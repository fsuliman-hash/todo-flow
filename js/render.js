function render(){
  if(!isViewEnabled(view))view='tasks';
  if(view!=="tasks"||filter!=="all")completedSectionExpanded=false;
  let h="";
  if(view==="tasks")h=rTasks();else if(view==="myday")h=rMyDay();else if(view==="calendar")h=rCal();
  else if(view==="habits")h=rHabits();else if(view==="routines")h=rRoutines();
  else if(view==="shifts")h=rShifts();else if(view==="time")h=rTime();
  else if(view==="templates")h=rTemplates();else if(view==="stats")h=rStats();
  else if(view==="settings")h=rSettings();else if(view==="weekly")h=rWeekly();else if(view==="whatnow")h=rWhatNow();
  else if(view==="bills")h=rBills();else if(view==="water")h=rWater();else if(view==="dispatch")h=rDispatch();else if(view==="trash")h=rTrash();
  else if(view==="dashboard")h=rDashboard();else if(view==="matrix")h=rMatrix();else if(view==="prayers")h=rPrayers();else if(view==="kids")h=rKids();
  else if(view==="health")h=rHealth();else if(view==="money")h=rMoney();else if(view==="timeline")h=rTimeline();
  h+=rNav();
  document.getElementById("app").innerHTML=h;
  updateTT();
  if(typeof document!=="undefined"&&document.body)document.body.classList.toggle("tasks-batch-select",!!(tasksBatchMode&&view==="tasks"));
}
function rNav(){
  const lib=Object.fromEntries(NAV_LIBRARY.map(n=>[n.k,n]));
  let h=`<nav class="bnav">`;
  (X.navTabs||["tasks","dashboard","myday","calendar"]).slice(0,4).forEach(k=>{const t=lib[k]||lib.tasks;h+=`<button class="${view===t.k?"active":""}" onclick="go('${t.k}')"><span style="font-size:18px">${t.i}</span><span>${t.l}</span></button>`});
  h+=`<button onclick="openMore()"><span style="font-size:18px">☰</span><span>More</span></button>`;
  if(["tasks","myday","kids","health","money"].includes(view))h+=`<button onclick="${view==='kids'?'openKidQuickAdd()':view==='health'?'openHealthQuickAdd()':view==='money'?'openMoneyQuickAdd()':'openAdd()'}" style="color:var(--accent)"><span style="font-size:18px">＋</span><span>Add</span></button>`;
  h+=`</nav>`;return h;
}
function openMore(){
  const groups=[
    {title:'Plan & review',items:[
      {k:"dashboard",i:"🏠",l:"Dashboard",d:'Overview, catch-up, and quick status'},
      {k:"myday",i:"☀️",l:"My Day",d:'Top 3, today focus, and bundles'},
      {k:"calendar",i:"🗓️",l:"Calendar",d:'See tasks by day'},
      {k:"timeline",i:"🕒",l:"Timeline",d:'Upcoming everything in one stream'},
      {k:"weekly",i:"📅",l:"Weekly Planner",d:'Weekly reset and planning'},
      {k:"matrix",i:"🧭",l:"Eisenhower Matrix",d:'Urgent vs important view'},
      {k:"whatnow",i:"🧠",l:"What Should I Do?",d:'Smart next-step suggestions'}
    ]},
    {title:'Life modules',items:[
            {k:"money",i:"💰",l:"Budget & Money",d:'Bills, pay, income, and contributions'},
      {k:"bills",i:"💳",l:"Bill Forecast",d:'Upcoming bills and paid history'},
      {k:"prayers",i:"🕌",l:"Prayer Times",d:'Ottawa prayer schedule and sync'},
      {k:"kids",i:"👨‍👩‍👧",l:"Kids & School",d:'Profiles, homework, rewards, appointments'},
      {k:"health",i:"🩺",l:"Health",d:'Medication, sleep, and exercise'},
      {k:"shifts",i:"🏗️",l:"Shift Planner",d:'Work shifts, patterns, and pay periods'},
      {k:"time",i:"⏱️",l:"Time Tracking",d:'Client time and invoices'}
    ]},
    {title:'Tools',items:[
      {k:"dispatch",i:"📞",l:"Dispatch",d:'FlowLine calls and follow-up'},
      {k:"templates",i:"📋",l:"Templates",d:'Reusable reminder sets'},
      {k:"stats",i:"📊",l:"Stats",d:'Trends and totals'},
      {k:"settings",i:"⚙️",l:"Settings",d:'Theme, categories, backup, and import/export'},
      {k:"trash",i:"🗑️",l:"Trash",d:'Recover deleted items'}
    ]}
  ].map(g=>({...g,items:g.items.filter(t=>isViewEnabled(t.k)&&(APP_SHELL_MINIMAL?!PRIMARY_NAV_KEYS.includes(t.k):true))})).filter(g=>g.items.length);
  const ov=document.createElement('div');ov.className='mo';ov.id='moreM';ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Browse modules</h3><div class="sdesc" style="margin-bottom:12px">${groups.length?'Everything is grouped so it feels more like an app drawer than a long luggage list.':'More modules are hidden in this build. Use Settings from the gear if available.'}</div>${groups.map(g=>`<div class="more-group"><div class="flbl" style="margin-bottom:8px">${g.title}</div><div class="more-grid">${g.items.map(t=>`<button class="more-card" onclick="go('${t.k}');document.getElementById('moreM').remove()"><div class="more-card-top"><span class="more-emoji">${t.i}</span><b>${t.l}</b></div><span>${t.d}</span></button>`).join('')}</div></div>`).join('')}</div>`;
  document.body.appendChild(ov);
}
function rDashboard(){
  const today=fmtLD(new Date());
  const top3=getTodayTop3();
  const shiftToday=getShiftsForDate(today);
  const overdue=R.filter(r=>!r.completed&&urg(r.dueDate)==='overdue').slice(0,4);
  const dueSoon=R.filter(r=>!r.completed&&['urgent','soon'].includes(urg(r.dueDate))).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).slice(0,4);
  const paidThisMonth=R.filter(r=>r.completed&&r.category==='bills'&&r.completedAt&&r.completedAt.startsWith(today.slice(0,7))).reduce((a,r)=>a+(Number(r.amount)||0),0);
  const review=getWeeklyAutoReview();
  const insights=getPatternInsights();
  const nextPay=getPaycheckCalendarRows(1)[0];
  const plan=buildProductivityPlan();
  const dashWhatNow=isViewEnabled('whatnow');
  const dashMoney=isViewEnabled('money');
  const dashShifts=isViewEnabled('shifts');
  let h=rHdr('Dashboard','See the day clearly and move with confidence');
  h+=`<div class="dash-grid">`;
  h+=`<div class="dash-card full"><div class="coach-card"><div class="dash-title">Productivity coach</div><div class="coach-title">${esc(plan.coach.title)}</div><div class="coach-copy">${esc(plan.coach.body)}</div><div class="reason-row"><span class="reason-chip">⚡ ${esc((X.energyLevel||'normal').replace(/^./,m=>m.toUpperCase()))} energy</span><span class="reason-chip">⏱ ${plan.minutes} min window</span><span class="reason-chip">🧭 ${esc((X.focusStyle||'balanced').replace(/^./,m=>m.toUpperCase()))} mode</span>${plan.shift.heavy?'<span class="reason-chip">🛠 shift-heavy day</span>':''}</div><div class="hero-actions"><button class="chip-btn" onclick="go('myday')">Open My Day</button><button class="chip-btn" onclick="openPowerHourPlan()">Build my next block</button>${dashWhatNow?`<button class="chip-btn" onclick="go('whatnow')">Smart next step</button>`:''}</div></div></div>`;
  h+=`<div class="dash-card" onclick="openTop3Picker()" style="cursor:pointer"><div class="dash-title">Top 3 Today</div><div class="dash-big">${top3.length}/3</div><div class="dash-sub">${top3.length?top3.map(r=>esc(r.title)).join(' · '):'Tap to pick your top 3'}</div></div>`;
  if(dashShifts)h+=`<div class="dash-card"><div class="dash-title">Today's Shift</div><div class="dash-big">${shiftToday.length||0}</div><div class="dash-sub">${shiftToday.length?shiftToday.map(s=>`${esc(s.type)}${s.start&&s.end?` · ${s.start}-${s.end}`:''}${s.onCall?' · on-call':''}`).join('<br>'):'No shifts saved'}</div></div>`;
  h+=`<div class="dash-card"><div class="dash-title">Focus pulse</div><div class="dash-big">${plan.queue.length}</div><div class="dash-sub">${plan.queue.length?`Ready for your next ${plan.minutes}-minute block`:'Add a few tasks to unlock smarter guidance'}<div class="hero-actions">${dashWhatNow?`<button class="chip-btn" onclick="go('whatnow')">Open smart next step</button>`:''}<button class="chip-btn" onclick="openPowerHourPlan()">Build next block</button></div></div></div>`;
  if(dashMoney)h+=`<div class="dash-card"><div class="dash-title">Money</div><div class="dash-big">$${paidThisMonth.toFixed(0)}</div><div class="dash-sub">Bills paid this month${nextPay?`<br>Next pay ${new Date(nextPay.payDate+'T00:00').toLocaleDateString()}`:''}<div class="hero-actions"><button class="chip-btn" onclick="go('money')">Open money</button></div></div></div>`;
  h+=`<div class="dash-card full"><div class="dash-title">Next block</div><div class="mini-list">${plan.queue.length?plan.queue.map((task,i)=>`<div class="mini-item"><b>${i+1}. ${esc(task.title)}</b><br>${task.effort} min · ${esc(task.reasons.join(' • ')||'good fit')}</div>`).join(''):'<div class="mini-item">No clear queue yet. Pick a top 3 task or lower your time window.</div>'}<div class="hero-actions"><button class="chip-btn" onclick="openPowerHourPlan()">Open plan</button><button class="chip-btn" onclick="setFocusStyle('quick')">Quick wins</button><button class="chip-btn" onclick="setFocusStyle('deep')">Deep work</button></div></div></div>`;
  h+=`<div class="dash-card full"><div class="dash-title">What did I miss?</div><div class="mini-list">${overdue.length?overdue.map(r=>`<div class="mini-item">🔴 ${esc(r.title)} · ${fmtD(r.dueDate)}</div>`).join(''):'<div class="mini-item">No overdue items right now</div>'}${dueSoon.map(r=>`<div class="mini-item">⚡ ${esc(r.title)} · ${fmtD(r.dueDate)}</div>`).join('')}</div></div>`;
  h+=`<div class="dash-card full"><div class="dash-title">Weekly auto-review</div><div class="mini-list"><div class="mini-item">Overdue tasks: ${review.overdue}</div>${review.snoozed.map(r=>`<div class="mini-item">😴 ${esc(r.title)} · snoozed ${r.snoozeCount}x</div>`).join('')||'<div class="mini-item">No repeatedly snoozed tasks</div>'}${review.blocked.map(r=>`<div class="mini-item">⛔ ${esc(r.title)} is blocked by another task</div>`).join('')}</div></div>`;
  h+=`<div class="dash-card full"><div class="dash-title">Pattern learning</div><div class="mini-list">${insights.length?insights.map(i=>`<div class="mini-item"><b>${esc(i.title)}</b><br>${esc(i.body)}</div>`).join(''):'<div class="mini-item">No strong patterns yet. Keep using the app and insights will appear here.</div>'}</div></div>`;
  h+=`<div class="dash-card full"><div class="dash-title">Recent changes</div><div class="mini-list">${(X.actionLog||[]).slice(-6).reverse().map(a=>`<div class="mini-item">${esc(a.label)} · ${new Date(a.date).toLocaleString()}</div>`).join('')||'<div class="mini-item">No changes logged yet</div>'}<div class="hero-actions"><button class="chip-btn" onclick="openChangelog()">Open changelog</button></div></div></div>`;
  h+=`</div>`;return h;
}
function rPrayers(){
  const ds=fmtLD(new Date());const p=getPrayerSummary(ds);let h=rHdr('Prayer Times','Ottawa auto-sync');
  h+=`<div class="prayer-top"><div class="safe-row"><button class="xbtn" onclick="syncPrayerTimesForDay('${ds}')">Sync Ottawa</button><button class="xbtn" onclick="addPrayerTasks('${ds}',getCachedPrayerTimes('${ds}')||{})">Add today to tasks</button></div></div>`;
  if(!p){h+=`<div class="empty"><div class="empty-i">🕌</div><div class="empty-t">Prayer times will appear after sync</div></div>`;return h;}
  const fasting=p.hijri?.month?.number===9;
  const todayEntries=Object.entries(p.timings);
  h+=`<div class="prayer-grid">${todayEntries.map(([name,time])=>`<div class="prayer-item${p.next?.name===name?' now':''}"><div class="dash-title">${esc(name)}</div><div class="dash-big" style="font-size:24px">${esc(time)}</div><div class="dash-sub">${p.next?.name===name?'Next prayer':''}</div></div>`).join('')}`;
  h+=`<div class="dash-card full"><div class="dash-title">Ramadan / Eid Planner</div><div class="dash-sub">Hijri: ${esc(p.hijri?.weekday?.en||'')} ${esc(p.hijri?.day||'')} ${esc(p.hijri?.month?.en||'')} ${esc(p.hijri?.year||'')}<br>${fasting?`Suhoor ends at Fajr ${esc(p.timings.Fajr)} · Iftar at Maghrib ${esc(p.timings.Maghrib)}`:'Outside Ramadan right now. Iftar/Suhoor card will become active in Ramadan.'}</div></div>`;
  h+=`</div>`;return h;
}
function rMatrix(){
  const active=R.filter(r=>!r.completed&&(isTaskStartVisible(r)));
  const boxes={doNow:[],schedule:[],delegate:[],eliminate:[]};
  active.forEach(r=>{const urgent=['overdue','urgent'].includes(urg(r.dueDate));const important=['critical','high'].includes(r.priority)||r.pinned;if(urgent&&important)boxes.doNow.push(r);else if(!urgent&&important)boxes.schedule.push(r);else if(urgent&&!important)boxes.delegate.push(r);else boxes.eliminate.push(r)});
  let h=rHdr('Eisenhower Matrix','Urgent vs important');
  h+=`<div class="matrix-grid">`;
  const renderBox=(title,key,emoji)=>`<div class="matrix-box"><h3>${emoji} ${title}</h3>${boxes[key].slice(0,6).map(r=>`<div class="mini-item">${esc(r.title)}</div>`).join('')||'<div class="mini-item">Nothing here</div>'}</div>`;
  h+=renderBox('Do Now','doNow','🔥')+renderBox('Schedule','schedule','📅')+renderBox('Delegate / Batch','delegate','📦')+renderBox('Eliminate / Later','eliminate','🧹');
  h+=`</div>`;return h;
}
function getVisibleTasks(){
  return getFiltered().filter(r=>isTaskStartVisible(r));
}
function normalizeDupTitle(title){
  return String(title||'')
    .toLowerCase()
    .replace(/\(copy\)/g,'')
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function duplicateDueKey(r){
  if(!r||r.unscheduled||isUnscheduledISO(r.dueDate))return 'undated';
  const d=new Date(r.dueDate);
  if(Number.isNaN(d.getTime()))return 'undated';
  return fmtLD(d);
}
function getDuplicateTaskIdSet(){
  const groups=new Map();
  getTaskVisibleList(R).forEach(r=>{
    if(!r||r.completed)return;
    const title=normalizeDupTitle(r.title);
    if(!title)return;
    const key=title+'|'+duplicateDueKey(r);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(r.id);
  });
  const dup=new Set();
  groups.forEach(ids=>{if(ids.length>1)ids.forEach(id=>dup.add(id));});
  return dup;
}
function buildDuplicateDeletePlanFromTasks(){
  const groups=new Map();
  getTaskVisibleList(R).forEach(r=>{
    if(!r||r.completed)return;
    const title=normalizeDupTitle(r.title);
    if(!title)return;
    const key=title+'|'+duplicateDueKey(r);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(r);
  });
  const removeIds=[],keepIds=[];
  groups.forEach(items=>{
    if(!items||items.length<2)return;
    const sorted=items.slice().sort((a,b)=>{
      const ta=new Date(a.createdAt||a.updated_at||0).getTime()||0;
      const tb=new Date(b.createdAt||b.updated_at||0).getTime()||0;
      return ta-tb;
    });
    keepIds.push(sorted[0].id);
    sorted.slice(1).forEach(x=>removeIds.push(x.id));
  });
  return {removeIds,keepIds};
}
function deleteAllDuplicatesFromFilter(){
  const plan=buildDuplicateDeletePlanFromTasks();
  if(!plan.removeIds.length){showToast('No duplicates to delete');return;}
  const n=plan.removeIds.length;
  if(!confirm(`Delete ${n} duplicate task${n===1?'':'s'} and keep oldest in each group?`))return;
  const backup=R.slice();
  const rm=new Set(plan.removeIds.map(String));
  const removed=[];
  R.forEach(r=>{if(r&&rm.has(String(r.id)))removed.push(r);});
  removed.forEach(r=>trash.push({...r,deletedAt:new Date().toISOString()}));
  R=R.filter(r=>!(r&&rm.has(String(r.id))));
  removed.forEach(r=>{if(r&&r.id){clearReminderKeys(r.id);deleteTaskOnSupabaseIfAuthed(r.id);}});
  reindexOrders(false);
  _undoCallback=()=>{R=backup;sv();render();};
  sv();render();showToast(`Deleted ${removed.length} duplicate task${removed.length===1?'':'s'}`,'Undo');
}
function getTasksForHeaderStats(){
  const dupIds=filter==='duplicates'?getDuplicateTaskIdSet():null;
  const urgencyLanes=new Set(['overdue','duesoon','duelater']);
  const listModes=new Set(['done','recent','duplicates']);
  let primary=filter;
  if(urgencyLanes.has(filter))primary='all';
  else if(listModes.has(filter))primary='all';
  let l=getTaskVisibleList(R).filter(r=>{
    if(primary==='all')return !r.completed;
    if(primary==='done')return r.completed;
    if(primary==='recent')return !r.completed&&isRecentlyAddedTask(r);
    if(primary==='duplicates')return !r.completed&&dupIds&&dupIds.has(r.id);
    return r.category===primary&&!r.completed;
  });
  if(primary!=='duplicates'){
    l=l.filter(r=>r.completed||isTaskStartVisible(r));
  }
  if(search){const q=search.toLowerCase();l=l.filter(r=>r.title.toLowerCase().includes(q)||(r.notes||'').toLowerCase().includes(q)||(r.tags||[]).some(t=>t.toLowerCase().includes(q))||(r.subject||'').toLowerCase().includes(q));}
  return l;
}
function getFiltered(){
  const dupIds=filter==='duplicates'?getDuplicateTaskIdSet():null;
  let l=getTaskVisibleList(R).filter(r=>{if(filter==='all')return !r.completed;if(filter==='done')return r.completed;if(filter==='recent')return !r.completed&&isRecentlyAddedTask(r);if(filter==='duplicates')return !r.completed&&dupIds&&dupIds.has(r.id);if(filter==='overdue')return !r.completed&&urg(r.dueDate)==='overdue';if(filter==='duesoon')return !r.completed&&['urgent','soon'].includes(urg(r.dueDate));if(filter==='duelater')return !r.completed&&urg(r.dueDate)==='later';return r.category===filter&&!r.completed});
  // Keep duplicate review truthful: if duplicate count says items exist,
  // do not hide them just because startDate is in the future.
  if(filter!=='duplicates'){
    l=l.filter(r=>r.completed||isTaskStartVisible(r));
  }
  if(search){const q=search.toLowerCase();l=l.filter(r=>r.title.toLowerCase().includes(q)||(r.notes||'').toLowerCase().includes(q)||(r.tags||[]).some(t=>t.toLowerCase().includes(q))||(r.subject||'').toLowerCase().includes(q));}
  const po={critical:0,high:1,medium:2,low:3};
  if(sortBy==='date')l.sort((a,b)=>((b.pinned?1:0)-(a.pinned?1:0))||(new Date(a.dueDate)-new Date(b.dueDate))||((a.order??0)-(b.order??0)));
  else if(sortBy==='priority')l.sort((a,b)=>((b.pinned?1:0)-(a.pinned?1:0))||((po[a.priority]||3)-(po[b.priority]||3))||new Date(a.dueDate)-new Date(b.dueDate));
  else if(sortBy==='name')l.sort((a,b)=>((b.pinned?1:0)-(a.pinned?1:0))||a.title.localeCompare(b.title));
  else l.sort((a,b)=>((b.pinned?1:0)-(a.pinned?1:0))||((a.order??0)-(b.order??0)));
  return l;
}
function getTasksForGroupedMainView(){
  const dupIds=filter==='duplicates'?getDuplicateTaskIdSet():null;
  let l=getTaskVisibleList(R).filter(r=>{
    if(filter==='all')return true;
    if(filter==='done')return r.completed;
    if(filter==='recent')return !r.completed&&isRecentlyAddedTask(r);
    if(filter==='duplicates')return !r.completed&&dupIds&&dupIds.has(r.id);
    if(filter==='overdue')return !r.completed&&urg(r.dueDate)==='overdue';
    if(filter==='duesoon')return !r.completed&&['urgent','soon'].includes(urg(r.dueDate));
    if(filter==='duelater')return !r.completed&&urg(r.dueDate)==='later';
    return r.category===filter&&!r.completed;
  });
  if(filter!=='duplicates'){
    l=l.filter(r=>r.completed||isTaskStartVisible(r));
  }
  if(search){const q=search.toLowerCase();l=l.filter(r=>r.title.toLowerCase().includes(q)||(r.notes||'').toLowerCase().includes(q)||(r.tags||[]).some(t=>t.toLowerCase().includes(q))||(r.subject||'').toLowerCase().includes(q));}
  const po={critical:0,high:1,medium:2,low:3};
  if(sortBy==='date')l.sort((a,b)=>((b.pinned?1:0)-(a.pinned?1:0))||(new Date(a.dueDate)-new Date(b.dueDate))||((a.order??0)-(b.order??0)));
  else if(sortBy==='priority')l.sort((a,b)=>((b.pinned?1:0)-(a.pinned?1:0))||((po[a.priority]||3)-(po[b.priority]||3))||new Date(a.dueDate)-new Date(b.dueDate));
  else if(sortBy==='name')l.sort((a,b)=>((b.pinned?1:0)-(a.pinned?1:0))||a.title.localeCompare(b.title));
  else l.sort((a,b)=>((b.pinned?1:0)-(a.pinned?1:0))||((a.order??0)-(b.order??0)));
  return l;
}
function groupTasksForMainView(list){
  const overdue=[],today=[],upcoming=[],completed=[];
  list.forEach(r=>{
    if(!r)return;
    if(r.completed){completed.push(r);return;}
    if(isUnscheduledISO(r.dueDate)){upcoming.push(r);return;}
    const u=urg(r.dueDate);
    if(u==='overdue'){overdue.push(r);return;}
    if(isToday(r.dueDate)){today.push(r);return;}
    upcoming.push(r);
  });
  return {overdue,today,upcoming,completed};
}
function toggleCompletedSection(){
  completedSectionExpanded=!completedSectionExpanded;
  render();
}
function rTaskSection(title,items,opts={}){
  const variant=opts.variant||'';
  if(!items.length)return'';
  const headCls=`task-sec-head${variant?` task-sec-${variant}`:''}`;
  const batchBtn=tasksBatchMode&&view==='tasks'&&opts.batchSelect==='overdue'?`<button type="button" class="chip-btn task-sec-batch-btn" onclick="event.stopPropagation();selectTasksBatchGroup('overdue')">Select all overdue</button>`:'';
  return`<div class="task-sec"><div class="${headCls}${batchBtn?' task-sec-head-flex':''}"><span class="task-sec-head-t">${esc(title)}</span>${batchBtn}</div><div class="task-sec-cards">${rCards(items)}</div></div>`;
}
function rGroupedTaskList(baseList){
  if(filter!=='all')return rCards(baseList);
  const g=groupTasksForMainView(baseList);
  const completedSorted=g.completed.slice().sort((a,b)=>new Date(b.completedAt||b.createdAt||0)-new Date(a.completedAt||a.createdAt||0));
  const completedPreview=completedSorted.slice(0,5);
  let h='';
  h+=rTaskSection('Overdue',g.overdue,{variant:'overdue',batchSelect:'overdue'});
  h+=rTaskSection('Today',g.today);
  h+=rTaskSection('Upcoming',g.upcoming);
  if(completedSorted.length){
    const label=completedSectionExpanded?`Hide completed (${completedSorted.length})`:`Show ${Math.min(5,completedSorted.length)} completed`;
    const batchCompletedBtn=tasksBatchMode&&view==='tasks'?`<button type="button" class="chip-btn task-sec-batch-btn" onclick="event.stopPropagation();selectTasksBatchGroup('completed')">Select all completed</button>`:'';
    h+=`<div class="task-sec"><div class="task-sec-head task-sec-completed"><span>Completed</span><div class="task-sec-completed-actions">${batchCompletedBtn}<button type="button" class="task-sec-toggle" onclick="toggleCompletedSection()">${esc(label)}</button></div></div><div class="task-sec-cards">`;
    h+=rCards(completedSectionExpanded?completedSorted:completedPreview);
    h+=`</div></div>`;
  }
  if(!h)return rCards([]);
  return h;
}
function isRecentlyAddedTask(r){
  if(!r||!r.createdAt)return false;
  const created=new Date(r.createdAt);
  if(Number.isNaN(created.getTime()))return false;
  return (Date.now()-created.getTime())<=7*24*60*60*1000;
}
function toggleTaskFiltersPanel(){
  taskFiltersOpen=!taskFiltersOpen;
  try{localStorage.setItem("rp3_taskFiltersOpen",taskFiltersOpen?"1":"0")}catch(e){}
  render();
}
const NLP_HINT_LS_KEY='rp3_nlpHintDismissed';
function nlpHintDismissed(){try{return localStorage.getItem(NLP_HINT_LS_KEY)==='1'}catch(e){return false}}
function dismissNlpHint(){try{localStorage.setItem(NLP_HINT_LS_KEY,'1')}catch(e){}render()}
function markNlpHintConsumed(){try{localStorage.setItem(NLP_HINT_LS_KEY,'1')}catch(e){}}
function rTaskWorkspaceAside(){
  const laneCounts=CATS.map(c=>({cat:c,count:R.filter(r=>!r.completed&&r.category===c.key).length})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count).slice(0,6);
  const soon=R.filter(r=>!r.completed&&!isUnscheduledISO(r.dueDate)&&['urgent','soon'].includes(urg(r.dueDate))).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).slice(0,4);
  return `<aside class="task-side-col"><div class="panel bulk-import-panel"><h3>Bulk task capture</h3><div class="bulk-help">Paste a list or load a text file. Headings like <b>Bills:</b>, <b>Work:</b>, or <b>[School]</b> help the app sort tasks into categories automatically.</div><div class="bulk-actions"><button class="xbtn" onclick="openBulkImport()">📥 Import text</button><button class="xbtn" onclick="pasteBulkToNewImport()">📋 Paste clipboard</button></div><div class="bulk-help" style="margin-top:8px">Example:<br>Work:<br>- Finish incident report tomorrow 9am<br>Bills:<br>- Pay hydro 2026-04-15 6pm</div></div><div class="panel"><h3>Category overview</h3>${laneCounts.map(x=>`<div class="list-row"><div class="list-main"><b>${esc(x.cat.icon)} ${esc(x.cat.label)}</b><span>${x.count} active task${x.count===1?'':'s'}</span></div></div>`).join('')||'<div class="sdesc">No active category lanes yet.</div>'}</div>${soon.length?`<div class="panel"><h3>Coming up</h3>${soon.map(task=>`<div class="list-row"><div class="list-main"><b>${esc(task.title)}</b><span>${fmtD(task.dueDate)}</span></div></div>`).join('')}</div>`:''}</aside>`;
}
function rTasks(){
  const statsPool=getTasksForHeaderStats();
  const filteredTasks=getFiltered();
  const groupedBase=getTasksForGroupedMainView();
  const listCount=filter==='all'?groupedBase.length:filteredTasks.length;
  let h=rHdr('Todo Flow','A cleaner place to capture and finish things',{headerTotalCount:listCount,headerStatPool:statsPool});
  h+=`<div class="nlp-bar"><input id="nlpIn" value="${esc(nlpDraft)}" placeholder="Try: soccer Tuesday 4pm, dentist Friday, pick up milk" ${nlpParsing?'disabled':''} oninput="queueNlp(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();nlpAdd()}"><button class="nlp-btn add" ${nlpParsing?'disabled':''} onclick="nlpDraft.trim()?nlpAdd():openAdd()">${nlpParsing?'⏳':'+'}</button></div>`;
  if(!nlpHintDismissed())h+=`<div class="nlp-hint-wrap"><p class="nlp-hint">Natural language, voice, long-press & bulk import — clipboard hint optional in Settings.</p><button type="button" class="nlp-hint-dismiss" onclick="dismissNlpHint()" aria-label="Dismiss hint">✕</button></div>`;
  h+=`<div class="search-row" style="padding:8px 14px 0"><input id="searchIn" value="${esc(search)}" placeholder="Search title, notes, tags, or subject" style="width:100%;padding:10px 12px;font-size:13px;border:1.5px solid var(--border);border-radius:12px;background:var(--card);outline:none" oninput="queueSearch(this.value)"></div>`;
  if(S.showClipboardDateBanner&&X.clipboardSuggestion)h+=`<div class="suggest-bar"><span>📋</span><span class="st">Clipboard looks like a date/reminder: ${esc(X.clipboardSuggestion)}</span><button onclick="useClipboardSuggestion()">Use</button><button class="dism" onclick="dismissClipboardSuggestion()">✕</button></div>`;
  if(ttActive)h+=rTTActive();
  const dupCount=getDuplicateTaskIdSet().size;
  const recentAddedCount=getTaskVisibleList(R).filter(r=>!r.completed&&isRecentlyAddedTask(r)).length;
  h+=`<div class="task-filters-wrap${taskFiltersOpen?" open":""}"><button type="button" class="task-filters-toggle chip-btn" onclick="toggleTaskFiltersPanel()" aria-expanded="${taskFiltersOpen?"true":"false"}">Filters <span class="task-filters-chev" aria-hidden="true">${taskFiltersOpen?"▴":"▾"}</span></button><div class="task-filters-panel" ${taskFiltersOpen?"":"hidden"}><div class="task-filter-head"><div class="task-filter-label">Task views</div><div class="task-filter-actions"><button class="chip-btn${filter==='all'?' on':''}" onclick="filter='all';render()">Active</button><button class="chip-btn${filter==='done'?' on':''}" onclick="filter='done';render()">Done</button><button class="chip-btn${filter==='recent'?' on':''}" onclick="filter='recent';render()">Recently Added${recentAddedCount?` (${recentAddedCount})`:''}</button><button class="chip-btn${filter==='duplicates'?' on':''}" onclick="filter='duplicates';render()">Duplicates${dupCount?` (${dupCount})`:''}</button>${filter==='duplicates'&&dupCount?`<button class="chip-btn" onclick="deleteAllDuplicatesFromFilter()">Delete all duplicates</button>`:''}${APP_SHELL_MINIMAL?'':`<button class="chip-btn" onclick="openAiRecategorizeModal()">AI recategorize</button>`}<button class="chip-btn" onclick="openBulkImport()">Bulk import</button></div></div><div class="filters task-cat-row">`;
  CATS.forEach(c=>{h+=`<button class="fbtn${filter===c.key?' active':''}" onclick="filter='${c.key}';render()">${c.icon} ${c.label}</button>`});
  h+=`<button class="fbtn" onclick="go('settings');setTimeout(()=>document.getElementById('catManage')?.scrollIntoView({behavior:'smooth',block:'start'}),120)">⚙ Manage categories</button></div></div></div><div class="sort-row"><span id="taskCountLabel">${listCount} items${sortBy==='manual'?' · drag to reorder':''}</span><select onchange="setSort(this.value)"><option value="date"${sortBy==='date'?' selected':''}>Date</option><option value="priority"${sortBy==='priority'?' selected':''}>Priority</option><option value="name"${sortBy==='name'?' selected':''}>A-Z</option><option value="manual"${sortBy==='manual'?' selected':''}>Manual</option></select></div>`;
  if(tasksBatchMode){
    const n=tasksBatchSelected.size;
    h+=`<div class="task-batch-toolbar safe-row" style="padding:8px 14px 4px;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:12px;font-weight:700;color:var(--text3)">${n} selected</span><button type="button" class="chip-btn" onclick="selectAllVisibleTasksForBatch()">All in view</button><button type="button" class="chip-btn" style="background:var(--green);color:#fff;border-color:transparent" onclick="tasksBatchDone()">Done</button><button type="button" class="chip-btn" style="background:var(--red);color:#fff;border-color:transparent" onclick="tasksBatchDel()" ${n===0?'disabled':''}>Delete (${n})</button><button type="button" class="chip-btn" onclick="exitTasksBatch()">Cancel</button></div>`;
  }else{
    h+=`<div class="task-batch-toolbar" style="padding:4px 14px 0"><button type="button" class="chip-btn" onclick="tasksBatchMode=true;tasksBatchSelected.clear();render()">Select tasks</button></div>`;
  }
  const mainListHtml=filter==='all'?rGroupedTaskList(groupedBase):rCards(filteredTasks);
  h+=`<div class="task-desktop-grid"><div class="task-main-col"><div class="clist task-stack${filter==='all'?' task-stack-grouped':''}" id="taskList">${mainListHtml}</div></div>${rTaskWorkspaceAside()}</div>`;return h;
}
function rCards(list){
  if(!list.length)return`<div class="empty task-empty-nlp"><div class="empty-i">✨</div><div class="empty-t">No tasks yet — try typing <span class="empty-quote">'soccer Tuesday 4pm'</span> in the box above.</div><div class="empty-nlp-arrow" aria-hidden="true">↑</div></div>`;
  return list.map(r=>{
    const u=urg(r.dueDate),cat=getCategory(r.category),pri=PRIS.find(p=>p.key===r.priority)||PRIS[0];
    const stD=(r.subtasks||[]).filter(s=>s.done).length,stT=(r.subtasks||[]).length;const blocked=!!(r.dependsOn&&R.find(x=>x.id===r.dependsOn && !x.completed));
    const kid=r.childId?X.children.find(c=>c.id===r.childId):null;
    const overdueBadge=u==='overdue'&&!r.completed?'<span class="cbdg bdg-overdue-label">Overdue</span>':'';
    const dueHuman=fmtTaskDueHuman(r.dueDate);
    const dueLineCls='cdate-line'+(dueHuman==='No date'?' cdate-muted':'');
    return`<div class="card pri-${r.priority||'low'}${r.completed?' completed':''}${tasksBatchMode&&view==='tasks'&&tasksBatchSelected.has(r.id)?' task-card-batch-selected':''}" data-task-id="${r.id}" draggable="${tasksBatchMode&&view==='tasks'?'false':'true'}" ondragstart="dragS(event,'${r.id}')" ondragover="dragO(event)" ondragleave="this.classList.remove('drag-over')" ondrop="dragD(event,'${r.id}')" ontouchstart="taskTouchStart(event,'${r.id}')" ontouchmove="taskTouchMove(event,'${r.id}')" ontouchend="taskTouchEnd(event,'${r.id}')" ontouchcancel="taskTouchCancel(event,'${r.id}')" oncontextmenu="event.preventDefault();openTaskMenu('${r.id}')">
      <div class="crow">
        ${tasksBatchMode&&view==='tasks'?`<label class="task-batch-pick" onclick="event.stopPropagation()"><input type="checkbox" aria-label="Select task" ${tasksBatchSelected.has(r.id)?'checked':''} onchange="toggleTasksBatch('${r.id}',this.checked)"></label>`:''}<span class="drag-handle">⠿</span>
        <button class="chk${r.completed?' on':''}" onclick="${blocked?"alert('Complete the dependency first!')":"toggleComp('"+r.id+"')"}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></button>
        <div class="cbody"${tasksBatchMode&&view==='tasks'?' style="cursor:pointer" onclick="taskCardBodyBatchTap(event,\''+r.id+'\')"':''}>
          <div class="ctop"><span class="cbadge" style="${categoryBadgeStyle(cat)}">${cat.icon} ${cat.label}</span>${taskSourceBadge(r)}${r.pinned?'<span class="ctag">📌 pinned</span>':''}${isInTop3(r.id)?'<span class="ctag">⭐ top 3</span>':''}${r.nag?'<span class="ctag">🔔 nag</span>':''}${r.bundle?`<span class="ctag">${esc(bundleLabel(r.bundle))}</span>`:''}${kid?`<span class="ctag">${esc(kid.icon)} ${esc(kid.name)}</span>`:''}${(r.tags||[]).slice(0,2).map(t=>`<span class="ctag">#${esc(t)}</span>`).join('')}</div>
          <div class="ctitle" onclick="event.stopPropagation();${tasksBatchMode&&view==='tasks'?'toggleTasksBatchToggle(\''+r.id+'\')':'openEdit(\''+r.id+'\')'}" style="cursor:pointer">${esc(r.title)}</div>
          ${r.notes?`<div class="cnotes">${esc(r.notes.length>110?r.notes.slice(0,110)+'...':r.notes)}</div>`:''}
          ${blocked?`<div class="cdep">🔗 Blocked by: ${esc(R.find(x=>x.id===r.dependsOn)?.title||'?')}</div>`:''}
          ${r.subject?`<div class="ctime">📚 ${esc(r.subject)}${r.grade?` · ${esc(r.grade)}`:''}</div>`:''}
          ${r.amount?`<div class="ctime">💵 $${Number(r.amount).toFixed(2)}</div>`:''}
          ${r.billable?`<div class="ctime">💰 Billable</div>`:''}
          ${r.effort?`<div class="ctime">⏱️ ${EFFORTS.find(e=>e.key===r.effort)?.label||r.effort}</div>`:''}
          ${stT?`<div class="csubs">${(r.subtasks||[]).map((s,i)=>`<div class="csub${s.done?' dn':''}"><button class="csubchk${s.done?' on':''}" onclick="toggleSub('${r.id}',${i})">${s.done?'✓':''}</button><span>${esc(s.text)}</span></div>`).join('')}<div style="font-size:9px;color:var(--text3)">${stD}/${stT}</div></div>`:''}
          <div class="cmeta">${overdueBadge}<span class="${dueLineCls}">${dueHuman}</span>${r.startDate?`<span class="cdate">Start ${fmtD(r.startDate)}</span>`:''}${r.recurrence&&r.recurrence!=='none'?`<span class="crec">🔁 ${r.recurrence}</span>`:''}${u==='overdue'&&!r.completed?`<button class="csnz" onclick="openSnooze('${r.id}')">💤 Snooze</button>`:''}</div>
        </div>
        <div class="cacts"><button type="button" class="cact cact-row-desktop" onclick="event.stopPropagation();openEdit('${r.id}')" aria-label="Edit">✏️</button><button type="button" class="cact cact-row-desktop" onclick="event.stopPropagation();delR('${r.id}')" aria-label="Delete">🗑</button><button type="button" class="cact cact-row-mobile-overflow" onclick="event.stopPropagation();openTaskCardQuickActions('${r.id}')" aria-haspopup="dialog" aria-label="More">⋯</button></div>
      </div>
    </div>`;
  }).join('');
}
function resetTouchState(){if(touchState.timer)clearTimeout(touchState.timer);touchState={id:null,x:0,y:0,t:0,timer:null,menuOpened:false,cancelled:false};}
function taskTouchStart(e,id){const t=e.changedTouches?.[0];if(!t)return;resetTouchState();touchState={id,x:t.clientX,y:t.clientY,t:Date.now(),timer:setTimeout(()=>{touchState.menuOpened=true;openTaskMenu(id)},520),menuOpened:false,cancelled:false};}
function taskTouchMove(e,id){const t=e.changedTouches?.[0];if(!t||touchState.id!==id)return;const dx=t.clientX-touchState.x,dy=t.clientY-touchState.y;if(Math.abs(dx)>12||Math.abs(dy)>12){touchState.cancelled=true;if(touchState.timer){clearTimeout(touchState.timer);touchState.timer=null;}}}
function taskTouchCancel(e,id){if(touchState.id===id)resetTouchState();}
function taskTouchEnd(e,id){const t=e.changedTouches?.[0];if(!t)return;const dx=t.clientX-touchState.x,dy=t.clientY-touchState.y;const menuOpened=touchState.menuOpened;const cancelled=touchState.cancelled;if(touchState.timer)clearTimeout(touchState.timer);resetTouchState();if(menuOpened||cancelled)return;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)){if(dx<0)toggleComp(id);else openSnooze(id);}}
function openTaskCardQuickActions(id){
  const r=R.find(x=>x.id===id);if(!r)return;
  const ov=document.createElement('div');ov.className='mo';ov.id='taskQuickActM';ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in task-quick-actions-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>${esc(r.title)}</h3><div class="snz-opt" onclick="document.getElementById('taskQuickActM')?.remove();openEdit('${id}')">✏️ Edit</div><div class="snz-opt" onclick="document.getElementById('taskQuickActM')?.remove();delR('${id}')" style="color:var(--red)">🗑 Delete</div></div>`;
  document.body.appendChild(ov);
}
function openTaskMenu(id){const r=R.find(x=>x.id===id);if(!r)return;const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>${esc(r.title)}</h3><div class="snz-opt" onclick="toggleTop3('${id}');this.closest('.mo').remove()">⭐ ${isInTop3(id)?'Remove from':'Add to'} Top 3</div><div class="snz-opt" onclick="togglePin('${id}');this.closest('.mo').remove()">📌 ${r.pinned?'Unpin':'Pin'} task</div><div class="snz-opt" onclick="duplicateTask('${id}');this.closest('.mo').remove()">📄 Duplicate</div><div class="snz-opt" onclick="openFocus('${id}');this.closest('.mo').remove()">🎯 Focus mode</div><div class="snz-opt" onclick="openSnooze('${id}');this.closest('.mo').remove()">💤 Snooze</div><div class="snz-opt" onclick="delR('${id}');this.closest('.mo').remove()">🗑 Delete</div></div>`;document.body.appendChild(ov)}
function togglePin(id){const r=R.find(x=>x.id===id);if(!r)return;r.pinned=!r.pinned;reindexOrders(false);sv();render();}
function duplicateTask(id){const r=R.find(x=>x.id===id);if(!r)return;const copy=normalizeReminder({...r,id:gid(),title:`${r.title} (copy)`,completed:false,completedAt:undefined,createdAt:new Date().toISOString(),order:R.length,subtasks:(r.subtasks||[]).map(s=>({...s,done:false}))},R.length);R.unshift(copy);logAction('duplicate',`Duplicated ${r.title}`);sv();render();showToast('Task duplicated');}
function triggerCompletionCelebration(){const s=document.createElement('div');s.className='sparkle';s.textContent='✨';s.style.left='50%';s.style.top='40%';document.body.appendChild(s);setTimeout(()=>s.remove(),850);try{if(navigator.vibrate)navigator.vibrate([15,40,15])}catch(e){}try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.value=.01;o.start();g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.12);o.stop(ctx.currentTime+.12);}catch(e){}}
function taskListLikelyHidesCompleted(){return view==='tasks'&&filter!=='done'}
function markTaskCompletingUi(id){
  const card=document.querySelector(`[data-task-id="${id}"]`);
  if(!card)return;
  card.style.setProperty('--complete-fade-ms',(getCompletionFadeMs()/1000)+'s');
  card.classList.add('completed','completing');
  const chk=card.querySelector('.chk');
  if(chk)chk.classList.add('on');
}
function clearPendingCompletionTimer(id){
  if(!completionPendingTimers[id])return;
  clearTimeout(completionPendingTimers[id]);
  delete completionPendingTimers[id];
}
function getCompletionFadeMs(){
  const k=String(S.completionAnimSpeed||'normal');
  if(k==='fast')return 350;
  if(k==='slow')return 1200;
  return 700;
}
function previewCompletionAnimation(){
  const root=document.getElementById('tf-completion-preview');
  if(!root)return;
  root.classList.remove('completing');
  root.style.setProperty('--complete-fade-ms',(getCompletionFadeMs()/1000)+'s');
  // Restart transition predictably when repeatedly tapping preview.
  void root.offsetWidth;
  root.classList.add('completing');
  setTimeout(()=>root.classList.remove('completing'),getCompletionFadeMs()+80);
}
function reopenTask(id){
  const r=R.find(x=>x.id===id);if(!r)return;
  clearPendingCompletionTimer(id);
  r.completed=false;delete r.completedAt;
  logAction('reopen',`Re-opened ${r.title}`,{id});
  reindexOrders(false);sv();render();showToast('Task moved back to active');
}
function finalizeTaskCompletion(r,id,prev){
  r.completedAt=new Date().toISOString();
  logAction('complete',`Completed ${r.title}`,{id});
  if(r.childId){const kid=X.children.find(c=>c.id===r.childId);if(kid)kid.points+=1;}
  if(r.recurrence&&r.recurrence!=='none'){
    const d=new Date(r.dueDate);if(r.recurrence==='daily')d.setDate(d.getDate()+1);else if(r.recurrence==='weekly')d.setDate(d.getDate()+7);else if(r.recurrence==='biweekly')d.setDate(d.getDate()+14);else if(r.recurrence==='monthly')d.setMonth(d.getMonth()+1);else if(r.recurrence==='weekdays'){d.setDate(d.getDate()+1);while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()+1)}else if(r.recurrence==='first_mon'){d.setMonth(d.getMonth()+1);d.setDate(1);while(d.getDay()!==1)d.setDate(d.getDate()+1)}
    R.push(normalizeReminder({...r,id:gid(),completed:false,completedAt:undefined,dueDate:d.toISOString(),createdAt:new Date().toISOString(),alerts:[...(r.alerts||[])],tags:[...(r.tags||[])],subtasks:(r.subtasks||[]).map(s=>({...s,done:false})),order:R.length},R.length));
  }
  triggerCompletionCelebration();
  lastCompletionState={id,prev};
  _undoCallback=()=>{const rr=R.find(x=>x.id===id);if(rr){rr.completed=prev.completed;rr.completedAt=prev.completedAt;rr.dueDate=prev.dueDate;sv();render();}};
  showToast('Completed','Undo');
  reindexOrders(false);sv();render();
}
function toggleComp(id){
  const r=R.find(x=>x.id===id);if(!r)return;
  const prev={completed:r.completed,completedAt:r.completedAt,dueDate:r.dueDate};
  if(r.completed&&completionPendingTimers[id]){
    reopenTask(id);
    return;
  }
  r.completed=!r.completed;clearReminderKeys(id);
  if(r.completed){
    if(taskListLikelyHidesCompleted()){
      markTaskCompletingUi(id);
      completionPendingTimers[id]=setTimeout(()=>{
        clearPendingCompletionTimer(id);
        finalizeTaskCompletion(r,id,prev);
      },getCompletionFadeMs());
      sv(false);
      return;
    }
    finalizeTaskCompletion(r,id,prev);
    return;
  } else {clearPendingCompletionTimer(id);delete r.completedAt;logAction('reopen',`Re-opened ${r.title}`,{id});}
  reindexOrders(false);sv();render();
}
function useClipboardSuggestion(){if(!X.clipboardSuggestion)return;nlpDraft=X.clipboardSuggestion;X.clipboardSuggestion=null;sv(false);go('tasks');setTimeout(()=>{const inp=document.getElementById('nlpIn');if(inp){inp.value=nlpDraft;inp.focus();}},60)}
function dismissClipboardSuggestion(){X.clipboardSuggestion=null;sv(false);render();}
function rMyDay(){
  let h=rHdr('My Day','Focus on what matters');if(ttActive)h+=rTTActive();
  const tasks=R.filter(r=>!r.completed&&(isToday(r.dueDate)||urg(r.dueDate)==='overdue')).sort((a,b)=>((isInTop3(b.id)?1:0)-(isInTop3(a.id)?1:0))||new Date(a.dueDate)-new Date(b.dueDate));
  const plan=buildProductivityPlan({scopedToday:true});
  const grouped={morning:[],afternoon:[],evening:[],any:[]};
  tasks.forEach(r=>{const key=r.bundle||'any';(grouped[key]||grouped.any).push(r)});
  h+=`<div class="prod-toolbar"><div class="prod-row"><button class="xbtn" onclick="openTop3Picker()">⭐ Pick top 3</button><button class="xbtn" onclick="openPowerHourPlan()">⚡ Build next block</button><button class="xbtn" onclick="openRecoveryPlan()">🧹 Reset pile</button></div><div class="prod-row"><span class="lane-pill${X.energyLevel==='low'?' on':''}" onclick="setEnergyLevel('low')">Low energy</span><span class="lane-pill${X.energyLevel==='normal'?' on':''}" onclick="setEnergyLevel('normal')">Normal</span><span class="lane-pill${X.energyLevel==='high'?' on':''}" onclick="setEnergyLevel('high')">High energy</span></div><div class="prod-row"><span class="lane-pill${Number(X.availableMinutes||30)===15?' on':''}" onclick="setAvailableMinutes(15)">15 min</span><span class="lane-pill${Number(X.availableMinutes||30)===30?' on':''}" onclick="setAvailableMinutes(30)">30 min</span><span class="lane-pill${Number(X.availableMinutes||30)===60?' on':''}" onclick="setAvailableMinutes(60)">60 min</span><span class="lane-pill${Number(X.availableMinutes||30)===90?' on':''}" onclick="setAvailableMinutes(90)">90 min</span></div><div class="prod-row"><span class="lane-pill${X.focusStyle==='balanced'?' on':''}" onclick="setFocusStyle('balanced')">Balanced</span><span class="lane-pill${X.focusStyle==='quick'?' on':''}" onclick="setFocusStyle('quick')">Quick wins</span><span class="lane-pill${X.focusStyle==='deep'?' on':''}" onclick="setFocusStyle('deep')">Deep work</span><span class="lane-pill${X.focusStyle==='admin'?' on':''}" onclick="setFocusStyle('admin')">Admin</span></div></div>`;
  h+=`<div style="padding:0 14px"><div class="prod-kpis"><div class="prod-kpi" onclick="filter='overdue';go('tasks')" style="cursor:pointer"><b>${plan.stats.overdue}</b><span>Overdue</span></div><div class="prod-kpi" onclick="filter='all';go('tasks')" style="cursor:pointer"><b>${plan.stats.fit}</b><span>Fit this window</span></div><div class="prod-kpi" onclick="filter='all';go('tasks')" style="cursor:pointer"><b>${plan.queue.length}</b><span>In your queue</span></div></div></div>`;
  h+=`<div class="coach-banner"><h3>${esc(plan.coach.title)}</h3><p>${esc(plan.coach.body)}</p><div class="hero-actions"><button class="chip-btn" onclick="go('whatnow')">What should I do?</button><button class="chip-btn" onclick="openPowerHourPlan()">Open plan</button></div></div>`;
  if(plan.queue.length)h+=`<div class="panel"><h3>Next ${plan.minutes} minutes</h3><div class="focus-queue">${plan.queue.map((task,i)=>`<div class="focus-step"><b>${i+1}. ${esc(task.title)}</b><span>${task.effort} min · ${esc(task.reasons.join(' • ')||'good fit')}</span><div class="safe-row" style="margin-top:8px"><button class="chip-btn" onclick="openFocus('${task.id}')">Focus</button><button class="chip-btn" onclick="toggleComp('${task.id}')">Done</button></div></div>`).join('')}</div></div>`;
  h+=`<div class="plan-grid" style="padding:0 14px 4px"><div class="plan-card"><h4>Quick wins</h4>${plan.quickWins.length?plan.quickWins.map(task=>`<div class="queue-line"><div><b>${esc(task.title)}</b><span>${esc(getCategory(task.category).label)} · ${esc(task.reasons[0]||'fast win')}</span></div><div class="queue-min">${task.effort}m</div></div>`).join(''):'<div class="sdesc">No clear quick wins.</div>'}</div><div class="plan-card"><h4>Deep work</h4>${plan.deepWork.length?plan.deepWork.map(task=>`<div class="queue-line"><div><b>${esc(task.title)}</b><span>${esc(getCategory(task.category).label)} · best ${task.bestDay}</span></div><div class="queue-min">${task.effort}m</div></div>`).join(''):'<div class="sdesc">Nothing heavy needs your brain right now.</div>'}</div></div>`;
  if(plan.batches.length)h+=`<div class="panel"><h3>Batch together</h3>${plan.batches.map(group=>`<div class="list-row"><div class="list-main"><b>${esc(group.icon)} ${esc(group.label)}</b><span>${group.items.map(t=>t.title).join(' · ')}</span></div></div>`).join('')}</div>`;
  h+=`<div class="clist compact-cards" style="padding-top:2px">`;
  [['morning','🌅 Morning'],['afternoon','☀️ Afternoon'],['evening','🌙 Evening'],['any','📌 Anytime']].forEach(([key,label])=>{if(grouped[key].length)h+=`<div class="panel" style="margin:0 14px 10px"><h3 style="margin-bottom:10px">${label}</h3>${rCards(grouped[key])}</div>`});
  if(!tasks.length)h+=`<div class="empty"><div class="empty-i">🌤️</div><div class="empty-t">Nothing scheduled for today</div></div>`;
  h+=`</div>`;return h;
}
function openTop3Picker(){const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov){ov.remove();render()}};ov.id='top3M';ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Pick your top 3 for today</h3><div id="top3List"></div><button class="sbtn" onclick="document.getElementById('top3M').remove();render()">Close</button></div>`;document.body.appendChild(ov);refreshTop3Modal()}
function refreshTop3Modal(){const el=document.getElementById('top3List');if(!el)return;const tasks=R.filter(r=>!r.completed&&(isToday(r.dueDate)||urg(r.dueDate)==='overdue')).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));el.innerHTML=tasks.map(r=>`<div class="snz-opt" onclick="toggleTop3('${r.id}')">${isInTop3(r.id)?'✅':'⬜'} ${esc(r.title)}</div>`).join('')||'<div class="empty"><div class="empty-t">No tasks due today</div></div>';}
function openFocus(id){const r=R.find(x=>x.id===id);if(!r)return;const ov=document.createElement('div');ov.className='focus-ov';ov.id='focusOv';ov.innerHTML=`<div style="font-size:18px;color:var(--text3);font-weight:700">Focus mode</div><div class="focus-title">${esc(r.title)}</div>${r.notes?`<div class="focus-notes">${esc(r.notes)}</div>`:''}${r.subtasks?.length?`<div class="panel" style="margin:0 auto 18px;max-width:340px;text-align:left">${r.subtasks.map((s,i)=>`<div class="csub${s.done?' dn':''}"><button class="csubchk${s.done?' on':''}" onclick="toggleSub('${r.id}',${i});openFocus('${r.id}')">${s.done?'✓':''}</button><span>${esc(s.text)}</span></div>`).join('')}</div>`:''}<div class="focus-actions"><button style="background:var(--green);color:#fff" onclick="toggleComp('${r.id}');document.getElementById('focusOv').remove()">✓ Done</button><button style="background:var(--accent);color:#fff" onclick="startPomo('${r.id}')">🍅 Pomodoro</button><button style="background:var(--bg3);color:var(--text2)" onclick="document.getElementById('focusOv').remove()">Close</button></div>`;document.body.appendChild(ov)}
function rHabits(){
  let h=rHdr('Habits','Custom goals and streaks');
  h+=`<div style="padding:10px 14px"><div class="frow"><input id="habIn" placeholder="New habit..." style="margin:0"><select id="habGoal"><option value="daily">Daily goal</option><option value="weekly">Weekly goal</option></select><select id="habTarget"><option value="1">1x</option><option value="2">2x</option><option value="3">3x</option><option value="4">4x</option><option value="5">5x</option><option value="6">6x</option><option value="7">7x</option></select></div><button class="xbtn" onclick="addHabitEnhanced()">+ Add Habit</button></div>`;
  const today=new Date(),days=[];for(let i=6;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);days.push(d)}
  h+=`<div style="padding:0 14px 72px">`;
  habits.forEach((hab,hi)=>{const countThisWeek=days.filter(d=>hab.log.includes(d.toDateString())).length;const goalTxt=hab.goalType==='weekly'?`${countThisWeek}/${hab.target} this week`:`Daily`;h+=`<div class="habit-card"><div class="habit-top"><span class="habit-name">${esc(hab.name)}</span><span class="habit-streak">🔥 ${getHabitStreak(hab)}d</span></div><div style="font-size:11px;color:var(--text3);margin-bottom:8px">${goalTxt}</div><div class="habit-days">${days.map(d=>{const ds=d.toDateString(),done=hab.log&&hab.log.includes(ds),isT=d.toDateString()===today.toDateString();return`<button class="habit-day${done?' done':''}${isT?' today':''}" onclick="toggleHabit(${hi},'${ds}')">${d.toLocaleDateString([],{weekday:'narrow'})}</button>`}).join('')}</div></div>`});
  h+=`</div>`;return h;
}
function addHabitEnhanced(){const inp=document.getElementById('habIn');if(!inp||!inp.value.trim())return;habits.push({id:gid(),name:inp.value.trim(),log:[],goalType:document.getElementById('habGoal')?.value||'daily',target:Number(document.getElementById('habTarget')?.value||1)});logAction('habit',`Added habit ${inp.value.trim()}`);sv();render();}

function groupActionLogByDay(limitDays=14){
  const groups={};
  (X.actionLog||[]).slice().reverse().forEach(a=>{
    const key=fmtLD(new Date(a.date));
    if(!groups[key])groups[key]=[];
    if(groups[key].length<12)groups[key].push(a);
  });
  return Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,limitDays);
}
function openChangelog(){
  const groups=groupActionLogByDay(21);
  const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Daily changelog</h3><div class="sdesc">Added, completed, edited, and deleted activity by day.</div>${groups.map(([day,items])=>`<div class="panel" style="margin:12px 0 0"><h3>${new Date(day+'T00:00').toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'})}</h3>${items.map(a=>`<div class="list-row"><div class="list-main"><b>${esc(a.label)}</b><span>${new Date(a.date).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} · ${esc(a.type||'change')}</span></div></div>`).join('')}</div>`).join('')||'<div class="sdesc" style="margin-top:12px">No actions logged yet.</div>'}<div class="safe-row" style="margin-top:14px"><button class="xbtn" onclick="exportActionLog()">📤 Export log</button><button class="sbtn" onclick="document.getElementById('logM')?.remove()">Close</button></div></div>`;
  document.body.appendChild(ov);
}
function exportActionLog(){
  const rows=['date,type,label'];
  (X.actionLog||[]).forEach(a=>rows.push([csvEsc(a.date),csvEsc(a.type||'change'),csvEsc(a.label||'')].join(',')));
  const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));
  const a=document.createElement('a');a.href=url;a.download='reminders_changelog.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function getHomeworkStats(childId=''){
  const list=(X.homework||[]).filter(h=>!childId||h.childId===childId);
  const subjects={};
  let graded=0,total=0;
  list.forEach(h=>{const key=h.subject||'General';if(!subjects[key])subjects[key]={subject:key,total:0,done:0,graded:0,gradeSum:0};subjects[key].total++;if(h.done)subjects[key].done++;const n=parseFloat(String(h.grade).replace(/[^0-9.]/g,''));if(Number.isFinite(n)){subjects[key].graded++;subjects[key].gradeSum+=n;graded++;total+=n;}});
  return {subjects:Object.values(subjects).sort((a,b)=>a.subject.localeCompare(b.subject)),avg:graded?total/graded:0,gradedCount:graded,totalCount:list.length};
}
function getMoneyCategoryActuals(monthKey=fmtLD(new Date()).slice(0,7)){
  const categories=(X.budgetCategories||[]).map(c=>({id:c.id,name:c.name,budget:Number(c.budget)||0,actual:0}));
  const lookup={};categories.forEach(c=>lookup[c.name.toLowerCase()]=c);
  R.filter(r=>r.category==='bills').forEach(r=>{
    const relevant=(r.completedAt&&String(r.completedAt).startsWith(monthKey))||(!r.completed&&String(r.dueDate).slice(0,7)===monthKey);
    if(!relevant)return;
    const tags=(r.tags||[]).map(t=>String(t).toLowerCase());
    let target=categories.find(c=>tags.includes(c.name.toLowerCase()))||null;
    if(!target){
      const title=(r.title||'').toLowerCase();
      target=categories.find(c=>title.includes(c.name.toLowerCase()))||lookup.utilities&&(/hydro|internet|phone|gas|utility/.test(title)?lookup.utilities:null)||lookup.housing&&/rent|mortgage/.test(title)?lookup.housing:null;
    }
    if(target)target.actual+=(Number(r.amount)||0);
  });
  return categories;
}
function getContributionDeadlineSummary(){
  const year=new Date().getFullYear();
  const rrspDeadline=new Date(year,2,1);rrspDeadline.setDate(rrspDeadline.getDate()-1);
  const tfsaReset=new Date(year,0,1);
  const respTarget=2500;
  const rrspTotal=(X.contributionLogs||[]).filter(c=>String(c.type).toUpperCase().includes('RRSP')&&String(c.date).startsWith(String(year))).reduce((a,c)=>a+(Number(c.amount)||0),0);
  const respTotal=(X.contributionLogs||[]).filter(c=>String(c.type).toUpperCase().includes('RESP')&&String(c.date).startsWith(String(year))).reduce((a,c)=>a+(Number(c.amount)||0),0);
  return {rrspDeadline,tfsaReset,rrspTotal,respTotal,respTarget,respRemaining:Math.max(0,respTarget-respTotal)};
}
function getPayCycleInfo(baseDate=new Date()){
  const anchor=new Date((X.payPeriodAnchor||'2026-01-01')+'T00:00');
  anchor.setHours(0,0,0,0);
  const base=new Date(fmtLD(baseDate)+'T00:00');
  const diff=Math.floor((base-anchor)/86400000);
  const offset=((diff%14)+14)%14;
  const currentStart=new Date(base);currentStart.setDate(base.getDate()-offset);currentStart.setHours(0,0,0,0);
  const currentEnd=new Date(currentStart);currentEnd.setDate(currentStart.getDate()+13);
  const nextStart=new Date(currentStart);nextStart.setDate(currentStart.getDate()+14);
  const nextPayDate=new Date(nextStart);nextPayDate.setDate(nextStart.getDate()+1);
  return {anchor,currentStart,currentEnd,nextStart,nextPayDate};
}
function getPaycheckCalendarRows(count=6){
  const info=getPayCycleInfo(new Date());
  let cycleStart=new Date(info.nextStart);
  const rows=[];
  for(let i=0;i<count;i++){
    const payDate=new Date(cycleStart);payDate.setDate(cycleStart.getDate()+1);
    const prevStart=new Date(cycleStart);prevStart.setDate(cycleStart.getDate()-14);
    const prevEnd=new Date(cycleStart);prevEnd.setDate(cycleStart.getDate()-1);
    const periodShifts=shifts.filter(s=>{const d=new Date(s.date+'T00:00');return d>=prevStart&&d<=prevEnd;});
    const hours=periodShifts.reduce((a,s)=>a+getShiftMinutes(s),0)/60;
    rows.push({anchor:fmtLD(info.anchor),periodStart:fmtLD(prevStart),periodEnd:fmtLD(prevEnd),payDate:fmtLD(payDate),hours,overtime:Math.max(0,hours-80)});
    cycleStart.setDate(cycleStart.getDate()+14);
  }
  return rows;
}
function openPaycheckCalendar(){
  const rows=getPaycheckCalendarRows(8);
  const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Paycheck calendar</h3><div class="mini-item">Current anchor: ${X.payPeriodAnchor||'2026-01-01'}</div>${rows.map(r=>`<div class="list-row"><div class="list-main"><b>Pay ${new Date(r.payDate+'T00:00').toLocaleDateString()}</b><span>${r.periodStart} → ${r.periodEnd} · ${r.hours.toFixed(1)}h${r.overtime?` · OT ${r.overtime.toFixed(1)}h`:''}</span></div></div>`).join('')}</div>`;
  document.body.appendChild(ov);
}
function getTimeSummaryByClient(){
  const map={};
  (timeLogs||[]).forEach(l=>{const key=l.clientId||'unassigned';if(!map[key])map[key]={clientId:key,name:key==='unassigned'?'Unassigned':((X.clients.find(c=>c.id===key)||{}).name||'Client'),ms:0,tags:{}};map[key].ms+=Number(l.duration)||0;const tag=l.taxTag||'general';map[key].tags[tag]=(map[key].tags[tag]||0)+(Number(l.duration)||0);});
  return Object.values(map).sort((a,b)=>b.ms-a.ms);
}
function openTimeSummary(){
  const rows=getTimeSummaryByClient();
  const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Invoice summary</h3>${rows.map(r=>`<div class="panel" style="margin:10px 0 0"><h3>${esc(r.name)}</h3><div class="mini-item">Total ${fmtDur(r.ms)}</div>${Object.entries(r.tags).map(([tag,ms])=>`<div class="mini-item">${esc(tag)} · ${fmtDur(ms)}</div>`).join('')}</div>`).join('')||'<div class="sdesc">No time logs yet.</div>'}</div>`;
  document.body.appendChild(ov);
}
function editHomework(id){const h=X.homework.find(x=>x.id===id);if(!h)return;openHomeworkForm(h.childId,id)}
function deleteHomework(id){const idx=X.homework.findIndex(x=>x.id===id);if(idx<0)return;X.homework.splice(idx,1);sv();render();showToast('Homework deleted');}
function editReadingLog(id){const item=X.readingLogs.find(x=>x.id===id);if(!item)return;openRecordModal({title:'Edit reading log',fields:[{name:'minutes',label:'Minutes read',type:'number',value:String(item.minutes||0)},{name:'lesson',label:'Lesson / Barton level',value:item.lesson||''},{name:'notes',label:'Notes',type:'textarea',value:item.notes||''}],onSubmit:(vals)=>{item.minutes=Number(vals.minutes)||0;item.lesson=(vals.lesson||'').trim();item.notes=(vals.notes||'').trim();sv();render();return true;}})}
function deleteReadingLog(id){const idx=X.readingLogs.findIndex(x=>x.id===id);if(idx<0)return;X.readingLogs.splice(idx,1);sv();render();showToast('Reading log deleted');}
function editKidAppointment(id){const item=X.kidAppointments.find(x=>x.id===id);if(!item)return;openKidAppointmentForm(item.childId,id)}
function deleteKidAppointment(id){const idx=X.kidAppointments.findIndex(x=>x.id===id);if(idx<0)return;X.kidAppointments.splice(idx,1);sv();render();showToast('Appointment deleted');}
function openMedicationForm(id=''){
  const med=id?X.medications.find(x=>x.id===id):null;
  openRecordModal({title:med?'Edit medication':'Add medication',submitLabel:med?'Save medication':'Add medication',fields:[{name:'name',label:'Medication name',value:med?.name||'',required:true},{name:'dose',label:'Dose / amount',value:med?.dose||''},{name:'refill',label:'Refill date',type:'date',value:med?.refillDate?fmtLD(new Date(med.refillDate)):''},{name:'times',label:'Reminder times (comma separated HH:MM)',value:(med?.times||[]).join(', ')}],onSubmit:(vals)=>{const name=vals.name.trim();if(!name)return false;const rec=med||{id:gid()};Object.assign(rec,{name,dose:(vals.dose||'').trim(),refillDate:vals.refill?new Date(vals.refill).toISOString():'',times:(vals.times||'').split(',').map(x=>x.trim()).filter(Boolean)});if(!med)X.medications.unshift(rec);sv();render();return true;}})
}
function editMedication(id){openMedicationForm(id)}
function deleteMedication(id){const idx=X.medications.findIndex(x=>x.id===id);if(idx<0)return;X.medications.splice(idx,1);X.medicationLogs=X.medicationLogs.filter(x=>x.medId!==id);sv();render();showToast('Medication deleted');}
function openSleepLogForm(id=''){
  const s=id?X.sleepLogs.find(x=>x.id===id):null;
  openRecordModal({title:s?'Edit sleep entry':'Add sleep entry',submitLabel:s?'Save sleep entry':'Add sleep entry',fields:[{name:'date',label:'Sleep date',type:'date',value:s?fmtLD(new Date(s.date)):fmtLD(new Date())},{name:'bed',label:'Bedtime',type:'time',value:s?.bed||'22:30'},{name:'wake',label:'Wake time',type:'time',value:s?.wake||'06:30'}],onSubmit:(vals)=>{const rec=s||{id:gid()};Object.assign(rec,{date:new Date((vals.date||fmtLD(new Date()))+'T00:00').toISOString(),bed:vals.bed||'',wake:vals.wake||''});if(!s)X.sleepLogs.push(rec);sv();render();return true;}})
}
function editSleepLog(id){openSleepLogForm(id)}
function deleteSleepLog(id){const idx=X.sleepLogs.findIndex(x=>x.id===id);if(idx<0)return;X.sleepLogs.splice(idx,1);sv();render();showToast('Sleep log deleted');}
function openExerciseLogForm(id=''){
  const x=id?X.exerciseLogs.find(v=>v.id===id):null;
  openRecordModal({title:x?'Edit exercise':'Add exercise',submitLabel:x?'Save exercise':'Add exercise',fields:[{name:'type',label:'Exercise type',value:x?.type||'Walk',required:true},{name:'minutes',label:'Minutes',type:'number',value:String(x?.minutes||20)}],onSubmit:(vals)=>{const rec=x||{id:gid(),date:new Date().toISOString()};Object.assign(rec,{type:(vals.type||'Exercise').trim()||'Exercise',minutes:Number(vals.minutes)||0});if(!x)X.exerciseLogs.push(rec);sv();render();return true;}})
}
function editExerciseLog(id){openExerciseLogForm(id)}
function deleteExerciseLog(id){const idx=X.exerciseLogs.findIndex(x=>x.id===id);if(idx<0)return;X.exerciseLogs.splice(idx,1);sv();render();showToast('Exercise log deleted');}
function openBudgetCategoryForm(id=''){
  const b=id?X.budgetCategories.find(x=>x.id===id):null;
  openRecordModal({title:b?'Edit budget category':'Add budget category',submitLabel:b?'Save category':'Add category',fields:[{name:'name',label:'Category name',value:b?.name||'',required:true},{name:'budget',label:'Monthly budget amount',type:'number',value:String(b?.budget||0)}],onSubmit:(vals)=>{const name=vals.name.trim();if(!name)return false;const rec=b||{id:gid()};Object.assign(rec,{name,budget:Number(vals.budget)||0});if(!b)X.budgetCategories.push(rec);sv();render();return true;}})
}
function editBudgetCategory(id){openBudgetCategoryForm(id)}
function deleteBudgetCategory(id){const idx=X.budgetCategories.findIndex(x=>x.id===id);if(idx<0)return;X.budgetCategories.splice(idx,1);sv();render();showToast('Category deleted');}
function openIncomeEntryForm(id=''){
  const x=id?X.incomes.find(v=>v.id===id):null;
  openRecordModal({title:x?'Edit income':'Add income',submitLabel:x?'Save income':'Add income',fields:[{name:'title',label:'Income title',value:x?.title||'Paycheck',required:true},{name:'amount',label:'Amount',type:'number',value:String(x?.amount||0)},{name:'date',label:'Date',type:'date',value:x?fmtLD(new Date(x.date)):fmtLD(new Date())}],onSubmit:(vals)=>{const rec=x||{id:gid()};Object.assign(rec,{title:(vals.title||'Income').trim()||'Income',amount:Number(vals.amount)||0,date:new Date((vals.date||fmtLD(new Date()))+'T00:00').toISOString()});if(!x)X.incomes.unshift(rec);sv();render();return true;}})
}
function editIncomeEntry(id){openIncomeEntryForm(id)}
function deleteIncomeEntry(id){const idx=X.incomes.findIndex(x=>x.id===id);if(idx<0)return;X.incomes.splice(idx,1);sv();render();showToast('Income entry deleted');}
function openContributionForm(id=''){
  const x=id?X.contributionLogs.find(v=>v.id===id):null;
  openRecordModal({title:x?'Edit contribution':'Add contribution',submitLabel:x?'Save contribution':'Add contribution',fields:[{name:'type',label:'Contribution type',type:'select',value:x?.type||'RRSP',options:[{value:'RRSP',label:'RRSP'},{value:'RESP',label:'RESP'},{value:'RDSP',label:'RDSP'},{value:'TFSA',label:'TFSA'}]},{name:'amount',label:'Amount',type:'number',value:String(x?.amount||0)},{name:'notes',label:'Notes',type:'textarea',value:x?.notes||''}],onSubmit:(vals)=>{const rec=x||{id:gid(),date:new Date().toISOString()};Object.assign(rec,{type:vals.type||'RRSP',amount:Number(vals.amount)||0,notes:(vals.notes||'').trim()});if(!x)X.contributionLogs.unshift(rec);sv();render();return true;}})
}
function editContribution(id){openContributionForm(id)}
function deleteContribution(id){const idx=X.contributionLogs.findIndex(x=>x.id===id);if(idx<0)return;X.contributionLogs.splice(idx,1);sv();render();showToast('Contribution deleted');}
function openVehicleLogForm(id=''){
  const v=id?X.vehicleLogs.find(x=>x.id===id):null;
  openRecordModal({title:v?'Edit vehicle service':'Add vehicle service',submitLabel:v?'Save service':'Add service',fields:[{name:'title',label:'Service item',value:v?.title||'Oil change',required:true},{name:'odometer',label:'Odometer (km)',type:'number',value:String(v?.odometer||'')},{name:'notes',label:'Notes',type:'textarea',value:v?.notes||''}],onSubmit:(vals)=>{const title=vals.title.trim();if(!title)return false;const rec=v||{id:gid(),date:new Date().toISOString()};Object.assign(rec,{title,odometer:String(vals.odometer||'').trim(),notes:(vals.notes||'').trim()});if(!v)X.vehicleLogs.unshift(rec);sv();render();return true;}})
}
function editVehicleEntry(id){openVehicleLogForm(id)}
function deleteVehicleEntry(id){const idx=X.vehicleLogs.findIndex(x=>x.id===id);if(idx<0)return;X.vehicleLogs.splice(idx,1);sv();render();showToast('Vehicle log deleted');}
function editSeasonalReminder(id){addSeasonalReminder(id)}
function deleteSeasonalReminder(id){const idx=X.seasonalReminders.findIndex(x=>x.id===id);if(idx<0)return;X.seasonalReminders.splice(idx,1);sv();render();showToast('Seasonal reminder deleted');}
function openClientProfileForm(id=''){
  const c=id?X.clients.find(x=>x.id===id):null;
  openRecordModal({title:c?'Edit client':'Add client',submitLabel:c?'Save client':'Add client',fields:[{name:'name',label:'Client name',value:c?.name||'',required:true},{name:'address',label:'Address',value:c?.address||''},{name:'phone',label:'Phone',value:c?.phone||''},{name:'notes',label:'Notes',type:'textarea',value:c?.notes||''}],onSubmit:(vals)=>{const name=vals.name.trim();if(!name)return false;const rec=c||{id:gid()};Object.assign(rec,{name,address:(vals.address||'').trim(),phone:(vals.phone||'').trim(),notes:(vals.notes||'').trim()});if(!c)X.clients.unshift(rec);sv();render();return true;}})
}
function addClientProfile(){openClientProfileForm()}
function editClientProfile(id){openClientProfileForm(id)}
function deleteClientProfile(id){const idx=X.clients.findIndex(x=>x.id===id);if(idx<0)return;X.clients.splice(idx,1);timeLogs.forEach(l=>{if(l.clientId===id)l.clientId=''});sv();render();showToast('Client removed')}
function buildSyncDiagnosticsLocal(){
  const raw=(R||[]).filter(Boolean);
  const visible=getTaskVisibleList(raw);
  const visibleActive=visible.filter(r=>!r.completed);
  const hiddenByStart=visibleActive.filter(r=>!isTaskStartVisible(r)).length;
  const completed=visible.filter(r=>r.completed).length;
  const autoPrayerHidden=Math.max(0,raw.length-visible.length);
  return {rawTotal:raw.length,visibleTotal:visible.length,visibleActive:visibleActive.length,completed,hiddenByStart,autoPrayerHidden};
}
async function runSyncDiagnostics(){
  if(typeof authManager==='undefined'||!authManager.isAuthenticated()){
    showToast('Sign in first to run diagnostics');
    return;
  }
  const startedAt=new Date().toISOString();
  X.syncDiagnostics={loading:true,ranAt:startedAt,error:''};
  sv(false);render();
  try{
    const local=buildSyncDiagnosticsLocal();
    let cloudTotal=null;
    if(typeof supabase!=='undefined'&&typeof supabase.getTasks==='function'){
      const cloud=await supabase.getTasks();
      cloudTotal=Array.isArray(cloud)?cloud.length:0;
    }
    X.syncDiagnostics={loading:false,ranAt:new Date().toISOString(),error:'',local,cloudTotal};
    sv(false);render();showToast('Sync diagnostics updated');
  }catch(err){
    X.syncDiagnostics={loading:false,ranAt:new Date().toISOString(),error:String(err?.message||err||'Failed to load diagnostics')};
    sv(false);render();showToast('Diagnostics failed');
  }
}
function rSettings(){
  const perm=('Notification'in window)?Notification.permission:'unsupported';let h=rHdr('Settings','Customize and safeguard');
  h+=`<div class="settings"><div class="sitem"><div><div class="slbl">Dark Mode</div></div><button class="tog${S.darkMode?' on':''}" onclick="toggleDark()"></button></div>`;
  h+=`<div class="sitem"><div><div class="slbl">Notifications</div><div class="sdesc">${perm==='granted'?'Enabled ✅':perm==='denied'?'Blocked in browser settings':'Tap to enable'}</div></div><button class="tog${perm==='granted'?' on':''}" onclick="reqNotif()"></button></div>`;
  const aiUsage=getAiUsageToday(),aiLimit=getAiDailyLimit(),aiMode=getAiMode(),chatMode=getChatAutonomyMode(),chatDry=isChatDryRunEnabled(),chatCap=getChatActionCap();
  h+=`<div class="panel"><h3>AI controls</h3><div class="sdesc" style="margin-bottom:8px">Mode controls add-form assist and chat AI calls.</div><div class="safe-row"><button class="chip-btn${aiMode==='off'?' on':''}" onclick="setAiAssistMode('off')">Off</button><button class="chip-btn${aiMode==='manual'?' on':''}" onclick="setAiAssistMode('manual')">Manual</button><button class="chip-btn${aiMode==='auto'?' on':''}" onclick="setAiAssistMode('auto')">Auto</button></div><div class="list-row"><div class="list-main"><b>Today usage</b><span>${aiUsage.calls}/${aiLimit} calls · categorize ${aiUsage.byType?.categorize||0} · chat ${aiUsage.byType?.chat||0} · action ${aiUsage.byType?.action||0} · edit ${aiUsage.byType?.edit||0}</span></div></div><div class="safe-row"><button class="xbtn" onclick="setAiDailyLimit(20)">20/day</button><button class="xbtn" onclick="setAiDailyLimit(40)">40/day</button><button class="xbtn" onclick="setAiDailyLimit(80)">80/day</button><button class="xbtn" onclick="resetAiUsageToday()">Reset today</button></div><div class="list-row"><div class="list-main"><b>Chat autonomy</b><span>${chatMode==='agentic'?'Agentic (guarded)':'Assistive'} · ${chatDry?'dry run on':'dry run off'} · cap ${chatCap} action${chatCap===1?'':'s'} per request · planner ${isChatPlannerEnabled()?'on':'off'}</span></div></div><div class="safe-row"><button class="chip-btn${chatMode==='assistive'?' on':''}" onclick="setChatAutonomyMode('assistive')">Assistive</button><button class="chip-btn${chatMode==='agentic'?' on':''}" onclick="setChatAutonomyMode('agentic')">Agentic (guarded)</button><button class="chip-btn${chatDry?' on':''}" onclick="setChatDryRun(!isChatDryRunEnabled())">${chatDry?'Dry run: ON':'Dry run: OFF'}</button><button class="chip-btn${isChatPlannerEnabled()?' on':''}" onclick="setChatPlannerEnabled(!isChatPlannerEnabled())">${isChatPlannerEnabled()?'Planner: ON':'Planner: OFF'}</button><select onchange="setChatActionCap(this.value)"><option value="5"${chatCap===5?' selected':''}>Cap 5</option><option value="10"${chatCap===10?' selected':''}>Cap 10</option><option value="20"${chatCap===20?' selected':''}>Cap 20</option><option value="50"${chatCap===50?' selected':''}>Cap 50</option></select></div></div>`;
  h+=`<div class="panel" id="tf-account-panel"><h3>Account &amp; sync</h3>`;
  if(typeof authManager!=='undefined'&&authManager.isAuthenticated()){
    const u=authManager.getUser();
    const email=esc((u&&u.email)||'Signed in');
    const st=(typeof syncManager!=='undefined')?esc(syncManager.getSyncStatus()):'—';
    const syncMode=getSyncMode();
    const syncSec=getSyncIntervalSec();
    const diag=X.syncDiagnostics||{};
    const local=diag.local||null;
    h+=`<div class="list-row"><div class="list-main"><b>${email}</b><span id="tf-settings-sync-status">Cloud: ${st}</span></div></div><div class="safe-row" style="margin-top:10px"><button class="sbtn" type="button" id="tf-btn-sync-now" onclick="typeof tfManualSyncClick==='function'&&tfManualSyncClick(event)">↻ Sync now</button><button class="xbtn" type="button" onclick="runSyncDiagnostics()">🩺 Sync diagnostics</button><button class="xbtn" type="button" id="tf-btn-sign-out" style="background:var(--red);color:#fff;border-color:transparent" onclick="typeof tfSignOutClick==='function'&&tfSignOutClick(event)">Sign out</button></div>`;
    h+=`<div class="panel" style="margin:10px 0 0"><h3>Sync mode</h3><div class="sdesc" style="margin-bottom:8px">Choose always-on auto sync or manual-only sync.</div><div class="safe-row"><button class="chip-btn${syncMode==='manual'?' on':''}" onclick="setSyncMode('manual')">Manual only</button><button class="chip-btn${syncMode==='auto'?' on':''}" onclick="setSyncMode('auto')">Auto sync</button><select onchange="setSyncIntervalSec(this.value)" ${syncMode==='manual'?'disabled':''}><option value="15"${syncSec===15?' selected':''}>Every 15s</option><option value="30"${syncSec===30?' selected':''}>Every 30s</option><option value="60"${syncSec===60?' selected':''}>Every 1 min</option><option value="300"${syncSec===300?' selected':''}>Every 5 min</option><option value="900"${syncSec===900?' selected':''}>Every 15 min</option><option value="1800"${syncSec===1800?' selected':''}>Every 30 min</option><option value="3600"${syncSec===3600?' selected':''}>Every 1 hour</option></select></div><div class="sdesc" style="margin-top:8px">${syncMode==='manual'?'Auto sync is off. Use "Sync now" when you want to sync.':'Auto sync is active at your selected interval.'}</div></div>`;
    h+=`<div class="panel" style="margin:10px 0 0"><h3>Sync diagnostics</h3>${diag.loading?`<div class="sdesc">Running diagnostics…</div>`:local?`<div class="mini-list"><div class="mini-item">Local raw tasks: <b>${local.rawTotal}</b></div><div class="mini-item">Local visible tasks: <b>${local.visibleTotal}</b></div><div class="mini-item">Local active visible: <b>${local.visibleActive}</b></div><div class="mini-item">Local completed: <b>${local.completed}</b></div><div class="mini-item">Hidden by start date: <b>${local.hiddenByStart}</b></div><div class="mini-item">Auto-prayer hidden from task views: <b>${local.autoPrayerHidden}</b></div><div class="mini-item">Cloud tasks (server): <b>${diag.cloudTotal??'—'}</b></div></div><div class="sdesc" style="margin-top:8px">Last run: ${diag.ranAt?new Date(diag.ranAt).toLocaleString():'Never'}</div>`:`<div class="sdesc">Tap <b>Sync diagnostics</b> to compare local and cloud counts on this device.</div>`}${diag.error?`<div class="sdesc" style="color:var(--red);margin-top:8px">${esc(diag.error)}</div>`:''}</div>`;
  }else{
    h+=`<div class="sdesc" style="margin-bottom:10px">Optional: sign in to sync tasks to Supabase. Tasks stay on this device until you connect.</div><div class="safe-row"><button class="sbtn" type="button" onclick="typeof openTodoFlowAuthModal==='function'&&openTodoFlowAuthModal()">Sign in to sync</button></div>`;
  }
  h+=`</div>`;
  h+=`<div class="sitem"><div><div class="slbl">Bigger tap targets</div><div class="sdesc">Better one-handed use</div></div><button class="tog${X.bigTap?' on':''}" onclick="X.bigTap=!X.bigTap;applyTheme();sv();render()"></button></div>`;
  h+=`<div class="sitem"><div><div class="slbl">Clipboard date hint</div><div class="sdesc">Show a banner on Tasks when the clipboard looks like a date or reminder. Clipboard check still runs either way; turn this on to see Use / dismiss.</div></div><button class="tog${S.showClipboardDateBanner?' on':''}" onclick="S.showClipboardDateBanner=!S.showClipboardDateBanner;sv();render()"></button></div>`;
  h+=`<div style="margin-top:14px"><div class="slbl" style="margin-bottom:8px">Task complete animation</div><div class="safe-row"><button class="chip-btn${S.completionAnimSpeed==='fast'?' on':''}" onclick="S.completionAnimSpeed='fast';sv(false);render();showToast('Completion speed: fast')">Fast</button><button class="chip-btn${(!S.completionAnimSpeed||S.completionAnimSpeed==='normal')?' on':''}" onclick="S.completionAnimSpeed='normal';sv(false);render();showToast('Completion speed: normal')">Normal</button><button class="chip-btn${S.completionAnimSpeed==='slow'?' on':''}" onclick="S.completionAnimSpeed='slow';sv(false);render();showToast('Completion speed: slow')">Slow</button><button class="xbtn" onclick="previewCompletionAnimation()">Preview</button></div><div id="tf-completion-preview" class="card pri-medium" style="margin:10px 0 0;padding:10px 12px;pointer-events:none"><div class="crow"><button class="chk on"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></button><div class="cbody"><div class="ctitle">Sample completed task</div><div class="cmeta"><span class="cdate">Preview speed</span></div></div></div></div></div>`;
  h+=`<div style="margin-top:16px"><div class="slbl" style="margin-bottom:8px">Accent Color</div><div class="safe-row">${Object.keys(THEME_PRESETS).map(k=>`<button class="chip-btn${X.themeColor===k?' on':''}" onclick="setThemeColor('${k}')">${k}</button>`).join('')}</div></div>`;
  h+=`<div style="margin-top:16px"><div class="slbl" style="margin-bottom:8px">Bottom Nav</div><div class="sdesc" style="margin-bottom:8px">${APP_SHELL_MINIMAL?'This build uses fixed shortcuts: Tasks · Home · My Day · Calendar.':'Pick a slot, then tap any icon below to assign it.'}</div><div class="nav-slot-grid">${(X.navTabs||[]).slice(0,4).map((k,i)=>{const item=NAV_LIBRARY.find(n=>n.k===k)||NAV_LIBRARY[0];return `<button class="nav-slot${(X.navEditSlot??0)===i?' active':''}" onclick="selectNavSlot(${i})"${APP_SHELL_MINIMAL?' disabled style="opacity:.55"':''}><small>Slot ${i+1}</small><b>${item.i} ${esc(item.l)}</b></button>`}).join('')}</div>${APP_SHELL_MINIMAL?'':`<div class="nav-chooser">${navLibraryForChooser().map(n=>`<button class="nav-choice${X.navTabs.includes(n.k)?' on':''}" onclick="assignNavTab('${n.k}')">${n.i} ${esc(n.l)}</button>`).join('')}</div>`}</div>`;
  h+=`<div class="panel" id="catManage"><h3>Task categories</h3><div class="sdesc" style="margin-bottom:10px">Add, edit, or remove custom categories for your workflow.</div>${CATS.map(c=>`<div class="list-row"><div class="list-main"><b>${c.icon} ${esc(c.label)}</b><span>${esc(c.key)}${isCustomCategory(c.key)?' · custom':' · default'}</span></div><div class="safe-row"><button class="xbtn" onclick="editTaskCategory('${c.key}')">Edit</button>${isCustomCategory(c.key)?`<button class="xbtn" style="color:var(--red);border-color:rgba(220,38,38,.25)" onclick="deleteTaskCategory('${c.key}')">Remove</button>`:''}</div></div>`).join('')}<div class="safe-row" style="margin-top:10px"><button class="xbtn" onclick="addTaskCategory()">＋ Add category</button></div></div>`;
  h+=`<div style="margin-top:16px"><div class="slbl" style="margin-bottom:8px">Data</div><button class="xbtn" onclick="exportAll(true)">📤 Full Export</button><button class="xbtn" onclick="exportPdfReport()">📄 PDF Report</button><button class="xbtn" onclick="openSectionExport()">🧩 Export Sections</button><button class="xbtn" onclick="document.getElementById('impF').click()">📥 Import JSON</button><button class="xbtn" onclick="document.getElementById('csvF').click()">📄 Import CSV</button><button class="xbtn" onclick="restoreBackup()">♻️ Restore Backup</button><button class="xbtn" onclick="openHealthCheck()">🩹 Data Health</button><button class="xbtn" onclick="openChangelog()">📝 Changelog</button><input type="file" id="impF" accept=".json" style="display:none" onchange="importAll(event)"><input type="file" id="csvF" accept=".csv" style="display:none" onchange="importCSV(event)"></div>`;
  h+=`<div style="margin-top:16px"><div class="slbl" style="margin-bottom:8px">Snapshots</div><div class="sdesc">Last 5 local snapshots are kept for safer upgrades.</div>${(X.backups||[]).slice().reverse().map((b,i)=>`<div class="list-row"><div class="list-main"><b>Snapshot ${i+1}</b><span>${new Date(b.savedAt).toLocaleString()}</span></div><button class="cact" onclick="restoreSnapshot(${(X.backups||[]).length-1-i})">↩</button></div>`).join('')||'<div class="sdesc">No versioned snapshots yet.</div>'}</div>`;
  h+=`<div class="panel"><h3>Quality & activity</h3><div class="list-row"><div class="list-main"><b>Action log entries</b><span>${(X.actionLog||[]).length} tracked changes</span></div><button class="cact" onclick="openChangelog()">📖</button></div><div class="list-row"><div class="list-main"><b>Backups kept</b><span>${(X.backups||[]).length}/5 snapshots on this device</span></div></div></div>`;
  h+=`<div style="margin-top:16px"><div class="sdesc">Version ${APP_VERSION} · polish pass with grouped modules, custom task categories, and stronger app-like touch behavior.</div><div class="sdesc">Last saved: ${S.lastSavedAt?new Date(S.lastSavedAt).toLocaleString():'Not yet'}</div><div class="sdesc">Last import: ${S.lastImportAt?new Date(S.lastImportAt).toLocaleString():'Never'}</div></div></div>`;return h;
}
function addTaskCategory(){
  const iconOptions=['🏷️','🕌','💼','🏠','💳','❤️','👶','📚','🚗','🛠️','🛒','💡','📌','🧠','🎯','📦','🧾'];
  openRecordModal({title:'Add task category',fields:[
    {name:'label',label:'Category name',value:'',required:true,placeholder:'Example: Mosque'},
    {name:'icon',label:'Icon',type:'select',value:'🏷️',options:iconOptions.map(i=>({value:i,label:`${i} ${i==='🏷️'?'Tag':i==='🕌'?'Mosque':i==='💼'?'Work':i==='🏠'?'Home':i==='💳'?'Bills':i==='❤️'?'Health':i==='👶'?'Kids':i==='📚'?'School':i==='🚗'?'Car':i==='🛠️'?'Tools':i==='🛒'?'Shopping':i==='💡'?'Ideas':i==='📌'?'Pinned':i==='🧠'?'Mind':i==='🎯'?'Focus':i==='📦'?'Packages':'Notes'}`}))},
    {name:'color',label:'Color',type:'color',value:'#64748B'}
  ],onSubmit:(vals)=>saveTaskCategory('',vals)});
}
function editTaskCategory(key){
  const cat=CATS.find(c=>c.key===key); if(!cat) return;
  const iconOptions=['🏷️','🕌','💼','🏠','💳','❤️','👶','📚','🚗','🛠️','🛒','💡','📌','🧠','🎯','📦','🧾'];
  openRecordModal({title:`Edit ${cat.label}`,fields:[
    {name:'label',label:'Category name',value:cat.label,required:true},
    {name:'icon',label:'Icon',type:'select',value:cat.icon||'🏷️',options:iconOptions.map(i=>({value:i,label:`${i} ${i==='🏷️'?'Tag':i==='🕌'?'Mosque':i==='💼'?'Work':i==='🏠'?'Home':i==='💳'?'Bills':i==='❤️'?'Health':i==='👶'?'Kids':i==='📚'?'School':i==='🚗'?'Car':i==='🛠️'?'Tools':i==='🛒'?'Shopping':i==='💡'?'Ideas':i==='📌'?'Pinned':i==='🧠'?'Mind':i==='🎯'?'Focus':i==='📦'?'Packages':'Notes'}`}))},
    {name:'color',label:'Color',type:'color',value:cat.color||'#64748B'}
  ],onSubmit:(vals)=>saveTaskCategory(key,vals)});
}
function saveTaskCategory(existingKey,vals){
  const label=(vals.label||'').trim(); if(!label) return false;
  const icon=(vals.icon||'🏷️').trim()||'🏷️';
  const color=(vals.color||'#64748B').trim()||'#64748B';
  const list=Array.isArray(X.customCategories)?X.customCategories.slice():[];
  if(existingKey){
    const idx=list.findIndex(c=>c.key===existingKey);
    if(idx<0)return false;
    list[idx]={...list[idx],label,icon,color};
  }else{
    list.push({key:slugCategoryKey(label),label,icon,color});
  }
  X.customCategories=normCustomCategories(list);
  syncCustomCategories();
  sv();
  render();
  showToast('Saved');
  return true;
}
function deleteTaskCategory(key){
  const cat=CATS.find(c=>c.key===key); if(!cat||!isCustomCategory(key)) return;
  const usage=R.filter(r=>r.category===key).length;
  const opts=categoryOptions().filter(o=>o.value!==key);
  openRecordModal({title:`Delete ${cat.label}?`,subtitle:usage?`Move ${usage} task${usage===1?'':'s'} to another category first.`:'This category is not being used right now.',fields:[
    {name:'replacement',label:'Move existing tasks to',type:'select',value:opts[0]?.value||'personal',options:opts}
  ],onSubmit:(vals)=>{
    const replacement=opts.some(o=>o.value===vals.replacement)?vals.replacement:'personal';
    R.forEach(r=>{if(r.category===key)r.category=replacement});
    X.customCategories=(X.customCategories||[]).filter(c=>c.key!==key);
    syncCustomCategories();
    if(filter===key)filter='all';
    sv();render();showToast('Category deleted');return true;
  }});
}

function setThemeColor(k){X.themeColor=k;applyTheme();sv();render()}
function selectNavSlot(i){X.navEditSlot=Math.max(0,Math.min(3,Number(i)||0));sv(false);render()}
function assignNavTab(k){
  if(APP_SHELL_MINIMAL)return;
  if(!isViewEnabled(k))return;
  const tabs=(X.navTabs||[]).slice(0,4);while(tabs.length<4){const n=NAV_LIBRARY.find(x=>!tabs.includes(x.k)&&isViewEnabled(x.k));if(!n)break;tabs.push(n.k)}
  const slot=Math.max(0,Math.min(3,Number(X.navEditSlot)||0));const existing=tabs.indexOf(k);if(existing>=0&&existing!==slot){const temp=tabs[slot];tabs[slot]=k;tabs[existing]=temp;}else tabs[slot]=k;X.navTabs=tabs.slice(0,4);sv(false);render()
}
function openSectionExport(){const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Export selected sections</h3>${['reminders','shifts','bills','kids','health','money','timeLogs'].map(k=>`<label class="snz-opt" style="text-align:left"><input type="checkbox" value="${k}" checked style="margin-right:8px">${k}</label>`).join('')}<button class="sbtn" onclick="doSectionExport()">Export</button></div>`;ov.id='secExpM';document.body.appendChild(ov)}
function doSectionExport(){const root=document.getElementById('secExpM');if(!root)return;const picked=[...root.querySelectorAll('input[type=checkbox]:checked')].map(i=>i.value);const data={version:APP_VERSION,exportedAt:new Date().toISOString()};if(picked.includes('reminders'))data.reminders=R;if(picked.includes('shifts'))data.shifts=shifts;if(picked.includes('bills'))data.bills=R.filter(r=>r.category==='bills');if(picked.includes('kids'))data.kids={children:X.children,readingLogs:X.readingLogs,homework:X.homework,kidAppointments:X.kidAppointments};if(picked.includes('health'))data.health={medications:X.medications,medicationLogs:X.medicationLogs,sleepLogs:X.sleepLogs,exerciseLogs:X.exerciseLogs};if(picked.includes('money'))data.money={budgetCategories:X.budgetCategories,incomes:X.incomes,contributionLogs:X.contributionLogs};if(picked.includes('timeLogs'))data.timeLogs=timeLogs;downloadJSON(data,`reminders_sections_${new Date().toISOString().slice(0,10)}.json`);root.remove();}
function downloadJSON(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
function exportAll(forceSnapshot=true){if(forceSnapshot)sv(false,true);downloadJSON(makeBackup(),`reminders_backup_${new Date().toISOString().slice(0,10)}.json`)}
function importAll(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(!d||typeof d!=='object')throw new Error('Invalid');if(d.reminders)R=d.reminders;if(d.habits)habits=d.habits;if(d.shifts)shifts=d.shifts;if(d.timeLogs)timeLogs=d.timeLogs;if(d.templates)templates=d.templates;if(d.routines)routines=d.routines;if(d.settings)S={...SETTINGS_DEFAULTS,...S,...d.settings};if(d.extras)X={...defaultExtras(),...X,...d.extras};if(d.kids){X.children=d.kids.children||X.children;X.readingLogs=d.kids.readingLogs||X.readingLogs;X.homework=d.kids.homework||X.homework;X.kidAppointments=d.kids.kidAppointments||X.kidAppointments;}if(d.health){X.medications=d.health.medications||X.medications;X.medicationLogs=d.health.medicationLogs||X.medicationLogs;X.sleepLogs=d.health.sleepLogs||X.sleepLogs;X.exerciseLogs=d.health.exerciseLogs||X.exerciseLogs;}if(d.money){X.budgetCategories=d.money.budgetCategories||X.budgetCategories;X.incomes=d.money.incomes||X.incomes;X.contributionLogs=d.money.contributionLogs||X.contributionLogs;}S.lastImportAt=new Date().toISOString();normalizeAll();applyTheme();sv(false,true);render();checkNotifications(true);alert('Imported!')}catch(err){alert('Invalid file')}};reader.readAsText(file);e.target.value=''}
function importCSV(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>{try{const lines=String(ev.target.result||'').trim().split(/\r?\n/);const headers=lines.shift().split(',').map(x=>x.trim().toLowerCase());let added=0;lines.forEach(line=>{if(!line.trim())return;const cols=line.split(',');const row={};headers.forEach((h,i)=>row[h]=cols[i]);const due=row.duedate||row.due||'';const dueDate=due&&!Number.isNaN(new Date(due).getTime())?new Date(due).toISOString():new Date(Date.now()+3600000).toISOString();R.push(normalizeReminder({id:gid(),title:row.title||row.name||'Imported task',notes:row.notes||'',dueDate,startDate:row.startdate||'',category:CATS.some(c=>c.key===row.category)?row.category:'personal',priority:PRIS.some(p=>p.key===row.priority)?row.priority:'medium',amount:Number(row.amount)||0,tags:(row.tags||'').split('|').filter(Boolean)},R.length));added++;});sv();render();alert(`Imported ${added} rows from CSV`);}catch(err){alert('CSV import failed')}};reader.readAsText(file);e.target.value=''}
function restoreBackup(){const d=parseJSON(BKP,null);if(!d||!d.reminders){alert('No emergency backup found on this device.');return}if(!confirm('Restore the last local backup on this device?'))return;R=d.reminders||[];habits=d.habits||[];shifts=d.shifts||[];timeLogs=d.timeLogs||[];templates=d.templates||[];routines=d.routines||[];S={...SETTINGS_DEFAULTS,...(d.settings||{})};X={...defaultExtras(),...(d.extras||{})};normalizeAll();applyTheme();sv(false,true);render();checkNotifications(true);alert('Local backup restored.')}
function restoreSnapshot(idx){const snap=(X.backups||[])[idx];if(!snap?.data)return;const d=snap.data;R=d.reminders||[];habits=d.habits||[];shifts=d.shifts||[];timeLogs=d.timeLogs||[];templates=d.templates||[];routines=d.routines||[];S={...SETTINGS_DEFAULTS,...(d.settings||{})};X={...defaultExtras(),...(d.extras||{})};normalizeAll();applyTheme();sv(false);render();showToast('Snapshot restored');}
function openHealthCheck(){const issues=[];R.forEach(r=>{if(Number.isNaN(new Date(r.dueDate).getTime()))issues.push(`Bad due date: ${r.title}`);if(r.dependsOn&&!R.some(x=>x.id===r.dependsOn))issues.push(`Missing dependency: ${r.title}`)});shifts.forEach(s=>{if(s.start&&s.end&&getShiftMinutes(s)<=0&&!isOffShiftType(s.type))issues.push(`Shift may have bad time span: ${s.date} ${s.type}`)});X.medications.forEach(m=>{if(m.refillDate&&Number.isNaN(new Date(m.refillDate).getTime()))issues.push(`Bad refill date: ${m.name}`)});(X.shoppingLists[0]?.items||[]).forEach((it,idx)=>{if(!it.text)issues.push(`Shopping item ${idx+1} is blank`)}) ;const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Data Health Checker</h3><div class="sdesc">${issues.length?`${issues.length} issue(s) found`:'No broken entries found'}</div>${issues.map(i=>`<div class="mini-item" style="margin-top:6px">${esc(i)}</div>`).join('')||'<div class="mini-item" style="margin-top:6px">All checked modules look healthy.</div>'}</div>`;document.body.appendChild(ov)}
function rKids(){
  let h=rHdr('Kids & Family','Profiles, homework, reading, appointments, chores');
  h+=`<div class="kid-tabs">${X.children.map(c=>`<button class="kid-tab${activeKidId===c.id?' active':''}" style="border-color:${activeKidId===c.id?c.color:'var(--border)'};color:${activeKidId===c.id?c.color:'var(--text2)'}" onclick="activeKidId='${c.id}';render()">${esc(c.icon)} ${esc(c.name)} · ⭐${c.points}</button>`).join('')}<button class="kid-tab" onclick="addChildProfile()">＋ Child</button></div>`;
  if(!X.children.length){h+=`<div class="empty"><div class="empty-i">👨‍👩‍👧</div><div class="empty-t">Add a child profile to start</div></div>`;return h;}
  const kid=X.children.find(c=>c.id===activeKidId)||X.children[0];activeKidId=kid.id;
  const reading=X.readingLogs.filter(x=>x.childId===kid.id).slice().reverse();
  const homework=X.homework.filter(x=>x.childId===kid.id).slice().reverse();
  const apps=X.kidAppointments.filter(x=>x.childId===kid.id).slice().reverse();
  const chores=(X.chores||[]).slice(0,8);
  const stats=getHomeworkStats(kid.id);
  const choreHistory=(X.choreHistory||[]).filter(c=>c.childId===kid.id).slice().reverse().slice(0,5);
  h+=`<div class="panel"><h3>Rewards</h3><div class="dash-big" style="font-size:34px;color:${kid.color}">${kid.points} ⭐</div><div class="safe-row"><button class="xbtn" onclick="adjustChildPoints('${kid.id}',1)">+1 Star</button><button class="xbtn" onclick="adjustChildPoints('${kid.id}',5)">+5 Stars</button><button class="xbtn" onclick="adjustChildPoints('${kid.id}',-1)">−1</button><button class="xbtn" onclick="redeemStars('${kid.id}')">Redeem</button><button class="xbtn" onclick="openChildProfileForm('${kid.id}')">✏️ Child</button><button class="xbtn" onclick="deleteChildProfile('${kid.id}')">🗑 Child</button></div>${(X.rewards||[]).filter(r=>r.childId===kid.id).slice().reverse().slice(0,4).map(r=>`<div class="mini-item">🎁 ${esc(r.title)} · ${r.cost}⭐</div>`).join('')||'<div class="sdesc" style="margin-top:8px">No redeemed rewards yet.</div>'}</div>`;
  h+=`<div class="panel"><h3>School tracker</h3><div class="safe-row"><button class="xbtn" onclick="addHomework('${kid.id}')">+ Assignment</button><button class="xbtn" onclick="addKidCategory('${kid.id}')">+ Category</button></div><div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0">${getKidCategories(kid.id).map(s=>`<span class="ctag" style="cursor:pointer" onclick="deleteKidCategory('${kid.id}','${esc(s)}')">${esc(s)} ✕</span>`).join('')}</div><div class="mini-list"><div class="mini-item">Assignments: ${stats.totalCount}</div><div class="mini-item">Average grade: ${stats.gradedCount?stats.avg.toFixed(1):'—'}</div></div>${stats.subjects.map(s=>`<div class="list-row"><div class="list-main"><b>${esc(s.subject)}</b><span>${s.done}/${s.total} done${s.graded?` · avg ${(s.gradeSum/s.graded).toFixed(1)}`:''}</span></div></div>`).join('')||'<div class="sdesc">No school entries yet.</div>'}${homework.slice(0,8).map(r=>`<div class="list-row"><div class="list-main"><b>${esc(r.title)}</b><span>${esc(r.subject)}${r.grade?` · Grade ${esc(r.grade)}`:''} · ${new Date(r.date).toLocaleDateString()}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="toggleHomework('${r.id}')">${r.done?'✅':'⬜'}</button><button class="cact" onclick="editHomework('${r.id}')">✏️</button><button class="cact" onclick="deleteHomework('${r.id}')">🗑</button></div></div>`).join('')}</div>`;
  h+=`<div class="panel"><h3>Reading log · Barton / minutes</h3><div class="safe-row"><button class="xbtn" onclick="addReadingLog('${kid.id}')">+ Reading</button></div><div class="mini-item">Total minutes logged: ${reading.reduce((a,r)=>a+(Number(r.minutes)||0),0)}</div>${reading.slice(0,6).map(r=>`<div class="list-row"><div class="list-main"><b>${r.minutes} min${r.lesson?` · ${esc(r.lesson)}`:''}</b><span>${new Date(r.date).toLocaleDateString()}${r.notes?` · ${esc(r.notes)}`:''}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="editReadingLog('${r.id}')">✏️</button><button class="cact" onclick="deleteReadingLog('${r.id}')">🗑</button></div></div>`).join('')||'<div class="sdesc">No reading logged yet.</div>'}</div>`;
  h+=`<div class="panel"><h3>Appointments history</h3><div class="safe-row"><button class="xbtn" onclick="addKidAppointment('${kid.id}')">+ Appointment</button></div>${apps.slice(0,8).map(r=>`<div class="list-row"><div class="list-main"><b>${esc(r.title)}</b><span>${new Date(r.date).toLocaleString()}${r.notes?` · ${esc(r.notes)}`:''}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="editKidAppointment('${r.id}')">✏️</button><button class="cact" onclick="deleteKidAppointment('${r.id}')">🗑</button></div></div>`).join('')||'<div class="sdesc">No appointments yet.</div>'}</div>`;
  h+=`<div class="panel"><h3>Chore rotation scheduler</h3><div class="safe-row"><button class="xbtn" onclick="addChore()">+ Chore</button><button class="xbtn" onclick="openWeeklyChoreRotation()">🔄 This week</button></div>${chores.map(ch=>{const asn=getChoreAssignee(ch);return `<div class="list-row"><div class="list-main"><b>${esc(ch.title)}</b><span>${asn?`${esc(asn.icon)} ${esc(asn.name)}`:'No child'} · ${ch.points}⭐${ch.lastDone?` · last done ${esc(ch.lastDone)}`:''}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="openChoreForm('${ch.id}')">✏️</button><button class="cact" onclick="deleteChore('${ch.id}')">🗑</button><button class="cact" onclick="completeChore('${ch.id}')">✅</button></div></div>`}).join('')||'<div class="sdesc">No chores set yet.</div>'}${choreHistory.length?`<div class="mini-list" style="margin-top:10px">${choreHistory.map(c=>`<div class="mini-item">${new Date(c.date).toLocaleDateString()} · ${esc(c.title)} · +${c.points}⭐</div>`).join('')}</div>`:''}</div>`;
  h+=`<div class="panel"><h3>Shared family checklist</h3><div class="safe-row"><button class="xbtn" onclick="openChecklistShare()">🔗 Share link</button><button class="xbtn" onclick="openChecklistShare()">▣ QR code</button></div><div class="sdesc">Share the current shopping and chore checklist with your wife's phone.</div>${(X.sharedLinks||[]).slice(0,3).map(l=>`<div class="list-row"><div class="list-main"><b>${esc(l.label)}</b><span>${new Date(l.createdAt).toLocaleString()}</span></div><button class="cact" onclick="copyShareUrl('Family checklist','${l.url}')">📋</button></div>`).join('')||''}</div>`;
  return h;
}
function openKidQuickAdd(){if(view!=='kids'){openAdd();return;}const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Kids quick add</h3><div class="snz-opt" onclick="addChildProfile();this.closest('.mo').remove()">👶 Add child profile</div><div class="snz-opt" onclick="addReadingLog('${activeKidId}');this.closest('.mo').remove()">📚 Add reading log</div><div class="snz-opt" onclick="addHomework('${activeKidId}');this.closest('.mo').remove()">📝 Add homework</div><div class="snz-opt" onclick="addKidAppointment('${activeKidId}');this.closest('.mo').remove()">📅 Add appointment</div></div>`;document.body.appendChild(ov)}
function openChildProfileForm(id=''){
  const child=id?X.children.find(x=>x.id===id):null;
  const icon=child?.icon||CHILD_ICON_OPTIONS[0];
  const color=child?.color||PROFILE_COLOR_OPTIONS[X.children.length%PROFILE_COLOR_OPTIONS.length];
  window.__childIcon=icon;
  window.__childColor=color;
  window.__editingChildId=child?.id||'';
  const ov=document.createElement('div');
  ov.className='mo';
  ov.id='childProfileM';
  ov.onclick=e=>{if(e.target===ov)closeChildProfileModal()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>${child?'Edit child profile':'Add child profile'}</h3><div class="flbl">Child name</div><input class="finp" id="childName" value="${esc(child?.name||'')}" placeholder="Enter child name"><div class="frow"><div><div class="flbl">Starting stars</div><input class="finp" id="childPoints" type="number" min="0" step="1" value="${Math.max(0,Number(child?.points)||0)}"></div><div><div class="flbl">Quick adjust</div><div class="safe-row"><button type="button" class="xbtn" onclick="adjustChildProfilePoints(-1)">−1</button><button type="button" class="xbtn" onclick="adjustChildProfilePoints(1)">+1</button><button type="button" class="xbtn" onclick="adjustChildProfilePoints(5)">+5</button></div></div></div><div class="flbl">Choose an icon</div><div class="emoji-grid">${CHILD_ICON_OPTIONS.map(em=>`<button type="button" class="emoji-btn${em===icon?' active':''}" data-icon="${em}" onclick="selectChildIcon('${em}')">${em}</button>`).join('')}</div><div class="flbl">Choose a color</div><div class="color-grid">${PROFILE_COLOR_OPTIONS.map(c=>`<button type="button" class="color-btn${c===color?' active':''}" data-color="${c}" style="background:${c}" onclick="selectChildColor('${c}')"></button>`).join('')}</div><div class="flbl">Custom color</div><input class="finp" id="childCustomColor" type="color" value="${color}" onchange="selectChildColor(this.value)"><div class="safe-row" style="margin-top:14px"><button class="xbtn" onclick="closeChildProfileModal()">Close</button><button class="sbtn" onclick="saveChildProfileModal()">Save</button></div></div>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('childName')?.focus(),60);
}
function addChildProfile(){openChildProfileForm()}
function deleteChildProfile(id){const idx=X.children.findIndex(x=>x.id===id);if(idx<0)return;const child=X.children[idx];X.children.splice(idx,1);X.readingLogs=X.readingLogs.filter(x=>x.childId!==id);X.homework=X.homework.filter(x=>x.childId!==id);X.kidAppointments=X.kidAppointments.filter(x=>x.childId!==id);X.rewards=X.rewards.filter(x=>x.childId!==id);R.forEach(r=>{if(r.childId===id)r.childId=''});if(activeKidId===id)activeKidId=X.children[0]?.id||'';logAction('child',`Deleted child profile ${child.name}`);sv();render();showToast('Child profile removed')}
function openRewardRedeemForm(childId){const kid=X.children.find(c=>c.id===childId);if(!kid)return;openRecordModal({title:`Redeem stars · ${kid.name}`,fields:[{name:'title',label:'Reward title',value:'Screen time',required:true},{name:'cost',label:'Stars to redeem',type:'number',value:'5'}],onSubmit:(vals)=>{const cost=Math.max(1,Number(vals.cost)||0);if(!cost||cost>kid.points){showToast('Not enough stars');return false;}kid.points-=cost;X.rewards.unshift({id:gid(),childId,title:vals.title.trim()||'Reward',cost,date:new Date().toISOString()});logAction('reward',`${kid.name} redeemed ${cost}⭐ for ${vals.title.trim()||'Reward'}`);sv();render();showToast(`Redeemed ${cost} stars`);return true;}})}
function addReadingLog(childId){if(!childId)return;const item={childId,id:'',minutes:15,lesson:'',notes:''};openRecordModal({title:'Add reading log',fields:[{name:'minutes',label:'Minutes read',type:'number',value:'15'},{name:'lesson',label:'Lesson / Barton level',value:''},{name:'notes',label:'Notes',type:'textarea',value:''}],onSubmit:(vals)=>{X.readingLogs.unshift({id:gid(),childId,date:new Date().toISOString(),minutes:Number(vals.minutes)||0,lesson:(vals.lesson||'').trim(),notes:(vals.notes||'').trim()});logAction('reading',`Reading logged for ${getChildName(childId)}`);sv();render();return true;}})
}
function openHomeworkForm(childId,id=''){
  if(!childId)return;const hw=id?X.homework.find(x=>x.id===id):null;
  openRecordModal({title:hw?'Edit assignment':'Add assignment',fields:[{name:'title',label:'Assignment title',value:hw?.title||'',required:true},{name:'subject',label:'Category',type:'select',options:getKidCategories(childId).map(s=>({value:s,label:s})),value:hw?.subject||'General'},{name:'grade',label:'Grade / score',value:hw?.grade||''}],onSubmit:(vals)=>{const title=vals.title.trim();if(!title)return false;const rec=hw||{id:gid(),childId,date:new Date().toISOString(),done:false};Object.assign(rec,{title,subject:(vals.subject||'General').trim()||'General',grade:(vals.grade||'').trim()});if(!hw)X.homework.unshift(rec);sv();render();return true;}})
}
function addHomework(childId){openHomeworkForm(childId)}
function getKidCategories(childId){
  const kid=X.children.find(c=>c.id===childId);
  if(kid&&Array.isArray(kid.categories)&&kid.categories.length)return kid.categories;
  return X.kidSubjects||[];
}
function addKidCategory(childId){
  const kid=X.children.find(c=>c.id===childId);if(!kid)return;
  const name=prompt('New category for '+kid.name+':');if(!name||!name.trim())return;
  const s=name.trim();
  if(!Array.isArray(kid.categories))kid.categories=[...(X.kidSubjects||[])];
  if(kid.categories.some(x=>x.toLowerCase()===s.toLowerCase())){showToast('Category already exists');return}
  kid.categories.push(s);sv();render();showToast('Category added for '+kid.name);
}
function deleteKidCategory(childId,name){
  const kid=X.children.find(c=>c.id===childId);if(!kid)return;
  if(!confirm('Remove category "'+name+'" for '+kid.name+'?'))return;
  if(!Array.isArray(kid.categories))kid.categories=[...(X.kidSubjects||[])];
  kid.categories=kid.categories.filter(s=>s!==name);sv();render();showToast('Category removed');
}
function toggleHomework(id){const h=X.homework.find(x=>x.id===id);if(!h)return;h.done=!h.done;if(h.done){const kid=X.children.find(c=>c.id===h.childId);if(kid)kid.points+=1;logAction('homework',`Completed ${h.title}`);}sv();render()}
function openKidAppointmentForm(childId,id=''){
  if(!childId)return;const item=id?X.kidAppointments.find(x=>x.id===id):null;
  openRecordModal({title:item?'Edit appointment':'Add appointment',fields:[{name:'title',label:'Appointment title',value:item?.title||'',required:true},{name:'when',label:'Date / time',type:'datetime-local',value:item?`${fmtLD(new Date(item.date))}T${fmtLT(new Date(item.date))}`:`${fmtLD(new Date())}T12:00`},{name:'notes',label:'Notes',type:'textarea',value:item?.notes||''}],onSubmit:(vals)=>{const title=vals.title.trim();if(!title||!vals.when)return false;const rec=item||{id:gid(),childId};Object.assign(rec,{title,date:new Date(vals.when).toISOString(),notes:(vals.notes||'').trim()});if(!item)X.kidAppointments.unshift(rec);sv();render();return true;}})
}
function addKidAppointment(childId){openKidAppointmentForm(childId)}
function redeemStars(childId){openRewardRedeemForm(childId)}
function getChildName(id){return X.children.find(c=>c.id===id)?.name||'Child'}
function rHealth(){
  let h=rHdr('Health','Medication, sleep, exercise, and refill tracking');
  const sleepItems=X.sleepLogs.slice().reverse().slice(0,7).map((s,i)=>({label:['S','M','T','W','T','F','S'][i]||String(i+1),value:getSleepHours(s)})).reverse();
  const sleepAvg=getAvgSleepHours();
  const refillSoon=X.medications.map(m=>({m,...getMedicationRefillStatus(m)})).filter(x=>x.urgent);
  const exerciseWeek=X.exerciseLogs.filter(x=>new Date(x.date)>=new Date(Date.now()-7*86400000)).reduce((a,x)=>a+(Number(x.minutes)||0),0);
  h+=`<div class="panel"><h3>Medication tracker</h3><div class="safe-row"><button class="xbtn" onclick="addMedication()">+ Medication</button><button class="xbtn" onclick="logDose()">💊 Log dose</button><button class="xbtn" onclick="syncMedicationReminders()">⏰ Sync reminders</button></div>${X.medications.map(m=>{const st=getMedicationRefillStatus(m);return `<div class="list-row"><div class="list-main"><b>${esc(m.name)}${m.dose?` · ${esc(m.dose)}`:''}</b><span>${esc(st.text)}${m.times?.length?` · ${esc(m.times.join(', '))}`:''}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="editMedication('${m.id}')">✏️</button><button class="cact" onclick="deleteMedication('${m.id}')">🗑</button></div></div>`}).join('')||'<div class="sdesc">No medications tracked yet.</div>'}${refillSoon.length?`<div class="mini-list" style="margin-top:10px">${refillSoon.map(x=>`<div class="mini-item">⚠️ ${esc(x.m.name)} · ${esc(x.text)}</div>`).join('')}</div>`:''}</div>`;
  h+=`<div class="panel"><h3>Sleep log</h3><div class="dash-big" style="font-size:30px">${sleepAvg?`${sleepAvg.toFixed(1)}h`:'—'}</div><div class="sdesc">Average from recent logs</div>${renderMiniBars(sleepItems,8)}<div class="safe-row"><button class="xbtn" onclick="addSleepLog()">+ Sleep entry</button></div>${X.sleepLogs.slice().reverse().slice(0,6).map(s=>`<div class="list-row"><div class="list-main"><b>${new Date(s.date).toLocaleDateString()}</b><span>Bed ${esc(s.bed)} · Wake ${esc(s.wake)} · ${getSleepHours(s).toFixed(1)}h</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="editSleepLog('${s.id}')">✏️</button><button class="cact" onclick="deleteSleepLog('${s.id}')">🗑</button></div></div>`).join('')||''}</div>`;
  h+=`<div class="panel"><h3>Exercise tracker</h3><div class="dash-big" style="font-size:30px">${exerciseWeek} min</div><div class="sdesc">Last 7 days</div><div class="safe-row"><button class="xbtn" onclick="addExerciseLog()">+ Exercise</button></div>${X.exerciseLogs.slice().reverse().slice(0,6).map(s=>`<div class="list-row"><div class="list-main"><b>${esc(s.type)}</b><span>${s.minutes} min · ${new Date(s.date).toLocaleDateString()}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="editExerciseLog('${s.id}')">✏️</button><button class="cact" onclick="deleteExerciseLog('${s.id}')">🗑</button></div></div>`).join('')||'<div class="sdesc">No exercise logged yet.</div>'}</div>`;
  h+=`<div class="panel"><h3>Dose history</h3>${X.medicationLogs.slice().reverse().slice(0,8).map(x=>`<div class="list-row"><div class="list-main"><b>${esc((X.medications.find(m=>m.id===x.medId)||{}).name||'Medication')}</b><span>${new Date(x.date).toLocaleString()}${x.dose?` · ${esc(x.dose)}`:''}${x.childId?` · ${esc(getChildName(x.childId))}`:''}</span></div></div>`).join('')||'<div class="sdesc">No doses logged yet.</div>'}</div>`;
  return h;
}
function openHealthQuickAdd(){const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Health quick add</h3><div class="snz-opt" onclick="addMedication();this.closest('.mo').remove()">💊 Add medication</div><div class="snz-opt" onclick="logDose();this.closest('.mo').remove()">📝 Log dose</div><div class="snz-opt" onclick="addSleepLog();this.closest('.mo').remove()">😴 Add sleep entry</div><div class="snz-opt" onclick="addExerciseLog();this.closest('.mo').remove()">🏃 Add exercise</div></div>`;document.body.appendChild(ov)}
function addMedication(){openMedicationForm()}
function logDose(){if(!X.medications.length){showToast('Add a medication first');return;}openRecordModal({title:'Log medication dose',fields:[{name:'medId',label:'Medication',type:'select',value:X.medications[0]?.id||'',options:X.medications.map(m=>({value:m.id,label:m.name}))},{name:'childId',label:'Child / person',type:'select',value:activeKidId||'',options:[{value:'',label:'General / not child-specific'},...X.children.map(c=>({value:c.id,label:c.name}))]},{name:'dose',label:'Dose',value:X.medications[0]?.dose||''}],onSubmit:(vals)=>{const med=X.medications.find(m=>m.id===vals.medId)||X.medications[0];if(!med)return false;X.medicationLogs.unshift({id:gid(),medId:med.id,date:new Date().toISOString(),dose:(vals.dose||med.dose||'').trim(),childId:vals.childId||''});const refillSoon=med.refillDate&&new Date(med.refillDate)-new Date()<14*86400000;sv();render();showToast(refillSoon?'Dose logged · refill due soon':'Dose logged');return true;}})}
function addSleepLog(){openSleepLogForm()}
function addExerciseLog(){openExerciseLogForm()}
function getAvgSleepHours(){const vals=X.sleepLogs.map(s=>{if(!s.bed||!s.wake)return null;const [bh,bm]=s.bed.split(':').map(Number),[wh,wm]=s.wake.split(':').map(Number);if([bh,bm,wh,wm].some(Number.isNaN))return null;let mins=(wh*60+wm)-(bh*60+bm);if(mins<=0)mins+=24*60;return mins/60;}).filter(v=>v!=null);if(!vals.length)return 0;return vals.reduce((a,v)=>a+v,0)/vals.length}
function rMoney(){
  let h=rHdr('Budget & Money','Bills, expenses, income, contributions');
  const monthKey=fmtLD(new Date()).slice(0,7);
  const billActive=R.filter(r=>!r.completed&&r.category==='bills');
  const billTotal=billActive.reduce((a,r)=>a+(Number(r.amount)||0),0);
  const paidBills=getPaidBills(monthKey);
  const paidTotal=paidBills.reduce((a,r)=>a+(Number(r.amount)||0),0);
  const monthExpenses=(X.expenses||[]).filter(e=>String(e.date).startsWith(monthKey));
  const expenseTotal=monthExpenses.reduce((a,e)=>a+(Number(e.amount)||0),0);
  const totalSpent=paidTotal+expenseTotal;
  const incomeThisMonth=(X.incomes||[]).filter(i=>String(i.date).startsWith(monthKey));
  const incomeTotal=incomeThisMonth.reduce((a,i)=>a+(Number(i.amount)||0),0);
  const templatesOnly=(X.shoppingLists||[]).filter(l=>l.template);
  const catActuals=getMoneyCategoryActuals(monthKey);
  const deadlines=getContributionDeadlineSummary();
  const paycheckRows=getPaycheckCalendarRows(4);
  // Expense by category
  const expByCat={};monthExpenses.forEach(e=>{expByCat[e.category]=(expByCat[e.category]||0)+e.amount});
  h+=`<div class="dash-grid" style="padding-bottom:0"><div class="dash-card" onclick="logExpense()" style="cursor:pointer"><div class="dash-title">🧾 Log Expense</div><div class="dash-big" style="font-size:20px">Tap to add</div></div><div class="dash-card"><div class="dash-title">Total spent</div><div class="dash-big">$${totalSpent.toFixed(0)}</div><div class="dash-sub">Bills $${paidTotal.toFixed(0)} + Other $${expenseTotal.toFixed(0)}</div></div><div class="dash-card"><div class="dash-title">Upcoming bills</div><div class="dash-big">$${billTotal.toFixed(0)}</div><div class="dash-sub">${billActive.length} open</div></div><div class="dash-card"><div class="dash-title">Net this month</div><div class="dash-big" style="color:${incomeTotal-totalSpent>=0?'var(--green)':'var(--red)'}">$${(incomeTotal-totalSpent).toFixed(0)}</div><div class="dash-sub">Income $${incomeTotal.toFixed(0)}</div></div></div>`;
  // Expense history
  h+=`<div class="panel"><h3>Recent expenses</h3><div class="safe-row"><button class="xbtn" onclick="logExpense()">+ Log Expense</button></div>${monthExpenses.slice(0,10).map(e=>`<div class="list-row"><div class="list-main"><b>${esc(e.title)}</b><span>${esc(e.category)} · ${new Date(e.date).toLocaleDateString()} · $${Number(e.amount).toFixed(2)}</span></div><button class="cact" onclick="deleteExpense('${e.id}')">🗑</button></div>`).join('')||'<div class="sdesc">No expenses logged this month. Tap + to start.</div>'}${Object.keys(expByCat).length?`<div style="margin-top:10px">${Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`<div class="mini-item">${esc(cat)}: $${amt.toFixed(2)}</div>`).join('')}</div>`:''}</div>`;
  h+=`<div class="panel"><h3>Budget categories</h3><div class="safe-row"><button class="xbtn" onclick="addBudgetCategory()">+ Category</button><button class="xbtn" onclick="addIncomeEntry()">+ Income</button><button class="xbtn" onclick="addContribution()">+ RRSP/RESP</button></div>${catActuals.map(b=>{const pct=b.budget?Math.min(100,Math.round((b.actual/b.budget)*100)):0;return `<div class="list-row"><div class="list-main"><b>${esc(b.name)}</b><span>Budget $${Number(b.budget).toFixed(0)} · Actual $${Number(b.actual).toFixed(0)}${b.budget?` · ${pct}%`:''}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="editBudgetCategory('${b.id}')">✏️</button><button class="cact" onclick="deleteBudgetCategory('${b.id}')">🗑</button></div></div>`}).join('')||'<div class="sdesc">No budget categories yet.</div>'}</div>`;
  const payInfo=getPayCycleInfo(new Date());
  h+=`<div class="panel"><h3>Paycheck calendar</h3><div class="mini-item">Anchor: ${fmtLD(payInfo.anchor)} · Current cycle: ${fmtLD(payInfo.currentStart)} → ${fmtLD(payInfo.currentEnd)}</div><div class="safe-row"><button class="xbtn" onclick="openPaycheckCalendar()">📅 Open full calendar</button><button class="xbtn" onclick="setPayAnchor()">⚙️ Set anchor</button></div>${paycheckRows.map(r=>`<div class="list-row"><div class="list-main"><b>Pay ${new Date(r.payDate+'T00:00').toLocaleDateString()}</b><span>${r.periodStart} → ${r.periodEnd} · ${r.hours.toFixed(1)}h${r.overtime?` · OT ${r.overtime.toFixed(1)}h`:''}</span></div></div>`).join('')}</div>`;
  h+=`<div class="panel"><h3>Income vs expenses</h3>${incomeThisMonth.slice(0,6).map(c=>`<div class="list-row"><div class="list-main"><b>${esc(c.title)} · $${Number(c.amount).toFixed(2)}</b><span>${new Date(c.date).toLocaleDateString()}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="editIncomeEntry('${c.id}')">✏️</button><button class="cact" onclick="deleteIncomeEntry('${c.id}')">🗑</button></div></div>`).join('')||'<div class="sdesc">No income logged this month yet.</div>'}<div class="mini-item">Monthly net: $${(incomeTotal-paidTotal).toFixed(2)}</div></div>`;
  h+=`<div class="panel"><h3>Already paid history</h3>${paidBills.slice(0,8).map(c=>`<div class="list-row"><div class="list-main"><b>${esc(c.title)}</b><span>${new Date(c.completedAt).toLocaleDateString()}${c.amount?` · $${Number(c.amount).toFixed(2)}`:''}</span></div></div>`).join('')||'<div class="sdesc">No paid bills this month yet.</div>'}</div>`;
  h+=`<div class="panel"><h3>Contribution tracker</h3><div class="mini-list"><div class="mini-item">RRSP YTD: $${deadlines.rrspTotal.toFixed(2)} · deadline ${deadlines.rrspDeadline.toLocaleDateString()}</div><div class="mini-item">RESP YTD: $${deadlines.respTotal.toFixed(2)} · remaining to $${deadlines.respTarget}: $${deadlines.respRemaining.toFixed(2)}</div></div>${X.contributionLogs.slice().reverse().slice(0,8).map(c=>`<div class="list-row"><div class="list-main"><b>${esc(c.type)} · $${Number(c.amount).toFixed(2)}</b><span>${new Date(c.date).toLocaleDateString()}${c.notes?` · ${esc(c.notes)}`:''}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="editContribution('${c.id}')">✏️</button><button class="cact" onclick="deleteContribution('${c.id}')">🗑</button></div></div>`).join('')||'<div class="sdesc">No contributions logged yet.</div>'}</div>`;
  h+=`<div class="panel"><h3>Shopping list</h3><div class="safe-row"><button class="xbtn" onclick="addShoppingItem()">+ Item</button><button class="xbtn" onclick="addShoppingTemplate()">📋 Save template</button><button class="xbtn" onclick="openChecklistShare()">📤 Share / QR</button></div>${(X.shoppingLists[0]?.items||[]).map(it=>`<div class="list-row"><div class="list-main"><b>${it.done?'✓ ':'○ '}${esc(it.text)}</b></div><button class="cact" onclick="toggleShoppingItem('${it.id}')">${it.done?'✅':'⬜'}</button></div>`).join('')||'<div class="sdesc">Shopping list is empty.</div>'}${templatesOnly.length?`<div class="mini-list" style="margin-top:10px">${templatesOnly.slice(0,5).map(t=>`<div class="mini-item"><b>${esc(t.name)}</b> · ${t.items.length} items <button class="chip-btn" onclick="applyShoppingTemplate('${t.id}')">Apply</button></div>`).join('')}</div>`:''}</div>`;
  h+=`<div class="panel"><h3>Home maintenance</h3><div class="safe-row"><button class="xbtn" onclick="createMaintenanceReminder('maintenance')">+ Maintenance task</button><button class="xbtn" onclick="createMaintenanceReminder('seasonal')">+ Seasonal task</button><button class="xbtn" onclick="addSeasonalReminder()">🌦 Saved seasonal</button></div>${X.seasonalReminders.slice(0,6).map(v=>`<div class="list-row"><div class="list-main"><b>${esc(v.title)}</b><span>${new Date(new Date().getFullYear(),v.month,v.day).toLocaleDateString([],{month:'short',day:'numeric'})}${v.notes?` · ${esc(v.notes)}`:''}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="materializeSeasonalReminder('${v.id}')">＋</button><button class="cact" onclick="editSeasonalReminder('${v.id}')">✏️</button><button class="cact" onclick="deleteSeasonalReminder('${v.id}')">🗑</button></div></div>`).join('')||'<div class="sdesc">No seasonal reminders yet.</div>'}</div>`;
  h+=`<div class="panel"><h3>Vehicle maintenance</h3><div class="safe-row"><button class="xbtn" onclick="addVehicleLog()">+ Service log</button></div>${X.vehicleLogs.slice().reverse().slice(0,6).map(v=>`<div class="list-row"><div class="list-main"><b>${esc(v.title)}</b><span>${new Date(v.date).toLocaleDateString()}${v.odometer?` · ${esc(v.odometer)} km`:''}${v.notes?` · ${esc(v.notes)}`:''}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="editVehicleEntry('${v.id}')">✏️</button><button class="cact" onclick="deleteVehicleEntry('${v.id}')">🗑</button></div></div>`).join('')||'<div class="sdesc">No vehicle logs yet.</div>'}</div>`;
  return h;
}
function openMoneyQuickAdd(){const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Money quick add</h3><div class="snz-opt" onclick="quickAddBill();this.closest('.mo').remove()">💰 Add bill</div><div class="snz-opt" onclick="logExpense();this.closest('.mo').remove()">🧾 Log expense</div><div class="snz-opt" onclick="addIncomeEntry();this.closest('.mo').remove()">💵 Add income</div><div class="snz-opt" onclick="addContribution();this.closest('.mo').remove()">🏦 Add RRSP/RESP</div><div class="snz-opt" onclick="addBudgetCategory();this.closest('.mo').remove()">🧮 Add budget category</div><div class="snz-opt" onclick="addShoppingItem();this.closest('.mo').remove()">🛒 Add shopping item</div><div class="snz-opt" onclick="addVehicleLog();this.closest('.mo').remove()">🚗 Add vehicle service log</div></div>`;document.body.appendChild(ov)}
function logExpense(){
  const cats=['Groceries','Gas','Kids','Dining','Transport','Shopping','Bills','Health','Other'];
  openRecordModal({title:'Log expense',submitHint:'Saves this expense in your current month log.',fields:[
    {name:'title',label:'What did you spend on?',value:'',required:true,placeholder:'FreshCo groceries'},
    {name:'amount',label:'Amount ($)',type:'number',value:'',required:true,placeholder:'85.00'},
    {name:'category',label:'Category',type:'select',options:cats.map(c=>({value:c,label:c})),value:'Groceries'}
  ],onSubmit:(vals)=>{
    const title=(vals.title||'').trim();const amount=Number(vals.amount)||0;
    if(!title){showToast('Enter a description');return false;}
    if(!amount||amount<=0){showToast('Enter an amount');return false;}
    X.expenses.unshift({id:gid(),title,amount,category:vals.category||'Other',date:new Date().toISOString()});
    logAction('expense',`Logged $${amount.toFixed(2)} — ${title}`);
    sv();render();showToast(`$${amount.toFixed(2)} logged`);return true;
  }});
}
function deleteExpense(id){X.expenses=X.expenses.filter(e=>e.id!==id);sv();render();showToast('Expense removed')}
function addBudgetCategory(){openBudgetCategoryForm()}
function addIncomeEntry(){openIncomeEntryForm()}
function addContribution(){openContributionForm()}
function addShoppingItem(){openRecordModal({title:'Add shopping item',fields:[{name:'text',label:'Item',value:'',required:true}],onSubmit:(vals)=>{const text=vals.text.trim();if(!text)return false;X.shoppingLists[0].items.push({id:gid(),text,done:false});sv();render();return true;}})}
function toggleShoppingItem(id){const item=X.shoppingLists[0]?.items.find(x=>x.id===id);if(!item)return;item.done=!item.done;sv();render();}
async function shareShoppingList(){openChecklistShare()}
function addVehicleLog(){openVehicleLogForm()}
function rBills(){
  let h=rHdr('Bill Forecast','Upcoming costs, paid history, and running total');
  const billTasks=R.filter(r=>!r.completed&&r.category==='bills').sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  const now=new Date(),monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const paidThisMonth=getPaidBills(monthKey);const forecast=billTasks.reduce((a,r)=>a+(Number(r.amount)||0),0);
  h+=`<div style="padding:10px 14px"><div style="display:flex;gap:8px;margin-bottom:12px"><div class="sm" style="flex:1;cursor:pointer" onclick="filter='all';go('tasks')"><div class="sm-n">${billTasks.length}</div><div class="sm-l">Upcoming</div></div><div class="sm" style="flex:1;cursor:pointer" onclick="filter='bills';go('tasks')"><div class="sm-n">$${forecast.toFixed(0)}</div><div class="sm-l">Forecast</div></div><div class="sm" style="flex:1"><div class="sm-n">$${paidThisMonth.reduce((a,r)=>a+(Number(r.amount)||0),0).toFixed(0)}</div><div class="sm-l">Paid</div></div></div><div style="display:flex;gap:8px;margin-bottom:10px"><button class="xbtn" onclick="quickAddBill()">💰 + Add Bill</button><button class="xbtn" onclick="logExpense()">🧾 Log Expense</button></div>`;
  if(billTasks.length){billTasks.forEach(r=>{const u=urg(r.dueDate);h+=`<div class="card pri-${r.priority}" style="margin-bottom:6px"><div class="crow"><button class="chk" onclick="toggleComp('${r.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></button><div class="cbody"><div class="ctitle" onclick="openEdit('${r.id}')" style="cursor:pointer">${esc(r.title)}</div><div class="cmeta"><span class="cdate">${fmtD(r.dueDate)}</span><span class="cbdg bdg-${u}">${tUntil(r.dueDate)}</span>${r.amount?`<span class="ctag">$${Number(r.amount).toFixed(2)}</span>`:''}</div></div><div class="cacts"><button class="cact" onclick="openEdit('${r.id}')">✏️</button><button class="cact" onclick="delR('${r.id}')">🗑</button></div></div></div>`})} else h+=`<div class="empty"><div class="empty-i">✅</div><div class="empty-t">No upcoming bills</div></div>`;
  h+=`<div class="panel" style="margin-top:12px"><h3>Already paid this month</h3>${paidThisMonth.slice(0,8).map(r=>`<div class="list-row"><div class="list-main"><b>${esc(r.title)}</b><span>${new Date(r.completedAt).toLocaleDateString()}${r.amount?` · $${Number(r.amount).toFixed(2)}`:''}</span></div><button class="cact" onclick="undoPaid('${r.id}')" title="Undo payment">↩</button></div>`).join('')||'<div class="sdesc">Nothing marked paid yet.</div>'}</div>`;
  h+=`</div>`;return h;
}
function undoPaid(id){const r=R.find(x=>x.id===id);if(!r)return;r.completed=false;delete r.completedAt;logAction('bill',`Unmarked paid: ${r.title}`);sv();render();showToast('Bill moved back to upcoming')}
function quickAddBill(){
  const d=new Date();d.setDate(d.getDate()+7);d.setHours(9,0,0,0);
  openRecordModal({title:'Add a bill',submitHint:'Saves as an upcoming task in the Bills category.',fields:[
    {name:'title',label:'Bill name',value:'',required:true,placeholder:'Hydro, Internet, Rent...'},
    {name:'amount',label:'Amount ($)',type:'number',value:'',required:true,placeholder:'150.00'},
    {name:'date',label:'Due date',type:'date',value:fmtLD(d)},
    {name:'recurrence',label:'Repeat',type:'select',options:[{value:'none',label:'One time'},{value:'monthly',label:'Monthly'},{value:'biweekly',label:'Every 2 weeks'},{value:'weekly',label:'Weekly'}],value:'monthly'}
  ],onSubmit:(vals)=>{
    const title=(vals.title||'').trim();const amount=Number(vals.amount)||0;
    if(!title){showToast('Enter a bill name');return false;}
    const due=new Date((vals.date||fmtLD(d))+'T09:00');
    if(isNaN(due.getTime())){showToast('Invalid date');return false;}
    R.push(normalizeReminder({id:gid(),title,notes:'',dueDate:due.toISOString(),category:'bills',priority:'high',recurrence:vals.recurrence||'none',alerts:['1440','60'],tags:[],subtasks:[],completed:false,amount,createdAt:new Date().toISOString()},R.length));
    logAction('bill',`Added bill: ${title}${amount?` $${amount.toFixed(2)}`:''}`);
    sv();render();showToast(`Bill added${amount?`: $${amount.toFixed(2)}`:''}`);return true;
  }});
}
function rShifts(){
  let h=rHdr('Shift Planner','Plan your schedule, patterns, pay, and conflicts');
  const y=shiftCalDate.getFullYear(),m=shiftCalDate.getMonth(),mn=shiftCalDate.toLocaleDateString([],{month:'long',year:'numeric'}),today=new Date(),todayKey=fmtLD(today);const fd=new Date(y,m,1).getDay(),dm=new Date(y,m+1,0).getDate();
  const searchBox=`<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><input id="shiftSearch" class="finp" style="margin:0" placeholder="Search shift notes or type" value="${esc(searchShiftTerm||'')}" oninput="searchShiftTerm=this.value;render()"><button class="xbtn" style="margin:0" onclick="openShiftPattern()">🔁 Pattern</button><button class="xbtn" style="margin:0" onclick="exportShiftsICS()">📅 .ics</button></div>`;
  h+=`<div class="cal"><div class="cal-hdr"><h3>${mn}</h3><div class="cal-nav"><button onclick="shiftCalPrev()">‹</button><button onclick="shiftCalToday()">Today</button><button onclick="shiftCalNext()">›</button></div></div>${searchBox}<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><input class="finp" type="month" value="${y}-${String(m+1).padStart(2,'0')}" style="margin:0" onchange="shiftCalJump(this.value)"><button class="xbtn" style="margin:0" onclick="openShiftDay('${todayKey}')">+ Today</button><button class="xbtn" style="margin:0" onclick="openPayPeriod()">💵 Pay period</button></div><div class="cal-grid">`;
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>h+=`<div class="cal-dl">${d}</div>`);for(let i=0;i<fd;i++){const pd=new Date(y,m,0-fd+i+1);h+=`<div class="cal-c other">${pd.getDate()}</div>`}for(let d=1;d<=dm;d++){const dt=new Date(y,m,d),ds=fmtLD(dt),dayShifts=getShiftsForDate(ds),primary=getPrimaryShiftForDate(ds),isT=sameDay(dt,today),label=getShiftCellLabel(dayShifts);h+=`<div class="cal-c${isT?' today':''}${dayShifts.length?' has':''}" onclick="openShiftDay('${ds}')" style="display:flex;flex-direction:column;justify-content:flex-start;padding-top:6px;border-color:${primary?getShiftColor(primary.type):'transparent'}"><div>${d}</div>${label?`<div style="font-size:9px;color:var(--text3);margin-top:4px;text-align:center">${label}</div>`:''}</div>`}const tc=fd+dm,rem=tc%7;if(rem>0)for(let i=1;i<=7-rem;i++)h+=`<div class="cal-c other">${i}</div>`;h+=`</div>`;
  const filtered=(shifts||[]).filter(s=>!searchShiftTerm||`${s.type} ${s.notes}`.toLowerCase().includes(searchShiftTerm.toLowerCase())).sort(sortShiftEntries).slice(0,18);
  const conflicts=getShiftConflicts().slice(0,6);const rests=getRestWarnings().slice(0,6);
  h+=`<div class="panel" style="margin:10px 0 0"><h3>Recent / matching shifts</h3>${filtered.map(s=>`<div class="shift-card" style="border-left:4px solid ${getShiftColor(s.type)}"><div class="shift-day"><div class="shift-day-name">${new Date(s.date+'T00:00').toLocaleDateString([],{weekday:'short'})}</div><div class="shift-day-num">${new Date(s.date+'T00:00').getDate()}</div></div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">${esc(s.type)}${s.onCall?' · On-call':''}</div><div style="font-size:11px;color:var(--text3)">${s.start&&s.end&&!isOffShiftType(s.type)?`${s.start} - ${s.end}`:'No hours'}${s.notes?` · ${esc(s.notes)}`:''}</div></div><button class="cact" onclick="copyShift('${s.date}')">📋</button><button class="cact" onclick="openShiftDay('${s.date}','${s.id}')">✏️</button></div>`).join('')||'<div class="sdesc">No shifts found.</div>'}</div>`;
  h+=`<div class="panel" style="margin:10px 0 0"><h3>Rest warnings</h3>${rests.map(r=>`<div class="mini-item">⚠️ ${esc(r.text)}</div>`).join('')||'<div class="sdesc">No short-rest gaps found.</div>'}</div>`;
  h+=`<div class="panel" style="margin:10px 0 0"><h3>Task conflicts</h3>${conflicts.map(r=>`<div class="mini-item">📌 ${esc(r.text)}</div>`).join('')||'<div class="sdesc">No task conflicts with saved shifts.</div>'}</div>`;
  h+=`</div>`;return h;
}
let searchShiftTerm='';
function getRestWarnings(){const arr=[];const sorted=[...shifts].filter(s=>!isOffShiftType(s.type)&&s.start&&s.end).sort(sortShiftEntries);for(let i=1;i<sorted.length;i++){const prev=sorted[i-1],cur=sorted[i];const prevEnd=getShiftEndDate(prev),curStart=new Date(cur.date+'T'+cur.start);const diff=(curStart-prevEnd)/3600000;if(diff<8)arr.push({text:`${prev.date} ${prev.type} → ${cur.date} ${cur.type} only ${diff.toFixed(1)}h apart`})}return arr}
function getShiftEndDate(s){const [eh,em]=String(s.end||'00:00').split(':').map(Number);const end=new Date(s.date+'T00:00');end.setHours(eh||0,em||0,0,0);if((eh*60+em)<(Number(s.start?.split(':')[0]||0)*60+Number(s.start?.split(':')[1]||0)))end.setDate(end.getDate()+1);return end}
function getShiftConflicts(){const out=[];R.filter(r=>!r.completed).forEach(r=>{const ds=fmtLD(new Date(r.dueDate));const due=new Date(r.dueDate);getShiftsForDate(ds).forEach(s=>{if(isShiftActiveNow(s,due))out.push({text:`${r.title} falls during ${s.type} on ${ds}`})})});return out}
function openShiftPattern(){const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Apply recurring shift pattern</h3><div class="flbl">Quick patterns</div><div class="snz-opt" onclick="applyWeeklyPattern('Mon-Fri Day','07:00','15:00',['1','2','3','4','5'])">Mon-Fri Day</div><div class="snz-opt" onclick="applyWeeklyPattern('Night','21:00','05:00',['0','1','2','3','4'])">Night block</div><div class="snz-opt" onclick="applyWeeklyPattern('Off','','',['6'])">Saturdays off</div><div class="flbl" style="margin-top:10px">Custom pattern for visible month</div><input class="finp" id="patType" placeholder="Shift type" value="303"><div class="frow"><input id="patStart" type="time" value="21:00"><input id="patEnd" type="time" value="05:00"></div><input class="finp" id="patDays" placeholder="Days of week, e.g. 0,1,2,3,4"><button class="sbtn" onclick="saveCustomPattern()">Apply custom pattern</button><div class="sdesc" style="margin-top:10px">Applies to the visible month. Days: Sun=0 ... Sat=6.</div></div>`;document.body.appendChild(ov)}
function saveCustomPattern(){const type=document.getElementById('patType')?.value.trim()||'Shift';const start=document.getElementById('patStart')?.value||'';const end=document.getElementById('patEnd')?.value||'';const days=(document.getElementById('patDays')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);if(!days.length){showToast('Enter at least one day number');return;}applyWeeklyPattern(type,start,end,days);document.querySelector('.mo')?.remove();}
function applyWeeklyPattern(type,start,end,days){const y=shiftCalDate.getFullYear(),m=shiftCalDate.getMonth(),dm=new Date(y,m+1,0).getDate();let added=0;for(let d=1;d<=dm;d++){const dt=new Date(y,m,d),dow=String(dt.getDay());if(!days.includes(dow))continue;const ds=fmtLD(dt);if(shifts.some(s=>s.date===ds&&s.type===type&&s.start===start&&s.end===end))continue;shifts.push({id:gid(),date:ds,type,start,end,notes:'Pattern applied',clientId:'',onCall:false});added++;}sv();render();showToast(`${added} pattern shifts added`);document.getElementById('moreM')?.remove?.()}
function openPayPeriod(){const info=getPayCycleInfo(new Date());const start=info.currentStart;const end=info.currentEnd;const periodShifts=shifts.filter(s=>{const d=new Date(s.date+'T00:00');return d>=start&&d<=end});const mins=periodShifts.reduce((a,s)=>a+getShiftMinutes(s),0);const workedDays=new Set(periodShifts.filter(s=>!isOffShiftType(s.type)).map(s=>s.date)).size;const payDates=[];for(let i=0;i<4;i++){const p=new Date(info.nextPayDate);p.setDate(info.nextPayDate.getDate()+14*i);payDates.push(p.toLocaleDateString())}const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Pay period view</h3><div class="mini-item">Anchor date: ${fmtLD(info.anchor)}</div><div class="mini-item">Current cycle: ${start.toLocaleDateString()} → ${end.toLocaleDateString()}</div><div class="mini-item">Total hours: ${(mins/60).toFixed(1)}</div><div class="mini-item">Worked days: ${workedDays}</div><div class="mini-item">Overtime estimate: ${(Math.max(0,mins-80*60)/60).toFixed(1)}h</div><div class="mini-item">Upcoming paycheck dates: ${payDates.join(', ')}</div><div class="mini-item">On-call entries: ${periodShifts.filter(s=>s.onCall).length}</div><div class="safe-row"><button class="xbtn" onclick="setPayAnchor()">Set anchor date</button></div></div>`;document.body.appendChild(ov)}
function setPayAnchor(){openRecordModal({title:'Set pay-period anchor',subtitle:'Choose the first day of the biweekly period, not the payday.',fields:[{name:'anchor',label:'Anchor date',type:'date',value:X.payPeriodAnchor||'2026-01-01',required:true}],onSubmit:(vals)=>{const d=vals.anchor||'';if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){showToast('Choose a valid date');return false;}X.payPeriodAnchor=d;sv();document.querySelectorAll('.mo').forEach(m=>m.remove());render();showToast('Saved');return true;}})}
function exportShiftsICS(){const entries=shifts.filter(s=>s.start&&s.end&&!isOffShiftType(s.type)).map(s=>{const st=formatICSDate(new Date(s.date+'T'+s.start));const en=formatICSDate(getShiftEndDate(s));return `BEGIN:VEVENT\nUID:${s.id}@todoflow\nDTSTAMP:${formatICSDate(new Date())}\nDTSTART:${st}\nDTEND:${en}\nSUMMARY:${escapeICS(s.type+(s.onCall?' (On-call)':''))}\nDESCRIPTION:${escapeICS(s.notes||'')}\nEND:VEVENT`;}).join('\n');const ics=`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Todo Flow//EN\n${entries}\nEND:VCALENDAR`;const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));const a=document.createElement('a');a.href=url;a.download='shifts.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
function formatICSDate(d){const pad=n=>String(n).padStart(2,'0');return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+pad(d.getUTCSeconds())+'Z'}
function escapeICS(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
function saveShift(ds){const start=document.getElementById('shiftStart')?.value||'07:00';const end=document.getElementById('shiftEnd')?.value||'15:00';const notes=document.getElementById('shiftNotes')?.value.trim()||'';const type=window._shiftType||'Day';const onCall=!!document.getElementById('shiftOnCall')?.checked;let msg='Shift saved';if(shiftEditId){const idx=shifts.findIndex(s=>s.id===shiftEditId);if(idx>=0){shifts[idx]={...shifts[idx],date:ds,type,start,end,notes,onCall};msg='Shift updated';}}else{shifts.push({id:gid(),date:ds,type,start,end,notes,onCall,clientId:''});msg='Shift added';}logAction('shift',`${msg}: ${type} ${ds}`);shiftEditId=null;shiftModalDate=null;window._shiftType='Day';const modal=document.getElementById('shiftM');if(modal)modal.remove();sv();render();showToast(msg)}
const _renderShiftModalOriginal=renderShiftModal;
renderShiftModal=function(){_renderShiftModalOriginal();const ov=document.getElementById('shiftM');if(!ov)return;const target=ov.querySelector('.shift-editor-panel');if(target&&!document.getElementById('shiftOnCallWrap')){const row=document.createElement('div');row.id='shiftOnCallWrap';row.innerHTML=`<label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;margin:8px 0 10px"><input type="checkbox" id="shiftOnCall" ${shiftEditId&&shifts.find(s=>s.id===shiftEditId)?.onCall?'checked':''}> On-call</label>`;target.insertBefore(row,target.querySelector('.flbl:nth-of-type(2)'))}}
function rTimeline(){
  const now=new Date();
  const yest=new Date(now.getTime()-86400000);
  const items=[];
  R.filter(r=>!r.completed).forEach(r=>{
    const uns=!!(r.unscheduled||isUnscheduledISO(r.dueDate));
    if(uns){
      items.push({kind:'Task',date:null,title:r.title,id:r.id,sub:fmtD(r.dueDate),unscheduled:true});
      return;
    }
    if(new Date(r.dueDate)>=yest){
      items.push({kind:'Task',date:r.dueDate,title:r.title,id:r.id,sub:fmtD(r.dueDate),unscheduled:false});
    }
  });
  shifts.filter(s=>s.date>=fmtLD(now)||s.date===fmtLD(now)).forEach(s=>items.push({kind:'Shift',date:s.date+'T'+(s.start||'00:00'),title:s.type+' '+(s.start&&s.end?s.start+'-'+s.end:''),sub:new Date(s.date+'T00:00').toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'}),unscheduled:false}));
  X.kidAppointments.filter(a=>new Date(a.date)>=now).forEach(a=>items.push({kind:'Appointment',date:a.date,title:a.title,sub:getChildName(a.childId),unscheduled:false}));
  items.sort((a,b)=>{
    const ka=a.unscheduled?Number.MAX_SAFE_INTEGER:new Date(a.date).getTime();
    const kb=b.unscheduled?Number.MAX_SAFE_INTEGER:new Date(b.date).getTime();
    if(ka!==kb)return ka-kb;
    return String(a.title||'').localeCompare(String(b.title||''));
  });
  let h=rHdr('Timeline','What\'s coming up');
  h+=`<div class="timeline">${items.slice(0,60).map(it=>{
    const rowClick=it.id?` onclick="openEdit('${it.id}')" style="cursor:pointer"`:'';
    const stamp=it.unscheduled
      ?'<div class="time-stamp" style="color:var(--text3)">No due<br>date</div>'
      :`<div class="time-stamp">${new Date(it.date).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}<br>${new Date(it.date).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div>`;
    return `<div class="time-row"${rowClick}>${stamp}<div class="time-card"><div class="time-type">${esc(it.kind)}</div><div style="font-size:14px;font-weight:700">${esc(it.title)}</div><div class="dash-sub">${esc(it.sub)}</div></div></div>`;
  }).join('')||'<div class="empty"><div class="empty-i">🎉</div><div class="empty-t">Nothing upcoming</div></div>'}</div>`;
  return h;
}
function toggleNoDue(on){const row=document.getElementById('fDueRow');const date=document.getElementById('fD');const time=document.getElementById('fTM');if(row)row.classList.toggle('is-disabled',!!on);if(date)date.disabled=!!on;if(time)time.disabled=!!on;}

let _addFormAiSeq = 0;
async function fetchAiAddFormHints(title, notes) {
  reserveAiCall('categorize');
  const base =
    typeof window !== 'undefined' && window.__TF_API_BASE__ ? String(window.__TF_API_BASE__).trim().replace(/\/+$/, '') : '';
  const url = (base || '') + '/api/chat-categorize';
  const categories = CATS.map((c) => ({ key: c.key, label: c.label }));
  const todayHint = typeof fmtLD === 'function' ? fmtLD(new Date()) : new Date().toISOString().slice(0, 10);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, notes, categories, todayHint }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data && (data.error || data.message) ? String(data.error || data.message) : 'HTTP ' + res.status;
    throw new Error(err);
  }
  return data;
}
function wireAddFormAiAssist() {
  const form = document.getElementById('formM');
  if (!form || form.dataset.aiWired === '1') return;
  form.dataset.aiWired = '1';
  const hint = document.getElementById('fAiHint');
  const mode=getAiMode();
  if (hint) hint.textContent = mode==='auto'?'AI assist is automatic while typing.':'AI assist is manual to reduce token usage. Click "Refresh AI" when you want suggestions.';
  if(mode==='auto'){
    let tmr = null;
    const sched = function () {
      clearTimeout(tmr);
      tmr = setTimeout(function () {
        void aiSuggestAddFormNow();
      }, 700);
    };
    document.getElementById('fT')?.addEventListener('input', sched);
    document.getElementById('fN')?.addEventListener('input', sched);
  }
}
async function aiSuggestAddFormNow() {
  if (editId) return;
  if (getAiMode() === 'off') {
    const el = document.getElementById('fAiHint');
    if (el) el.textContent = 'AI assist is off in Settings.';
    return;
  }
  if (!document.getElementById('formM')) return;
  const title = (document.getElementById('fT') || {}).value?.trim() || '';
  const notes = (document.getElementById('fN') || {}).value?.trim() || '';
  if (title.length < 6) return;
  const hintEl = document.getElementById('fAiHint');
  const my = ++_addFormAiSeq;
  if (hintEl) hintEl.textContent = 'AI: suggesting…';
  try {
    const h = await fetchAiAddFormHints(title, notes);
    if (my !== _addFormAiSeq || !document.getElementById('formM') || editId) return;
    if (h.category && CATS.some((c) => c.key === h.category)) window._fCat = h.category;
    if (h.priority && PRIS.some((p) => p.key === h.priority)) window._fPri = h.priority;
    if (h.effort !== undefined && h.effort !== null && EFFORTS.some((e) => e.key === String(h.effort))) {
      const sel = document.getElementById('fE');
      if (sel) sel.value = String(h.effort);
    }
    window._fAiTouched = true;
    rFC();
    rFP();
    if (hintEl) hintEl.textContent = h.reason ? String(h.reason).slice(0, 160) : 'AI updated category & priority — adjust if needed.';
  } catch (e) {
    if (my !== _addFormAiSeq) return;
    const el = document.getElementById('fAiHint');
    if (el) el.textContent = 'AI unavailable: ' + (e && e.message ? String(e.message) : 'check server / CLAUDE_API_KEY.');
  }
}
function closeAiRecategorizeModal(){document.getElementById('aiRecatM')?.remove();}
function getAiRecategorizeCandidates(){
  return getTaskVisibleList(R).filter(r=>r&&!r.completed&&String(r.title||'').trim().length>=3);
}
function renderAiRecategorizePreview(){
  const box=document.getElementById('aiRecatPreview');
  if(!box)return;
  const p=window.__aiRecatPreview;
  if(!p){
    box.innerHTML='<div class="sdesc">Click <b>Run preview</b> to let AI suggest category changes before applying.</div>';
    return;
  }
  const lines=[];
  lines.push(`<div class="mini-item">Scanned: ${p.scanned} task${p.scanned===1?'':'s'}${p.capHit?' (capped to protect AI usage)':''}</div>`);
  lines.push(`<div class="mini-item">Suggested changes: ${p.changes.length}</div>`);
  if(p.error)lines.push(`<div class="mini-item" style="color:var(--red)">Stopped: ${esc(p.error)}</div>`);
  if(!p.changes.length){
    lines.push('<div class="sdesc" style="margin-top:8px">No category changes suggested for the scanned tasks.</div>');
    box.innerHTML=lines.join('');
    return;
  }
  const rows=p.changes.slice(0,40).map(ch=>{
    const from=getCategory(ch.from),to=getCategory(ch.to);
    return `<div class="list-row"><div class="list-main"><b>${esc(ch.title)}</b><span>${esc(from.icon)} ${esc(from.label)} → ${esc(to.icon)} ${esc(to.label)}${ch.reason?` · ${esc(ch.reason)}`:''}</span></div></div>`;
  }).join('');
  const more=p.changes.length>40?`<div class="sdesc">Showing first 40 of ${p.changes.length} suggested changes.</div>`:'';
  box.innerHTML=lines.join('')+`<div style="margin-top:8px">${rows}${more}</div>`;
}
function openAiRecategorizeModal(){
  const existing=document.getElementById('aiRecatM');
  if(existing)existing.remove();
  const ov=document.createElement('div');
  ov.className='mo';
  ov.id='aiRecatM';
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>AI recategorize tasks</h3><div class="sdesc">Runs AI on active tasks and previews category changes before you apply them.</div><div class="frow" style="margin-top:10px"><label class="flbl" style="margin:0;font-size:12px;align-self:center">Scan cap</label><select id="aiRecatCap"><option value="25">25 tasks</option><option value="50">50 tasks</option><option value="120" selected>120 tasks</option><option value="all">All tasks</option></select></div><div id="aiRecatPreview" class="panel" style="margin:10px 0 0;max-height:55vh;overflow:auto"></div><div class="safe-row" style="margin-top:12px"><button class="xbtn" id="aiRecatRunBtn" onclick="runAiRecategorizePreview()">Run preview</button><button class="sbtn" id="aiRecatApplyBtn" onclick="applyAiRecategorizePreview()" disabled style="opacity:.55">Apply changes</button><button class="xbtn" onclick="closeAiRecategorizeModal()">Close</button></div></div>`;
  document.body.appendChild(ov);
  renderAiRecategorizePreview();
}
async function runAiRecategorizePreview(){
  if(getAiMode()==='off'){showToast('AI assist is off in Settings');return;}
  const runBtn=document.getElementById('aiRecatRunBtn');
  const applyBtn=document.getElementById('aiRecatApplyBtn');
  if(runBtn){runBtn.disabled=true;runBtn.style.opacity='.55';runBtn.textContent='Running…';}
  if(applyBtn){applyBtn.disabled=true;applyBtn.style.opacity='.55';}
  const candidates=getAiRecategorizeCandidates();
  const capSel=String(document.getElementById('aiRecatCap')?.value||'120');
  const capLimit=capSel==='all'?candidates.length:Math.max(1,Number(capSel)||120);
  const cap=Math.min(candidates.length,capLimit);
  const changes=[];
  let scanned=0,errMsg='';
  const categories=CATS.map(c=>({key:c.key,label:c.label}));
  const base=(typeof window!=='undefined'&&window.__TF_API_BASE__)?String(window.__TF_API_BASE__).trim().replace(/\/+$/,''):'';
  const url=(base||'')+'/api/chat-categorize';
  for(let i=0;i<cap;i++){
    const task=candidates[i];
    try{
      reserveAiCall('categorize');
      const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:task.title,notes:task.notes||'',categories,todayHint:fmtLD(new Date())})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(String(data?.error||data?.message||('HTTP '+res.status)));
      const nextCat=String(data?.category||'').trim();
      if(nextCat&&nextCat!==task.category&&CATS.some(c=>c.key===nextCat)){
        changes.push({id:task.id,title:task.title,from:task.category,to:nextCat,reason:String(data?.reason||'').slice(0,120)});
      }
    }catch(e){
      errMsg=String(e?.message||e||'AI request failed');
      break;
    }
    scanned++;
    const box=document.getElementById('aiRecatPreview');
    if(box&&scanned%10===0){box.innerHTML=`<div class="sdesc">Scanning tasks with AI… ${scanned}/${cap}</div>`;}
  }
  window.__aiRecatPreview={changes,scanned,error:errMsg,capHit:candidates.length>cap,ranAt:new Date().toISOString()};
  renderAiRecategorizePreview();
  if(applyBtn){
    const canApply=changes.length>0;
    applyBtn.disabled=!canApply;
    applyBtn.style.opacity=canApply?'1':'.55';
  }
  if(runBtn){runBtn.disabled=false;runBtn.style.opacity='1';runBtn.textContent='Run preview';}
}
function applyAiRecategorizePreview(){
  const p=window.__aiRecatPreview;
  if(!p||!Array.isArray(p.changes)||!p.changes.length){showToast('No changes to apply');return;}
  const backup=R.slice();
  let changed=0;
  p.changes.forEach(ch=>{
    const task=R.find(r=>r&&r.id===ch.id);
    if(!task)return;
    if(task.category===ch.to)return;
    task.category=ch.to;
    changed++;
  });
  if(!changed){showToast('No changes applied');return;}
  _undoCallback=()=>{R=backup;sv();render();};
  sv();render();showToast(`Saved ${changed} category change${changed===1?'':'s'}`,'Undo');
  closeAiRecategorizeModal();
}

function showForm(){
  const r=editId?R.find(x=>x.id===editId):null;const noDue=!!(r?.unscheduled||isUnscheduledISO(r?.dueDate));const d=noDue?new Date(Date.now()+3600000):(r?new Date(r.dueDate):new Date(Date.now()+3600000));const dd=fmtLD(d),tt=fmtLT(d),sd=r?.startDate?fmtLD(new Date(r.startDate)):'',st=r?.startDate?fmtLT(new Date(r.startDate)):'';const tags=(r?.tags||[]).join(', '),subs=(r?.subtasks||[]),dep=r?.dependsOn||'',amount=Number(r?.amount||0)||'',bundle=r?.bundle||'',childId=r?.childId||'';
  const ov=document.createElement('div');ov.className='mo';ov.id='formM';ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>${r?'Edit':'New'} Reminder</h3><div class="flbl">Title</div><input class="finp" id="fT" value="${esc(r?.title||'')}" placeholder="Reminder title"><div class="flbl">Notes</div><textarea class="finp" id="fN" placeholder="Details or checklist context">${esc(r?.notes||'')}</textarea>${r?'':'<div class="sdesc" id="fAiRow" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:2px 0 10px"><span id="fAiHint" style="flex:1;min-width:140px;font-size:11px;color:var(--text3)">AI suggests category, priority & effort from title and notes.</span><button type="button" class="xbtn" style="font-size:11px;padding:6px 10px;font-weight:600" onclick="aiSuggestAddFormNow()">Refresh AI</button></div>'}<div class="flbl">Start</div><div class="frow"><input type="date" id="fSD" value="${sd}"><input type="time" id="fST" value="${st}"></div><div class="flbl">Due</div><div class="safe-row" style="margin-bottom:8px"><label style="font-size:12px;font-weight:600"><input type="checkbox" id="fNoDue" ${noDue?'checked':''} onchange="toggleNoDue(this.checked)"> No due date yet</label></div><div class="frow due-row${noDue?' is-disabled':''}" id="fDueRow"><input type="date" id="fD" value="${dd}" ${noDue?'disabled':''}><input type="time" id="fTM" value="${tt}" ${noDue?'disabled':''}></div><div class="flbl">Category</div><div class="cgrid" id="fCG"></div><div class="flbl">Priority</div><div class="cgrid4" id="fPG"></div><div class="flbl">Alerts</div><div class="agrid" id="fAG"></div><div class="frow"><select id="fR">${RECS.map(o=>`<option value="${o.key}"${(r?.recurrence||'none')===o.key?' selected':''}>${o.label}</option>`).join('')}</select><select id="fE">${EFFORTS.map(o=>`<option value="${o.key}"${(r?.effort||'')===o.key?' selected':''}>Effort: ${o.label}</option>`).join('')}</select></div><div class="frow"><input id="fAmt" type="number" step="0.01" placeholder="Bill amount $" value="${amount}"><select id="fBundle"><option value="">Any time</option><option value="morning"${bundle==='morning'?' selected':''}>Morning bundle</option><option value="afternoon"${bundle==='afternoon'?' selected':''}>Afternoon bundle</option><option value="evening"${bundle==='evening'?' selected':''}>Evening bundle</option></select></div><div class="frow"><select id="fChild"><option value="">No child</option>${X.children.map(c=>`<option value="${c.id}"${childId===c.id?' selected':''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select><input id="fSubject" placeholder="Subject / label" value="${esc(r?.subject||'')}"></div><div class="frow"><input id="fGrade" placeholder="Grade / score" value="${esc(r?.grade||'')}"><select id="fDep"><option value="">No dependency</option>${R.filter(x=>!editId||x.id!==editId).map(x=>`<option value="${x.id}"${dep===x.id?' selected':''}>${esc(x.title)}</option>`).join('')}</select></div><div class="safe-row" style="margin-bottom:10px"><label style="font-size:12px;font-weight:600"><input type="checkbox" id="fBill" ${r?.billable?'checked':''}> Billable</label><label style="font-size:12px;font-weight:600"><input type="checkbox" id="fPin" ${r?.pinned?'checked':''}> Pin to top</label><label style="font-size:12px;font-weight:600"><input type="checkbox" id="fNag" ${r?.nag?'checked':''}> Nag mode</label></div><div class="flbl">Tags</div><input class="finp" id="fTags" value="${esc(tags)}" placeholder="comma, separated, tags"><div class="flbl">Subtasks</div><div class="sub-row"><input id="fSI" placeholder="Add subtask" onkeydown="if(event.key==='Enter'){event.preventDefault();addSub()}"><button onclick="addSub()">+</button></div><div id="fSL"></div><div class="safe-row" style="margin-top:12px"><button class="xbtn" type="button" onclick="document.getElementById('formM')?.remove();editId=null">Close</button><button class="sbtn" type="button" onclick="submitForm()">Save</button></div></div>`;
  document.body.appendChild(ov);window._fCat=r?.category||'personal';window._fPri=r?.priority||'medium';window._fAlerts=[...(r?.alerts||['15'])];window._fSubs=subs.map(s=>({...s}));window._fAiTouched=false;rFC();rFP();rFA();rFS();toggleNoDue(noDue);if(!r){wireAddFormAiAssist();if(getAiMode()==='auto')setTimeout(function(){if(!editId&&document.getElementById('fT')&&(document.getElementById('fT').value||'').trim().length>=6)void aiSuggestAddFormNow();},90);}setTimeout(()=>document.getElementById('fT')?.focus(),60)
}
function submitForm(){const title=document.getElementById('fT')?.value.trim();if(!title)return;const notes=document.getElementById('fN')?.value.trim()||'';const noDue=!!document.getElementById('fNoDue')?.checked;const dd=document.getElementById('fD')?.value,tm=document.getElementById('fTM')?.value||'09:00';const sd=document.getElementById('fSD')?.value,st=document.getElementById('fST')?.value||'00:00';const dueDate=noDue?UNSCHEDULED_SENTINEL_ISO:new Date(dd+'T'+tm).toISOString();let startDate=sd?new Date(sd+'T'+st).toISOString():'';if(startDate&&dueDate!==UNSCHEDULED_SENTINEL_ISO){const stMs=new Date(startDate).getTime(),dueMs=new Date(dueDate).getTime();if(Number.isFinite(stMs)&&Number.isFinite(dueMs)&&stMs>=dueMs)startDate='';}const rec=document.getElementById('fR')?.value||'none';const tags=(document.getElementById('fTags')?.value||'').split(',').map(t=>t.trim()).filter(Boolean);const dep=document.getElementById('fDep')?.value||'';const billable=!!document.getElementById('fBill')?.checked;const effort=document.getElementById('fE')?.value||'';const amount=Number(document.getElementById('fAmt')?.value||0)||0;const pinned=!!document.getElementById('fPin')?.checked;const nag=!!document.getElementById('fNag')?.checked;const bundle=document.getElementById('fBundle')?.value||'';const childId=document.getElementById('fChild')?.value||'';const subject=document.getElementById('fSubject')?.value.trim()||'';const grade=document.getElementById('fGrade')?.value.trim()||'';if(editId){const r=R.find(x=>x.id===editId);if(r)Object.assign(r,{title,notes,dueDate,startDate,unscheduled:noDue,category:window._fCat,priority:window._fPri,recurrence:rec,alerts:[...window._fAlerts],tags,subtasks:window._fSubs.map(s=>({...s})),dependsOn:dep||undefined,billable,effort,amount,pinned,nag,bundle,childId,subject,grade});logAction('task',`Updated ${title}`)}else{R.push(normalizeReminder({id:gid(),title,notes,dueDate,startDate,unscheduled:noDue,category:window._fCat,priority:window._fPri,recurrence:rec,alerts:[...window._fAlerts],tags,subtasks:window._fSubs.map(s=>({...s})),completed:false,billable,effort,dependsOn:dep||undefined,createdAt:new Date().toISOString(),amount,pinned,nag,bundle,childId,subject,grade,sourceMode:window._fAiTouched?'ai-suggest':'manual'},R.length));logAction('task',`Added ${title}`)}document.getElementById('formM')?.remove();editId=null;sv();render();}
function doSnz(id,v){const r=R.find(x=>x.id===id);if(!r)return;if(v==='tom'){const t=new Date();t.setDate(t.getDate()+1);t.setHours(9,0,0,0);r.dueDate=t.toISOString()}else r.dueDate=new Date(Date.now()+v*60000).toISOString();r.snoozeCount=(r.snoozeCount||0)+1;notified.forEach(k=>{if(k.startsWith(id+'_'))notified.delete(k)});logAction('snooze',`Snoozed ${r.title}`);sv();document.getElementById('snzM').remove();render()}
function rWhatNow(){
  let h=rHdr('What Now?','Smarter recommendations');
  const plan=buildProductivityPlan();
  h+=`<div class="prod-toolbar"><div class="prod-row"><span class="lane-pill${X.energyLevel==='low'?' on':''}" onclick="setEnergyLevel('low')">Low energy</span><span class="lane-pill${X.energyLevel==='normal'?' on':''}" onclick="setEnergyLevel('normal')">Normal</span><span class="lane-pill${X.energyLevel==='high'?' on':''}" onclick="setEnergyLevel('high')">High energy</span></div><div class="prod-row"><span class="lane-pill${X.focusStyle==='balanced'?' on':''}" onclick="setFocusStyle('balanced')">Balanced</span><span class="lane-pill${X.focusStyle==='quick'?' on':''}" onclick="setFocusStyle('quick')">Quick wins</span><span class="lane-pill${X.focusStyle==='deep'?' on':''}" onclick="setFocusStyle('deep')">Deep work</span><span class="lane-pill${X.focusStyle==='admin'?' on':''}" onclick="setFocusStyle('admin')">Admin</span><span class="lane-pill" onclick="openPowerHourPlan()">⚡ Open plan</span></div></div>`;
  if(plan.primary){const top=plan.primary,cat=getCategory(top.category);h+=`<div style="padding:14px"><div style="text-align:center;margin-bottom:18px"><div style="font-size:46px;margin-bottom:8px">🎯</div><div style="font-size:20px;font-weight:800;margin-bottom:4px">Best next move:</div><div class="coach-copy">${esc(plan.coach.body)}</div></div><div class="card pri-${top.priority||'low'}" style="border-width:2px"><div class="crow"><div class="cbody"><div class="ctop"><span class="cbadge" style="${categoryBadgeStyle(cat)}">${cat.icon} ${cat.label}</span>${top.pinned?'<span class="ctag">📌 pinned</span>':''}${isInTop3(top.id)?'<span class="ctag">⭐ top 3</span>':''}</div><div class="ctitle" style="font-size:18px">${esc(top.title)}</div>${top.notes?`<div class="cnotes">${esc(top.notes.slice(0,120))}</div>`:''}<div class="cmeta" style="margin-top:6px"><span class="cdate">${fmtD(top.dueDate)}</span><span class="cbdg bdg-${urg(top.dueDate)}">${tUntil(top.dueDate)}</span><span style="font-size:10px;color:var(--text3)">⏱ ${top.effort} min</span></div><div class="reason-row">${top.reasons.map(r=>`<span class="reason-chip">${esc(r)}</span>`).join('')}</div><div class="mini-item" style="margin-top:8px">Best lighter day in the next week: ${top.bestDay}</div></div></div></div><div style="display:flex;gap:8px;margin:12px 0"><button class="sbtn" style="flex:1;background:var(--green)" onclick="toggleComp('${top.id}');go('whatnow')">✓ Done</button><button class="sbtn" style="flex:1;background:var(--accent)" onclick="startPomo('${top.id}')">🍅 Focus</button><button class="sbtn" style="flex:0;padding:14px 18px" onclick="openSnooze('${top.id}')">💤</button></div>`;
    h+=`<div class="plan-grid"><div class="plan-card"><h4>Quick wins</h4>${plan.quickWins.map(task=>`<div class="queue-line"><div><b>${esc(task.title)}</b><span>${esc(task.reasons.join(' • ')||'fast win')}</span></div><div class="queue-min">${task.effort}m</div></div>`).join('')||'<div class="sdesc">No quick wins.</div>'}</div><div class="plan-card"><h4>Deep work</h4>${plan.deepWork.map(task=>`<div class="queue-line"><div><b>${esc(task.title)}</b><span>${esc(getCategory(task.category).label)} · best ${task.bestDay}</span></div><div class="queue-min">${task.effort}m</div></div>`).join('')||'<div class="sdesc">No deep work needs attention.</div>'}</div></div>`;
    if(plan.queue.length>1){h+=`<div class="panel"><h3>After that</h3>${plan.queue.slice(1,5).map(task=>`<div class="list-row"><div class="list-main"><b>${esc(task.title)}</b><span>${task.effort} min · ${esc(task.reasons.join(' • ')||'good fit')}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="openFocus('${task.id}')">🎯</button><button class="cact" onclick="openSnooze('${task.id}')">💤</button></div></div>`).join('')}</div>`;}
    if(plan.recovery.length)h+=`<div class="panel"><h3>If you feel stuck</h3><div class="sdesc" style="margin-bottom:10px">Try one of these easiest overdue wins to get momentum back.</div>${plan.recovery.map(task=>`<div class="list-row"><div class="list-main"><b>${esc(task.title)}</b><span>${fmtD(task.dueDate)} · ${task.effort} min</span></div><button class="cact" onclick="openFocus('${task.id}')">🎯</button></div>`).join('')}</div>`;
    h+=`</div>`;
  } else h+=`<div class="empty"><div class="empty-i">🎉</div><div class="empty-t">All done! Nothing to do right now.</div></div>`;
  return h
}
function openTop3FromPrompts(){
  document.getElementById('briefOv')?.remove();
  document.getElementById('top3M')?.remove();
  const weekly=[...document.querySelectorAll('.mo')].find(m=>/Sunday weekly reset/i.test(m.textContent||''));
  if(weekly)weekly.remove();
  go('myday');
  setTimeout(()=>{if(typeof openTop3Picker==='function')openTop3Picker();},120);
}
function checkBriefing(){const td=fmtLD(new Date());if(S.briefingShown[td])return;const overdue=R.filter(r=>!r.completed&&urg(r.dueDate)==='overdue');const missed=R.filter(r=>!r.completed&&fmtLD(new Date(r.dueDate))===fmtLD(new Date(Date.now()-86400000)));const top3=getTodayTop3();if(!overdue.length&&!missed.length&&!top3.length&&new Date().getDay()!==0)return;S.briefingShown[td]=true;sv(false);const ov=document.createElement('div');ov.className='brief-ov';ov.id='briefOv';const sunday=new Date().getDay()===0;ov.innerHTML=`<div style="font-size:44px">☀️</div><h2>Morning catch-up</h2><div class="brief-sub">${overdue.length} overdue · ${missed.length} from yesterday · ${top3.length}/3 top picks</div><div style="text-align:left;width:100%;max-width:340px;margin-bottom:18px">${overdue.slice(0,3).map(r=>`<div class="brief-item">🔴 ${esc(r.title)}</div>`).join('')}${missed.slice(0,2).map(r=>`<div class="brief-item">📦 Yesterday: ${esc(r.title)}</div>`).join('')}${top3.map(r=>`<div class="brief-item">⭐ ${esc(r.title)}</div>`).join('')||'<div class="brief-item">Pick your top 3 from My Day</div>'}</div><div class="safe-row" style="justify-content:center"><button onclick="document.getElementById('briefOv').remove();go('myday')">Start day</button><button onclick="openTop3FromPrompts()">Pick top 3</button>${sunday?`<button onclick="document.getElementById('briefOv').remove();openWeeklyReset()">Sunday reset</button>`:''}</div>`;document.body.appendChild(ov);if(sunday)setTimeout(openWeeklyReset,400)}
function openWeeklyReset(){const key=fmtLD(new Date());if(X.weeklyResetShown[key])return;X.weeklyResetShown[key]=true;sv(false);const overdue=R.filter(r=>!r.completed&&urg(r.dueDate)==='overdue').length;const snoozed=R.filter(r=>!r.completed&&(r.snoozeCount||0)>=2).slice(0,5);const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Sunday weekly reset</h3><div class="mini-item">Overdue tasks: ${overdue}</div><div class="mini-item">Tasks you keep snoozing: ${snoozed.length}</div>${snoozed.map(r=>`<div class="mini-item">😴 ${esc(r.title)}</div>`).join('')}<div class="safe-row"><button class="xbtn" onclick="go('weekly');this.closest('.mo').remove()">Open weekly planner</button><button class="xbtn" onclick="openTop3FromPrompts()">Pick top 3</button><button class="xbtn" onclick="this.closest('.mo').remove()">Close</button></div></div>`;document.body.appendChild(ov)}
async function checkNotifications(catchUp=false){const now=Date.now();let changed=false;pruneNotificationHistory();for(const r of R){if(r.completed)continue;const eligible=(r.alerts||['15']).filter(a=>{const key=r.id+'_'+a;if(notified.has(key))return false;const at=new Date(r.dueDate).getTime()-parseInt(a,10)*60000;const withinNormalWindow=now>=at&&now<at+120000;const withinCatchUpWindow=catchUp&&now>=at&&now-at<=NOTIFICATION_CATCHUP_MS;return withinNormalWindow||withinCatchUpWindow;}).sort((a,b)=>parseInt(a,10)-parseInt(b,10));if(eligible.length){const a=eligible[0],key=r.id+'_'+a,dueText=a==='0'?'Due now!':`Due ${getReminderLabel(a)}`;const sent=await sendNotification(`⏰ ${r.title}`,{body:dueText,tag:key,renotify:false,vibrate:[200,100,200],data:{id:r.id,view:'tasks'}});if(sent){rememberReminderStage(r.id,a,r.alerts||['15']);changed=true;}}if(r.nag&&!r.completed&&now>=new Date(r.dueDate).getTime()){const slot=Math.floor(now/(15*60*1000));const key=`${r.id}_nag_${slot}`;if(!notified.has(key)){const sent=await sendNotification(`🔔 ${r.title}`,{body:'Nag mode: still waiting for completion.',tag:key,renotify:true,vibrate:[250,120,250],data:{id:r.id,view:'tasks'}});if(sent){rememberNotified(key);changed=true;}}}}if(changed)sv(false)}
function genReport(){const now=new Date(),wa=new Date(now);wa.setDate(wa.getDate()-7);const completed=R.filter(r=>r.completed&&r.completedAt&&new Date(r.completedAt)>=wa);const overdue=R.filter(r=>!r.completed&&urg(r.dueDate)==='overdue');const upcoming=R.filter(r=>!r.completed&&urg(r.dueDate)!=='overdue').sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).slice(0,10);const ttW=timeLogs.filter(l=>new Date(l.date)>=wa).reduce((a,l)=>a+l.duration,0);let rpt=`WEEKLY REPORT — ${wa.toLocaleDateString()} to ${now.toLocaleDateString()}\n\n✅ COMPLETED (${completed.length})\n${completed.map(r=>'  • '+r.title).join('\n')||'  None'}\n\n🔴 OVERDUE (${overdue.length})\n${overdue.map(r=>'  • '+r.title).join('\n')||'  None'}\n\n📋 UPCOMING\n${upcoming.map(r=>'  • '+r.title+' — '+fmtD(r.dueDate)).join('\n')||'  None'}\n\n⏱️ TIME: ${fmtDur(ttW)}\n🔥 STREAK: ${getStreak()} days\n🕌 Prayer cache days: ${Object.keys(X.prayerCache||{}).length}\n💵 Open bill forecast: $${R.filter(r=>!r.completed&&r.category==='bills').reduce((a,r)=>a+(Number(r.amount)||0),0).toFixed(2)}`;const url=URL.createObjectURL(new Blob([rpt],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='weekly_report.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function rDispatch(){let h=rHdr('Dispatch Log','FlowLine AI calls');const weekAgo=new Date(Date.now()-7*86400000);const recent=dispatches.filter(d=>new Date(d.date)>=weekAgo);const sev={standard:0,urgent:0,emergency:0};recent.forEach(d=>sev[d.severity]=(sev[d.severity]||0)+1);h+=`<div style="padding:10px 14px"><div style="display:flex;gap:8px;margin-bottom:10px"><button class="xbtn" onclick="openDispatchForm()">📞 Log New Call</button><button class="xbtn" onclick="openClientBook()">👥 Client Book</button><button class="xbtn" onclick="exportInvoiceCsv()">🧾 Invoice CSV</button></div><div style="display:flex;gap:8px;margin-bottom:12px"><div class="sm" style="flex:1"><div class="sm-n">${recent.length}</div><div class="sm-l">7d volume</div></div><div class="sm" style="flex:1"><div class="sm-n" style="color:var(--orange)">${sev.urgent||0}</div><div class="sm-l">Urgent</div></div><div class="sm" style="flex:1"><div class="sm-n" style="color:var(--red)">${sev.emergency||0}</div><div class="sm-l">Emergency</div></div></div>`;
  if(dispatches.length){dispatches.slice().reverse().forEach(d=>{h+=`<div class="card" style="margin-bottom:6px"><div class="cbody"><div style="display:flex;justify-content:space-between;align-items:start"><div class="ctitle">${esc(d.caller)}</div><span class="cbdg" style="background:${d.severity==='emergency'?'var(--red)':d.severity==='urgent'?'var(--orange)':'var(--green)'}">${d.severity}</span></div><div style="font-size:11px;color:var(--text3);margin-top:2px">📍 ${esc(d.address)}</div>${d.notes?`<div style="font-size:11px;color:var(--text2);margin-top:2px">${esc(d.notes)}</div>`:''}<div style="font-size:10px;color:var(--text3);margin-top:4px">${new Date(d.date).toLocaleString()}</div></div></div>`})} else h+=`<div class="empty"><div class="empty-i">📞</div><div class="empty-t">No dispatches yet</div></div>`;h+=`</div>`;return h}
function saveDispatch(){const caller=document.getElementById('dCaller')?.value.trim();const address=document.getElementById('dAddr')?.value.trim();const notes=document.getElementById('dNotes')?.value.trim();const createTask=document.getElementById('dCreateTask')?.checked;if(!caller||!address)return;dispatches.push({id:gid(),caller,address,severity:window._dSev,notes,date:new Date().toISOString()});if(!X.clients.some(c=>c.name===caller&&c.address===address))X.clients.unshift({id:gid(),name:caller,address,phone:'',notes:''});if(createTask){const d=new Date(Date.now()+3600000);R.push(normalizeReminder({id:gid(),title:`Follow up: ${caller} - ${address}`,notes:`Severity: ${window._dSev}\n${notes}`,dueDate:d.toISOString(),startDate:d.toISOString(),category:'flowline',priority:window._dSev==='emergency'?'critical':window._dSev==='urgent'?'high':'medium',recurrence:'none',alerts:['15'],tags:['dispatch'],subtasks:[],completed:false,billable:true,effort:'30',createdAt:new Date().toISOString(),nag:window._dSev!=='standard'}))}logAction('dispatch',`Logged ${window._dSev} dispatch for ${caller}`);sv();document.getElementById('dispM')?.remove();render()}
function escalateOldDispatchFollowups(){let changed=false;R.forEach(r=>{if(r.completed||!(r.tags||[]).includes('dispatch'))return;if(new Date()-new Date(r.createdAt)>48*3600000&&r.priority!=='critical'){r.priority='critical';r.nag=true;changed=true;}});if(changed)sv(false)}
function openClientBook(){const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Client book</h3>${X.clients.map(c=>`<div class="list-row"><div class="list-main"><b>${esc(c.name)}</b><span>${esc(c.address)}${c.phone?` · ${esc(c.phone)}`:''}</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="editClientProfile('${c.id}')">✏️</button><button class="cact" onclick="deleteClientProfile('${c.id}')">🗑</button></div></div>`).join('')||'<div class="sdesc">No saved clients yet.</div>'}<div class="safe-row" style="margin-top:12px"><button class="xbtn" onclick="addClientProfile()">+ Client</button></div></div>`;document.body.appendChild(ov)}
function exportInvoiceCsv(){const rows=['title,date,duration_hours,client_id,tax_tag'];timeLogs.forEach(l=>rows.push([csvEsc(l.title),csvEsc(new Date(l.date).toISOString()),(l.duration/3600000).toFixed(2),csvEsc(l.clientId||''),csvEsc(l.taxTag||'general')].join(',')));const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='invoice_export.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
function csvEsc(s){s=String(s??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}

// DUE NOW BANNER
function checkDueNowBanner(){
  const existing=document.getElementById('dueBanner');
  const now=Date.now();
  const dueNow=R.filter(r=>!r.completed&&!r.startDate).filter(r=>{
    const diff=new Date(r.dueDate).getTime()-now;
    return diff>=-300000&&diff<=300000; // within 5 minutes either side
  });
  if(!dueNow.length){if(existing)existing.remove();return}
  const r=dueNow[0];
  if(existing){existing.querySelector('.due-text').textContent=`⏰ ${r.title} — due now!`;return}
  const banner=document.createElement('div');banner.className='due-banner';banner.id='dueBanner';
  banner.innerHTML=`<span class="due-text">⏰ ${esc(r.title)} — due now!</span><button onclick="event.stopPropagation();document.getElementById('dueBanner').remove()">✕</button>`;
  banner.onclick=()=>{banner.remove();openFocus(r.id)};
  document.body.appendChild(banner);
  try{if(navigator.vibrate)navigator.vibrate([100,50,100])}catch(e){}
}

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

