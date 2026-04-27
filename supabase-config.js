// ==================== SUPABASE CONFIG ====================
// Public Supabase URL + anon (publishable) key only — never put Claude or service_role keys here.
// When using `node server.js`, `/runtime-config.js` injects values from SUPABASE_URL + SUPABASE_ANON_KEY env.
// For static hosting, set window.__TF_SUPABASE_URL__ / __TF_SUPABASE_ANON_KEY__ before this script (see .env.example).
// (Do not declare UNSCHEDULED_SENTINEL_ISO here — app.js already defines it; duplicate const breaks classic script load order.)

/** Maps app reminder (camelCase) to PostgREST row for `tasks` table (see SUPABASE_SETUP.sql). */
function taskToRow(task, userId) {
  if (!task || !userId) return null;
  const dueRaw = task.dueDate && !task.unscheduled ? new Date(task.dueDate) : null;
  const hasValidDue = dueRaw && !Number.isNaN(dueRaw.getTime());
  const iso = hasValidDue ? dueRaw.toISOString() : null;
  let tm = '';
  if (hasValidDue) {
    const d = dueRaw;
    tm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }
  return {
    id: String(task.id || ''),
    user_id: userId,
    title: String(task.title || 'Untitled').slice(0, 4000),
    cat: String(task.category || 'personal').slice(0, 128),
    pri: String(task.priority || 'medium').slice(0, 64),
    dat: iso,
    done: !!task.completed,
    notes: String(task.notes || '').slice(0, 16000),
    rec: String(task.recurrence || 'none').slice(0, 64),
    tm,
    order_index: Number.isFinite(Number(task.order)) ? Number(task.order) : 0,
    updated_at: new Date().toISOString(),
  };
}

/** Maps DB row to app reminder shape (subset; normalizeAll() fills the rest). */
function rowToTask(row) {
  if (!row || !row.id) return null;
  const unscheduled = !row.dat;
  const noDateIso = '2099-12-31T23:59:00.000Z';
  const dueDate = unscheduled ? noDateIso : new Date(row.dat).toISOString();
  return {
    id: String(row.id),
    title: String(row.title || 'Untitled'),
    notes: String(row.notes || ''),
    dueDate,
    // Do not infer start date from due date.
    // Inferring this made many synced tasks look "future-start" and disappear from active views.
    startDate: '',
    category: String(row.cat || 'personal'),
    priority: String(row.pri || 'medium'),
    recurrence: String(row.rec || 'none'),
    completed: !!row.done,
    order: Number.isFinite(Number(row.order_index)) ? Number(row.order_index) : 0,
    createdAt: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
    unscheduled,
    alerts: ['15'],
    subtasks: [],
    tags: [],
    billable: false,
    effort: '',
    amount: 0,
    pinned: false,
    nag: false,
    bundle: '',
    childId: '',
    subject: '',
    grade: '',
    snoozeCount: 0,
  };
}

function tfAuthDebugEnabled() {
  return (
    typeof window !== 'undefined' &&
    (window.__TF_AUTH_DEBUG === true || String(localStorage.getItem('tf_auth_debug') || '') === '1')
  );
}

function tfAuthLog() {
  if (!tfAuthDebugEnabled()) return;
  const args = Array.prototype.slice.call(arguments);
  args.unshift('[TodoFlowAuth]');
  console.log.apply(console, args);
}

/** Parse JWT payload (no signature verify — same as typical SPA handling of own session JWT). */
function parseJwtPayload(accessToken) {
  try {
    const parts = String(accessToken || '').split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function stripAuthFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const u = new URL(window.location.href);
    if (u.hash && (u.hash.includes('access_token') || u.hash.includes('error'))) {
      u.hash = '';
      history.replaceState(null, document.title, u.pathname + u.search + u.hash);
      return;
    }
    if (u.searchParams.has('code')) {
      u.searchParams.delete('code');
      history.replaceState(null, document.title, u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash);
    }
  } catch {
    /* ignore */
  }
}

const TF_PW_RECOVERY_KEY = 'tf_password_recovery_pending';

class SupabaseClient {
  constructor() {
    this.url = '';
    this.key = '';
    this.authToken = null;
    this.user = null;
    this.pendingPasswordRecovery = false;
    this._hydrateFromStorage();
    this._hydrateRecoveryFlag();
  }

  _hydrateRecoveryFlag() {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TF_PW_RECOVERY_KEY) === '1') {
        this.pendingPasswordRecovery = true;
      }
    } catch {
      /* private mode */
    }
  }

  /** True after password-reset email link (#type=recovery) until new password is saved or sign-out. */
  needsPasswordRecovery() {
    return !!this.pendingPasswordRecovery;
  }

  setPasswordRecoveryPending(on) {
    this.pendingPasswordRecovery = !!on;
    try {
      if (typeof sessionStorage === 'undefined') return;
      if (on) sessionStorage.setItem(TF_PW_RECOVERY_KEY, '1');
      else sessionStorage.removeItem(TF_PW_RECOVERY_KEY);
    } catch {
      /* ignore */
    }
  }

  /**
   * After email confirmation, Supabase redirects to your Site URL with tokens in the hash, e.g.:
   * #access_token=...&refresh_token=...&type=signup
   * This must run before auth UI reads the session (call from applySupabaseRuntimeConfig).
   */
  consumeImplicitTokensFromUrl() {
    if (typeof window === 'undefined' || !this.url || !this.key) return false;
    const raw = window.location.hash || '';
    if (!raw || raw.length < 10) return false;
    const q = raw.startsWith('#') ? raw.slice(1) : raw;
    const params = new URLSearchParams(q);
    const err = params.get('error') || params.get('error_code');
    if (err) {
      tfAuthLog('Auth redirect error in URL hash', err, params.get('error_description'));
      stripAuthFromUrl();
      return false;
    }
    const access = params.get('access_token');
    if (!access) return false;
    const refresh = params.get('refresh_token') || '';
    const flowType = params.get('type') || '';
    if (flowType === 'recovery') {
      this.setPasswordRecoveryPending(true);
      tfAuthLog('Password recovery session from hash (type=recovery)');
    } else {
      this.setPasswordRecoveryPending(false);
    }
    tfAuthLog('Implicit / email-confirm tokens found in hash (type=', flowType || 'n/a', ')');
    this.authToken = access;
    localStorage.setItem('sb_auth_token', access);
    if (refresh) localStorage.setItem('sb_refresh_token', refresh);
    const payload = parseJwtPayload(access);
    const sub = payload && (payload.sub || payload.user_id);
    this.user = sub ? { id: String(sub), email: String(payload.email || '') } : null;
    if (this.user) localStorage.setItem('sb_user', JSON.stringify(this.user));
    stripAuthFromUrl();
    tfAuthLog('Session saved from hash; user id =', this.user && this.user.id);
    return true;
  }

  /** PKCE: redirect may use ?code=... — exchange for session (no code_verifier needed for this server-issued code path). */
  async exchangePkceCodeFromUrl() {
    if (typeof window === 'undefined' || !this.url || !this.key) return false;
    let code = '';
    try {
      code = new URL(window.location.href).searchParams.get('code') || '';
    } catch {
      return false;
    }
    if (!code) return false;
    var recoveryFromQuery = false;
    try {
      recoveryFromQuery = new URL(window.location.href).searchParams.get('type') === 'recovery';
    } catch {
      /* ignore */
    }
    tfAuthLog('PKCE ?code= present, exchanging for session…');
    const tryBodies = [{ auth_code: code }, { code: code }];
    for (let i = 0; i < tryBodies.length; i++) {
      const res = await fetch(`${this.url}/auth/v1/token?grant_type=pkce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: this.key },
        body: JSON.stringify(tryBodies[i]),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.access_token) {
        this.authToken = data.access_token;
        this.user = data.user || null;
        localStorage.setItem('sb_auth_token', this.authToken);
        if (data.refresh_token) localStorage.setItem('sb_refresh_token', data.refresh_token);
        if (this.user) localStorage.setItem('sb_user', JSON.stringify(this.user));
        if (recoveryFromQuery) this.setPasswordRecoveryPending(true);
        else this.setPasswordRecoveryPending(false);
        stripAuthFromUrl();
        tfAuthLog('PKCE exchange OK; user id =', this.user && this.user.id);
        return true;
      }
      tfAuthLog('PKCE attempt', i + 1, 'failed', res.status, data);
    }
    return false;
  }

  /** Optional: merge full profile from Auth API (fixes missing email in JWT-only path). */
  async refreshUserFromAuthApi() {
    if (!this.url || !this.key || !this.authToken) return;
    const res = await fetch(`${this.url}/auth/v1/user`, {
      headers: { apikey: this.key, Authorization: `Bearer ${this.authToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && data.id) {
      this.user = data;
      localStorage.setItem('sb_user', JSON.stringify(data));
      tfAuthLog('User profile loaded from /auth/v1/user');
    }
  }

  _hydrateFromStorage() {
    try {
      this.authToken = localStorage.getItem('sb_auth_token');
      const raw = localStorage.getItem('sb_user');
      this.user = this.authToken && raw ? JSON.parse(raw) : null;
    } catch {
      this.user = null;
    }
  }

  /** Call after runtime-config.js loaded or when URL changes. */
  configure(url, anonKey) {
    this.url = String(url || '').replace(/\/+$/, '');
    this.key = String(anonKey || '');
  }

  _baseHeaders() {
    const h = {
      'Content-Type': 'application/json',
      apikey: this.key,
    };
    if (this.authToken) h.Authorization = `Bearer ${this.authToken}`;
    return h;
  }

  /** Normalize GoTrue user update JSON (may include nested `user` or `session`). */
  _applyUserUpdateResponse(data) {
    if (!data || typeof data !== 'object') return;
    const u = data.user && data.user.id ? data.user : data.id ? data : null;
    if (u && u.id) {
      this.user = u;
      localStorage.setItem('sb_user', JSON.stringify(this.user));
    }
    const sess = data.session;
    if (sess && sess.access_token) {
      this.authToken = sess.access_token;
      localStorage.setItem('sb_auth_token', this.authToken);
      if (sess.refresh_token) localStorage.setItem('sb_refresh_token', sess.refresh_token);
    }
  }

  async request(method, endpoint, data = null, extraHeaders = {}) {
    if (!this.url || !this.key) {
      throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY on the server or window.__TF_* variables.');
    }
    const opts = {
      method,
      headers: { ...this._baseHeaders(), ...extraHeaders },
    };
    if (data !== null && data !== undefined) opts.body = JSON.stringify(data);

    const res = await fetch(`${this.url}/rest/v1${endpoint}`, opts);
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { message: text || `HTTP ${res.status}` };
    }

    if (!res.ok) {
      const msg =
        (parsed && (parsed.message || parsed.error_description || parsed.hint)) ||
        `HTTP ${res.status}`;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return parsed;
  }

  async signUp(email, password) {
    const res = await fetch(`${this.url}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.key },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.session?.access_token) {
      this.setPasswordRecoveryPending(false);
      this.authToken = data.session.access_token;
      this.user = data.user;
      localStorage.setItem('sb_auth_token', this.authToken);
      localStorage.setItem('sb_user', JSON.stringify(this.user || {}));
    }
    return { ok: res.ok, data, error: !res.ok ? data : null };
  }

  async signIn(email, password) {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.key },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.access_token) {
      this.setPasswordRecoveryPending(false);
      this.authToken = data.access_token;
      this.user = data.user;
      localStorage.setItem('sb_auth_token', this.authToken);
      localStorage.setItem('sb_user', JSON.stringify(this.user || {}));
    }
    return { ok: res.ok, data, error: !res.ok ? data : null };
  }

  /** Request password reset email (GoTrue `/auth/v1/recover`). */
  async resetPasswordForEmail(email, redirectTo) {
    if (!this.url || !this.key) {
      return { ok: false, data: null, error: { message: 'Supabase is not configured.' } };
    }
    const body = { email: String(email || '').trim() };
    if (redirectTo) body.redirect_to = String(redirectTo);
    const res = await fetch(`${this.url}/auth/v1/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.key },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data, error: !res.ok ? data : null };
  }

  async signOut() {
    this.setPasswordRecoveryPending(false);
    localStorage.removeItem('sb_auth_token');
    localStorage.removeItem('sb_refresh_token');
    localStorage.removeItem('sb_user');
    this.authToken = null;
    this.user = null;
  }

  /**
   * Set a new password for the current session (recovery or normal).
   * GoTrue: PUT /auth/v1/user with { password }.
   */
  async updatePassword(newPassword) {
    if (!this.url || !this.key || !this.authToken) {
      return { ok: false, data: null, error: { message: 'Not signed in.' } };
    }
    const pwd = String(newPassword || '');
    const res = await fetch(`${this.url}/auth/v1/user`, {
      method: 'PUT',
      headers: this._baseHeaders(),
      body: JSON.stringify({ password: pwd }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (res.ok) {
      this._applyUserUpdateResponse(data);
      this.setPasswordRecoveryPending(false);
      return { ok: true, data, error: null };
    }
    if (res.status === 405 || res.status === 404) {
      const res2 = await fetch(`${this.url}/auth/v1/user`, {
        method: 'PATCH',
        headers: this._baseHeaders(),
        body: JSON.stringify({ password: pwd }),
      });
      let data2 = {};
      try {
        data2 = await res2.json();
      } catch {
        data2 = {};
      }
      if (res2.ok) {
        this._applyUserUpdateResponse(data2);
        this.setPasswordRecoveryPending(false);
        return { ok: true, data: data2, error: null };
      }
      return { ok: false, data: null, error: data2 };
    }
    return { ok: false, data: null, error: data };
  }

  isAuthenticated() {
    return !!(this.authToken && this.user && this.user.id);
  }

  getUser() {
    return this.user;
  }

  async insertTask(task) {
    const row = taskToRow(task, this.user?.id);
    if (!row) throw new Error('Invalid task or user');
    return this.request('POST', '/tasks', row, { Prefer: 'return=minimal' });
  }

  async updateTask(id, task) {
    const row = taskToRow({ ...task, id }, this.user?.id);
    if (!row) throw new Error('Invalid task or user');
    const { id: _id, user_id, ...patch } = row;
    return this.request('PATCH', `/tasks?id=eq.${encodeURIComponent(id)}&user_id=eq.${this.user.id}`, patch, {
      Prefer: 'return=minimal',
    });
  }

  async deleteTask(id) {
    return this.request('DELETE', `/tasks?id=eq.${encodeURIComponent(id)}&user_id=eq.${this.user.id}`);
  }

  async getTasks() {
    const rows = await this.request('GET', `/tasks?user_id=eq.${this.user.id}&order=updated_at.desc`);
    if (!Array.isArray(rows)) return [];
    return rows.map(rowToTask).filter(Boolean);
  }

  async saveSync(syncData) {
    return this.request('POST', '/user_sync', {
      user_id: this.user.id,
      data: syncData,
      synced_at: new Date().toISOString(),
    });
  }

  async getLastSync() {
    try {
      const res = await this.request('GET', `/user_sync?user_id=eq.${this.user.id}&order=synced_at.desc&limit=1`);
      return res?.[0] || null;
    } catch {
      return null;
    }
  }
}

const supabase = new SupabaseClient();

function applySupabaseRuntimeConfig() {
  if (typeof window === 'undefined') return;
  const url = String(window.__TF_SUPABASE_URL__ || '').trim();
  const key = String(window.__TF_SUPABASE_ANON_KEY__ || '').trim();
  supabase.configure(url, key);
  supabase.consumeImplicitTokensFromUrl();
  supabase._hydrateFromStorage();
  supabase._hydrateRecoveryFlag();
}

applySupabaseRuntimeConfig();

if (typeof window !== 'undefined') {
  window.applyTodoFlowSupabaseConfig = applySupabaseRuntimeConfig;
  /** PKCE ?code= — runs after paint; auth-module listens for tf-auth-session-updated. */
  queueMicrotask(function () {
    supabase.exchangePkceCodeFromUrl().then(function (ok) {
      if (ok) {
        supabase.refreshUserFromAuthApi().finally(function () {
          try {
            window.dispatchEvent(new CustomEvent('tf-auth-session-updated'));
          } catch (_) {
            /* ignore */
          }
        });
      }
    });
  });
}
