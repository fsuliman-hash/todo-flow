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
  h+=`<div class="panel"><h3>AI controls</h3>`;
  h+=`<div class="sitem"><div><div class="slbl">Assist mode</div><div class="sdesc">Controls AI on the add form and chat</div></div></div><div class="safe-row" style="margin-top:6px;margin-bottom:4px"><button class="chip-btn${aiMode==='off'?' on':''}" onclick="setAiAssistMode('off')">Off</button><button class="chip-btn${aiMode==='manual'?' on':''}" onclick="setAiAssistMode('manual')">Manual</button><button class="chip-btn${aiMode==='auto'?' on':''}" onclick="setAiAssistMode('auto')">Auto</button></div>`;
  h+=`<div class="sitem"><div><div class="slbl">Daily usage</div><div class="sdesc">${aiUsage.calls}/${aiLimit} calls today · categorize ${aiUsage.byType?.categorize||0} · chat ${aiUsage.byType?.chat||0} · action ${aiUsage.byType?.action||0} · edit ${aiUsage.byType?.edit||0}</div></div></div><div class="safe-row" style="margin-top:6px;margin-bottom:4px"><button class="chip-btn${aiLimit===20?' on':''}" onclick="setAiDailyLimit(20)">20/day</button><button class="chip-btn${aiLimit===40?' on':''}" onclick="setAiDailyLimit(40)">40/day</button><button class="chip-btn${aiLimit===80?' on':''}" onclick="setAiDailyLimit(80)">80/day</button><button class="xbtn" onclick="resetAiUsageToday()">Reset today</button></div>`;
  h+=`<div class="sitem"><div><div class="slbl">Chat autonomy</div><div class="sdesc">How much the AI acts vs. asks first</div></div></div><div class="safe-row" style="margin-top:6px;margin-bottom:4px"><button class="chip-btn${chatMode==='assistive'?' on':''}" onclick="setChatAutonomyMode('assistive')">Assistive</button><button class="chip-btn${chatMode==='agentic'?' on':''}" onclick="setChatAutonomyMode('agentic')">Agentic</button></div>`;
  h+=`<div class="sitem"><div><div class="slbl">Dry run</div><div class="sdesc">Preview actions without saving changes</div></div><button class="chip-btn${chatDry?' on':''}" onclick="setChatDryRun(!isChatDryRunEnabled())" style="flex-shrink:0">${chatDry?'ON':'OFF'}</button></div>`;
  h+=`<div class="sitem"><div><div class="slbl">AI Planner</div><div class="sdesc">Auto-build a step plan before acting</div></div><button class="chip-btn${isChatPlannerEnabled()?' on':''}" onclick="setChatPlannerEnabled(!isChatPlannerEnabled())" style="flex-shrink:0">${isChatPlannerEnabled()?'ON':'OFF'}</button></div>`;
  h+=`<div class="sitem"><div><div class="slbl">Action cap</div><div class="sdesc">Max actions the AI can take per request</div></div></div><div class="safe-row" style="margin-top:6px"><button class="chip-btn${chatCap===5?' on':''}" onclick="setChatActionCap(5)">5</button><button class="chip-btn${chatCap===10?' on':''}" onclick="setChatActionCap(10)">10</button><button class="chip-btn${chatCap===20?' on':''}" onclick="setChatActionCap(20)">20</button><button class="chip-btn${chatCap===50?' on':''}" onclick="setChatActionCap(50)">50</button></div>`;
  h+=`</div>`;
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
  h+=`<div class="panel" id="catManage"><h3>Task categories</h3><div class="sdesc" style="margin-bottom:10px">Add, edit, or remove custom categories for your workflow.</div>${CATS.map(c=>`<div class="list-row"><div class="list-main"><b>${esc(c.icon)} ${esc(c.label)}</b><span>${esc(c.key)}${isCustomCategory(c.key)?' · custom':' · default'}</span></div><div class="safe-row"><button class="xbtn" onclick="editTaskCategory('${c.key}')">Edit</button>${isCustomCategory(c.key)?`<button class="xbtn" style="color:var(--red);border-color:rgba(220,38,38,.25)" onclick="deleteTaskCategory('${c.key}')">Remove</button>`:''}</div></div>`).join('')}<div class="safe-row" style="margin-top:10px"><button class="xbtn" onclick="addTaskCategory()">＋ Add category</button></div></div>`;
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
