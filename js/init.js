// INIT
(function todoFlowBoot(){
  try{
    load();
    syncViewportMode();
    render();
    startNotificationLoop();
    setTimeout(checkBriefing,500);
    setInterval(checkDueNowBanner,15000);
    setTimeout(checkDueNowBanner,2000);
    // Supabase email-confirm redirect: tokens in URL hash are consumed in supabase-config.js; auth-module refreshes profile and notifies sync.
    if(typeof wireTodoFlowProduction==='function')wireTodoFlowProduction();
  }catch(err){
    console.error(err);
    var el=document.getElementById("app");
    var msg=String(err&&err.message?err.message:err);
    var stack=String(err&&err.stack?err.stack:"");
    if(el)el.innerHTML='<div style="padding:24px;max-width:520px;margin:0 auto;font-family:system-ui,sans-serif;color:#0f172a;background:#fff"><h1 style="font-size:18px;margin-bottom:8px">Todo Flow could not start</h1><p style="font-size:14px;color:#64748b;margin-bottom:12px">Fix the error below, hard-refresh the page (Ctrl+Shift+R), or clear site data if a service worker is stuck.</p><pre style="font-size:12px;white-space:pre-wrap;word-break:break-word;background:#f1f5f9;padding:12px;border-radius:8px">'+esc(msg)+"\n\n"+esc(stack)+'</pre></div>';
  }
})();

