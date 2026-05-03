// ==================== SETTINGS ====================

// ==================== NAV ====================


// ==================== ACTIONS ====================
function go(v){
  if(!isViewEnabled(v)){showToast('That screen is off in this build.');return;}
  const prev=view;
  view=v;
  if(prev!==v&&prev==='tasks'&&v!=='tasks'){tasksBatchMode=false;tasksBatchSelected.clear()}
  if(prev!==v)history.pushState({view:v},'',(location.pathname+location.search));
  render();
}
window.addEventListener('popstate',function(e){
  if(closeAnyModalOverlay()){render();return}
  if(e.state&&e.state.view){view=e.state.view;render()}
  else{view='tasks';render()}
});
history.replaceState({view:view},'');
async function fetchParsedTasksFromServer(text){
  const tz=(typeof Intl!=='undefined'&&Intl.DateTimeFormat)?(Intl.DateTimeFormat().resolvedOptions().timeZone||''):'';
  const userId=(typeof authManager!=='undefined'&&authManager&&typeof authManager.isAuthenticated==='function'&&authManager.isAuthenticated()&&typeof authManager.getUser==='function')
    ? String(authManager.getUser()?.id||authManager.getUser()?.user_id||'').trim()
    : '';
  const base=(typeof chatApiBase==='function')?chatApiBase():'';
  const url=(base||'')+'/api/parse-tasks';
  const response=await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      input:text,
      anchorDate:fmtLD(new Date())+' ('+['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]+')',
      anchorNowIso:new Date().toISOString(),
      timezone:tz||'UTC',
      userId:userId
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const err=data&&(data.error||data.message)?String(data.error||data.message):('HTTP '+response.status);
    throw new Error(err);
  }
  return Array.isArray(data?.tasks)?data.tasks:[];
}
function extractExplicitWeekday(text){
  const t=String(text||'').toLowerCase();
  const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const found=days.map((d,i)=>({d,i,has:new RegExp(`\\b${d}\\b`,'i').test(t)})).filter(x=>x.has);
  if(found.length!==1)return -1;
  return found[0].i;
}
function editDistance(a,b){
  const s=String(a||''),t=String(b||'');
  const m=s.length,n=t.length;
  const dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++)dp[i][0]=i;
  for(let j=0;j<=n;j++)dp[0][j]=j;
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++){
      const cost=s[i-1]===t[j-1]?0:1;
      dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost);
    }
  }
  return dp[m][n];
}
function normalizeWeekdayTypos(text){
  const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return String(text||'').replace(/\b([a-z]{4,12}day)\b/gi,(raw)=>{
    const token=String(raw||'').toLowerCase();
    if(days.includes(token))return raw;
    let best='';
    let bestDist=99;
    days.forEach((d)=>{
      const dist=editDistance(token,d);
      if(dist<bestDist){bestDist=dist;best=d;}
    });
    if(best&&bestDist<=3)return best;
    return raw;
  });
}
function forceTaskDueToExplicitWeekday(task,inputText){
  const targetDay=extractExplicitWeekday(inputText);
  if(targetDay<0)return task;
  const dueRaw=String(task?.due_at||'').trim();
  if(!dueRaw)return task;
  // Always compute target date client-side from today's local date.
  // Never trust the model's weekday arithmetic — it can be off by 1 for future 2026 dates.
  const now=new Date();
  const dueDate=new Date(dueRaw);
  const h=Number.isNaN(dueDate.getTime())?9:dueDate.getHours();
  const m=Number.isNaN(dueDate.getTime())?0:dueDate.getMinutes();
  const fixed=new Date(now);
  fixed.setHours(h,m,0,0);
  let shift=(targetDay-now.getDay()+7)%7;
  if(shift===0)shift=7; // always land on the NEXT occurrence, never today
  fixed.setDate(now.getDate()+shift);
  return {...task,due_at:fixed.toISOString()};
}
function addTaskFromParsedNlpTask(task){
  const title=String(task?.title||'').trim().replace(/\s+/g,' ').slice(0,180);
  if(!title)return null;
  const notes=String(task?.notes||'').trim().slice(0,4000);
  const dueRaw=String(task?.due_at||'').trim();
  const dueMs=dueRaw?Date.parse(dueRaw):NaN;
  const hasDue=Number.isFinite(dueMs);
  const rec=normalizeReminder({
    id:gid(),
    title:title,
    notes:notes,
    dueDate:hasDue?new Date(dueMs).toISOString():UNSCHEDULED_SENTINEL_ISO,
    startDate:'',
    unscheduled:!hasDue,
    category:'personal',
    priority:'medium',
    recurrence:'none',
    alerts:['15'],
    tags:['nlp-ai'],
    sourceMode:'nlp-ai',
    subtasks:[],
    completed:false,
    billable:false,
    createdAt:new Date().toISOString()
  },R.length);
  R.push(rec);
  return rec;
}
async function nlpAdd(){
  if(nlpParsing)return;
  const rawInput=(nlpDraft||document.getElementById("nlpIn")?.value||"");
  const normalizedInput=normalizeWeekdayTypos(rawInput);
  const text=normalizedInput.trim();
  if(!rawInput){openAdd();return;}
  if(!text||text.length<2){showToast('Type at least 2 characters');return;}
  const inp=document.getElementById("nlpIn");
  nlpParsing=true;
  render();
  try{
    let parsedTasks=await fetchParsedTasksFromServer(text);
    if(parsedTasks.length===1)parsedTasks=[forceTaskDueToExplicitWeekday(parsedTasks[0],text)];
    if(!parsedTasks.length){showToast('I could not find any actionable tasks in that text.');return;}
    let added=0;
    parsedTasks.slice(0,25).forEach(t=>{if(addTaskFromParsedNlpTask(t))added++;});
    if(!added){showToast('No valid tasks were returned. Please try rephrasing.');return;}
    markNlpHintConsumed();
    nlpDraft="";
    if(inp){inp.value="";inp.placeholder="✓ Added!";}
    sv();
    render();
    showToast(added===1?'Added 1 task':`Added ${added} tasks`);
  }catch(e){
    const msg=String(e?.message||'');
    if(/invalid task json|parse task json|returned invalid/i.test(msg))showToast('Task parsing failed this time. Please try again.');
    else showToast('Could not parse tasks right now. Please try again.');
  }finally{
    nlpParsing=false;
    render();
  }
}
function queueNlp(v){
  nlpDraft=v;
  if(nlpTimer)clearTimeout(nlpTimer);
  nlpTimer=setTimeout(()=>{const inp=document.getElementById("nlpIn");if(inp&&inp.value!==nlpDraft)inp.value=nlpDraft;},10);
}
function voiceInput(){
  if(!("webkitSpeechRecognition"in window||"SpeechRecognition"in window)){alert("Voice input is not supported on this browser.");return}
  if(listening)return;
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const rec=new SR();
  rec.lang="en-US";
  rec.interimResults=true;
  rec.continuous=false;
  rec.maxAlternatives=1;
  let heardAnything=false;
  listening=true;
  render();
  rec.onresult=e=>{
    const transcript=Array.from(e.results).map(r=>r[0]?.transcript||"").join(" ").replace(/\s+/g," ").trim();
    if(transcript){
      heardAnything=true;
      nlpDraft=transcript;
      const inp=document.getElementById("nlpIn");
      if(inp){inp.value=nlpDraft;inp.focus();inp.setSelectionRange(nlpDraft.length,nlpDraft.length);}
    }
  };
  rec.onerror=e=>{
    listening=false;
    render();
    const err=e&&e.error?e.error:"unknown";
    if(err==="not-allowed"||err==="service-not-allowed")alert("Microphone access is blocked. Allow mic permission in the browser/app settings, then try again.");
    else if(err!=="aborted")alert(heardAnything?"Voice input was interrupted before it finished. Please try again.":"I didn't catch any speech. Please try again and speak after the mic starts blinking.");
  };
  rec.onend=()=>{
    listening=false;
    render();
    const inp=document.getElementById("nlpIn");
    if(inp&&nlpDraft){inp.focus();inp.setSelectionRange(nlpDraft.length,nlpDraft.length);}
    if(!heardAnything&&!(nlpDraft||"").trim())showToast("No speech captured");
  };
  try{rec.start()}catch(e){listening=false;render();alert("Voice input could not start on this device right now.");}
}
function applySug(a){if(a==="overdue"){filter="overdue";sortBy="date";go('tasks');return}nlpDraft=a;const inp=document.getElementById("nlpIn");if(inp){inp.value=a;inp.focus();inp.setSelectionRange(a.length,a.length)}}
function toggleSub(rid,si){const r=R.find(x=>x.id===rid);if(r&&r.subtasks&&r.subtasks[si])r.subtasks[si].done=!r.subtasks[si].done;sv();render()}
function deleteTaskOnSupabaseIfAuthed(id){
  if(!id)return;
  try{
    if(typeof supabase==='undefined'||typeof supabase.deleteTask!=='function')return;
    if(typeof supabase.isAuthenticated!=='function'||!supabase.isAuthenticated())return;
    supabase.deleteTask(id).catch(function(){});
  }catch(e){}
}
function delR(id){const r=R.find(x=>x.id===id);if(!r)return;r.deletedAt=new Date().toISOString();trash.push({...r});R=R.filter(x=>x.id!==id);clearReminderKeys(id);deleteTaskOnSupabaseIfAuthed(id);reindexOrders(false);sv();render();showUndo(id)}
function dragS(e,id){dragId=id;e.dataTransfer.effectAllowed="move"}
function dragO(e){e.preventDefault();e.currentTarget.classList.add("drag-over")}
function dragD(e,tid){
  e.preventDefault();e.currentTarget.classList.remove("drag-over");
  if(!dragId||dragId===tid)return;
  if(sortBy!=="manual")sortBy="manual";
  const fi=R.findIndex(x=>x.id===dragId),ti=R.findIndex(x=>x.id===tid);
  if(fi<0||ti<0)return;
  const item=R.splice(fi,1)[0];R.splice(ti,0,item);
  dragId=null;
  reindexOrders(false);localStorage.setItem("rp3_sort",sortBy);sv();render();
}

// POMODORO
function startPomo(id){pomoActive=true;pomoId=id;pomoBreak=false;pomoEnd=Date.now()+25*60000;pomoInterval=setInterval(updatePomo,1000);renderPomo()}
function renderPomo(){
  const r=R.find(x=>x.id===pomoId);let ov=document.getElementById("pomoOv");
  if(!ov){ov=document.createElement("div");ov.className="pomo-ov";ov.id="pomoOv";document.body.appendChild(ov)}
  const left=Math.max(0,pomoEnd-Date.now()),m=Math.floor(left/60000),s=Math.floor((left%60000)/1000),total=pomoBreak?5*60000:25*60000,pct=((total-left)/total)*100;
  ov.innerHTML=`<div style="font-size:40px">${pomoBreak?"☕":"🍅"}</div><div class="pomo-label">${pomoBreak?"Break":"Focus"}</div><div class="pomo-task">${r?esc(r.title):""}</div><div class="pomo-prog"><div class="pomo-fill" style="width:${pct}%"></div></div><div class="pomo-timer">${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}</div><div class="pomo-btns"><button class="pomo-btn stop" onclick="stopPomo()">Stop</button><button class="pomo-btn skip" onclick="skipPomo()">Skip</button></div>`;
}
function updatePomo(){if(!pomoActive)return;if(Date.now()>=pomoEnd){if(!pomoBreak){if("Notification"in window&&Notification.permission==="granted")new Notification("🍅 Done!",{body:"5-min break",vibrate:[200,100,200]});pomoBreak=true;pomoEnd=Date.now()+5*60000}else{stopPomo();return}}renderPomo()}
function stopPomo(){pomoActive=false;clearInterval(pomoInterval);const ov=document.getElementById("pomoOv");if(ov)ov.remove()}
function skipPomo(){if(pomoBreak)stopPomo();else{pomoBreak=true;pomoEnd=Date.now()+5*60000;renderPomo()}}

// MODALS
function openAdd(){editId=null;showForm()}
function openEdit(id){editId=id;showForm()}
function rFC(){document.getElementById("fCG").innerHTML=CATS.map(c=>`<button class="cbtn${window._fCat===c.key?" active":""}" style="--c:${c.color}" onclick="window._fCat='${c.key}';rFC()">${esc(c.icon)} ${esc(c.label)}</button>`).join("")}
function rFP(){document.getElementById("fPG").innerHTML=PRIS.map(p=>`<button class="cbtn${window._fPri===p.key?" active":""}" style="--c:${p.color}" onclick="window._fPri='${p.key}';rFP()">● ${p.label}</button>`).join("")}
function rFA(){document.getElementById("fAG").innerHTML=ALERTS.map(a=>`<button class="abtn${window._fAlerts.includes(a.key)?" active":""}" onclick="tglA('${a.key}')">${a.label}</button>`).join("")}
function tglA(k){const i=window._fAlerts.indexOf(k);if(i>=0)window._fAlerts.splice(i,1);else window._fAlerts.push(k);rFA()}
function rFS(){document.getElementById("fSL").innerHTML=window._fSubs.map((s,i)=>`<div class="sub-item"><span>${esc(s.text)}</span><button class="rm" onclick="window._fSubs.splice(${i},1);rFS()">✕</button></div>`).join("")}
function addSub(){const inp=document.getElementById("fSI");if(inp&&inp.value.trim()){window._fSubs.push({text:inp.value.trim(),done:false});inp.value="";rFS()}}
function openSnooze(id){
  const ov=document.createElement("div");ov.className="mo";ov.id="snzM";ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>💤 Snooze</h3>
    <div class="snz-opt" onclick="doSnz('${id}',30)">30 minutes</div><div class="snz-opt" onclick="doSnz('${id}',60)">1 hour</div>
    <div class="snz-opt" onclick="doSnz('${id}',180)">3 hours</div><div class="snz-opt" onclick="doSnz('${id}','tom')">Tomorrow 9 AM</div></div>`;
  document.body.appendChild(ov);
}
function calDay(y,m,d){calSel=new Date(y,m,d);render()}
function calPrev(){calDate.setMonth(calDate.getMonth()-1);calSel=null;render()}
function calNext(){calDate.setMonth(calDate.getMonth()+1);calSel=null;render()}
function setSort(v){sortBy=v;localStorage.setItem("rp3_sort",sortBy);render()}
function refreshTaskResults(){
  const countEl=document.getElementById("taskCountLabel"),listEl=document.getElementById("taskList");
  if(!countEl||!listEl)return render();
  const filtered=getFiltered();
  const grouped=getTasksForGroupedMainView();
  const n=filter==="all"?grouped.length:filtered.length;
  countEl.textContent=`${n} items${sortBy==="manual"?" · drag to reorder":""}`;
  listEl.innerHTML=filter==="all"?rGroupedTaskList(grouped):rCards(filtered);
  const totalHdr=document.getElementById("hdrStatTotal");
  if(totalHdr)totalHdr.textContent=String(n);
}
function queueSearch(v){
  search=v;
  localStorage.setItem("rp3_search",search);
  if(searchTimer)clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{if(view==="tasks")refreshTaskResults();else render()},60);
}
function setSearch(v){queueSearch(v)}
function toggleDark(){S.darkMode=!S.darkMode;applyTheme();sv();render()}
function reqNotif(){
  if(!("Notification"in window)){alert("Notifications are not supported on this browser.");return}
  Notification.requestPermission().then(async perm=>{
    if(perm==="granted"){
      await sendNotification("Notifications enabled",{body:"Reminders will show here when the browser allows it.",tag:"notif-enabled",renotify:false,silent:true});
      checkNotifications(true);
    }
    render();
  })
}

// NOTIFICATIONS
function withTimeout(promise,ms,label){
  return Promise.race([
    promise,
    new Promise(function(_,rej){setTimeout(function(){rej(new Error(label||"timeout"))},ms);}),
  ]);
}
async function sendNotification(title,options={}){
  if(!("Notification"in window)||Notification.permission!=="granted")return false;
  try{
    if("serviceWorker"in navigator){
      const reg=await withTimeout(navigator.serviceWorker.ready,2500,"service worker not ready");
      await reg.showNotification(title,{icon:"icon-192.png",badge:"icon-192.png",...options});
      return true;
    }
  }catch(e){}
  try{new Notification(title,{icon:"icon-192.png",...options});return true}catch(e){return false}
}
function getReminderLabel(alertKey){
  if(alertKey==="0")return "now";
  if(alertKey==="15")return "in 15 minutes";
  if(alertKey==="60")return "in 1 hour";
  if(alertKey==="1440")return "tomorrow";
  return `in ${alertKey} minutes`;
}
function startNotificationLoop(){
  if(notifInterval)clearInterval(notifInterval);
  notifInterval=setInterval(()=>checkNotifications(false),30000);
  setTimeout(()=>checkNotifications(true),800);
}

// ==================== WEEKLY PLANNER ====================
function rWeekly(){
  let h=rHdr("Weekly Planner","7-day overview");
  const today=new Date();today.setHours(0,0,0,0);
  h+=`<div style="padding:10px 14px">`;
  h+=`<button class="xbtn" onclick="moveUnfinished()" style="margin-bottom:10px">📦 Move yesterday's unfinished to today</button>`;
  if(batchMode)h+=`<div style="display:flex;gap:6px;margin-bottom:10px"><button class="xbtn" style="background:var(--green);color:#fff;border:none" onclick="batchDone()">✓ Done</button><button class="xbtn" style="background:var(--red);color:#fff;border:none" onclick="batchDel()">🗑 Delete</button><button class="xbtn" onclick="batchMode=false;batchSelected.clear();render()">Cancel</button></div>`;
  else h+=`<button class="xbtn" onclick="batchMode=true;render()" style="margin-bottom:10px">☑️ Batch select</button>`;
  for(let i=0;i<7;i++){
    const d=new Date(today);d.setDate(d.getDate()+i);
    const ds=d.toDateString(),isT=i===0;
    const dayTasks=R.filter(r=>!r.completed&&new Date(r.dueDate).toDateString()===ds).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
    const dayShifts=getShiftsForDate(fmtLD(d));
    h+=`<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px"><div style="font-size:14px;font-weight:800;${isT?"color:var(--accent)":""}">${isT?"Today":d.toLocaleDateString([],{weekday:"long"})} <span style="font-weight:500;font-size:12px;color:var(--text3)">${d.toLocaleDateString([],{month:"short",day:"numeric"})}</span></div>${getShiftBadgeHtml(dayShifts)}</div>`;
    if(dayTasks.length){
      dayTasks.forEach(r=>{
        const cat=getCategory(r.category),u=urg(r.dueDate);
        h+=`<div class="card pri-${r.priority||"low"}" style="margin-bottom:4px;padding:8px 10px"><div class="crow">${batchMode?`<input type="checkbox" ${batchSelected.has(r.id)?"checked":""} onchange="toggleBatch('${r.id}',this.checked)" style="width:18px;height:18px;margin-top:2px">`:""}<button class="chk${r.completed?" on":""}" onclick="toggleComp('${r.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></button><div class="cbody"><div class="ctitle" style="font-size:13px;cursor:pointer" onclick="openEdit('${r.id}')">${esc(r.title)}</div><div class="cmeta"><span class="cdate">${new Date(r.dueDate).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</span><span class="cbadge" style="background:${cat.color}">${cat.icon}</span>${r.effort?`<span style="font-size:9px;color:var(--text3)">⏱${EFFORTS.find(e=>e.key===r.effort)?.label||""}</span>`:""}</div></div><div class="cacts"><button class="cact" onclick="openEdit('${r.id}')">✏️</button><button class="cact" onclick="delR('${r.id}')">🗑</button></div></div></div>`;
      });
    }else h+=`<div style="font-size:12px;color:var(--text3);padding:4px 0">No tasks</div>`;
    h+=`</div>`;
  }
  h+=`</div>`;return h;
}

function moveUnfinished(){
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);yesterday.setHours(0,0,0,0);
  const yd=yesterday.toDateString();
  let moved=0;
  R.forEach(r=>{
    if(!r.completed&&new Date(r.dueDate).toDateString()===yd){
      const d=new Date(r.dueDate);d.setDate(d.getDate()+1);
      r.dueDate=d.toISOString();moved++;
    }
  });
  if(moved){sv();render();showToast(`Moved ${moved} tasks to today`)}
  else showToast("Nothing to move");
}

// ==================== BATCH ACTIONS ====================
function toggleBatch(id,checked){if(checked)batchSelected.add(id);else batchSelected.delete(id);render()}
function batchDone(){batchSelected.forEach(id=>{const r=R.find(x=>x.id===id);if(r){r.completed=true;r.completedAt=new Date().toISOString()}});batchMode=false;batchSelected.clear();sv();render()}
function batchDel(){batchSelected.forEach(id=>delR(id));batchMode=false;batchSelected.clear();sv();render()}
function toggleTasksBatch(id,checked){if(checked)tasksBatchSelected.add(id);else tasksBatchSelected.delete(id);render()}
function toggleTasksBatchToggle(id){
  if(tasksBatchSelected.has(id))tasksBatchSelected.delete(id);else tasksBatchSelected.add(id);
  render();
}
function taskCardBodyBatchTap(e,id){
  if(!tasksBatchMode||view!=='tasks')return;
  if(e.target.closest('button')||e.target.closest('a')||e.target.closest('label.task-batch-pick'))return;
  e.preventDefault();
  toggleTasksBatchToggle(id);
}
function selectTasksBatchGroup(kind){
  if(view!=='tasks'||filter!=='all')return;
  const base=getTasksForGroupedMainView();
  const g=groupTasksForMainView(base);
  let ids=[];
  if(kind==='overdue')ids=g.overdue.map(r=>r.id);
  else if(kind==='completed')ids=g.completed.map(r=>r.id);
  else return;
  ids.forEach(id=>tasksBatchSelected.add(id));
  render();
  showToast(ids.length?`${ids.length} selected`:'None in this group');
}
function selectAllVisibleTasksForBatch(){
  const list=filter==='all'?getTasksForGroupedMainView():getFiltered();
  list.forEach(r=>tasksBatchSelected.add(r.id));
  render();
  showToast(`${tasksBatchSelected.size} selected`);
}
function tasksBatchDone(){
  tasksBatchSelected.forEach(id=>{const r=R.find(x=>x.id===id);if(r){r.completed=true;r.completedAt=new Date().toISOString()}});
  tasksBatchMode=false;tasksBatchSelected.clear();sv();render();showToast('Marked done');
}
function tasksBatchDel(){
  const n=tasksBatchSelected.size;
  if(!n)return;
  const msg=n===1?'Delete 1 task? This cannot be undone.':`Delete ${n} tasks? This cannot be undone.`;
  if(!confirm(msg))return;
  const ids=[...tasksBatchSelected];
  ids.forEach(id=>{
    const r=R.find(x=>x.id===id);
    if(!r)return;
    r.deletedAt=new Date().toISOString();
    trash.push({...r});
    R=R.filter(x=>x.id!==id);
    clearReminderKeys(id);
    deleteTaskOnSupabaseIfAuthed(id);
  });
  reindexOrders(false);
  tasksBatchMode=false;
  tasksBatchSelected.clear();
  sv();
  render();
  showToast(n===1?'1 task deleted':`${n} tasks deleted`);
}
function exitTasksBatch(){tasksBatchMode=false;tasksBatchSelected.clear();render()}

