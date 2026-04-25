/* Todo Flow public runtime (no secrets except Supabase anon — protect with RLS).
   When using `node server.js`, this file is overridden by env-based `/runtime-config.js`.
   For static hosts, replace placeholders or inject via your host's env → snippet. */
(function () {
  if (typeof window === 'undefined') return;
  window.__TF_SUPABASE_URL__ = window.__TF_SUPABASE_URL__ || 'https://qwaguurkplfdgvfnlabg.supabase.co';
  window.__TF_SUPABASE_ANON_KEY__ = window.__TF_SUPABASE_ANON_KEY__ || 'sb_publishable_ESoLTSC9n7ctsvvDS5UYFA_QOA7e2hg';
  window.__TF_API_BASE__ = window.__TF_API_BASE__ || '';
})();
