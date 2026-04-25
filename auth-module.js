// ==================== AUTH MODULE ====================
// Depends on: supabase-config.js (global `supabase`)
// Email confirmation: Supabase redirects with #access_token=… in the URL; supabase-config consumes it on load.
// Debug: localStorage.setItem('tf_auth_debug','1') or window.__TF_AUTH_DEBUG = true (no tokens logged).

function authDebugEnabled() {
  return (
    typeof window !== 'undefined' &&
    (window.__TF_AUTH_DEBUG === true || String(localStorage.getItem('tf_auth_debug') || '') === '1')
  );
}

function authDebugLog() {
  if (!authDebugEnabled()) return;
  const a = Array.prototype.slice.call(arguments);
  a.unshift('[TodoFlowAuth]');
  console.log.apply(console, a);
}

class AuthManager {
  constructor() {
    this.user = supabase.getUser();
    this.listeners = [];
    authDebugLog('AuthManager init', {
      authed: !!(this.user && this.user.id),
      userId: this.user && this.user.id,
    });
  }

  onAuthChange(callback) {
    this.listeners.push(callback);
    callback(this.user);
  }

  notifyListeners() {
    authDebugLog('notifyListeners', this.user && this.user.id);
    this.listeners.forEach((cb) => cb(this.user));
  }

  _formatError(error) {
    if (!error || typeof error !== 'object') return 'Request failed';
    const code = error.error_code || error.code;
    const base =
      error.message ||
      error.msg ||
      error.error_description ||
      (Array.isArray(error.errors) ? error.errors.map((e) => e?.message).filter(Boolean).join('; ') : '') ||
      '';
    const msg = base || 'Request failed';
    if (code) return msg + (String(msg).indexOf(String(code)) === -1 ? ' (' + code + ')' : '');
    return msg;
  }

  async signUp(email, password) {
    try {
      authDebugLog('signUp request', email);
      const { ok, error } = await supabase.signUp(email, password);
      if (ok) {
        this.user = supabase.getUser();
        this.notifyListeners();
        authDebugLog('signUp ok', { hasUser: !!this.user, needsConfirm: !this.user });
        if (!this.user) {
          return {
            success: true,
            needsEmailConfirm: true,
            message: 'Check your email to confirm your account, then sign in.',
          };
        }
        return { success: true };
      }
      authDebugLog('signUp failed', error);
      return { success: false, error: this._formatError(error) };
    } catch (err) {
      authDebugLog('signUp exception', err);
      return { success: false, error: err?.message || 'Sign up failed' };
    }
  }

  async signIn(email, password) {
    try {
      authDebugLog('signIn request', email);
      const { ok, error } = await supabase.signIn(email, password);
      if (ok) {
        this.user = supabase.getUser();
        this.notifyListeners();
        authDebugLog('signIn ok', this.user && this.user.id);
        if (typeof syncManager !== 'undefined' && syncManager.syncFromCloud) {
          await syncManager.syncFromCloud();
        }
        return { success: true };
      }
      authDebugLog('signIn failed', error);
      return { success: false, error: this._formatError(error) };
    } catch (err) {
      authDebugLog('signIn exception', err);
      return { success: false, error: err?.message || 'Sign in failed' };
    }
  }

  async signOut() {
    try {
      await supabase.signOut();
      this.user = null;
      this.notifyListeners();
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || 'Sign out failed' };
    }
  }

  async resetPasswordForEmail(email) {
    try {
      authDebugLog('resetPasswordForEmail request', email);
      let redirectTo = '';
      if (typeof window !== 'undefined' && window.location) {
        redirectTo = window.location.origin + window.location.pathname + window.location.search;
      }
      const { ok, error } = await supabase.resetPasswordForEmail(email, redirectTo || undefined);
      if (ok) {
        authDebugLog('resetPasswordForEmail ok');
        return { success: true, message: 'Check your email for a reset link.' };
      }
      authDebugLog('resetPasswordForEmail failed', error);
      return { success: false, error: this._formatError(error) };
    } catch (err) {
      authDebugLog('resetPasswordForEmail exception', err);
      return { success: false, error: err?.message || 'Could not send reset email' };
    }
  }

  isAuthenticated() {
    return supabase.isAuthenticated();
  }

  getUser() {
    return this.user;
  }

  needsPasswordRecovery() {
    return typeof supabase.needsPasswordRecovery === 'function' && supabase.needsPasswordRecovery();
  }

  async updatePassword(newPassword) {
    try {
      authDebugLog('updatePassword');
      const { ok, error } = await supabase.updatePassword(newPassword);
      if (ok) {
        this.user = supabase.getUser();
        this.notifyListeners();
        authDebugLog('updatePassword ok');
        try {
          window.dispatchEvent(new CustomEvent('tf-auth-session-updated'));
        } catch (_) {
          /* ignore */
        }
        if (typeof syncManager !== 'undefined' && syncManager.syncFromCloud) {
          await syncManager.syncFromCloud();
        }
        return { success: true };
      }
      authDebugLog('updatePassword failed', error);
      return { success: false, error: this._formatError(error) };
    } catch (err) {
      authDebugLog('updatePassword exception', err);
      return { success: false, error: err?.message || 'Could not update password' };
    }
  }

  async signInWithGoogle() {
    return { success: false, error: 'Google sign-in is not configured for this build.' };
  }
}

const authManager = new AuthManager();

if (supabase.isAuthenticated()) {
  authManager.user = supabase.getUser();
}

if (typeof window !== 'undefined') {
  window.addEventListener('tf-auth-session-updated', function () {
    authManager.user = supabase.getUser();
    authDebugLog('tf-auth-session-updated', authManager.user && authManager.user.id);
    authManager.notifyListeners();
    if (typeof render === 'function') {
      try {
        render();
      } catch (e) {
        authDebugLog('render after session event failed', e);
      }
    }
  });

  /** After email-confirm hash / stored session: fill full user from Auth API (PKCE path dispatches same event). */
  if (supabase.isAuthenticated()) {
    supabase.refreshUserFromAuthApi().then(function () {
      authManager.user = supabase.getUser();
      authDebugLog('refreshUserFromAuthApi after boot', authManager.user && authManager.user.id);
      authManager.notifyListeners();
      if (typeof render === 'function') {
        try {
          render();
        } catch (e) {
          authDebugLog('render after profile refresh failed', e);
        }
      }
    });
  }
}
