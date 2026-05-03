function parseJSON(key,fallback){
  try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch(e){return fallback}
}
function normalizeTemplate(t,index){
  const items=Array.isArray(t?.items)?t.items.map((item,ii)=>({
    title:String(item?.title||"").trim(),
    cat:CATS.some(c=>c.key===item?.cat)?item.cat:"bills",
    pri:PRIS.some(p=>p.key===item?.pri)?item.pri:"medium",
    order:Number.isFinite(Number(item?.order))?Number(item.order):ii,
  })).filter(item=>item.title):[];
  return {
    id:t?.id||gid(),
    name:String(t?.name||"").trim()||`Template ${index+1}`,
    desc:String(t?.desc||"").trim(),
    items:items.sort((a,b)=>(a.order??0)-(b.order??0)),
  };
}
function gid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function pruneBriefing(){
  const cut=new Date();cut.setDate(cut.getDate()-7);
  Object.keys(S.briefingShown||{}).forEach(k=>{if(new Date(k)<cut)delete S.briefingShown[k]});
}
function pruneNotificationHistory(){
  const cut=Date.now()-NOTIFICATION_HISTORY_MS;
  Object.keys(S.notifiedHistory||{}).forEach(k=>{if((S.notifiedHistory[k]||0)<cut)delete S.notifiedHistory[k]});
  notified=new Set(Object.keys(S.notifiedHistory||{}));
}
function reindexOrders(save=true){
  R.forEach((r,i)=>r.order=i);
  if(save)sv(false);
}
function clearReminderKeys(id){
  notified.forEach(k=>{if(k.startsWith(id+"_")){notified.delete(k);delete S.notifiedHistory[k]}})
}
function rememberNotified(key){
  notified.add(key);
  S.notifiedHistory[key]=Date.now();
}
function rememberReminderStage(taskId,currentAlert,allAlerts){
  const currentLead=parseInt(currentAlert,10);
  (allAlerts||[currentAlert]).forEach(a=>{if(parseInt(a,10)>=currentLead)rememberNotified(taskId+"_"+a)})
}
// ==================== UTILS ====================
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;")}
function isUnscheduledISO(iso){const d=new Date(iso);return !Number.isNaN(d.getTime())&&d.getFullYear()>=2099}
function fmtD(iso){if(isUnscheduledISO(iso))return"No date";const d=new Date(iso),n=new Date(),t=new Date(n);t.setDate(t.getDate()+1);const tm=d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});if(d.toDateString()===n.toDateString())return"Today · "+tm;if(d.toDateString()===t.toDateString())return"Tomorrow · "+tm;return d.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"})+" · "+tm}
function tUntil(iso){if(isUnscheduledISO(iso))return"No date";const df=new Date(iso)-new Date();if(df<0)return"Overdue";const m=Math.floor(df/60000);if(m<60)return m+"m";const h=Math.floor(m/60);if(h<24)return h+"h "+m%60+"m";return Math.floor(h/24)+"d "+h%24+"h"}
function startOfLocalDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
function calendarDaysBetween(from,to){return Math.round((startOfLocalDay(to)-startOfLocalDay(from))/86400000)}
function fmtTaskDueHuman(iso){
  if(isUnscheduledISO(iso))return'No date';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return'No date';
  const tm=d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
  const dayDiff=calendarDaysBetween(new Date(),d);
  if(dayDiff<0){
    const n=Math.abs(dayDiff);
    const ago=n===1?'yesterday':`${n} days ago`;
    return`Overdue · ${ago}, ${tm}`;
  }
  if(dayDiff===0)return`Today, ${tm}`;
  if(dayDiff===1)return`Tomorrow, ${tm}`;
  if(dayDiff>=2&&dayDiff<=7)return`${d.toLocaleDateString([],{weekday:'long'})}, ${tm}`;
  return`${d.toLocaleDateString([],{month:'short',day:'numeric'})}, ${tm}`;
}
function urg(iso){if(isUnscheduledISO(iso))return"later";const df=new Date(iso)-new Date();if(df<0)return"overdue";if(df<3600000)return"urgent";if(df<86400000)return"soon";return"later"}
function isToday(iso){return new Date(iso).toDateString()===new Date().toDateString()}
function sameDay(a,b){return a.toDateString()===b.toDateString()}
function fmtDur(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);return h>0?h+"h "+m%60+"m":m+"m "+s%60+"s"}
function fmtLD(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function fmtLT(d){return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")}
function getAiMode(){const m=String(S?.aiAssistMode||'manual');return ['off','manual','auto'].includes(m)?m:'manual'}
function getAiDailyLimit(){const n=Number(S?.aiDailyLimit);return Number.isFinite(n)&&n>0?Math.max(1,Math.min(500,n)):40}
function getAiUsageToday(){const day=fmtLD(new Date());if(!S.aiUsage||S.aiUsage.day!==day)S.aiUsage={day,calls:0,byType:{}};if(!S.aiUsage.byType||typeof S.aiUsage.byType!=="object")S.aiUsage.byType={};if(!Number.isFinite(Number(S.aiUsage.calls)))S.aiUsage.calls=0;return S.aiUsage}
function reserveAiCall(kind='general'){if(getAiMode()==='off')throw new Error('AI assist is off in Settings.');const u=getAiUsageToday();const lim=getAiDailyLimit();if(u.calls>=lim)throw new Error(`AI daily limit reached (${lim}).`);u.calls+=1;u.byType[kind]=(u.byType[kind]||0)+1;S.aiUsage=u;sv(false)}
function setAiAssistMode(mode){const m=String(mode);if(!['off','manual','auto'].includes(m))return;S.aiAssistMode=m;sv();render();showToast(`AI mode: ${m}`)}
function setAiDailyLimit(v){const n=Math.max(1,Math.min(500,Number(v)||40));S.aiDailyLimit=n;sv(false);render();showToast(`AI daily limit: ${n}`)}
function resetAiUsageToday(){S.aiUsage={day:fmtLD(new Date()),calls:0,byType:{}};sv(false);render();showToast('AI usage reset for today')}
function getChatAutonomyMode(){const m=String(S?.chatAutonomyMode||'assistive');return ['assistive','agentic'].includes(m)?m:'assistive'}
function isChatDryRunEnabled(){return !!S?.chatDryRun}
function getChatActionCap(){const n=Number(S?.chatActionCap);return Number.isFinite(n)&&n>0?Math.max(1,Math.min(200,n)):20}
function isChatPlannerEnabled(){return S?.chatPlannerEnabled!==false}
function getSyncMode(){const m=String(S?.syncMode||'auto').toLowerCase();return m==='manual'?'manual':'auto'}
function getSyncIntervalSec(){const n=Number(S?.syncIntervalSec);const allowed=[15,30,60,300,900,1800,3600];return allowed.includes(n)?n:30}
function setChatAutonomyMode(mode){const m=String(mode);if(!['assistive','agentic'].includes(m))return;S.chatAutonomyMode=m;sv(false);render();showToast(`Chat mode: ${m}`)}
function setChatDryRun(on){S.chatDryRun=!!on;sv(false);render();showToast(`Chat dry run: ${S.chatDryRun?'on':'off'}`)}
function setChatActionCap(v){const n=Math.max(1,Math.min(200,Number(v)||20));S.chatActionCap=n;sv(false);render();showToast(`Chat action cap: ${n}`)}
function setChatPlannerEnabled(on){S.chatPlannerEnabled=!!on;sv(false);render();showToast(`Chat planner: ${S.chatPlannerEnabled?'on':'off'}`)}
function applySyncPreferences(){
  if(typeof syncManager==='undefined')return;
  const mode=getSyncMode();
  const intervalMs=getSyncIntervalSec()*1000;
  if(typeof syncManager.configureAutoSync==='function'){
    syncManager.configureAutoSync(mode==='auto',intervalMs);
  }else if(mode==='manual'){
    if(typeof syncManager.stopAutoSync==='function')syncManager.stopAutoSync();
  }else{
    if(typeof syncManager.startAutoSync==='function')syncManager.startAutoSync(intervalMs);
  }
}
function setSyncMode(mode){
  const m=String(mode||'').toLowerCase();
  if(!['auto','manual'].includes(m))return;
  S.syncMode=m;
  sv(false);
  applySyncPreferences();
  render();
  showToast(`Sync mode: ${m==='manual'?'manual':'auto'}`);
}
function setSyncIntervalSec(sec){
  const n=Number(sec);
  const allowed=[15,30,60,300,900,1800,3600];
  if(!allowed.includes(n))return;
  S.syncIntervalSec=n;
  sv(false);
  applySyncPreferences();
  render();
  const label=n>=3600?`${Math.round(n/3600)} hour`:n>=60?`${Math.round(n/60)} min`:`${n}s`;
  showToast(`Auto-sync interval: ${label}`);
}

function parseNLP(text){
  const r={title:text,date:null,time:null,cat:"personal",pri:"medium"};const t=text.toLowerCase();const now=new Date();
  if(t.includes("today")){r.date=fmtLD(now);r.title=r.title.replace(/\btoday\b/i,"").trim()}
  else if(t.includes("tomorrow")){const d=new Date(now);d.setDate(d.getDate()+1);r.date=fmtLD(d);r.title=r.title.replace(/\btomorrow\b/i,"").trim()}
  else{const days=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];for(let i=0;i<days.length;i++){if(t.includes(days[i])){const d=new Date(now);const diff=(i-d.getDay()+7)%7||7;d.setDate(d.getDate()+diff);r.date=fmtLD(d);r.title=r.title.replace(new RegExp("\\b"+days[i]+"\\b","i"),"").trim();break}}}
  const tm=t.match(/(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)?/i)||t.match(/(\d{1,2})\s*(am|pm)/i);
  if(tm){let h=parseInt(tm[1]),mn=tm[2]&&!tm[2].match(/am|pm/i)?parseInt(tm[2]):0;const ap=tm[3]||tm[2];if(ap&&ap.toLowerCase()==="pm"&&h<12)h+=12;if(ap&&ap.toLowerCase()==="am"&&h===12)h=0;r.time=String(h).padStart(2,"0")+":"+String(mn).padStart(2,"0");r.title=r.title.replace(tm[0],"").trim()}
  CATS.forEach(c=>{if(t.includes(c.key)||t.includes(c.label.toLowerCase()))r.cat=c.key});
  if(t.includes("bill")||t.includes("pay")||t.includes("hydro")||t.includes("rent"))r.cat="bills";
  if(t.includes("doctor")||t.includes("dentist")||t.includes("medication"))r.cat="health";
  if(t.includes("school")||t.includes("homework"))r.cat="school";
  if(t.includes("plumb")||t.includes("dispatch")||t.includes("flowline"))r.cat="flowline";
  if(t.includes("urgent")||t.includes("critical")||t.includes("asap"))r.pri="critical";
  else if(t.includes("important"))r.pri="high";
  r.title=r.title.replace(/\b(urgent|critical|asap|important|high priority)\b/gi,"").replace(/\s+/g," ").trim();
  if(!r.title)r.title=text;return r;
}

function titleCaseWords(str){return String(str||'').toLowerCase().split(/\s+/).filter(Boolean).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')}
function stripTaskBullet(line){return String(line||'').replace(/^\s*(?:[-*•]+|\d+[.)]|\[(?:\s|x|X)?\])\s*/, '').trim()}
function detectCategoryByLabel(label){
  const raw=String(label||'').trim().toLowerCase();
  if(!raw)return '';
  const compact=raw.replace(/[^a-z0-9]+/g,'');
  const exact=CATS.find(c=>String(c.key).toLowerCase()===raw||String(c.label).toLowerCase()===raw);
  if(exact)return exact.key;
  const loose=CATS.find(c=>{
    const key=String(c.key).toLowerCase();
    const lab=String(c.label).toLowerCase();
    return compact===key.replace(/[^a-z0-9]+/g,'')||compact===lab.replace(/[^a-z0-9]+/g,'')||raw.includes(lab)||raw.includes(key);
  });
  return loose?loose.key:'';
}
function parseBulkSectionHeader(line){
  const trimmed=String(line||'').trim();
  if(!trimmed)return '';
  let m=trimmed.match(/^#{1,3}\s+(.+)$/);
  if(m)return m[1].trim();
  m=trimmed.match(/^\[(.+?)\]$/);
  if(m)return m[1].trim();
  m=trimmed.match(/^([^:]{2,40}):$/);
  if(m&&!/[0-9]/.test(m[1]))return m[1].trim();
  return '';
}
function extractExplicitDateTime(text){
  let working=String(text||'').trim(),date='',time='';
  let m=working.match(/\b(\d{4}-\d{2}-\d{2})(?:[ T]+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i);
  if(m){
    let h=m[2]?parseInt(m[2],10):null, mn=m[3]?parseInt(m[3],10):0, ap=(m[4]||'').toLowerCase();
    if(h!==null){if(ap==='pm'&&h<12)h+=12; if(ap==='am'&&h===12)h=0; time=String(h).padStart(2,'0')+':'+String(mn).padStart(2,'0');}
    date=m[1];
    return {date,time,text:working.replace(m[0],'').replace(/\s{2,}/g,' ').trim()};
  }
  m=working.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i);
  if(m){
    let year=parseInt(m[3]||new Date().getFullYear(),10); if(year<100)year+=2000;
    const month=Math.max(1,Math.min(12,parseInt(m[1],10))); const day=Math.max(1,Math.min(31,parseInt(m[2],10)));
    date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    let h=m[4]?parseInt(m[4],10):null, mn=m[5]?parseInt(m[5],10):0, ap=(m[6]||'').toLowerCase();
    if(h!==null){if(ap==='pm'&&h<12)h+=12; if(ap==='am'&&h===12)h=0; time=String(h).padStart(2,'0')+':'+String(mn).padStart(2,'0');}
    return {date,time,text:working.replace(m[0],'').replace(/\s{2,}/g,' ').trim()};
  }
  m=working.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(\d{4}))?(?:\s+(?:at\s+)??(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i);
  if(m){
    const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    const month=months[m[1].slice(0,3).toLowerCase()]||1;
    const day=Math.max(1,Math.min(31,parseInt(m[2],10)));
    const year=parseInt(m[3]||new Date().getFullYear(),10);
    date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    let h=m[4]?parseInt(m[4],10):null, mn=m[5]?parseInt(m[5],10):0, ap=(m[6]||'').toLowerCase();
    if(h!==null){if(ap==='pm'&&h<12)h+=12; if(ap==='am'&&h===12)h=0; time=String(h).padStart(2,'0')+':'+String(mn).padStart(2,'0');}
    return {date,time,text:working.replace(m[0],'').replace(/\s{2,}/g,' ').trim()};
  }
  return {date:'',time:'',text:working};
}
function buildTaskDateIso(date,time='09:00'){const d=new Date(`${date}T${time||'09:00'}`);return Number.isNaN(d.getTime())?new Date(Date.now()+3600000).toISOString():d.toISOString()}
function ensureBulkCategory(label){
  const existing=detectCategoryByLabel(label);
  if(existing)return existing;
  const pretty=titleCaseWords(String(label||'').replace(/[_-]+/g,' ').trim());
  const rec={key:slugCategoryKey(pretty),label:pretty,icon:'🏷️',color:'#64748B'};
  X.customCategories=[...(Array.isArray(X.customCategories)?X.customCategories:[]),rec];
  syncCustomCategories();
  return rec.key;
}
function inferBulkCategoryKey(text,sectionLabel){
  const sectionKey=detectCategoryByLabel(sectionLabel);
  if(sectionKey)return {key:sectionKey,customLabel:''};
  const knownInText=detectCategoryByLabel(text);
  if(knownInText&&knownInText!=='personal')return {key:knownInText,customLabel:''};
  const nlp=parseNLP(text||'');
  if(nlp.cat&&nlp.cat!=='personal')return {key:nlp.cat,customLabel:''};
  if(sectionLabel)return {key:'',customLabel:titleCaseWords(sectionLabel)};
  return {key:'',customLabel:''};
}
function parseBulkImportText(text,opts={}){
  const lines=String(text||'').split(/\r?\n/);
  const items=[];
  let sectionLabel='';
  lines.forEach(raw=>{
    if(!String(raw||'').trim())return;
    if(/^\s*\/\//.test(raw))return;
    const header=parseBulkSectionHeader(raw);
    if(header){sectionLabel=header;return;}
    let line=stripTaskBullet(raw);
    if(!line)return;
    let inlineSection='';
    const inline=line.match(/^([A-Za-z][A-Za-z0-9 &/+_-]{1,24})\s*(?:>|-)\s+(.+)$/);
    if(inline&&detectCategoryByLabel(inline[1])){inlineSection=inline[1];line=inline[2].trim();}
    const explicit=extractExplicitDateTime(line);
    line=explicit.text||line;
    const nlp=parseNLP(line);
    const categoryInfo=inferBulkCategoryKey(line, inlineSection||sectionLabel);
    const explicitPriority=/\b(urgent|critical|asap|important|high priority)\b/i.test(raw);
    const categoryKey=categoryInfo.key || (opts.defaultCategory&&opts.defaultCategory!=='auto'?opts.defaultCategory:'personal');
    const date=explicit.date||nlp.date||opts.defaultDate||'';
    const time=explicit.time||nlp.time||opts.defaultTime||'';
    const unscheduled=!date;
    const title=(nlp.title||line).replace(/\s+/g,' ').trim();
    if(!title)return;
    items.push({
      title,
      notes:'',
      categoryKey,
      customCategoryLabel:!categoryInfo.key&&categoryInfo.customLabel&&opts.createCategories?categoryInfo.customLabel:'',
      priority:explicitPriority?nlp.pri:(opts.defaultPriority||nlp.pri||'medium'),
      dueDate:unscheduled?UNSCHEDULED_SENTINEL_ISO:buildTaskDateIso(date,time||opts.defaultTime||'09:00'),
      unscheduled,
      source:raw.trim()
    });
  });
  return {items};
}
function renderBulkImportPreview(result){
  const items=result?.items||[];
  if(!items.length)return `<div class="sdesc" style="margin-top:10px">No task lines detected yet. Try one task per line, with optional headings like Bills: or School:</div>`;
  const created=[...new Set(items.map(i=>i.customCategoryLabel).filter(Boolean))];
  return `<div class="bulk-meta"><span class="bulk-pill">${items.length} tasks found</span>${created.length?`<span class="bulk-pill">${created.length} new categor${created.length===1?'y':'ies'}</span>`:''}</div>${items.slice(0,12).map(item=>{const cat=getCategory(item.categoryKey);return `<div class="bulk-preview-item"><b>${esc(item.title)}</b><div class="sdesc">${item.unscheduled?'No due date yet':fmtD(item.dueDate)} · ${esc(item.customCategoryLabel||cat.label)} · ${esc(item.priority)}</div></div>`}).join('')}${items.length>12?`<div class="sdesc">Showing first 12 of ${items.length} items.</div>`:''}`;
}
function openBulkImport(){
  const ov=document.createElement('div');ov.className='mo';ov.id='bulkImportM';ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Bulk import tasks</h3><div class="sdesc">Paste one task per line, or use section headings like <b>Bills:</b> or <b>[School]</b>. Dates and times will be pulled from the text when possible.</div><div class="flbl" style="margin-top:12px">Task text</div><textarea class="finp" id="bulkText" style="min-height:180px" placeholder="Bills:
- Pay hydro Apr 14 6pm
School:
- Send reading log tomorrow
Work:
- Finish report Friday 9am"></textarea><div class="frow"><select id="bulkDefaultCategory"><option value="auto">Auto-detect category</option>${categoryOptions().map(o=>`<option value="${o.value}">${esc(o.label)}</option>`).join('')}</select><select id="bulkDefaultPriority">${PRIS.map(p=>`<option value="${p.key}"${p.key==='medium'?' selected':''}>${esc(p.label)} priority</option>`).join('')}</select></div><div class="frow"><input id="bulkDefaultDate" type="date"><input id="bulkDefaultTime" type="time" value="09:00"></div><label class="snz-opt" style="text-align:left"><input id="bulkCreateCats" type="checkbox" checked style="margin-right:8px">Create categories from headings when needed</label><div class="bulk-actions"><button class="xbtn" onclick="document.getElementById('bulkFile').click()">📄 Load text file</button><button class="xbtn" onclick="pasteBulkClipboard()">📋 Paste clipboard</button><button class="xbtn" onclick="bulkPreview()">Preview</button></div><input id="bulkFile" type="file" accept=".txt,.md,.csv,text/plain" style="display:none" onchange="loadBulkImportFile(event)"><div id="bulkPreview" class="bulk-preview"></div><div class="safe-row" style="margin-top:14px"><button class="xbtn" onclick="document.getElementById('bulkImportM').remove()">Close</button><button class="sbtn" onclick="bulkImportSubmit()">Import tasks</button></div></div>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('bulkText')?.focus(),60);
}
function getBulkImportOptions(){
  return {
    defaultCategory:document.getElementById('bulkDefaultCategory')?.value||'auto',
    defaultPriority:document.getElementById('bulkDefaultPriority')?.value||'medium',
    defaultDate:document.getElementById('bulkDefaultDate')?.value||'',
    defaultTime:document.getElementById('bulkDefaultTime')?.value||'',
    createCategories:!!document.getElementById('bulkCreateCats')?.checked
  };
}
function bulkPreview(){
  const text=document.getElementById('bulkText')?.value||'';
  const result=parseBulkImportText(text,getBulkImportOptions());
  window.__bulkImportPreview=result;
  const box=document.getElementById('bulkPreview');
  if(box)box.innerHTML=renderBulkImportPreview(result);
  return result;
}
function loadBulkImportFile(e){
  const file=e.target.files?.[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{const ta=document.getElementById('bulkText'); if(ta)ta.value=String(ev.target?.result||''); bulkPreview();};
  reader.readAsText(file);
  e.target.value='';
}
async function pasteBulkClipboard(){
  try{const txt=await navigator.clipboard.readText();const ta=document.getElementById('bulkText');if(ta){ta.value=txt;bulkPreview();showToast('Clipboard pasted');}}catch(e){showToast('Clipboard paste not allowed here');}
}
function pasteBulkToNewImport(){openBulkImport();setTimeout(()=>pasteBulkClipboard(),120)}
function bulkImportSubmit(){
  const result=window.__bulkImportPreview?.items?.length?window.__bulkImportPreview:bulkPreview();
  const items=result?.items||[];
  if(!items.length){showToast('No tasks found to import');return;}
  const opts=getBulkImportOptions();
  const created=new Set();
  items.forEach(item=>{
    let category=item.categoryKey;
    if(item.customCategoryLabel&&opts.createCategories){category=ensureBulkCategory(item.customCategoryLabel);created.add(item.customCategoryLabel);}
    const rec=normalizeReminder({id:gid(),title:item.title,notes:item.notes||'',dueDate:item.dueDate,unscheduled:item.unscheduled,category:category||'personal',priority:item.priority||opts.defaultPriority||'medium',recurrence:'none',alerts:['15'],tags:['bulk-import'],subtasks:[],completed:false,createdAt:new Date().toISOString()},R.length);
    R.unshift(rec);
  });
  reindexOrders(false);
  logAction('bulk-import',`Imported ${items.length} tasks${created.size?` and ${created.size} categories`:''}`);
  sv();
  document.getElementById('bulkImportM')?.remove();
  render();
  showToast(`Imported ${items.length} task${items.length===1?'':'s'}`);
}

function getSuggestion(){
  const now=new Date(),dow=now.getDay();
  const recent=R.filter(r=>r.createdAt).slice(-50);
  const dayTasks=recent.filter(r=>new Date(r.createdAt).getDay()===dow);
  if(dayTasks.length>=3){const freq={};dayTasks.forEach(r=>{const w=r.title.toLowerCase().split(" ").slice(0,3).join(" ");freq[w]=(freq[w]||0)+1});const top=Object.entries(freq).sort((a,b)=>b[1]-a[1])[0];if(top&&top[1]>=2)return{text:`You often add "${top[0]}..." on ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow]}s`,action:top[0]}}
  return null;
}

function getWeekNumber(d=new Date()){const dt=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=(dt.getUTCDay()+6)%7;dt.setUTCDate(dt.getUTCDate()-day+3);const firstThu=new Date(Date.UTC(dt.getUTCFullYear(),0,4));return 1+Math.round(((dt-firstThu)/86400000-3+((firstThu.getUTCDay()+6)%7))/7)}
function getPatternInsights(){
  const out=[];const recent=R.filter(r=>r.createdAt).slice(-120);const byDow={};
  recent.forEach(r=>{const d=new Date(r.createdAt);const key=d.getDay();if(!byDow[key])byDow[key]={};const stem=r.title.toLowerCase().split(/\s+/).slice(0,3).join(' ');if(stem)byDow[key][stem]=(byDow[key][stem]||0)+1;});
  Object.entries(byDow).forEach(([dow,map])=>{const top=Object.entries(map).sort((a,b)=>b[1]-a[1])[0];if(top&&top[1]>=2)out.push({title:`${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]} pattern`,body:`You often add “${top[0]}…” on ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dow]}s.`});});
  const snoozed=R.filter(r=>!r.completed&&(r.snoozeCount||0)>=3).slice(0,3);if(snoozed.length)out.push({title:'Weekly auto-review',body:`${snoozed.length} tasks keep getting snoozed. Review them in Weekly Planner.`});
  return out.slice(0,4);
}
function getWeeklyAutoReview(){
  const snoozed=R.filter(r=>!r.completed&&(r.snoozeCount||0)>=2).sort((a,b)=>(b.snoozeCount||0)-(a.snoozeCount||0)).slice(0,5);
  const blocked=R.filter(r=>!r.completed&&r.dependsOn&&R.some(x=>x.id===r.dependsOn&&!x.completed)).slice(0,5);
  return {snoozed,blocked,overdue:R.filter(r=>!r.completed&&urg(r.dueDate)==='overdue').length};
}
function getSleepHours(entry){if(!entry?.bed||!entry?.wake)return 0;const [bh,bm]=String(entry.bed).split(':').map(Number),[wh,wm]=String(entry.wake).split(':').map(Number);let mins=(wh*60+wm)-(bh*60+bm);if(mins<0)mins+=24*60;return Math.max(0,mins/60)}
function renderMiniBars(items,max=8){if(!items.length)return '<div class="sdesc">No data yet.</div>';const peak=Math.max(1,...items.map(i=>Number(i.value)||0),max);return `<div class="mini-bars">${items.map(i=>`<div class="mini-bar"><div class="mini-bar-fill" style="height:${Math.max(8,Math.round((Number(i.value)||0)/peak*72))}px"></div><div class="mini-bar-label">${esc(i.label)}</div></div>`).join('')}</div>`}
function getPaidBills(monthKey=fmtLD(new Date()).slice(0,7)){return R.filter(r=>r.completed&&r.category==='bills'&&r.completedAt&&r.completedAt.startsWith(monthKey)).sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt))}
function getWeeklyPayPeriods(count=4){const anchor=new Date((X.payPeriodAnchor||'2026-01-01')+'T00:00');const start=new Date(anchor);start.setHours(0,0,0,0);const out=[];while(out.length<count){const end=new Date(start);end.setDate(start.getDate()+13);const periodShifts=shifts.filter(s=>{const d=new Date(s.date+'T00:00');return d>=start&&d<=end});out.push({start:new Date(start),end,totalHours:periodShifts.reduce((a,s)=>a+getShiftMinutes(s),0)/60});start.setDate(start.getDate()+14);}return out}
function shareEncode(str){try{return btoa(unescape(encodeURIComponent(str)))}catch(e){return ''}}
function shareDecode(str){try{return decodeURIComponent(escape(atob(str)))}catch(e){return ''}}
function buildShareUrl(payload){const raw=shareEncode(JSON.stringify(payload));return `${location.origin}${location.pathname}#share=${raw}`}
function openChecklistShare(){
  const checklist={items:(X.shoppingLists[0]?.items||[]).map(i=>({text:i.text,done:i.done})), chores:X.chores.map(c=>({title:c.title,assignee:getChoreAssignee(c)?.name||'',points:c.points}))};
  const payload={kind:'familyChecklist',label:'Family checklist',createdAt:new Date().toISOString(),checklist};
  const url=buildShareUrl(payload);X.sharedLinks.unshift({id:gid(),label:payload.label,url,createdAt:new Date().toISOString()});X.sharedLinks=X.sharedLinks.slice(0,20);sv(false);
  const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};
  const qr=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Share family checklist</h3><div class="sdesc">Open on another phone to import the checklist.</div><div class="mini-item" style="word-break:break-all">${esc(url)}</div><img src="${qr}" alt="QR code" style="width:220px;height:220px;border-radius:16px;margin:12px auto;display:block;background:#fff;padding:10px"><div class="safe-row"><button class="xbtn" onclick="copyShareUrl('${payload.label.replace(/'/g,"&#39;")}','${url}')">Copy link</button><button class="xbtn" onclick="nativeShareLink('${payload.label.replace(/'/g,"&#39;")}','${url}')">Share</button></div></div>`;
  document.body.appendChild(ov);
}
async function copyShareUrl(label,url){try{if(navigator.clipboard)await navigator.clipboard.writeText(url);showToast(`${label} link copied`)}catch(e){showToast('Could not copy link')}}
async function nativeShareLink(label,url){try{if(navigator.share)await navigator.share({title:label,url,text:url});else await copyShareUrl(label,url);}catch(e){}}
const CHILD_ICON_OPTIONS=['🧒','👦','👧','🧑','👶','🦸','🧕','👨‍🎓','👩‍🎓','🌟','📚','🎨','⚽','🧩','🎵'];
const PROFILE_COLOR_OPTIONS=['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899','#14B8A6','#6366F1'];
function closeChildProfileModal(){document.getElementById('childProfileM')?.remove();window.__childIcon=null;window.__childColor=null;window.__editingChildId=null;}
function selectChildIcon(icon){window.__childIcon=icon;document.querySelectorAll('#childProfileM .emoji-btn').forEach(b=>b.classList.toggle('active',b.dataset.icon===icon));}
function selectChildColor(color){window.__childColor=color;document.querySelectorAll('#childProfileM .color-btn').forEach(b=>b.classList.toggle('active',b.dataset.color===color));const picker=document.getElementById('childCustomColor');if(picker&&picker.value!==color)picker.value=color;}
function adjustChildProfilePoints(delta){const input=document.getElementById('childPoints');if(!input)return;input.value=String(Math.max(0,(Number(input.value)||0)+Number(delta||0)));}
function adjustChildPoints(childId,delta){const kid=X.children.find(c=>c.id===childId);if(!kid)return;kid.points=Math.max(0,(Number(kid.points)||0)+Number(delta||0));logAction('reward',`${kid.name} ${delta>=0?'gained':'lost'} ${Math.abs(Number(delta||0))}⭐`);sv();render();showToast(`${kid.name}: ${kid.points}⭐`);}

function saveChildProfileModal(){const name=(document.getElementById('childName')?.value||'').trim();if(!name){showToast('Enter a child name');return;}const customColor=document.getElementById('childCustomColor')?.value||'';const icon=window.__childIcon||'🧒';const color=customColor||window.__childColor||'#3B82F6';const points=Math.max(0,Number(document.getElementById('childPoints')?.value)||0);const child=window.__editingChildId?X.children.find(x=>x.id===window.__editingChildId):null;const rec=child||{id:gid(),points:0};Object.assign(rec,{name,icon,color,points});if(!child){X.children.push(rec);activeKidId=rec.id;logAction('child',`Added child profile ${name}`);}else{logAction('child',`Updated child profile ${name}`);}sv();render();closeChildProfileModal();showToast('Saved');}

function closeRecordModal(){document.getElementById('recordM')?.remove();window.__recordModalHandler=null;}
function openRecordModal(cfg){
  const fields=cfg.fields||[];
  window.__recordModalHandler=()=>{
    const vals={};
    for(const f of fields){
      const el=document.getElementById('rm_'+f.name);
      if(!el)continue;
      vals[f.name]=f.type==='checkbox'?!!el.checked:el.value;
    }
    const res=cfg.onSubmit?cfg.onSubmit(vals):true;
    if(res!==false)closeRecordModal();
  };
  const ov=document.createElement('div');ov.className='mo';ov.id='recordM';ov.onclick=e=>{if(e.target===ov)closeRecordModal()};
  const body=fields.map(f=>{
    const id='rm_'+f.name;
    const ph=f.placeholder?`placeholder="${esc(f.placeholder)}"`:'';
    if(f.type==='textarea')return `<div class="flbl">${esc(f.label)}</div><textarea class="finp" style="min-height:92px" id="${id}" ${ph}>${esc(f.value||'')}</textarea>`;
    if(f.type==='select')return `<div class="flbl">${esc(f.label)}</div><select class="finp" id="${id}">${(f.options||[]).map(o=>`<option value="${esc(o.value)}"${String(o.value)===String(f.value||'')?' selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
    if(f.type==='checkbox')return `<label class="snz-opt" style="justify-content:flex-start;gap:10px"><input id="${id}" type="checkbox" ${f.value?'checked':''}> ${esc(f.label)}</label>`;
    const inputType=f.type||'text';
    const step=inputType==='number'?' step="any"':'';
    return `<div class="flbl">${esc(f.label)}</div><input class="finp" type="${inputType}"${step} id="${id}" ${ph} value="${esc(f.value||'')}">`;
  }).join('');
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>${esc(cfg.title||'Edit')}</h3>${cfg.subtitle?`<div class="sdesc">${esc(cfg.subtitle)}</div>`:''}<div style="margin-top:12px">${body}</div><div class="safe-row" style="margin-top:14px"><button class="xbtn" onclick="closeRecordModal()">Close</button><button class="sbtn" onclick="window.__recordModalHandler&&window.__recordModalHandler()">Save</button></div>${cfg.submitHint?`<div class="sdesc" style="margin-top:8px">${esc(cfg.submitHint)}</div>`:''}</div>`;
  document.body.appendChild(ov);
  setTimeout(()=>ov.querySelector('input:not([type=checkbox]), textarea, select')?.focus(),60);
}
function importSharedPayloadFromLocation(){const hash=String(location.hash||'');if(!hash.startsWith('#share='))return false;const raw=hash.slice(7);const decoded=shareDecode(raw);if(!decoded)return false;try{const data=JSON.parse(decoded);if(data.kind==='familyChecklist'){const items=(data.checklist?.items||[]).map(i=>({id:gid(),text:String(i.text||''),done:!!i.done})).filter(i=>i.text);if(items.length){X.shoppingLists[0]={...(X.shoppingLists[0]||{id:gid(),name:'Groceries',items:[]}),items};sv(false);setTimeout(()=>showToast('Shared family checklist imported'),60);} } location.hash=''; return true;}catch(e){location.hash='';return false;}}
function createMaintenanceReminder(kind='maintenance'){
  const defaults={maintenance:{title:'Replace furnace filter',days:30,category:'personal',tags:['maintenance']},seasonal:{title:'Seasonal task',days:14,category:'personal',tags:['seasonal']}};
  const d=defaults[kind]||defaults.maintenance;
  openRecordModal({title:kind==='seasonal'?'Seasonal task':'Home maintenance task',subtitle:'Create a reminder directly from the home module.',fields:[
    {name:'title',label:'Title',value:d.title,required:true},
    {name:'date',label:'Due date',type:'date',value:fmtLD(new Date(Date.now()+d.days*86400000)),required:true},
    {name:'notes',label:'Notes',type:'textarea',value:''}
  ],onSubmit:(vals)=>{if(!vals.title.trim()||!vals.date)return false;const due=new Date(vals.date+'T09:00');R.push(normalizeReminder({id:gid(),title:vals.title.trim(),notes:vals.notes||'',dueDate:due.toISOString(),startDate:due.toISOString(),category:d.category,priority:'medium',recurrence:'none',alerts:['1440'],tags:d.tags,subtasks:[],completed:false,createdAt:new Date().toISOString()},R.length));logAction(kind,`Added ${kind} reminder ${vals.title.trim()}`);sv();render();showToast(kind==='seasonal'?'Seasonal task added':'Maintenance task added');return true;}
  });
}
function addSeasonalReminder(id=''){
  const existing=id?X.seasonalReminders.find(x=>x.id===id):null;
  openRecordModal({title:existing?'Edit seasonal reminder':'Add seasonal reminder',fields:[
    {name:'title',label:'Title',value:existing?.title||'Back to school forms',required:true},
    {name:'month',label:'Month',type:'select',value:String((existing?.month??8)+1),options:Array.from({length:12},(_,i)=>({value:String(i+1),label:new Date(2026,i,1).toLocaleDateString([],{month:'long'})}))},
    {name:'day',label:'Day of month',type:'number',value:String(existing?.day||1)},
    {name:'notes',label:'Notes',type:'textarea',value:existing?.notes||''}
  ],onSubmit:(vals)=>{const title=vals.title.trim();if(!title)return false;const month=Math.max(1,Math.min(12,Number(vals.month)||1));const day=Math.max(1,Math.min(31,Number(vals.day)||1));const rec=existing||{id:gid()};Object.assign(rec,{title,month:month-1,day,notes:(vals.notes||'').trim()});if(!existing)X.seasonalReminders.unshift(rec);sv();render();showToast('Saved');return true;}
  });
}
function addShoppingTemplate(){
  openRecordModal({title:'New shopping template',fields:[
    {name:'name',label:'Template name',value:'Costco run',required:true},
    {name:'items',label:'Items (comma separated)',type:'textarea',value:'milk, eggs, bread'}
  ],onSubmit:(vals)=>{const name=vals.name.trim();if(!name)return false;const items=(vals.items||'').split(',').map(x=>x.trim()).filter(Boolean).map(text=>({id:gid(),text,done:false}));X.shoppingLists.push({id:gid(),name,template:true,items});sv();render();showToast('Saved');return true;}
  });
}
function getChoreAssignee(chore,date=new Date()){if(!X.children.length)return null;const manual=chore?.assigneeByWeek?.[fmtLD(new Date(date))];if(manual)return X.children.find(c=>c.id===manual)||null;const week=getWeekNumber(date);return X.children[week%X.children.length]||X.children[0]}
function openChoreForm(id=''){
  const chore=id?X.chores.find(x=>x.id===id):null;
  openRecordModal({title:chore?'Edit chore':'Add chore',fields:[
    {name:'title',label:'Chore title',value:chore?.title||'Take out recycling',required:true},
    {name:'points',label:'Reward points',type:'number',value:String(chore?.points||1)},
    {name:'rotation',label:'Rotation',type:'select',value:chore?.rotation||'weekly',options:[{value:'weekly',label:'Weekly rotation'},{value:'manual',label:'Manual assignment'}]}
  ],onSubmit:(vals)=>{const title=vals.title.trim();if(!title)return false;const rec=chore||{id:gid(),lastDone:'',lastAssigned:'',assigneeByWeek:{}};Object.assign(rec,{title,points:Math.max(1,Number(vals.points)||1),rotation:vals.rotation||'weekly'});if(!chore)X.chores.unshift(rec);sv();render();showToast('Saved');return true;}
  });
}
function addChore(){openChoreForm()}
function completeChore(id){const chore=X.chores.find(x=>x.id===id);if(!chore)return;const kid=getChoreAssignee(chore);if(kid)kid.points+=chore.points;chore.lastDone=fmtLD(new Date());X.choreHistory.unshift({id:gid(),choreId:id,date:new Date().toISOString(),childId:kid?.id||'',points:chore.points,title:chore.title});X.choreHistory=X.choreHistory.slice(0,150);sv();render();showToast(kid?`${kid.name} earned ${chore.points}⭐`:'Chore completed')}
function deleteChore(id){const idx=X.chores.findIndex(x=>x.id===id);if(idx<0)return;X.chores.splice(idx,1);sv();render();showToast('Chore deleted')}
function openWeeklyChoreRotation(){
  const weekKey=fmtLD(new Date());
  const assignments=X.chores.map(ch=>({chore:ch,assignee:getChoreAssignee(ch)}));
  const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Chore rotation this week</h3><div class="sdesc">Review assignments, manually switch a child, or complete chores from one place.</div>${assignments.map(a=>`<div class="list-row"><div class="list-main"><b>${esc(a.chore.title)}</b><span>${a.assignee?`${esc(a.assignee.icon)} ${esc(a.assignee.name)}`:'No child profile yet'} · ${a.chore.points}⭐</span></div><div style="display:flex;gap:6px">${X.children.length?`<select class="finp" style="width:auto;min-width:110px;margin:0" onchange="const ch=X.chores.find(x=>x.id==='${a.chore.id}');if(ch){ch.assigneeByWeek=ch.assigneeByWeek||{};ch.assigneeByWeek['${weekKey}']=this.value;sv(false);}"><option value="">Auto</option>${X.children.map(c=>`<option value="${c.id}"${a.assignee?.id===c.id?' selected':''}>${esc(c.name)}</option>`).join('')}</select>`:''}<button class="cact" onclick="openChoreForm('${a.chore.id}')">✏️</button><button class="cact" onclick="deleteChore('${a.chore.id}')">🗑</button><button class="cact" onclick="completeChore('${a.chore.id}')">✅</button></div></div>`).join('')||'<div class="sdesc">Add chores first.</div>'}</div>`;
  document.body.appendChild(ov)
}
function materializeSeasonalReminder(id){const it=X.seasonalReminders.find(x=>x.id===id);if(!it)return;const y=new Date().getFullYear();const due=new Date(y,it.month,it.day,9,0,0,0);if(due<new Date())due.setFullYear(y+1);R.push(normalizeReminder({id:gid(),title:it.title,notes:it.notes,dueDate:due.toISOString(),startDate:due.toISOString(),category:'personal',priority:'medium',alerts:['1440'],tags:['seasonal'],createdAt:new Date().toISOString()},R.length));sv();render();showToast('Seasonal reminder added to tasks')}
function applyShoppingTemplate(id){const tpl=X.shoppingLists.find(x=>x.id===id);if(!tpl)return;const base=X.shoppingLists[0]||(X.shoppingLists[0]={id:gid(),name:'Groceries',items:[]});tpl.items.forEach(it=>{if(!base.items.some(x=>x.text.toLowerCase()===it.text.toLowerCase()))base.items.push({id:gid(),text:it.text,done:false})});sv();render();showToast('Template added to shopping list')}
function syncMedicationReminders(){let added=0;const today=fmtLD(new Date());X.medications.forEach(m=>{(m.times||[]).forEach(tm=>{const due=new Date(`${today}T${String(tm).slice(0,5)}`);if(Number.isNaN(due.getTime()))return;const title=`Medication: ${m.name}`;if(R.some(r=>!r.completed&&r.tags?.includes('medication')&&r.title===title&&fmtLD(new Date(r.dueDate))===today&&fmtLT(new Date(r.dueDate))===fmtLT(due)))return;R.push(normalizeReminder({id:gid(),title,notes:m.dose?`Dose: ${m.dose}`:'Medication reminder',dueDate:due.toISOString(),startDate:due.toISOString(),category:'health',priority:'high',alerts:['15'],tags:['medication','auto'],createdAt:new Date().toISOString()},R.length));added++;})});if(added){sv(false);if(view==='health'||view==='tasks')render();showToast(`${added} medication reminder${added===1?'':'s'} synced`)}}
function getMedicationRefillStatus(m){if(!m?.refillDate)return {text:'No refill date',urgent:false};const diff=Math.ceil((new Date(m.refillDate)-new Date())/86400000);if(diff<0)return {text:`Refill overdue by ${Math.abs(diff)}d`,urgent:true};if(diff<=14)return {text:`Refill due in ${diff}d`,urgent:true};return {text:`Refill in ${diff}d`,urgent:false}}
function exportPdfReport(){const now=new Date();const completed=R.filter(r=>r.completed&&r.completedAt&&new Date(r.completedAt)>=new Date(Date.now()-30*86400000)).length;const overdue=R.filter(r=>!r.completed&&urg(r.dueDate)==='overdue').length;const openBills=R.filter(r=>!r.completed&&r.category==='bills').reduce((a,r)=>a+(Number(r.amount)||0),0);const period=getWeeklyPayPeriods(4);const bars=period.map((p,i)=>`<div style="flex:1;text-align:center"><div style="height:${Math.max(12,p.totalHours*1.5)}px;background:#3B82F6;border-radius:10px 10px 4px 4px;margin:0 6px"></div><div style="font-size:11px;color:#475569">P${i+1}</div><div style="font-size:11px;color:#0f172a;font-weight:700">${p.totalHours.toFixed(1)}h</div></div>`).join('');const html=`<!doctype html><html><head><meta charset="utf-8"><title>Todo Flow Report</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#0f172a}h1{margin:0 0 6px} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.card{border:1px solid #cbd5e1;border-radius:16px;padding:14px;background:#f8fafc}.bars{display:flex;align-items:flex-end;height:180px;border:1px solid #e2e8f0;border-radius:16px;padding:14px;margin:18px 0}.muted{color:#64748b;font-size:12px}.list li{margin:6px 0}</style></head><body><h1>Todo Flow PDF report</h1><div class="muted">Generated ${now.toLocaleString()}</div><div class="grid"><div class="card"><b>Completed (30d)</b><div style="font-size:30px;font-weight:800">${completed}</div></div><div class="card"><b>Overdue</b><div style="font-size:30px;font-weight:800">${overdue}</div></div><div class="card"><b>Open bills</b><div style="font-size:30px;font-weight:800">$${openBills.toFixed(2)}</div></div></div><h3>Pay-period hours</h3><div class="bars">${bars}</div><h3>Weekly auto-review</h3><ul class="list">${getWeeklyAutoReview().snoozed.map(r=>`<li>${esc(r.title)} — snoozed ${r.snoozeCount} times</li>`).join('')||'<li>No repeated snoozes right now</li>'}</ul><script>window.onload=()=>setTimeout(()=>window.print(),120)</script></body></html>`;const win=window.open('','_blank');if(!win){showToast('Allow pop-ups to export PDF');return;}win.document.write(html);win.document.close();}
function getStreak(){let s=0,d=new Date();d.setHours(0,0,0,0);for(let i=0;i<365;i++){const c=new Date(d);c.setDate(c.getDate()-i);if(R.some(r=>r.completed&&r.completedAt&&new Date(r.completedAt).toDateString()===c.toDateString()))s++;else if(i>0)break}return s}
function getHabitStreak(hab){let s=0,d=new Date();d.setHours(0,0,0,0);for(let i=0;i<365;i++){const c=new Date(d);c.setDate(c.getDate()-i);if(hab.log&&hab.log.includes(c.toDateString()))s++;else if(i>0)break}return s}

// ==================== RENDER ====================

function rHdr(title,sub,opts){
  opts=opts||{};
  const pool=(opts.headerStatPool&&Array.isArray(opts.headerStatPool))?opts.headerStatPool:getTaskVisibleList(R).filter(r=>!r.completed&&isTaskStartVisible(r)),ov=pool.filter(r=>urg(r.dueDate)==="overdue").length,sc=pool.filter(r=>{const u=urg(r.dueDate);return u==="urgent"||u==="soon"}).length,lc=pool.filter(r=>urg(r.dueDate)==="later").length;
  const totalN=typeof opts.headerTotalCount==="number"?opts.headerTotalCount:pool.length;
  const showOvHdr=ov>0;
  const overdueHtml=showOvHdr?`<div class="stat ov" onclick="filter='overdue';go('tasks')" style="cursor:pointer" role="button"><span>🔴</span><div><div class="stat-n">${ov}</div><div class="stat-l">Overdue</div></div></div>`:'';
  return`<div class="hdr"><div class="hdr-top"><div class="hdr-date">${sub||new Date().toLocaleDateString([],{weekday:"long",month:"long",day:"numeric"})}</div><div style="display:flex;gap:6px"><button class="hdr-btn" onclick="openEndOfDay()" title="End of day review">🌙</button><button class="hdr-btn theme-toggle" onclick="toggleDark()" aria-pressed="${S.darkMode?'true':'false'}" title="${S.darkMode?'Switch to light mode':'Switch to dark mode'}">${S.darkMode?"🌙 Dark":"☀️ Light"}</button></div></div><h1>${title}</h1><div class="stats-row${showOvHdr?'':' stats-row--compact'}">${overdueHtml}<div class="stat" onclick="filter='duesoon';go('tasks')" style="cursor:pointer" role="button"><span>⚡</span><div><div class="stat-n">${sc}</div><div class="stat-l">Due Soon</div></div></div><div class="stat" onclick="filter='duelater';go('tasks')" style="cursor:pointer" role="button"><span>🗓️</span><div><div class="stat-n">${lc}</div><div class="stat-l">Due Later</div></div></div><div class="stat" onclick="filter='all';go('tasks')" style="cursor:pointer" role="button"><span>📋</span><div><div class="stat-n" id="hdrStatTotal">${totalN}</div><div class="stat-l">Total</div></div></div></div></div>`;
}
function isTaskStartVisible(r){
  if(!r?.startDate)return true;
  const st=new Date(r.startDate);
  if(Number.isNaN(st.getTime()))return true;
  if(r?.dueDate){
    const due=new Date(r.dueDate);
    if(!Number.isNaN(due.getTime())&&st>due)return true;
  }
  return st<=new Date();
}





