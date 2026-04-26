// ==================== SYNC MODULE ====================
// Depends on: auth-module.js, supabase-config.js, app.js globals `R`, `sv`

class SyncManager {
  constructor() {
    this.syncing = false;
    this.lastSync = null;
    this.syncInterval = null;
    this.listeners = [];
    this.failCount = 0;
    this.nextRetryAt = 0;
    this.lastError = '';
  }

  onSyncChange(callback) {
    this.listeners.push(callback);
  }

  notifySyncListeners() {
    const payload = {
      syncing: this.syncing,
      lastSync: this.lastSync,
      status: this.getSyncStatus(),
      lastError: this.lastError,
      nextRetryAt: this.nextRetryAt,
    };
    this.listeners.forEach((cb) => {
      try {
        cb(payload);
      } catch {
        /* ignore listener errors */
      }
    });
  }

  getSyncStatus() {
    if (!authManager.isAuthenticated()) return 'offline';
    if (this.syncing) return 'syncing';
    if (this.nextRetryAt && Date.now() < this.nextRetryAt) {
      const waitSec = Math.max(1, Math.ceil((this.nextRetryAt - Date.now()) / 1000));
      return `retry in ${waitSec}s`;
    }
    if (!this.lastSync) return 'never';
    const mins = Math.floor((Date.now() - this.lastSync) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return 'out of sync';
  }

  _classifySyncError(err) {
    const msg = String((err && err.message) || err || '').toLowerCase();
    if (!msg) return { fatal: false, code: 'unknown', message: '' };
    if (msg.includes('failed to fetch') || msg.includes('cors') || msg.includes('network')) {
      return { fatal: true, code: 'network', message: msg };
    }
    if (msg.includes('401') || msg.includes('403') || msg.includes('jwt') || msg.includes('permission')) {
      return { fatal: true, code: 'auth', message: msg };
    }
    return { fatal: false, code: 'other', message: msg };
  }

  _registerSyncFailure(err) {
    const kind = this._classifySyncError(err);
    this.failCount = Math.min(this.failCount + 1, 10);
    // Exponential backoff: 15s, 30s, 60s, 120s ... max 10m
    const delayMs = Math.min(15000 * Math.pow(2, this.failCount - 1), 10 * 60 * 1000);
    this.nextRetryAt = Date.now() + delayMs;
    this.lastError = kind.code || 'sync-failed';
  }

  _registerSyncSuccess() {
    this.failCount = 0;
    this.nextRetryAt = 0;
    this.lastError = '';
  }

  _canAttemptSync() {
    return !this.nextRetryAt || Date.now() >= this.nextRetryAt;
  }

  async syncToCloud() {
    if (!authManager.isAuthenticated() || typeof R === 'undefined' || !Array.isArray(R)) return;
    if (!this._canAttemptSync()) return;

    this.syncing = true;
    this.notifySyncListeners();

    try {
      for (const task of R) {
        try {
          const existing = await supabase.request(
            'GET',
            `/tasks?id=eq.${encodeURIComponent(task.id)}&user_id=eq.${supabase.user.id}&select=id`
          );
          if (Array.isArray(existing) && existing.length > 0) {
            await supabase.updateTask(task.id, task);
          } else {
            await supabase.insertTask(task);
          }
        } catch (err) {
          const kind = this._classifySyncError(err);
          if (kind.fatal) throw err;
          /* skip non-fatal per-task failures; next sync can retry */
        }
      }

      // Also sync non-task modules that are device-local by default (e.g. shifts)
      // so the same signed-in user can see them on another device.
      if (typeof shifts !== 'undefined' && Array.isArray(shifts) && shifts.length > 0 && supabase.saveSync) {
        await supabase.saveSync({
          shifts: shifts
            .filter((s) => s && s.id && s.date)
            .slice(-1500)
            .map((s) => ({
              id: String(s.id),
              date: String(s.date || ''),
              type: String(s.type || ''),
              start: String(s.start || ''),
              end: String(s.end || ''),
              notes: String(s.notes || ''),
              onCall: !!s.onCall,
              clientId: String(s.clientId || ''),
            })),
          savedAt: new Date().toISOString(),
        });
      }

      this.lastSync = Date.now();
      localStorage.setItem('sync_last', this.lastSync.toString());
      this._registerSyncSuccess();
      this.notifySyncListeners();
    } catch (err) {
      this._registerSyncFailure(err);
    } finally {
      this.syncing = false;
      this.notifySyncListeners();
    }
  }

  async syncFromCloud() {
    if (!authManager.isAuthenticated()) return;
    if (!this._canAttemptSync()) return;

    this.syncing = true;
    this.notifySyncListeners();

    try {
      const cloudTasks = await supabase.getTasks();

      for (const cloudTask of cloudTasks) {
        if (!cloudTask || !cloudTask.id) continue;
        const localIndex = R.findIndex((t) => t.id === cloudTask.id);
        if (localIndex >= 0) {
          const local = R[localIndex];
          const cloudTs = cloudTask.updated_at ? new Date(cloudTask.updated_at).getTime() : 0;
          const localTs = local.updated_at ? new Date(local.updated_at).getTime() : new Date(local.createdAt || 0).getTime();
          if (cloudTs > localTs) {
            R[localIndex] = {
              ...local,
              ...cloudTask,
              subtasks: Array.isArray(local.subtasks) && local.subtasks.length ? local.subtasks : cloudTask.subtasks || [],
              tags: Array.isArray(local.tags) && local.tags.length ? local.tags : cloudTask.tags || [],
            };
          }
        } else {
          R.push(cloudTask);
        }
      }

      // Pull shift snapshot from user_sync and merge by id.
      if (supabase.getLastSync && typeof shifts !== 'undefined' && Array.isArray(shifts)) {
        const last = await supabase.getLastSync();
        const cloudShiftList = Array.isArray(last?.data?.shifts) ? last.data.shifts : [];
        if (cloudShiftList.length > 0) {
          const localMap = new Map(
            shifts
              .filter((s) => s && s.id)
              .map((s) => [String(s.id), s])
          );
          cloudShiftList.forEach((s) => {
            if (!s || !s.id || !s.date) return;
            const sid = String(s.id);
            localMap.set(sid, {
              id: sid,
              date: String(s.date || ''),
              type: String(s.type || 'Shift'),
              start: String(s.start || ''),
              end: String(s.end || ''),
              notes: String(s.notes || ''),
              onCall: !!s.onCall,
              clientId: String(s.clientId || ''),
            });
          });
          shifts = Array.from(localMap.values()).sort((a, b) => {
            const da = String(a?.date || '');
            const db = String(b?.date || '');
            if (da !== db) return da.localeCompare(db);
            const sa = String(a?.start || '');
            const sb = String(b?.start || '');
            if (sa !== sb) return sa.localeCompare(sb);
            return String(a?.id || '').localeCompare(String(b?.id || ''));
          });
        }
      }

      if (typeof sv === 'function') sv(false);
      this.lastSync = Date.now();
      localStorage.setItem('sync_last', this.lastSync.toString());
      this._registerSyncSuccess();
      this.notifySyncListeners();
    } catch (err) {
      this._registerSyncFailure(err);
    } finally {
      this.syncing = false;
      this.notifySyncListeners();
    }
  }

  async fullSync() {
    if (!authManager.isAuthenticated()) return;
    await this.syncToCloud();
    await this.syncFromCloud();
  }

  startAutoSync() {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      if (authManager.isAuthenticated()) {
        this.fullSync().catch(() => {});
      }
    }, 30000);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  getLastSyncTime() {
    return this.lastSync;
  }

  async manualSync() {
    await this.fullSync();
  }
}

const syncManager = new SyncManager();

syncManager.lastSync = parseInt(localStorage.getItem('sync_last') || '0', 10) || null;
