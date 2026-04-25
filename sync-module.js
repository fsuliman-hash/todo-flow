// ==================== SYNC MODULE ====================
// Depends on: auth-module.js, supabase-config.js, app.js globals `R`, `sv`

class SyncManager {
  constructor() {
    this.syncing = false;
    this.lastSync = null;
    this.syncInterval = null;
    this.listeners = [];
  }

  onSyncChange(callback) {
    this.listeners.push(callback);
  }

  notifySyncListeners() {
    const payload = {
      syncing: this.syncing,
      lastSync: this.lastSync,
      status: this.getSyncStatus(),
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
    if (!this.lastSync) return 'never';
    const mins = Math.floor((Date.now() - this.lastSync) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return 'out of sync';
  }

  async syncToCloud() {
    if (!authManager.isAuthenticated() || typeof R === 'undefined' || !Array.isArray(R)) return;

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
        } catch {
          /* skip individual task failures; next sync can retry */
        }
      }

      this.lastSync = Date.now();
      localStorage.setItem('sync_last', this.lastSync.toString());
      this.notifySyncListeners();
    } catch {
      /* whole sync failure */
    } finally {
      this.syncing = false;
      this.notifySyncListeners();
    }
  }

  async syncFromCloud() {
    if (!authManager.isAuthenticated()) return;

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

      if (typeof sv === 'function') sv(false);
      this.lastSync = Date.now();
      localStorage.setItem('sync_last', this.lastSync.toString());
      this.notifySyncListeners();
    } catch {
      /* sync from cloud failed */
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
