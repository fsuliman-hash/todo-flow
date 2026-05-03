function initPullToRefresh(){
  if(!('ontouchstart' in window))return;
  var el=document.getElementById('ptr');
  if(!el)return;
  var label=el.querySelector('.ptr-label');
  var icon=el.querySelector('.ptr-icon');
  var startY=0,pulling=false,farEnough=false;
  document.addEventListener('touchstart',function(e){
    if(window.scrollY>4)return;
    startY=e.touches[0].clientY;
    pulling=true;farEnough=false;
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!pulling)return;
    var dy=e.touches[0].clientY-startY;
    if(dy<16){el.classList.remove('ptr-visible');farEnough=false;return;}
    el.classList.add('ptr-visible');
    if(dy>80){farEnough=true;label.textContent='Release to refresh';icon.textContent='↑';}
    else{farEnough=false;label.textContent='Pull to refresh';icon.textContent='↓';}
  },{passive:true});
  document.addEventListener('touchend',function(){
    if(!pulling)return;
    pulling=false;
    if(farEnough){
      label.textContent='Refreshing…';icon.textContent='⟳';
      el.classList.add('ptr-refreshing');
      setTimeout(function(){
        try{load();render();}catch(err){console.warn('[ptr]',err);}
        el.classList.remove('ptr-visible','ptr-refreshing');
        label.textContent='Pull to refresh';icon.textContent='↓';
      },500);
    }else{
      el.classList.remove('ptr-visible');
    }
  },{passive:true});
}

// INIT
(function todoFlowBoot(){
  try{
    load();
    syncViewportMode();
    render();
    startNotificationLoop();
    initPullToRefresh();
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

