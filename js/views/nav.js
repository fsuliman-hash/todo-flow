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
      {k:"prayers",i:"🕌",l:"Prayer Times",d:'Daily prayer times and reminders'},
      {k:"kids",i:"👨‍👩‍👧",l:"Kids & School",d:'Profiles, homework, rewards, appointments'},
      {k:"health",i:"🩺",l:"Health",d:'Medication, sleep, and exercise'},
      {k:"shifts",i:"🏗️",l:"Shift Planner",d:'Work shifts, patterns, and pay periods'},
      {k:"time",i:"⏱️",l:"Time Tracking",d:'Client time and invoices'}
    ]},
    {title:'Tools',items:[
      {k:"dispatch",i:"📞",l:"Dispatch",d:'Client calls and follow-up log'},
      {k:"templates",i:"📋",l:"Templates",d:'Reusable reminder sets'},
      {k:"stats",i:"📊",l:"Stats",d:'Trends and totals'},
      {k:"settings",i:"⚙️",l:"Settings",d:'Theme, categories, backup, and import/export'},
      {k:"trash",i:"🗑️",l:"Trash",d:'Recover deleted items'}
    ]}
  ].map(g=>({...g,items:g.items.filter(t=>isViewEnabled(t.k)&&(APP_SHELL_MINIMAL?!PRIMARY_NAV_KEYS.includes(t.k):true))})).filter(g=>g.items.length);
  const ov=document.createElement('div');ov.className='mo';ov.id='moreM';ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>All modules</h3>${groups.length?'':` <div class="sdesc" style="margin-bottom:12px">More modules are hidden in this build. Use Settings if available.</div>`}${groups.map(g=>`<div class="more-group" style="margin-bottom:16px"><div class="flbl" style="margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.6">${g.title}</div><div class="more-grid">${g.items.map(t=>`<button class="more-card" onclick="go('${t.k}');document.getElementById('moreM').remove()"><div class="more-card-top"><span class="more-emoji">${t.i}</span><b>${t.l}</b></div><span>${t.d}</span></button>`).join('')}</div></div>`).join('')}</div>`;
  document.body.appendChild(ov);
}
