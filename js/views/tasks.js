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
const SWIPE_HINT_KEY='rp3_swipeHintDismissed';
function swipeHintDismissed(){try{return localStorage.getItem(SWIPE_HINT_KEY)==='1'}catch(e){return false}}
function dismissSwipeHint(){try{localStorage.setItem(SWIPE_HINT_KEY,'1')}catch(e){}render()}
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
  CATS.forEach(c=>{h+=`<button class="fbtn${filter===c.key?' active':''}" onclick="filter='${c.key}';render()">${esc(c.icon)} ${esc(c.label)}</button>`});
  h+=`<button class="fbtn" onclick="go('settings');setTimeout(()=>document.getElementById('catManage')?.scrollIntoView({behavior:'smooth',block:'start'}),120)">⚙ Manage categories</button></div></div></div><div class="sort-row"><span id="taskCountLabel">${listCount} items${sortBy==='manual'?' · drag to reorder':''}</span><select onchange="setSort(this.value)"><option value="date"${sortBy==='date'?' selected':''}>Date</option><option value="priority"${sortBy==='priority'?' selected':''}>Priority</option><option value="name"${sortBy==='name'?' selected':''}>A-Z</option><option value="manual"${sortBy==='manual'?' selected':''}>Manual</option></select></div>`;
  if(tasksBatchMode){
    const n=tasksBatchSelected.size;
    h+=`<div class="task-batch-toolbar safe-row" style="padding:8px 14px 4px;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:12px;font-weight:700;color:var(--text3)">${n} selected</span><button type="button" class="chip-btn" onclick="selectAllVisibleTasksForBatch()">All in view</button><button type="button" class="chip-btn" style="background:var(--green);color:#fff;border-color:transparent" onclick="tasksBatchDone()">Done</button><button type="button" class="chip-btn" style="background:var(--red);color:#fff;border-color:transparent" onclick="tasksBatchDel()" ${n===0?'disabled':''}>Delete (${n})</button><button type="button" class="chip-btn" onclick="exitTasksBatch()">Cancel</button></div>`;
  }else{
    h+=`<div class="task-batch-toolbar" style="padding:4px 14px 0"><button type="button" class="chip-btn" onclick="tasksBatchMode=true;tasksBatchSelected.clear();render()">Select tasks</button></div>`;
  }
  if(!swipeHintDismissed()&&R.length&&('ontouchstart' in window))h+=`<div class="swipe-hint-wrap"><span class="swipe-hint">← swipe to complete · swipe right to snooze</span><button type="button" class="nlp-hint-dismiss" onclick="dismissSwipeHint()" aria-label="Dismiss">✕</button></div>`;
  const mainListHtml=filter==='all'?rGroupedTaskList(groupedBase):rCards(filteredTasks);
  h+=`<div class="task-desktop-grid"><div class="task-main-col"><div class="clist task-stack${filter==='all'?' task-stack-grouped':''}" id="taskList">${mainListHtml}</div></div>${rTaskWorkspaceAside()}</div>`;return h;
}
function rCards(list){
  if(!list.length)return`<div class="empty task-empty-nlp"><div class="empty-i">✨</div><div class="empty-t">No tasks yet — try typing <span class="empty-quote">'soccer Tuesday 4pm'</span> in the box above.</div><div class="empty-nlp-arrow" aria-hidden="true">↑</div></div>`;
  return list.map(r=>{
    const u=urg(r.dueDate),cat=getCategory(r.category),pri=PRIS.find(p=>p.key===r.priority)||PRIS[0];
    const stD=(r.subtasks||[]).filter(s=>s.done).length,stT=(r.subtasks||[]).length;const blocked=!!(r.dependsOn&&R.find(x=>x.id===r.dependsOn && !x.completed));
    const kid=r.childId?X.children.find(c=>c.id===r.childId):null;
    const isOverdue=u==='overdue'&&!r.completed;
    const dueHuman=fmtTaskDueHuman(r.dueDate);
    const dueLineCls='cdate-line'+(isOverdue?' cdate-overdue':dueHuman==='No date'?' cdate-muted':'');
    return`<div class="card pri-${r.priority||'low'}${r.completed?' completed':''}${isOverdue?' card-overdue':''}${tasksBatchMode&&view==='tasks'&&tasksBatchSelected.has(r.id)?' task-card-batch-selected':''}" data-task-id="${r.id}" draggable="${tasksBatchMode&&view==='tasks'?'false':'true'}" ondragstart="dragS(event,'${r.id}')" ondragover="dragO(event)" ondragleave="this.classList.remove('drag-over')" ondrop="dragD(event,'${r.id}')" ontouchstart="taskTouchStart(event,'${r.id}')" ontouchmove="taskTouchMove(event,'${r.id}')" ontouchend="taskTouchEnd(event,'${r.id}')" ontouchcancel="taskTouchCancel(event,'${r.id}')" oncontextmenu="event.preventDefault();openTaskMenu('${r.id}')">
      <div class="crow">
        ${tasksBatchMode&&view==='tasks'?`<label class="task-batch-pick" onclick="event.stopPropagation()"><input type="checkbox" aria-label="Select task" ${tasksBatchSelected.has(r.id)?'checked':''} onchange="toggleTasksBatch('${r.id}',this.checked)"></label>`:''}<span class="drag-handle">⠿</span>
        <button class="chk${r.completed?' on':''}" onclick="${blocked?"alert('Complete the dependency first!')":"toggleComp('"+r.id+"')"}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></button>
        <div class="cbody"${tasksBatchMode&&view==='tasks'?' style="cursor:pointer" onclick="taskCardBodyBatchTap(event,\''+r.id+'\')"':''}>
          <div class="ctop"><span class="cbadge" style="${categoryBadgeStyle(cat)}">${esc(cat.icon)} ${esc(cat.label)}</span>${taskSourceBadge(r)}${r.pinned?'<span class="ctag">📌 pinned</span>':''}${isInTop3(r.id)?'<span class="ctag">⭐ top 3</span>':''}${r.nag?'<span class="ctag">🔔 nag</span>':''}${r.bundle?`<span class="ctag">${esc(bundleLabel(r.bundle))}</span>`:''}${kid?`<span class="ctag">${esc(kid.icon)} ${esc(kid.name)}</span>`:''}${(r.tags||[]).slice(0,2).map(t=>`<span class="ctag">#${esc(t)}</span>`).join('')}</div>
          <div class="ctitle" onclick="event.stopPropagation();${tasksBatchMode&&view==='tasks'?'toggleTasksBatchToggle(\''+r.id+'\')':'openEdit(\''+r.id+'\')'}" style="cursor:pointer">${esc(r.title)}</div>
          ${r.notes?`<div class="cnotes">${esc(r.notes.length>110?r.notes.slice(0,110)+'...':r.notes)}</div>`:''}
          ${blocked?`<div class="cdep">🔗 Blocked by: ${esc(R.find(x=>x.id===r.dependsOn)?.title||'?')}</div>`:''}
          ${r.subject?`<div class="ctime">📚 ${esc(r.subject)}${r.grade?` · ${esc(r.grade)}`:''}</div>`:''}
          ${r.amount?`<div class="ctime">💵 $${Number(r.amount).toFixed(2)}</div>`:''}
          ${r.billable?`<div class="ctime">💰 Billable</div>`:''}
          ${r.effort?`<div class="ctime">⏱️ ${esc(EFFORTS.find(e=>e.key===r.effort)?.label||r.effort)}</div>`:''}
          ${stT?`<div class="csubs">${(r.subtasks||[]).map((s,i)=>`<div class="csub${s.done?' dn':''}"><button class="csubchk${s.done?' on':''}" onclick="toggleSub('${r.id}',${i})">${s.done?'✓':''}</button><span>${esc(s.text)}</span></div>`).join('')}<div style="font-size:9px;color:var(--text3)">${stD}/${stT}</div></div>`:''}
          <div class="cmeta"><span class="${dueLineCls}">${dueHuman}</span>${r.startDate?`<span class="cdate">Start ${fmtD(r.startDate)}</span>`:''}${r.recurrence&&r.recurrence!=='none'?`<span class="crec">🔁 ${esc(r.recurrence)}</span>`:''}${u==='overdue'&&!r.completed?`<button class="csnz" onclick="openSnooze('${r.id}')">💤 Snooze</button>`:''}</div>
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
