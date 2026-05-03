// ==================== WHAT SHOULD I DO NOW? ====================

// ==================== BILL FORECAST ====================

// ==================== WATER INTAKE ====================
function rWater(){
  let h=rHdr("Water Intake","Stay hydrated");
  const today=fmtLD(new Date()),glasses=waterLog[today]||0,goal=8;
  h+=`<div style="padding:14px;text-align:center">`;
  h+=`<div style="font-size:64px;margin:10px 0">💧</div>`;
  h+=`<div style="font-size:48px;font-weight:900;color:${glasses>=goal?"var(--green)":"var(--accent)"}">${glasses}/${goal}</div>`;
  h+=`<div style="font-size:14px;color:var(--text2);margin-bottom:20px">glasses today</div>`;
  // Visual glasses
  h+=`<div style="display:flex;justify-content:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">`;
  for(let i=1;i<=goal;i++){
    h+=`<div style="width:36px;height:44px;border-radius:6px;border:2px solid ${i<=glasses?"var(--accent)":"var(--border)"};background:${i<=glasses?"var(--accent)":"var(--card)"};display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .2s">${i<=glasses?"💧":"  "}</div>`;
  }
  h+=`</div>`;
  h+=`<div style="display:flex;gap:10px;justify-content:center;margin-bottom:20px"><button class="sbtn" style="width:auto;padding:14px 28px;background:var(--accent)" onclick="addWater(1)">+ 1 Glass</button><button class="sbtn" style="width:auto;padding:14px 28px;background:var(--bg3);color:var(--text2)" onclick="addWater(-1)">- 1</button></div>`;
  // History
  const days=[];for(let i=1;i<=7;i++){const d=new Date();d.setDate(d.getDate()-i);days.push(d)}
  h+=`<h4 style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px">LAST 7 DAYS</h4>`;
  h+=`<div style="display:flex;gap:6px;justify-content:center">`;
  days.reverse().forEach(d=>{
    const k=fmtLD(d),g=waterLog[k]||0;
    h+=`<div style="text-align:center"><div style="font-size:10px;color:var(--text3);font-weight:600">${d.toLocaleDateString([],{weekday:"narrow"})}</div><div style="font-size:14px;font-weight:800;color:${g>=goal?"var(--green)":g>0?"var(--accent)":"var(--text3)"}">${g}</div></div>`;
  });
  h+=`</div></div>`;return h;
}
function addWater(n){
  const today=fmtLD(new Date());
  waterLog[today]=Math.max(0,(waterLog[today]||0)+n);
  sv();render();
}

// ==================== DISPATCH LOG ====================
function openDispatchForm(){
  const ov=document.createElement("div");ov.className="mo";ov.id="dispM";ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>📞 New Dispatch</h3>
    <div class="flbl">Caller Name</div><input class="finp" id="dCaller" placeholder="John Smith">
    <div class="flbl">Service Address</div><input class="finp" id="dAddr" placeholder="123 Main St, Ottawa">
    <div class="flbl">Severity</div><div class="cgrid" id="dSev"></div>
    <div class="flbl">Notes</div><textarea class="finp" id="dNotes" placeholder="Issue description..."></textarea>
    <div style="display:flex;gap:8px;margin-top:8px"><label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px"><input type="checkbox" id="dCreateTask"> Create follow-up reminder</label></div>
    <button class="sbtn" onclick="saveDispatch()" style="margin-top:12px">Save</button></div>`;
  document.body.appendChild(ov);
  window._dSev="standard";renderDispSev();
  setTimeout(()=>document.getElementById("dCaller")?.focus(),100);
}
function renderDispSev(){
  const g=document.getElementById("dSev");if(!g)return;
  g.innerHTML=[{k:"standard",l:"Standard",c:"var(--green)"},{k:"urgent",l:"Urgent",c:"var(--orange)"},{k:"emergency",l:"Emergency",c:"var(--red)"}].map(s=>`<button class="cbtn${window._dSev===s.k?" active":""}" style="--c:${s.c}" onclick="window._dSev='${s.k}';renderDispSev()">${s.l}</button>`).join("");
}

// ==================== TRASH ====================
function rTrash(){
  let h=rHdr("Trash","Deleted items (last 50)");
  h+=`<div style="padding:10px 14px">`;
  if(trash.length){
    h+=`<button class="xbtn" style="margin-bottom:10px;background:var(--red);color:#fff;border:none" onclick="if(confirm('Empty trash permanently?')){trash=[];sv();render()}">🗑 Empty Trash</button>`;
    trash.slice().reverse().forEach(r=>{
      h+=`<div class="card" style="opacity:.7;margin-bottom:6px"><div class="crow"><div class="cbody"><div class="ctitle">${esc(r.title)}</div><div style="font-size:10px;color:var(--text3)">Deleted ${r.deletedAt?new Date(r.deletedAt).toLocaleDateString():""}</div></div><button class="cact" style="background:var(--green);color:#fff" onclick="restoreTrash('${r.id}')">↩</button></div></div>`;
    });
  }else h+=`<div class="empty"><div class="empty-i">🗑</div><div class="empty-t">Trash is empty</div></div>`;
  h+=`</div>`;return h;
}
function restoreTrash(id){
  const idx=trash.findIndex(x=>x.id===id);
  if(idx<0)return;
  const r=trash.splice(idx,1)[0];
  delete r.deletedAt;r.completed=false;
  R.push(r);sv();render();showToast("Restored!");
}

// ==================== UNDO & TOAST ====================
let _undoCallback=null;
function showUndo(id){
  _undoCallback=()=>{restoreTrash(id)};
  showToast("Deleted","Undo");
}
function showToast(msg,actionLabel){
  const existing=document.getElementById("toast");if(existing)existing.remove();
  const t=document.createElement("div");t.id="toast";
  t.style.cssText="position:fixed;bottom:calc(96px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);max-width:min(92vw,420px);background:var(--text);color:var(--bg);padding:10px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:200;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:'DM Sans',sans-serif";
  t.innerHTML=`<span>${msg}</span>${actionLabel?`<button style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:4px 12px;font-weight:700;font-size:12px;cursor:pointer" onclick="document.getElementById('toast').remove();if(_undoCallback)_undoCallback()">${actionLabel}</button>`:""}`;
  document.body.appendChild(t);
  setTimeout(()=>{const el=document.getElementById("toast");if(el)el.remove()},4000);
}

// ==================== COPY SHIFT ====================
function copyShift(fromDate){
  const dayShifts=getShiftsForDate(fromDate);if(!dayShifts.length)return;
  openRecordModal({title:'Copy shifts',subtitle:`Copy ${dayShifts.length} shift${dayShifts.length===1?'':'s'} from ${fromDate} to another date.`,fields:[{name:'toDate',label:'Copy to date',type:'date',value:fromDate,required:true}],onSubmit:(vals)=>{const toDate=vals.toDate||'';if(!/^\d{4}-\d{2}-\d{2}$/.test(toDate)){showToast('Choose a valid date');return false;}dayShifts.forEach(s=>shifts.push({...s,id:gid(),date:toDate}));sv();render();showToast(dayShifts.length===1?'Shift copied!':`${dayShifts.length} shifts copied!`);return true;}});
}

// ==================== OVERTIME CALCULATOR ====================
function calcOvertime(){
  const now=new Date(),weekStart=new Date(now);
  weekStart.setDate(weekStart.getDate()-weekStart.getDay());weekStart.setHours(0,0,0,0);
  const weekEnd=new Date(weekStart);weekEnd.setDate(weekEnd.getDate()+7);
  let totalMins=0;
  shifts.forEach(s=>{
    const sd=new Date(s.date+"T00:00:00");
    if(sd>=weekStart&&sd<weekEnd){
      totalMins+=getShiftMinutes(s);
    }
  });
  const regMins=40*60;
  const otMins=Math.max(0,totalMins-regMins);
  return{total:totalMins,regular:Math.min(totalMins,regMins),overtime:otMins};
}

// ==================== END OF DAY REVIEW ====================
function openEndOfDay(){
  const today=new Date().toDateString();
  const todayDone=R.filter(r=>r.completed&&r.completedAt&&new Date(r.completedAt).toDateString()===today);
  const todayLeft=R.filter(r=>!r.completed&&isToday(r.dueDate));
  const overdue=R.filter(r=>!r.completed&&urg(r.dueDate)==="overdue");
  const ov=document.createElement("div");ov.className="mo";ov.id="eodM";ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div>
    <div style="text-align:center;margin-bottom:14px"><div style="font-size:40px">🌙</div><h3 style="margin:8px 0">End of Day Review</h3></div>
    <div style="display:flex;gap:8px;margin-bottom:14px"><div class="sm" style="flex:1"><div class="sm-n" style="color:var(--green)">${todayDone.length}</div><div class="sm-l">Completed</div></div><div class="sm" style="flex:1"><div class="sm-n" style="color:var(--orange)">${todayLeft.length}</div><div class="sm-l">Unfinished</div></div><div class="sm" style="flex:1"><div class="sm-n" style="color:var(--red)">${overdue.length}</div><div class="sm-l">Overdue</div></div></div>
    ${todayDone.length?`<h4 style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">DONE TODAY ✅</h4>${todayDone.map(r=>`<div style="font-size:12px;padding:3px 0;color:var(--text2)">✓ ${esc(r.title)}</div>`).join("")}`:""}
    ${todayLeft.length?`<h4 style="font-size:11px;font-weight:700;color:var(--text3);margin:10px 0 6px">UNFINISHED</h4>${todayLeft.map(r=>`<div style="font-size:12px;padding:3px 0;color:var(--text2)">○ ${esc(r.title)}</div>`).join("")}
    <button class="xbtn" onclick="moveUnfinished();document.getElementById('eodM').remove()" style="margin-top:8px">📦 Move to tomorrow</button>`:""}
    <button class="sbtn" onclick="document.getElementById('eodM').remove()" style="margin-top:14px">Close</button></div>`;
  document.body.appendChild(ov);
}

// BRIEFING

// PWA
if("serviceWorker"in navigator){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
  navigator.serviceWorker.addEventListener("message",e=>{
    if(e.data&&e.data.type==="open-reminders"){
      view="tasks";
      render();
      window.focus();
    }
  });
}
window.addEventListener("focus",()=>checkNotifications(true));
window.addEventListener("pageshow",()=>checkNotifications(true));
window.addEventListener("online",()=>checkNotifications(true));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkNotifications(true)});

function isDesktopLike(){
  return typeof window!=="undefined" && window.matchMedia && window.matchMedia("(min-width: 980px)").matches;
}
function syncViewportMode(){
  if(typeof document==="undefined" || !document.body)return;
  const desktop=isDesktopLike();
  document.body.classList.toggle("desktop-shell",desktop);
  document.body.classList.toggle("mobile-shell",!desktop);
  let coarse=false;
  try{coarse=!!(window.matchMedia&&window.matchMedia("(pointer: coarse)").matches)}catch(e){}
  document.body.classList.toggle("coarse-pointer",coarse);
  document.body.classList.toggle("fine-pointer",!coarse);
  document.body.classList.toggle("tasks-touch",!desktop||coarse);
}
function openKeyboardHelp(){
  const ov=document.createElement("div");ov.className="mo";ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Desktop shortcuts</h3><div class="mini-list"><div class="mini-item"><b>/</b><br>Focus task search on the Tasks screen</div><div class="mini-item"><b>N</b><br>Open quick add for the current main module</div><div class="mini-item"><b>?</b><br>Open this shortcut list</div><div class="mini-item"><b>Esc</b><br>Close the top modal or focus screen</div></div></div>`;
  document.body.appendChild(ov);
}
function handleDesktopHotkeys(e){
  if(!isDesktopLike())return;
  const t=e.target;
  const typing=t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"||t.isContentEditable);
  if(e.key==="Escape"){
    const top=[...document.querySelectorAll(".mo,.focus-ov,.pomo-ov,.brief-ov")].pop();
    if(top){top.remove();e.preventDefault();return;}
  }
  if(typing || e.metaKey || e.ctrlKey || e.altKey)return;
  if(e.key==="/"){
    if(view==="tasks"){e.preventDefault();const el=document.getElementById("searchIn");if(el){el.focus();el.select?.();}}
    return;
  }
  if(e.key==="?" || (e.shiftKey && e.key==="/")){e.preventDefault();openKeyboardHelp();return;}
  if(e.key.toLowerCase()==="n"){
    e.preventDefault();
    if(view==="kids")openKidQuickAdd();
    else if(view==="health")openHealthQuickAdd();
    else if(view==="money")openMoneyQuickAdd();
    else if(["tasks","myday","dashboard"].includes(view))openAdd();
    return;
  }
}
function ensureModalHasExplicitClose(ov){
  if(!ov||!ov.classList||!ov.classList.contains('mo'))return;
  const inner=ov.querySelector('.mo-in');
  if(!inner)return;
  const btns=[...inner.querySelectorAll('button')];
  // Avoid duplicate dismiss buttons: accept Close/Cancel/Done as valid.
  const hasClose=btns.some(b=>/\b(close|cancel|done)\b/i.test((b.textContent||'').trim()));
  if(hasClose||inner.querySelector('.tf-modal-close-btn'))return;
  let row=inner.querySelector('.safe-row:last-of-type');
  if(!row){
    row=document.createElement('div');
    row.className='safe-row';
    row.style.marginTop='14px';
    inner.appendChild(row);
  }
  const closeBtn=document.createElement('button');
  closeBtn.type='button';
  closeBtn.className='xbtn tf-modal-close-btn';
  closeBtn.textContent='Close';
  closeBtn.onclick=()=>ov.remove();
  row.appendChild(closeBtn);
}
function initModalCloseGuard(){
  if(typeof MutationObserver==='undefined'||window.__tfModalCloseGuard)return;
  window.__tfModalCloseGuard=true;
  const run=(n)=>ensureModalHasExplicitClose(n);
  const obs=new MutationObserver((muts)=>{
    muts.forEach(m=>{
      m.addedNodes&&[...m.addedNodes].forEach(n=>{
        if(!(n instanceof HTMLElement))return;
        if(n.classList&&n.classList.contains('mo'))run(n);
        n.querySelectorAll&&n.querySelectorAll('.mo').forEach(run);
      });
    });
  });
  obs.observe(document.body,{childList:true,subtree:true});
  document.querySelectorAll('.mo').forEach(run);
}
window.addEventListener("resize",syncViewportMode);
window.addEventListener("orientationchange",syncViewportMode);
document.addEventListener("keydown",handleDesktopHotkeys);
initModalCloseGuard();



