/**
 * Todo Flow production wiring: Supabase auth listener, sync badge, auth modal, global actions.
 * Loads after app.js so globals R, sv, render, esc, showToast exist.
 */
(function () {
  function wireTodoFlowSync() {
    if (typeof authManager === 'undefined' || typeof syncManager === 'undefined') return;
    if (window.__tfSyncWired) return;
    window.__tfSyncWired = true;

    authManager.onAuthChange(function (user) {
      if (user) {
        syncManager.startAutoSync();
        syncManager.fullSync().catch(function () {});
      } else {
        syncManager.stopAutoSync();
      }
    });
  }

  function updateSyncUi() {
    var pill = document.getElementById('tf-global-sync-pill');
    if (pill && typeof syncManager !== 'undefined') {
      var syncing = syncManager.syncing;
      var authed = typeof authManager !== 'undefined' && authManager.isAuthenticated();
      var status = authed ? syncManager.getSyncStatus() : 'offline';
      pill.textContent = syncing ? 'Syncing…' : 'Cloud: ' + status;
      pill.style.opacity = syncing ? '1' : '0.92';
      pill.style.background = syncing ? 'var(--amber)' : 'var(--bg2)';
    }
    var st = document.getElementById('tf-settings-sync-status');
    if (
      st &&
      typeof authManager !== 'undefined' &&
      typeof syncManager !== 'undefined' &&
      authManager.isAuthenticated()
    ) {
      st.textContent = 'Cloud: ' + syncManager.getSyncStatus();
    }
  }

  function initSyncPill() {
    if (document.getElementById('tf-global-sync-pill')) return;
    var pill = document.createElement('button');
    pill.type = 'button';
    pill.id = 'tf-global-sync-pill';
    pill.title = 'Sync status — tap to sync now if signed in';
    pill.style.cssText =
      'position:fixed;top:18px;left:12px;z-index:85;max-width:min(52vw,200px);padding:6px 10px;border-radius:999px;border:1px solid var(--border);background:var(--bg2);color:var(--text2);font-size:11px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    pill.onclick = function () {
      if (typeof authManager !== 'undefined' && !authManager.isAuthenticated()) {
        if (typeof openTodoFlowAuthModal === 'function') openTodoFlowAuthModal();
        return;
      }
      tfManualSyncClick();
    };
    document.body.appendChild(pill);
    updateSyncUi();
    if (typeof syncManager !== 'undefined') {
      syncManager.onSyncChange(updateSyncUi);
    }
  }

  window.tfManualSyncClick = function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) {
      if (typeof showToast === 'function') showToast('Sign in first to sync.', 3500);
      return;
    }
    var btn = document.getElementById('tf-btn-sync-now');
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.6';
    }
    syncManager
      .manualSync()
      .then(function () {
        if (typeof showToast === 'function') showToast('Sync complete', 2500);
        if (typeof render === 'function') render();
      })
      .catch(function () {
        if (typeof showToast === 'function') showToast('Sync failed — check connection and Supabase config.', 5000);
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
        }
        updateSyncUi();
      });
  };

  window.tfSignOutClick = function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    authManager.signOut().then(function (r) {
      if (r.success) {
        if (typeof showToast === 'function') showToast('Signed out', 2500);
        if (typeof render === 'function') render();
      } else if (typeof showToast === 'function') showToast(r.error || 'Sign out failed', 4000);
    });
  };

  function closeTodoFlowAuthModal() {
    var m = document.getElementById('tf-auth-modal');
    if (m) m.remove();
  }

  function closePasswordRecoveryModal() {
    var m = document.getElementById('tf-password-recovery-modal');
    if (m) m.remove();
  }

  function passwordMeetsPolicy(p) {
    if (!p || p.length < 8) return 'Use at least 8 characters.';
    if (!/[A-Z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9]/.test(p)) {
      return 'Password needs uppercase, number, and symbol.';
    }
    return '';
  }

  window.openTodoFlowPasswordRecoveryModal = function () {
    if (document.getElementById('tf-password-recovery-modal')) return;
    // Recovery links can land before authManager has a hydrated user object.
    // If Supabase marked recovery pending, allow the modal to open.
    if (typeof authManager === 'undefined' || typeof supabase === 'undefined') return;
    var canOpen =
      (typeof authManager.isAuthenticated === 'function' && authManager.isAuthenticated()) ||
      (typeof supabase.needsPasswordRecovery === 'function' && supabase.needsPasswordRecovery());
    if (!canOpen) return;

    var ov = document.createElement('div');
    ov.className = 'mo';
    ov.id = 'tf-password-recovery-modal';
    ov.style.zIndex = '120';
    ov.onclick = function () {
      /* Backdrop does not dismiss — complete reset or sign out */
    };
    var emailPart = '';
    try {
      var u = authManager.getUser();
      if (u && u.email) {
        var em = typeof esc === 'function' ? esc(String(u.email)) : String(u.email).replace(/[<>&"']/g, '');
        emailPart =
          '<p class="sdesc" style="margin-bottom:12px">Signed in as <b>' +
          em +
          '</b>. Choose a new password below.</p>';
      }
    } catch (e0) {
      /* ignore */
    }
    ov.innerHTML =
      '<div class="mo-in" onclick="event.stopPropagation()" style="max-width:420px">' +
      '<div class="mo-h"></div><h3>Set a new password</h3>' +
      emailPart +
      '<p class="sdesc" style="margin-bottom:12px">You opened the app from a password-reset link. Save a new password here, then use it to sign in on any device.</p>' +
      '<div class="flbl">New password</div>' +
      '<input type="password" id="tf-pw-new" class="finp" autocomplete="new-password" placeholder="••••••••" style="margin-bottom:10px">' +
      '<div class="flbl">Confirm new password</div>' +
      '<input type="password" id="tf-pw-confirm" class="finp" autocomplete="new-password" placeholder="••••••••" style="margin-bottom:12px">' +
      '<p class="sdesc" id="tf-pw-err" style="color:var(--red);min-height:1.2em;margin-bottom:10px"></p>' +
      '<div class="safe-row">' +
      '<button type="button" class="sbtn" id="tf-pw-save">Save new password</button>' +
      '<button type="button" class="xbtn" id="tf-pw-signout">Sign out</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    var inpNew = document.getElementById('tf-pw-new');
    if (inpNew) inpNew.focus();

    function setPwErr(t) {
      var el = document.getElementById('tf-pw-err');
      if (el) el.textContent = t || '';
    }

    document.getElementById('tf-pw-save').onclick = function () {
      var a = document.getElementById('tf-pw-new').value || '';
      var b = document.getElementById('tf-pw-confirm').value || '';
      setPwErr('');
      var pol = passwordMeetsPolicy(a);
      if (pol) {
        setPwErr(pol);
        return;
      }
      if (a !== b) {
        setPwErr('Passwords do not match.');
        return;
      }
      var btn = document.getElementById('tf-pw-save');
      var so = document.getElementById('tf-pw-signout');
      btn.disabled = true;
      so.disabled = true;
      btn.style.opacity = '0.6';
      authManager
        .updatePassword(a)
        .then(function (r) {
          btn.disabled = false;
          so.disabled = false;
          btn.style.opacity = '1';
          if (r.success) {
            closePasswordRecoveryModal();
            if (typeof showToast === 'function') showToast('Password updated — you are signed in.', 4000);
            if (typeof render === 'function') render();
          } else setPwErr(r.error || 'Update failed. Open the reset link again if this session expired.');
        })
        .catch(function (e) {
          btn.disabled = false;
          so.disabled = false;
          btn.style.opacity = '1';
          setPwErr((e && e.message) || 'Update failed. Open the reset link again if this session expired.');
        });
    };

    document.getElementById('tf-pw-signout').onclick = function () {
      authManager.signOut().then(function (r) {
        closePasswordRecoveryModal();
        if (r.success && typeof showToast === 'function') showToast('Signed out', 2500);
        if (typeof render === 'function') render();
      });
    };
  };

  window.openTodoFlowAuthModal = function () {
    if (document.getElementById('tf-password-recovery-modal')) return;
    if (document.getElementById('tf-auth-modal')) return;
    var ov = document.createElement('div');
    ov.className = 'mo';
    ov.id = 'tf-auth-modal';
    ov.onclick = function (e) {
      if (e.target === ov) closeTodoFlowAuthModal();
    };
    ov.innerHTML =
      '<div class="mo-in" onclick="event.stopPropagation()" style="max-width:400px">' +
      '<div class="mo-h"></div><h3>Sign in to sync</h3>' +
      '<p class="sdesc" style="margin-bottom:12px">Use the same email and password as your Supabase project. Your tasks stay on this device and copy to the cloud after login.</p>' +
      '<div class="flbl">Email</div>' +
      '<input type="email" id="tf-auth-email" class="finp" autocomplete="username" placeholder="you@example.com" style="margin-bottom:10px">' +
      '<div class="flbl">Password</div>' +
      '<input type="password" id="tf-auth-password" class="finp" autocomplete="current-password" placeholder="••••••••" style="margin-bottom:8px">' +
      '<div style="text-align:right;margin-bottom:10px">' +
      '<button type="button" class="xbtn" id="tf-auth-forgot" style="font-size:12px;padding:6px 10px;font-weight:600">Forgot password?</button>' +
      '</div>' +
      '<p class="sdesc" id="tf-auth-error" style="color:var(--red);min-height:1.2em;margin-bottom:8px"></p>' +
      '<div class="safe-row">' +
      '<button type="button" class="sbtn" id="tf-auth-signin">Sign in</button>' +
      '<button type="button" class="xbtn" id="tf-auth-signup">Create account</button>' +
      '<button type="button" class="xbtn" onclick="document.getElementById(\'tf-auth-modal\').remove()">Cancel</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    document.getElementById('tf-auth-email').focus();

    function setErr(t) {
      var el = document.getElementById('tf-auth-error');
      if (el) el.textContent = t || '';
    }

    function busy(on) {
      ['tf-auth-signin', 'tf-auth-signup', 'tf-auth-forgot'].forEach(function (id) {
        var b = document.getElementById(id);
        if (b) {
          b.disabled = !!on;
          b.style.opacity = on ? '0.6' : '1';
        }
      });
    }

    document.getElementById('tf-auth-signin').onclick = function () {
      var email = (document.getElementById('tf-auth-email').value || '').trim();
      var password = document.getElementById('tf-auth-password').value || '';
      setErr('');
      if (!email || !password) {
        setErr('Enter email and password.');
        return;
      }
      busy(true);
      authManager
        .signIn(email, password)
        .then(function (r) {
          busy(false);
          if (r.success) {
            closeTodoFlowAuthModal();
            if (typeof showToast === 'function') showToast('Signed in — syncing…', 3000);
            if (typeof render === 'function') render();
          } else setErr(r.error || 'Sign in failed');
        })
        .catch(function (e) {
          busy(false);
          setErr((e && e.message) || 'Sign in failed');
        });
    };

    document.getElementById('tf-auth-forgot').onclick = function () {
      var email = (document.getElementById('tf-auth-email').value || '').trim();
      setErr('');
      if (!email) {
        setErr('Enter your email address first.');
        return;
      }
      busy(true);
      authManager
        .resetPasswordForEmail(email)
        .then(function (r) {
          busy(false);
          if (r.success) {
            if (typeof showToast === 'function') showToast(r.message || 'Check your email for a reset link.', 5000);
            setErr('');
          } else setErr(r.error || 'Could not send reset email.');
        })
        .catch(function (e) {
          busy(false);
          setErr((e && e.message) || 'Could not send reset email.');
        });
    };

    document.getElementById('tf-auth-signup').onclick = function () {
      var email = (document.getElementById('tf-auth-email').value || '').trim();
      var password = document.getElementById('tf-auth-password').value || '';
      setErr('');
      if (!email || password.length < 8) {
        setErr('Use a password with at least 8 characters.');
        return;
      }
      if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        setErr('Password needs uppercase, number, and symbol (Supabase-safe).');
        return;
      }
      busy(true);
      authManager
        .signUp(email, password)
        .then(function (r) {
          busy(false);
          if (r.success) {
            if (r.needsEmailConfirm) setErr(r.message || 'Check your email to confirm.');
            else {
              closeTodoFlowAuthModal();
              if (typeof showToast === 'function') showToast('Account ready — syncing…', 3000);
              if (typeof render === 'function') render();
            }
          } else setErr(r.error || 'Sign up failed');
        })
        .catch(function (e) {
          busy(false);
          setErr((e && e.message) || 'Sign up failed');
        });
    };
  };

  window.wireTodoFlowProduction = function () {
    wireTodoFlowSync();
    initSyncPill();
    updateSyncUi();
    if (!window.__tfAuthSessionSyncUi) {
      window.__tfAuthSessionSyncUi = true;
      window.addEventListener('tf-auth-session-updated', updateSyncUi);
    }
    setTimeout(function () {
      if (typeof supabase !== 'undefined' && supabase.needsPasswordRecovery()) {
        if (typeof openTodoFlowPasswordRecoveryModal === 'function') openTodoFlowPasswordRecoveryModal();
      }
    }, 0);
    if (!window.__tfPwRecoveryAfterSession) {
      window.__tfPwRecoveryAfterSession = true;
      window.addEventListener('tf-auth-session-updated', function () {
        setTimeout(function () {
          if (typeof supabase !== 'undefined' && supabase.needsPasswordRecovery()) {
            if (typeof openTodoFlowPasswordRecoveryModal === 'function') openTodoFlowPasswordRecoveryModal();
          }
        }, 0);
      });
    }
  };

  // app.js may run before this file is loaded, so production wiring can be missed.
  // Auto-wire on next tick and after DOM ready; function is idempotent.
  setTimeout(function () {
    if (typeof window.wireTodoFlowProduction === 'function') window.wireTodoFlowProduction();
  }, 0);
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof window.wireTodoFlowProduction === 'function') window.wireTodoFlowProduction();
    });
  }
})();
