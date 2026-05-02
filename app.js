// ==================== DATA ====================
const APP_VERSION = "6.1.3";
const SK="rp3",STK="rp3_set",HK="rp3_hab",SHK="rp3_shift",TLK="rp3_tlog",TMK="rp3_tmpl",RTK="rp3_rtn",BKP="rp3_backup",TRK="rp3_trash",WTK="rp3_water",DPK="rp3_dispatch";
const SETTINGS_DEFAULTS={darkMode:false,briefingShown:{},lastSavedAt:null,lastImportAt:null,notifiedHistory:{},aiAssistMode:'manual',aiDailyLimit:40,aiUsage:{day:'',calls:0,byType:{}},chatAutonomyMode:'assistive',chatDryRun:true,chatActionCap:20,chatPlannerEnabled:true,completionAnimSpeed:'normal',syncMode:'auto',syncIntervalSec:30,showClipboardDateBanner:false};
const BASE_CATS=[
  {key:"work",label:"Work",icon:"💼",color:"#3B82F6"},{key:"personal",label:"Personal",icon:"🏠",color:"#10B981"},
  {key:"bills",label:"Bills",icon:"💰",color:"#F59E0B"},{key:"health",label:"Health",icon:"🩺",color:"#EF4444"},
  {key:"kids",label:"Kids",icon:"👧",color:"#8B5CF6"},{key:"school",label:"School",icon:"📚",color:"#0EA5E9"},
  {key:"car",label:"Car",icon:"🚗",color:"#6366F1"},{key:"flowline",label:"FlowLine",icon:"🔧",color:"#0D9488"},
  {key:"other",label:"Other",icon:"📌",color:"#6B7280"},
];
const CATS=BASE_CATS.map(c=>({...c}));
const PRIS=[{key:"low",label:"Low",color:"#16A34A"},{key:"medium",label:"Med",color:"#D97706"},{key:"high",label:"High",color:"#EA580C"},{key:"critical",label:"Critical",color:"#DC2626"}];
const RECS=[{key:"none",label:"None"},{key:"daily",label:"Daily"},{key:"weekly",label:"Weekly"},{key:"biweekly",label:"Every 2 Weeks"},{key:"monthly",label:"Monthly"},{key:"weekdays",label:"Weekdays"},{key:"first_mon",label:"1st Monday"}];
const ALERTS=[{key:"0",label:"At time"},{key:"15",label:"15 min"},{key:"60",label:"1 hr"},{key:"1440",label:"1 day"}];
const EFFORTS=[{key:"",label:"None"},{key:"5",label:"5 min"},{key:"15",label:"15 min"},{key:"30",label:"30 min"},{key:"60",label:"1 hr"},{key:"120",label:"2 hr"}];
const NOTIFICATION_CATCHUP_MS=12*60*60*1000;
const NOTIFICATION_HISTORY_MS=3*24*60*60*1000;
const UNSCHEDULED_SENTINEL_ISO="2099-12-31T23:59:00.000Z";

let R=[],S={...SETTINGS_DEFAULTS},habits=[],shifts=[],timeLogs=[],templates=[],routines=[],trash=[],waterLog={},dispatches=[];
let view="tasks",filter="all",sortBy=localStorage.getItem("rp3_sort")||"date",search=localStorage.getItem("rp3_search")||"",calDate=new Date(),calSel=null,editId=null,notified=new Set();
let pomoActive=false,pomoId=null,pomoEnd=0,pomoBreak=false,pomoInterval=null;
let ttActive=null,ttStart=0,ttInterval=null;
let listening=false,dragId=null,notifInterval=null,searchTimer=null,nlpTimer=null,nlpDraft="",nlpParsing=false;
let completedSectionExpanded=false;
let taskFiltersOpen=localStorage.getItem("rp3_taskFiltersOpen")==="1";
let batchMode=false,batchSelected=new Set();
let tasksBatchMode=false,tasksBatchSelected=new Set();

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
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
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
  const active=R.filter(r=>!r.completed&&isTaskStartVisible(r)),ov=active.filter(r=>urg(r.dueDate)==="overdue").length,sc=active.filter(r=>{const u=urg(r.dueDate);return u==="urgent"||u==="soon"}).length,lc=active.filter(r=>urg(r.dueDate)==="later").length;
  const hideOvHdr=!!opts.hideHeaderOverdueStat;
  return`<div class="hdr"><div class="hdr-top"><div class="hdr-date">${sub||new Date().toLocaleDateString([],{weekday:"long",month:"long",day:"numeric"})}</div><div style="display:flex;gap:6px"><button class="hdr-btn" onclick="openEndOfDay()" title="End of day review">🌙</button><button class="hdr-btn theme-toggle" onclick="toggleDark()" aria-pressed="${S.darkMode?'true':'false'}" title="${S.darkMode?'Switch to light mode':'Switch to dark mode'}">${S.darkMode?"🌙 Dark":"☀️ Light"}</button></div></div><h1>${title}</h1><div class="stats-row">${ov>0&&!hideOvHdr?`<div class="stat ov" onclick="filter='overdue';go('tasks')" style="cursor:pointer"><span>🔴</span><div><div class="stat-n">${ov}</div><div class="stat-l">Overdue</div></div></div>`:""}<div class="stat" onclick="filter='duesoon';go('tasks')" style="cursor:pointer"><span>⚡</span><div><div class="stat-n">${sc}</div><div class="stat-l">Due Soon</div></div></div><div class="stat" onclick="filter='duelater';go('tasks')" style="cursor:pointer"><span>🗓️</span><div><div class="stat-n">${lc}</div><div class="stat-l">Due Later</div></div></div><div class="stat" onclick="filter='all';go('tasks')" style="cursor:pointer"><span>📋</span><div><div class="stat-n">${active.length}</div><div class="stat-l">Total</div></div></div></div></div>`;
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





// ==================== HABITS ====================
function addHabit(){const inp=document.getElementById("habIn");if(!inp||!inp.value.trim())return;habits.push({name:inp.value.trim(),log:[]});sv();render()}
function toggleHabit(hi,ds){if(!habits[hi])return;if(!habits[hi].log)habits[hi].log=[];const i=habits[hi].log.indexOf(ds);if(i>=0)habits[hi].log.splice(i,1);else habits[hi].log.push(ds);sv();render()}

// ==================== ROUTINES ====================
function rRoutines(){
  let h=rHdr("Routines","Visual routines for the kids");h+=`<div style="padding:10px 14px">`;
  routines.forEach((rtn,ri)=>{
    h+=`<h3 style="font-size:16px;font-weight:800;margin:14px 0 8px">${esc(rtn.name)} <button style="font-size:11px;background:var(--bg3);border:none;border-radius:8px;padding:4px 10px;color:var(--text2);font-weight:600" onclick="resetRtn(${ri})">Reset</button></h3>`;
    rtn.steps.forEach((s,si)=>{h+=`<div class="routine-card${s.done?" done":""}"><div class="routine-icon">${s.icon}</div><div class="routine-label">${esc(s.label)}</div><button class="routine-check${s.done?" on":""}" onclick="toggleRtn(${ri},${si})">${s.done?"✓":""}</button></div>`});
  });
  h+=`</div>`;return h;
}
function toggleRtn(ri,si){if(routines[ri]&&routines[ri].steps[si])routines[ri].steps[si].done=!routines[ri].steps[si].done;sv();render()}
function resetRtn(ri){if(routines[ri])routines[ri].steps.forEach(s=>s.done=false);sv();render()}

// ==================== SHIFTS ====================
let shiftCalDate=new Date();
let shiftModalDate=null,shiftEditId=null;
const SHIFT_TYPES=[
  {key:"Day",icon:"☀️"},{key:"Night",icon:"🌙"},{key:"Mobile",icon:"🚛"},
  {key:"Station",icon:"🚌"},{key:"Control",icon:"🏭"},{key:"Field",icon:"🚗"},
  {key:"Split",icon:"↔️"},{key:"Off",icon:"🏠"},{key:"Stat",icon:"🎉"}
];
function sortShiftEntries(a,b){
  return (a?.date||"").localeCompare(b?.date||"")||(a?.start||"").localeCompare(b?.start||"")||(a?.type||"").localeCompare(b?.type||"")||(a?.id||"").localeCompare(b?.id||"");
}
function getShiftsForDate(ds){return shifts.filter(s=>s.date===ds).sort(sortShiftEntries)}
function isOffShiftType(type){const t=(type||"").toLowerCase();return["off","stat","vacation","sick"].some(k=>t.includes(k))}
function getShiftMinutes(s){
  if(!s||isOffShiftType(s.type)||!s.start||!s.end)return 0;
  const [sh,sm]=String(s.start).split(":").map(v=>parseInt(v,10)||0);
  const [eh,em]=String(s.end).split(":").map(v=>parseInt(v,10)||0);
  let mins=(eh*60+em)-(sh*60+sm);
  if(mins<0)mins+=24*60;
  return Math.max(0,mins);
}
function isShiftActiveNow(s,now=new Date()){
  if(!s||s.date!==fmtLD(now)||isOffShiftType(s.type)||!s.start||!s.end)return false;
  const [sh,sm]=String(s.start).split(":").map(v=>parseInt(v,10)||0);
  const [eh,em]=String(s.end).split(":").map(v=>parseInt(v,10)||0);
  const cur=now.getHours()*60+now.getMinutes();
  const start=sh*60+sm,end=eh*60+em;
  if(start===end)return false;
  return end<start ? (cur>=start||cur<=end) : (cur>=start&&cur<=end);
}
function getPrimaryShiftForDate(ds){const day=getShiftsForDate(ds);return day.find(s=>!isOffShiftType(s.type))||day[0]||null}
function getShiftBadgeHtml(input){
  const dayShifts=Array.isArray(input)?input.slice().sort(sortShiftEntries):getShiftsForDate(input);
  if(!dayShifts.length)return "";
  const workedShifts=dayShifts.filter(s=>!isOffShiftType(s.type));
  const offOnly=workedShifts.length===0;
  const primary=workedShifts[0]||dayShifts[0];
  if(offOnly&&dayShifts.length===1){
    return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${getShiftColor(primary.type)}22;color:${getShiftColor(primary.type)}">OFF</span>`;
  }
  if(dayShifts.length===1){
    const timeLabel=primary.start&&primary.end&&!isOffShiftType(primary.type)?` ${primary.start}-${primary.end}`:"";
    return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${getShiftColor(primary.type)}22;color:${getShiftColor(primary.type)}">${esc(primary.type)}${timeLabel}</span>`;
  }
  const worked=workedShifts.length;
  if(!worked)return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${getShiftColor(primary.type)}22;color:${getShiftColor(primary.type)}">OFF</span>`;
  return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${getShiftColor(primary.type)}22;color:${getShiftColor(primary.type)}">${worked} worked${worked!==dayShifts.length?` · ${dayShifts.length-worked} off`:""}</span>`;
}
function getShiftCellLabel(dayShifts){
  if(!dayShifts.length)return "";
  const workedShifts=dayShifts.filter(s=>!isOffShiftType(s.type));
  if(!workedShifts.length)return "OFF";
  if(workedShifts.length===1){
    const t=(workedShifts[0].type||"").toUpperCase();
    return t.length>4?t.slice(0,3):t;
  }
  return `${workedShifts.length} SH`;
}

function getShiftColor(type){
  const t=(type||"").toLowerCase();
  if(t.includes("night")||t.includes("evening"))return"#7C3AED";
  if(t.includes("field")||t.includes("mobile"))return"#0D9488";
  if(t.includes("station"))return"#D97706";
  if(t.includes("control"))return"#DC2626";
  if(t.includes("split"))return"#EC4899";
  if(isOffShiftType(t))return"#94A3B8";
  return"#3B82F6";
}

function openShiftDay(ds,editEntryId=""){
  shiftModalDate=ds;
  const dayShifts=getShiftsForDate(ds);
  shiftEditId=editEntryId||((dayShifts.length===1&&dayShifts[0])?dayShifts[0].id:null);
  const editing=shiftEditId?shifts.find(s=>s.id===shiftEditId):null;
  window._shiftType=editing?editing.type:"Day";
  let ov=document.getElementById("shiftM");
  if(!ov){
    ov=document.createElement("div");ov.className="mo";ov.id="shiftM";
    ov.onclick=e=>{if(e.target===ov){ov.remove();shiftModalDate=null;shiftEditId=null;window._shiftType="Day"}};
    document.body.appendChild(ov);
  }
  renderShiftModal();
}

function closeShiftModal(){
  const ov=document.getElementById("shiftM");
  if(ov)ov.remove();
  shiftModalDate=null;
  shiftEditId=null;
  window._shiftType="Day";
}

function closeAnyModalOverlay(){
  const mods=[...document.querySelectorAll('.mo')];
  if(!mods.length)return false;
  mods.forEach(m=>m.remove());
  closeShiftModal();
  return true;
}

function renderShiftModal(){
  const ov=document.getElementById("shiftM");if(!ov||!shiftModalDate)return;
  const dayShifts=getShiftsForDate(shiftModalDate);
  const d=new Date(shiftModalDate+"T00:00:00");
  const dayLabel=d.toLocaleDateString([],{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const editing=shiftEditId?dayShifts.find(s=>s.id===shiftEditId):null;
  const startVal=editing?.start||"07:00",endVal=editing?.end||"15:00",notesVal=editing?.notes||"";
  ov.innerHTML=`<div class="mo-in shift-modal" onclick="event.stopPropagation()">
    <div class="mo-h"></div>
    <h3>${editing?"Edit Shift":"Add Shift"}</h3>
    <div style="font-size:13px;color:var(--text2);margin-bottom:14px">${dayLabel}</div>
    <div class="shift-day-list">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><div class="flbl" style="margin:0">Saved shifts</div>${dayShifts.length?`<button class="xbtn" style="margin:0" onclick="startNewShiftEntry()">＋ Add another</button>`:""}</div>
      ${dayShifts.length?dayShifts.map(s=>`<div class="shift-mini-card" style="border-left:4px solid ${getShiftColor(s.type)}"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${esc(s.type)}</div><div style="font-size:11px;color:var(--text3)">${s.start&&s.end&&!isOffShiftType(s.type)?`${s.start} - ${s.end}`:"No hours"}${s.notes?` · ${esc(s.notes)}`:""}</div></div><button class="cact" onclick="editShiftEntry('${s.id}')">✏️</button><button class="cact" onclick="delShiftEntry('${s.id}',true)">🗑</button></div>`).join(""):`<div class="empty" style="padding:16px 10px"><div class="empty-t">No shifts saved for this day yet</div></div>`}
    </div>
    <div class="shift-editor-panel">
      <div class="flbl">Shift Type</div>
      <div class="cgrid3" id="shiftTypeGrid"></div>
      <div class="flbl">Hours</div>
      <div style="margin-bottom:10px">
        <label style="font-size:10px;color:var(--text3)">Start</label>
        <input type="time" id="shiftStart" value="${startVal}" class="finp" style="margin-bottom:6px;font-size:16px;min-height:46px">
        <label style="font-size:10px;color:var(--text3)">End</label>
        <input type="time" id="shiftEnd" value="${endVal}" class="finp" style="margin-bottom:0;font-size:16px;min-height:46px">
      </div>
      <div class="flbl" style="margin-top:10px">Notes (optional)</div>
      <textarea class="finp shift-notes" id="shiftNotes" placeholder="e.g. covering for Mike, overtime, split duty">${esc(notesVal)}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="sbtn" style="flex:1;min-width:180px" onclick="saveShift('${shiftModalDate}')">Save</button>
        ${editing?`<button class="xbtn" style="margin:0" onclick="startNewShiftEntry()">Cancel edit</button>`:""}
        ${dayShifts.length?`<button class="xbtn" style="margin:0;color:var(--red);border-color:rgba(220,38,38,.25)" onclick="delShift('${shiftModalDate}')">Delete day</button>`:""}
      </div>
    </div>
  </div>`;
  renderShiftTypes();
}

function startNewShiftEntry(){shiftEditId=null;window._shiftType="Day";renderShiftModal()}
function editShiftEntry(id){
  shiftEditId=id;
  const s=shifts.find(x=>x.id===id);
  window._shiftType=s?.type||"Day";
  renderShiftModal();
}
function renderShiftTypes(){
  const grid=document.getElementById("shiftTypeGrid");if(!grid)return;
  grid.innerHTML=SHIFT_TYPES.map(t=>{
    const c=getShiftColor(t.key);
    return`<button class="cbtn${window._shiftType===t.key?" active":""}" style="--c:${c}" onclick="window._shiftType='${t.key}';renderShiftTypes()">${t.icon} ${t.key}</button>`;
  }).join("");
}

function delShiftEntry(id,keepModal=false){
  const idx=shifts.findIndex(s=>s.id===id);if(idx<0)return;
  const day=shifts[idx].date;
  shifts.splice(idx,1);
  if(shiftEditId===id)shiftEditId=null;
  sv();render();
  if(keepModal&&shiftModalDate===day)renderShiftModal();
  showToast("Shift deleted");
}
function delShift(ds){
  const count=getShiftsForDate(ds).length;
  if(!count)return;
  shifts=shifts.filter(s=>s.date!==ds);
  shiftEditId=null;
  sv();render();
  if(shiftModalDate===ds)closeShiftModal();
  showToast(count===1?"Shift deleted":`${count} shifts deleted`);
}
function shiftCalPrev(){shiftCalDate.setMonth(shiftCalDate.getMonth()-1);render()}
function shiftCalNext(){shiftCalDate.setMonth(shiftCalDate.getMonth()+1);render()}
function shiftCalToday(){shiftCalDate=new Date();render()}
function shiftCalJump(v){if(!v)return;const[mY,mM]=v.split("-").map(Number);if(mY&&mM){shiftCalDate=new Date(mY,mM-1,1);render()}}
// ==================== TIME TRACKING ====================
function rTime(){
  let h=rHdr("Time Tracking","Billable hours, invoices, and tax tags");if(ttActive)h+=rTTActive();
  h+=`<div style="padding:10px 14px">`;
  const billable=R.filter(r=>r.billable&&!r.completed);
  const summary=getTimeSummaryByClient();
  if(billable.length){h+=`<h4 style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px">BILLABLE TASKS</h4>`;billable.forEach(r=>{h+=`<div class="card" style="margin-bottom:6px"><div class="crow"><div class="cbody"><div class="ctitle">${esc(r.title)}</div></div><button class="cact" style="background:var(--accent);color:#fff" onclick="startTT('${r.id}')">▶</button></div></div>`})}
  h+=`<div class="safe-row" style="margin:12px 0"><button class="xbtn" onclick="openClientBook()">👥 Clients</button><button class="xbtn" onclick="addClientProfile()">＋ Client</button><button class="xbtn" onclick="openTimeSummary()">📊 Summary</button><button class="xbtn" onclick="exportInvoiceCsv()">🧾 Invoice CSV</button></div>`;
  if(summary.length)h+=`<div class="panel" style="margin:0 0 12px"><h3>Billable summary by client</h3>${summary.slice(0,5).map(r=>`<div class="list-row"><div class="list-main"><b>${esc(r.name)}</b><span>${fmtDur(r.ms)} · ${Object.keys(r.tags).length} tax tag${Object.keys(r.tags).length===1?'':'s'}</span></div></div>`).join('')}</div>`;
  h+=`<h4 style="font-size:12px;font-weight:700;color:var(--text3);margin:14px 0 8px">TIME LOG</h4>`;
  const totalMs=timeLogs.reduce((a,l)=>a+l.duration,0);
  h+=`<div style="font-size:13px;font-weight:700;margin-bottom:10px">Total: ${fmtDur(totalMs)}</div>`;
  timeLogs.slice().reverse().slice(0,20).forEach(l=>{h+=`<div class="tt-log"><div><div style="font-size:13px;font-weight:600">${esc(l.title)}</div><div style="font-size:10px;color:var(--text3)">${new Date(l.date).toLocaleDateString()}${l.clientId?` · ${(X.clients.find(c=>c.id===l.clientId)||{}).name||'client'}`:''}${l.taxTag?` · ${esc(l.taxTag)}`:''}</div></div><div style="display:flex;gap:6px;align-items:center"><div style="font-size:12px;font-family:'JetBrains Mono',monospace;color:var(--text3)">${fmtDur(l.duration)}</div><button class="cact" onclick="editTimeLogMeta('${l.id}')">✏️</button></div></div>`});
  h+=`</div>`;return h;
}
function editTimeLogMeta(id){const log=timeLogs.find(x=>x.id===id);if(!log)return;const currentClient=(X.clients.find(c=>c.id===log.clientId)||{}).name||'';openRecordModal({title:'Edit invoice timer details',fields:[{name:'client',label:'Client name',value:currentClient,placeholder:'Optional client name'},{name:'taxTag',label:'Tax category tag',value:log.taxTag||'general',placeholder:'general'}],onSubmit:(vals)=>{const client=(vals.client||'').trim();let clientId=log.clientId||'';if(client){let found=X.clients.find(c=>c.name.toLowerCase()===client.toLowerCase());if(!found){found={id:gid(),name:client,address:'',phone:'',notes:''};X.clients.unshift(found);}clientId=found.id;}else clientId='';log.clientId=clientId;log.taxTag=(vals.taxTag||'general').trim()||'general';sv();render();showToast('Saved');return true;}});}
function rTTActive(){const r=R.find(x=>x.id===ttActive);return`<div class="tt-active"><div class="tt-timer" id="ttT">${fmtDur(Date.now()-ttStart)}</div><div class="tt-task">${r?esc(r.title):"Tracking..."}</div><button class="tt-stop" onclick="stopTT()">⏹ Stop</button></div>`}
function startTT(id){if(ttActive)stopTT();ttActive=id;ttStart=Date.now();ttInterval=setInterval(updateTT,1000);render()}
function stopTT(){if(!ttActive)return;const dur=Date.now()-ttStart,r=R.find(x=>x.id===ttActive);timeLogs.push({id:gid(),taskId:ttActive,title:r?r.title:"Unknown",duration:dur,date:new Date().toISOString()});clearInterval(ttInterval);ttActive=null;ttStart=0;ttInterval=null;sv();render()}
function updateTT(){if(!ttActive)return;const el=document.getElementById("ttT");if(el)el.textContent=fmtDur(Date.now()-ttStart)}

// ==================== TEMPLATES ====================
function rTemplates(){
  let h=rHdr("Templates","Quick-add bundles");
  h+=`<div style="padding:10px 14px"><div style="margin-bottom:10px"><button class="xbtn" onclick="openTemplateForm()">+ New Template</button></div>`;
  if(!templates.length)h+=`<div class="empty"><div class="empty-i">📋</div><div class="empty-t">No templates yet</div></div>`;
  templates.forEach(t=>{
    const preview=(t.items||[]).slice(0,4).map(item=>`<span class="ctag">${esc(item.title)}</span>`).join("");
    h+=`<div class="tmpl-card" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div class="tmpl-name">${esc(t.name)}</div><div class="tmpl-desc">${esc(t.desc||`${t.items.length} items`)} · ${t.items.length} items</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="tmpl-use" onclick="useTmpl('${t.id}')">Use</button><button class="cact" onclick="openTemplateForm('${t.id}')">✏️</button><button class="cact" onclick="delTmpl('${t.id}')">🗑</button></div></div>${preview?`<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${preview}</div>`:""}</div>`
  });
  h+=`</div>`;return h;
}
function useTmpl(tid){const t=templates.find(x=>x.id===tid);if(!t)return;const base=new Date();t.items.forEach((item,i)=>{const d=new Date(base);d.setDate(d.getDate()+1);d.setHours(9+i,0,0,0);R.push({id:gid(),title:item.title,notes:"",dueDate:d.toISOString(),category:item.cat||"personal",priority:item.pri||"medium",recurrence:"none",alerts:["15"],tags:[],subtasks:[],completed:false,billable:false,createdAt:new Date().toISOString()})});sv();alert(`Added ${t.items.length} reminders!`);render()}
function openTemplateForm(id){
  const t=id?templates.find(x=>x.id===id):null;
  window._tmplEditId=t?t.id:null;
  window._tmplItems=(t?.items||[]).map(item=>({...item}));
  const ov=document.createElement("div");ov.className="mo";ov.id="tmplM";ov.onclick=e=>{if(e.target===ov)ov.remove()};
  ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>${t?"Edit":"New"} Template</h3>
    <div class="flbl">Template name</div><input class="finp" id="tmplName" value="${esc(t?.name||"")}" placeholder="Monthly Bills">
    <div class="flbl">Description</div><input class="finp" id="tmplDesc" value="${esc(t?.desc||"")}" placeholder="Optional note">
    <div class="flbl">Items</div><div id="tmplItems"></div>
    <div class="sub-row" style="margin-top:10px"><input id="tmplItemTitle" placeholder="Add item, e.g. Pay gas bill" onkeydown="if(event.key==='Enter'){event.preventDefault();addTmplItem()}"><button onclick="addTmplItem()">+</button></div>
    <div class="frow" style="margin-top:8px"><select id="tmplItemCat">${CATS.map(c=>`<option value="${c.key}">${c.icon} ${c.label}</option>`).join("")}</select><select id="tmplItemPri">${PRIS.map(p=>`<option value="${p.key}">${p.label}</option>`).join("")}</select></div>
    <button class="sbtn" onclick="saveTemplateForm()" style="margin-top:12px">Save</button></div>`;
  document.body.appendChild(ov);
  renderTemplateItems();
  setTimeout(()=>document.getElementById("tmplName")?.focus(),100);
}
function renderTemplateItems(){
  const wrap=document.getElementById("tmplItems");
  if(!wrap)return;
  if(!window._tmplItems?.length){wrap.innerHTML=`<div class="empty" style="margin:6px 0 0"><div class="empty-t">No items yet</div></div>`;return}
  wrap.innerHTML=window._tmplItems.map((item,i)=>`<div class="card" style="margin:6px 0;padding:10px"><div style="display:grid;grid-template-columns:1fr;gap:8px"><input class="finp" value="${esc(item.title)}" placeholder="Item title" oninput="updTmplItem(${i},'title',this.value)"><div class="frow"><select onchange="updTmplItem(${i},'cat',this.value)">${CATS.map(c=>`<option value="${c.key}"${item.cat===c.key?" selected":""}>${c.icon} ${c.label}</option>`).join("")}</select><select onchange="updTmplItem(${i},'pri',this.value)">${PRIS.map(p=>`<option value="${p.key}"${item.pri===p.key?" selected":""}>${p.label}</option>`).join("")}</select></div><div style="display:flex;justify-content:flex-end"><button class="cact" onclick="delTmplItem(${i})">🗑</button></div></div></div>`).join("")
}
function updTmplItem(i,field,value){if(!window._tmplItems||!window._tmplItems[i])return;window._tmplItems[i][field]=value}
function addTmplItem(){
  const title=document.getElementById("tmplItemTitle")?.value.trim();
  const cat=document.getElementById("tmplItemCat")?.value||"bills";
  const pri=document.getElementById("tmplItemPri")?.value||"medium";
  if(!title)return;
  if(!window._tmplItems)window._tmplItems=[];
  window._tmplItems.push({title,cat,pri,order:window._tmplItems.length});
  document.getElementById("tmplItemTitle").value="";
  renderTemplateItems();
  document.getElementById("tmplItemTitle")?.focus();
}
function delTmplItem(i){if(!window._tmplItems)return;window._tmplItems.splice(i,1);renderTemplateItems()}
function saveTemplateForm(){
  const name=document.getElementById("tmplName")?.value.trim();
  const desc=document.getElementById("tmplDesc")?.value.trim()||"";
  const items=(window._tmplItems||[]).map((item,i)=>({title:String(item.title||"").trim(),cat:item.cat,pri:item.pri,order:i})).filter(item=>item.title);
  if(!name){alert("Please enter a template name.");return}
  if(!items.length){alert("Add at least one item to the template.");return}
  const rec={id:window._tmplEditId||gid(),name,desc,items};
  const idx=templates.findIndex(x=>x.id===rec.id);
  if(idx>=0)templates[idx]=rec;else templates.unshift(rec);
  normalizeAll();sv();document.getElementById("tmplM")?.remove();render();
}
function delTmpl(id){const t=templates.find(x=>x.id===id);if(!t)return;if(!confirm(`Delete template "${t.name}"?`))return;templates=templates.filter(x=>x.id!==id);sv();render()}

// ==================== CALENDAR ====================
function rCal(){
  let h=rHdr("Calendar","Monthly view");const y=calDate.getFullYear(),m=calDate.getMonth(),mn=calDate.toLocaleDateString([],{month:"long",year:"numeric"});
  const fd=new Date(y,m,1).getDay(),dm=new Date(y,m+1,0).getDate(),today=new Date();
  h+=`<div class="cal"><div class="cal-hdr"><h3>${mn}</h3><div class="cal-nav"><button onclick="calPrev()">‹</button><button onclick="calNext()">›</button></div></div><div class="cal-grid">`;
  ["Su","Mo","Tu","We","Th","Fr","Sa"].forEach(d=>h+=`<div class="cal-dl">${d}</div>`);
  for(let i=0;i<fd;i++){const pd=new Date(y,m,0-fd+i+1);h+=`<div class="cal-c other">${pd.getDate()}</div>`}
  for(let d=1;d<=dm;d++){const dt=new Date(y,m,d),has=R.some(r=>!r.completed&&sameDay(new Date(r.dueDate),dt)),isT=sameDay(dt,today),isS=calSel&&sameDay(dt,calSel);h+=`<div class="cal-c${isT?" today":""}${isS?" sel":""}${has?" has":""}" onclick="calDay(${y},${m},${d})">${d}</div>`}
  const tc=fd+dm,rem=tc%7;if(rem>0)for(let i=1;i<=7-rem;i++)h+=`<div class="cal-c other">${i}</div>`;
  h+=`</div><div>`;
  if(calSel){const dt=R.filter(r=>!r.completed&&sameDay(new Date(r.dueDate),calSel)).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));if(dt.length)dt.forEach(r=>{const cat=getCategory(r.category);h+=`<div class="cal-ti"><span>${cat.icon}</span><span style="flex:1">${esc(r.title)}</span><span style="font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace">${new Date(r.dueDate).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</span></div>`});else h+=`<div class="empty"><div class="empty-t">No tasks</div></div>`}
  else h+=`<div class="empty"><div class="empty-t">Tap a day</div></div>`;
  h+=`</div></div>`;return h;
}

// ==================== STATS ====================
function rStats(){
  let h=rHdr("Stats","Productivity overview");
  const done=R.filter(r=>r.completed),active=R.filter(r=>!r.completed);
  const thisWeek=done.filter(r=>{if(!r.completedAt)return false;const d=new Date(r.completedAt),w=new Date();w.setDate(w.getDate()-7);return d>=w});
  const catStats=CATS.map(c=>({...c,count:active.filter(r=>r.category===c.key).length})),maxC=Math.max(...catStats.map(c=>c.count),1);
  h+=`<div class="sv"><div class="sr"><div class="sm"><div class="sm-n">${done.length}</div><div class="sm-l">Done</div></div><div class="sm"><div class="sm-n">${thisWeek.length}</div><div class="sm-l">This Week</div></div><div class="sm"><div class="sm-n">${active.length}</div><div class="sm-l">Active</div></div></div>`;
  h+=`<div class="sc"><div class="strk"><div class="strk-n">🔥 ${getStreak()}</div><div class="strk-l">Day streak</div></div></div>`;
  h+=`<div class="sc"><h4>By Category</h4>${catStats.map(c=>`<div class="sb-r"><span class="sb-l">${c.icon} ${c.label}</span><div class="sb-t"><div class="sb-f" style="width:${(c.count/maxC)*100}%;background:${c.color}"></div></div><span style="font-size:11px;font-weight:700;width:22px;text-align:right">${c.count}</span></div>`).join("")}</div>`;
  if(timeLogs.length){const total=timeLogs.reduce((a,l)=>a+l.duration,0);h+=`<div class="sc"><h4>Time Tracked</h4><div class="sm-n" style="text-align:center">${fmtDur(total)}</div></div>`}
  h+=`</div>`;return h;
}

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
      anchorDate:fmtLD(new Date()),
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
  const due=new Date(dueRaw);
  if(Number.isNaN(due.getTime()))return task;
  if(due.getDay()===targetDay)return task;
  const now=new Date();
  const fixed=new Date(now);
  fixed.setHours(due.getHours(),due.getMinutes(),0,0);
  let shift=(targetDay-fixed.getDay()+7)%7;
  if(shift===0&&fixed.getTime()<now.getTime())shift=7;
  fixed.setDate(fixed.getDate()+shift);
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
function rFC(){document.getElementById("fCG").innerHTML=CATS.map(c=>`<button class="cbtn${window._fCat===c.key?" active":""}" style="--c:${c.color}" onclick="window._fCat='${c.key}';rFC()">${c.icon} ${c.label}</button>`).join("")}
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
  countEl.textContent=`${filtered.length} items${sortBy==="manual"?" · drag to reorder":""}`;
  listEl.innerHTML=rCards(filtered);
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



// ==================== V5.5 ENHANCEMENTS ====================
const EXK="rp3_ex";
const THEME_PRESETS={
  blue:{accent:"#2563EB",accent2:"#3B82F6",abg:"rgba(37,99,235,.08)"},
  green:{accent:"#16A34A",accent2:"#22C55E",abg:"rgba(22,163,74,.10)"},
  purple:{accent:"#7C3AED",accent2:"#8B5CF6",abg:"rgba(124,58,237,.10)"},
  amber:{accent:"#D97706",accent2:"#F59E0B",abg:"rgba(217,119,6,.10)"},
  teal:{accent:"#0D9488",accent2:"#14B8A6",abg:"rgba(13,148,136,.10)"}
};
const NAV_LIBRARY=[
  {k:"tasks",l:"Tasks",i:"✅"},{k:"myday",l:"My Day",i:"☀️"},{k:"dashboard",l:"Home",i:"🏠"},{k:"calendar",l:"Calendar",i:"🗓️"},
  {k:"kids",l:"Kids",i:"👨‍👩‍👧"},{k:"health",l:"Health",i:"🩺"},{k:"money",l:"Money",i:"💰"}
];

/** Layer 1: Primary bottom nav = Tasks + Home + My Day + Calendar only; More + go() respect layer 2. */
const APP_SHELL_MINIMAL=true;
/** Layer 2: When APP_SHELL_MINIMAL, only keys set true appear in More (besides the four primary). When false, missing keys default open. */
const FEATURE_VIEW={
  tasks:true,dashboard:true,myday:true,calendar:true,
  settings:true,trash:true,
  timeline:false,weekly:false,matrix:false,whatnow:false,
  habits:false,routines:false,shifts:false,time:false,
  money:false,bills:false,prayers:false,kids:false,health:false,
  water:false,dispatch:false,templates:false,stats:false,
};
const PRIMARY_NAV_KEYS=["tasks","dashboard","myday","calendar"];
function isViewEnabled(k){
  if(APP_SHELL_MINIMAL){
    if(PRIMARY_NAV_KEYS.includes(k))return true;
    return FEATURE_VIEW[k]===true;
  }
  return FEATURE_VIEW[k]!==false;
}
function navLibraryForChooser(){
  return APP_SHELL_MINIMAL?NAV_LIBRARY.filter(n=>PRIMARY_NAV_KEYS.includes(n.k)):NAV_LIBRARY.filter(n=>isViewEnabled(n.k));
}
let X={};
let touchState={id:null,x:0,y:0,t:0,timer:null,menuOpened:false,cancelled:false};
let activeKidId="",lastCompletionState=null,prayerSyncing=false;
let completionPendingTimers={};
function defaultExtras(){
  return {
    themeColor:"amber",
    bigTap:false,
    navTabs:["tasks","dashboard","myday","calendar"],
    payPeriodAnchor:"2026-01-01",
    morningCatchupShown:{},
    weeklyResetShown:{},
    top3ByDate:{},
    children:[],
    readingLogs:[],
    homework:[],
    kidAppointments:[],
    medicationLogs:[],
    rewards:[],
    chores:[],
    choreHistory:[],
    sharedLinks:[],
    medications:[],
    sleepLogs:[],
    exerciseLogs:[],
    shiftPatterns:[],
    budgetCategories:[
      {id:gid(),name:"Housing",budget:0},{id:gid(),name:"Utilities",budget:0},{id:gid(),name:"Groceries",budget:0},{id:gid(),name:"Transport",budget:0}
    ],
    incomes:[],
    contributionLogs:[],
    shoppingLists:[{id:gid(),name:"Groceries",items:[]}],
    vehicleLogs:[],
    maintenanceLogs:[],
    seasonalReminders:[
      {id:gid(),title:"Tax season prep",month:2,day:15,notes:"Gather tax slips and contribution receipts."},
      {id:gid(),title:"Back to school forms",month:7,day:20,notes:"Review forms and school supplies."},
      {id:gid(),title:"Winter tire swap",month:9,day:20,notes:"Book tire swap before snow."}
    ],
    clients:[],
    actionLog:[],
    backups:[],
    lastSnapshotAt:null,
    prayerCache:{},
    clipboardSuggestion:null,
    energyLevel:"normal",
    availableMinutes:30,
    focusStyle:"balanced",
    productivityHistory:[],
    customCategories:[],
    kidSubjects:["General","Math","English","Science","French","Barton","Art","Gym","Islamic Studies","Sports","Hobbies"],
    expenses:[]
  };
}
function cloneForBackupExtras(){
  const ex=JSON.parse(JSON.stringify(X||defaultExtras()));
  delete ex.backups;
  delete ex.lastSnapshotAt;
  return ex;
}

function normCustomCategories(list){
  const seen=new Set(BASE_CATS.map(c=>c.key));
  return (Array.isArray(list)?list:[]).map((c,i)=>{
    const label=String(c?.label||c?.name||"Custom").trim()||`Custom ${i+1}`;
    let key=String(c?.key||label.toLowerCase().replace(/[^a-z0-9]+/g,'-')).trim().replace(/^-+|-+$/g,'');
    if(!key)key=`custom-${i+1}`;
    if(seen.has(key))return null;
    seen.add(key);
    return {
      key,
      label,
      icon:String(c?.icon||"🏷️").trim()||"🏷️",
      color:String(c?.color||"#64748B").trim()||"#64748B"
    };
  }).filter(Boolean);
}
function syncCustomCategories(){
  while(CATS.length>BASE_CATS.length)CATS.pop();
  const extras=normCustomCategories(X?.customCategories||[]);
  extras.forEach(c=>CATS.push({...c}));
  if(X)X.customCategories=extras;
}
function getCategory(key){return CATS.find(c=>c.key===key)||CATS[CATS.length-1]||BASE_CATS[0]}
function hexToRgb(hex){const raw=String(hex||'').trim().replace('#','');if(!/^[0-9a-fA-F]{3,8}$/.test(raw))return {r:100,g:116,b:139};let h=raw;if(h.length===3)h=h.split('').map(ch=>ch+ch).join('');if(h.length>=6)return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)};return {r:100,g:116,b:139};}
function categoryBadgeStyle(cat){const rgb=hexToRgb(cat?.color||'#64748B');const lum=((rgb.r*299)+(rgb.g*587)+(rgb.b*114))/1000;const dark=!!document.documentElement.getAttribute('data-theme');const fg=dark?'#F8FAFC':(lum>165?'#1E293B':'#FFFFFF');const bg=dark?`rgba(${rgb.r},${rgb.g},${rgb.b},0.28)`:`rgba(${rgb.r},${rgb.g},${rgb.b},0.16)`;return `--badge-color:${cat?.color||'#64748B'};--badge-bg:${bg};--badge-fg:${fg}`;}
function taskSourceBadge(r){const m=String(r?.sourceMode||'manual');if(m==='manual')return'';if(m==='chat-ai')return'<span class="ctag">🤖 AI chat</span>';if(m==='ai-suggest')return'<span class="ctag">✨ AI suggest</span>';if(m==='import')return'<span class="ctag">📥 import</span>';if(m==='auto')return'<span class="ctag">⚙️ auto</span>';return'';}
function categoryOptions(includeAll=false){
  const opts=CATS.map(c=>({value:c.key,label:`${c.icon} ${c.label}`}));
  return includeAll?[{value:'all',label:'All categories'},...opts]:opts;
}
function isCustomCategory(key){return !BASE_CATS.some(c=>c.key===key);}
function slugCategoryKey(label){
  let key=String(label||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  if(!key)key='custom';
  let finalKey=key, i=2;
  while(CATS.some(c=>c.key===finalKey))finalKey=`${key}-${i++}`;
  return finalKey;
}

function normChildren(children){
  return (Array.isArray(children)?children:[]).map((c,i)=>({
    id:c?.id||gid(),
    name:String(c?.name||"").trim()||`Child ${i+1}`,
    icon:String(c?.icon||"🧒"),
    color:String(c?.color||["#3B82F6","#8B5CF6","#10B981","#F59E0B"][i%4]),
    points:Math.max(0,Number(c?.points)||0)
  })).filter(c=>c.name);
}
function normSimpleList(arr, fields){
  return (Array.isArray(arr)?arr:[]).map(item=>{
    const out={id:item?.id||gid()};
    Object.entries(fields).forEach(([k,def])=>{out[k]=item?.[k]===undefined?def:String(item[k]??def)});
    return out;
  });
}
function normNumber(n,def=0){n=Number(n);return Number.isFinite(n)?n:def}
function normalizeReminder(r,index){
  const nowIso=new Date().toISOString();
  const hasValidDue=!!(r&&r.dueDate&&!Number.isNaN(new Date(r.dueDate).getTime()));
  const unscheduled=!!r?.unscheduled||isUnscheduledISO(r?.dueDate);
  const base={
    id:r&&r.id?r.id:gid(),
    title:r&&typeof r.title==="string"&&r.title.trim()?r.title.trim():"Untitled reminder",
    notes:r&&typeof r.notes==="string"?r.notes:"",
    dueDate:unscheduled?UNSCHEDULED_SENTINEL_ISO:(hasValidDue?new Date(r.dueDate).toISOString():new Date(Date.now()+3600000).toISOString()),
    startDate:r?.startDate&&!Number.isNaN(new Date(r.startDate).getTime())?new Date(r.startDate).toISOString():"",
    category:CATS.some(c=>c.key===r?.category)?r.category:"personal",
    priority:PRIS.some(p=>p.key===r?.priority)?r.priority:"medium",
    recurrence:RECS.some(o=>o.key===r?.recurrence)?r.recurrence:"none",
    alerts:Array.isArray(r?.alerts)&&r.alerts.length?r.alerts.map(String).filter(a=>ALERTS.some(opt=>opt.key===a)): ["15"],
    tags:Array.isArray(r?.tags)?r.tags.map(t=>String(t).trim()).filter(Boolean):[],
    subtasks:Array.isArray(r?.subtasks)?r.subtasks.map(s=>({text:String(s?.text||"").trim(),done:!!s?.done})).filter(s=>s.text):[],
    completed:!!r?.completed,
    completedAt:r?.completedAt&&!Number.isNaN(new Date(r.completedAt).getTime())?new Date(r.completedAt).toISOString():undefined,
    billable:!!r?.billable,
    dependsOn:r?.dependsOn||undefined,
    effort:EFFORTS.some(e=>e.key===String(r?.effort||""))?String(r.effort):"",
    createdAt:r?.createdAt&&!Number.isNaN(new Date(r.createdAt).getTime())?new Date(r.createdAt).toISOString():nowIso,
    order:Number.isFinite(Number(r?.order))?Number(r.order):index,
    amount:Number.isFinite(Number(r?.amount))?Number(r.amount):0,
    pinned:!!r?.pinned,
    nag:!!r?.nag,
    bundle:["","morning","afternoon","evening"].includes(String(r?.bundle||""))?String(r?.bundle||""):"",
    childId:String(r?.childId||""),
    subject:String(r?.subject||""),
    grade:String(r?.grade||""),
    snoozeCount:Math.max(0,Number(r?.snoozeCount)||0),
    unscheduled,
    sourceMode:["manual","chat-ai","ai-suggest","import","auto"].includes(String(r?.sourceMode||""))?String(r.sourceMode):"manual"
  };
  return base;
}
function normalizeAll(){
  S={...SETTINGS_DEFAULTS,...(S||{})};
  if(!S.briefingShown||typeof S.briefingShown!=="object")S.briefingShown={};
  if(!S.notifiedHistory||typeof S.notifiedHistory!=="object")S.notifiedHistory={};
  X={...defaultExtras(),...(X||{})};
  X.customCategories=normCustomCategories(X.customCategories);
  if(!Array.isArray(X.kidSubjects)||!X.kidSubjects.length)X.kidSubjects=defaultExtras().kidSubjects;
  X.expenses=Array.isArray(X.expenses)?X.expenses.map(e=>({id:e?.id||gid(),title:String(e?.title||''),amount:Number(e?.amount)||0,category:String(e?.category||'Other'),date:e?.date||new Date().toISOString()})).filter(e=>e.title):[];
  syncCustomCategories();
  R=(Array.isArray(R)?R:[]).map(normalizeReminder).sort((a,b)=>((b.pinned?1:0)-(a.pinned?1:0))||((a.order??0)-(b.order??0))||new Date(a.dueDate)-new Date(b.dueDate));
  habits=(Array.isArray(habits)?habits:[]).map((h,i)=>({id:h?.id||gid(),name:String(h?.name||"").trim()||`Habit ${i+1}`,log:Array.isArray(h?.log)?h.log.filter(Boolean):[],goalType:["daily","weekly"].includes(h?.goalType)?h.goalType:"daily",target:Math.max(1,Number(h?.target)||1)})).filter(h=>h.name);
  shifts=Array.isArray(shifts)?shifts.map((s,idx)=>({id:s?.id||gid(),date:String(s?.date||""),type:String(s?.type||"Shift"),start:String(s?.start||""),end:String(s?.end||""),notes:String(s?.notes||""),clientId:String(s?.clientId||""),onCall:!!s?.onCall})).filter(s=>s.date).sort(sortShiftEntries):[];
  timeLogs=Array.isArray(timeLogs)?timeLogs.map(l=>({id:l?.id||gid(),taskId:l?.taskId||null,title:String(l?.title||"Unknown"),duration:Math.max(0,Number(l?.duration)||0),date:l?.date||new Date().toISOString(),clientId:String(l?.clientId||""),taxTag:String(l?.taxTag||"general")})):[];
  templates=(Array.isArray(templates)?templates:[]).map(normalizeTemplate).filter(t=>t.name);
  routines=Array.isArray(routines)?routines:[];
  if(APP_SHELL_MINIMAL){
    X.navTabs=PRIMARY_NAV_KEYS.slice();
  }else{
    X.navTabs=(Array.isArray(X.navTabs)?X.navTabs:["tasks","dashboard","myday","calendar"]).filter(v=>NAV_LIBRARY.some(n=>n.k===v)&&isViewEnabled(v)).slice(0,4);
    while(X.navTabs.length<4){const next=NAV_LIBRARY.find(n=>!X.navTabs.includes(n.k)&&isViewEnabled(n));if(!next)break;X.navTabs.push(next.k)}
  }
  if(!isViewEnabled(view))view='tasks';
  X.children=normChildren(X.children);
  if(!activeKidId&&X.children[0])activeKidId=X.children[0].id;
  X.readingLogs=Array.isArray(X.readingLogs)?X.readingLogs.map(x=>({id:x?.id||gid(),childId:String(x?.childId||""),date:x?.date||new Date().toISOString(),minutes:normNumber(x?.minutes,0),lesson:String(x?.lesson||""),notes:String(x?.notes||"")})):[];
  X.homework=Array.isArray(X.homework)?X.homework.map(x=>({id:x?.id||gid(),childId:String(x?.childId||""),subject:String(x?.subject||"General"),title:String(x?.title||""),grade:String(x?.grade||""),date:x?.date||new Date().toISOString(),done:!!x?.done})).filter(x=>x.title):[];
  X.kidAppointments=Array.isArray(X.kidAppointments)?X.kidAppointments.map(x=>({id:x?.id||gid(),childId:String(x?.childId||""),title:String(x?.title||"Appointment"),date:x?.date||new Date().toISOString(),notes:String(x?.notes||"")})):[];
  X.medications=Array.isArray(X.medications)?X.medications.map(x=>({id:x?.id||gid(),name:String(x?.name||"Medication"),dose:String(x?.dose||""),refillDate:x?.refillDate||"",times:Array.isArray(x?.times)?x.times.map(String):[]})):[];
  X.medicationLogs=Array.isArray(X.medicationLogs)?X.medicationLogs.map(x=>({id:x?.id||gid(),medId:String(x?.medId||""),date:x?.date||new Date().toISOString(),dose:String(x?.dose||""),childId:String(x?.childId||"")})):[];
  X.sleepLogs=Array.isArray(X.sleepLogs)?X.sleepLogs.map(x=>({id:x?.id||gid(),date:x?.date||new Date().toISOString(),bed:String(x?.bed||""),wake:String(x?.wake||"")})):[];
  X.exerciseLogs=Array.isArray(X.exerciseLogs)?X.exerciseLogs.map(x=>({id:x?.id||gid(),date:x?.date||new Date().toISOString(),type:String(x?.type||"Workout"),minutes:normNumber(x?.minutes,0)})):[];
  X.budgetCategories=Array.isArray(X.budgetCategories)?X.budgetCategories.map(x=>({id:x?.id||gid(),name:String(x?.name||"Budget"),budget:normNumber(x?.budget,0)})).filter(x=>x.name):defaultExtras().budgetCategories;
  X.incomes=Array.isArray(X.incomes)?X.incomes.map(x=>({id:x?.id||gid(),title:String(x?.title||"Income"),amount:normNumber(x?.amount,0),date:x?.date||new Date().toISOString()})):[];
  X.contributionLogs=Array.isArray(X.contributionLogs)?X.contributionLogs.map(x=>({id:x?.id||gid(),type:String(x?.type||"RRSP"),amount:normNumber(x?.amount,0),date:x?.date||new Date().toISOString(),notes:String(x?.notes||"")})):[];
  X.shoppingLists=Array.isArray(X.shoppingLists)?X.shoppingLists.map(l=>({id:l?.id||gid(),name:String(l?.name||"List"),items:Array.isArray(l?.items)?l.items.map(it=>({id:it?.id||gid(),text:String(it?.text||"").trim(),done:!!it?.done})).filter(it=>it.text):[]})):defaultExtras().shoppingLists;
  X.vehicleLogs=Array.isArray(X.vehicleLogs)?X.vehicleLogs.map(x=>({id:x?.id||gid(),date:x?.date||new Date().toISOString(),title:String(x?.title||"Service"),odometer:String(x?.odometer||""),notes:String(x?.notes||"")})):[];
  X.maintenanceLogs=Array.isArray(X.maintenanceLogs)?X.maintenanceLogs.map(x=>({id:x?.id||gid(),title:String(x?.title||"Maintenance"),date:x?.date||new Date().toISOString(),notes:String(x?.notes||"")})):[];
  X.clients=Array.isArray(X.clients)?X.clients.map(x=>({id:x?.id||gid(),name:String(x?.name||"Client"),address:String(x?.address||""),phone:String(x?.phone||""),notes:String(x?.notes||"")})).filter(x=>x.name):[];
  X.actionLog=Array.isArray(X.actionLog)?X.actionLog.slice(-400):[];
  X.backups=Array.isArray(X.backups)?X.backups.slice(-5):[];
  X.prayerCache=(X.prayerCache&&typeof X.prayerCache==="object")?X.prayerCache:{};
  pruneBriefing();pruneNotificationHistory();reindexOrders(false);
}
function makeBackup(){
  return {reminders:R,habits,shifts,timeLogs,templates,routines,settings:S,extras:cloneForBackupExtras(),version:APP_VERSION,exportedAt:new Date().toISOString()};
}
function maybeSaveSnapshot(force=false){
  const now=Date.now();
  const last=X.lastSnapshotAt?new Date(X.lastSnapshotAt).getTime():0;
  if(!force&&last&&now-last<6*60*60*1000)return;
  const snap={savedAt:new Date().toISOString(),data:makeBackup()};
  X.backups=[...(Array.isArray(X.backups)?X.backups:[]),snap].slice(-5);
  X.lastSnapshotAt=snap.savedAt;
}
function load(){
  let usedBackup=false;
  try{R=JSON.parse(localStorage.getItem(SK)||"[]")}catch(e){R=[];usedBackup=true}
  try{S={...SETTINGS_DEFAULTS,...JSON.parse(localStorage.getItem(STK)||'{}')}}catch(e){S={...SETTINGS_DEFAULTS};usedBackup=true}
  try{habits=JSON.parse(localStorage.getItem(HK)||"[]")}catch(e){habits=[];usedBackup=true}
  try{shifts=JSON.parse(localStorage.getItem(SHK)||"[]")}catch(e){shifts=[];usedBackup=true}
  try{timeLogs=JSON.parse(localStorage.getItem(TLK)||"[]")}catch(e){timeLogs=[];usedBackup=true}
  try{templates=JSON.parse(localStorage.getItem(TMK)||"[]")}catch(e){templates=[];usedBackup=true}
  try{routines=JSON.parse(localStorage.getItem(RTK)||"[]")}catch(e){routines=[];usedBackup=true}
  try{trash=JSON.parse(localStorage.getItem(TRK)||"[]")}catch(e){trash=[]}
  try{waterLog=JSON.parse(localStorage.getItem(WTK)||"{}")}catch(e){waterLog={}}
  try{dispatches=JSON.parse(localStorage.getItem(DPK)||"[]")}catch(e){dispatches=[]}
  try{X={...defaultExtras(),...JSON.parse(localStorage.getItem(EXK)||"{}")}}catch(e){X=defaultExtras();usedBackup=true}
  if(usedBackup){
    const backup=parseJSON(BKP,null);
    if(backup&&typeof backup==="object"){
      R=backup.reminders||[];S={...SETTINGS_DEFAULTS,...(backup.settings||{})};habits=backup.habits||[];shifts=backup.shifts||[];timeLogs=backup.timeLogs||[];templates=backup.templates||[];routines=backup.routines||[];X={...defaultExtras(),...(backup.extras||{})};
    }
  }
  normalizeAll();
  applyTheme();
  if(!templates.length){
    templates=[
      {id:gid(),name:"Monthly Bills",desc:"Rent, Hydro, Internet, Phone, Insurance",items:[{title:"Pay rent",cat:"bills",pri:"critical"},{title:"Pay hydro bill",cat:"bills",pri:"high"},{title:"Pay internet",cat:"bills",pri:"medium"},{title:"Pay phone bill",cat:"bills",pri:"medium"},{title:"Pay insurance",cat:"bills",pri:"high"}]},
      {id:gid(),name:"Weekly Groceries",desc:"Shopping + meal prep",items:[{title:"Make grocery list",cat:"personal",pri:"medium"},{title:"Go grocery shopping",cat:"personal",pri:"high"},{title:"Meal prep for the week",cat:"personal",pri:"low"}]}
    ];
  }
  if(!routines.length){
    routines=[{id:gid(),name:"Morning Routine",steps:[{icon:"🛏️",label:"Make bed",done:false},{icon:"🪥",label:"Brush teeth",done:false},{icon:"👕",label:"Get dressed",done:false},{icon:"🥣",label:"Eat breakfast",done:false},{icon:"🎒",label:"Pack bag",done:false}]},{id:gid(),name:"Bedtime Routine",steps:[{icon:"🛁",label:"Bath time",done:false},{icon:"🪥",label:"Brush teeth",done:false},{icon:"📖",label:"Read a story",done:false},{icon:"💤",label:"Wind down",done:false},{icon:"😴",label:"Lights out",done:false}]}]
  }
  ensureEnhancementStyles();
  setTimeout(()=>{detectClipboardSuggestion();escalateOldDispatchFollowups();syncMedicationReminders();importSharedPayloadFromLocation();},50);
  sv(false);
}
function sv(showAlertOnFail=true,forceSnapshot=false){
  try{
    normalizeAll();
    S.lastSavedAt=new Date().toISOString();
    maybeSaveSnapshot(forceSnapshot);
    localStorage.setItem(SK,JSON.stringify(R));
    localStorage.setItem(STK,JSON.stringify(S));
    localStorage.setItem(HK,JSON.stringify(habits));
    localStorage.setItem(SHK,JSON.stringify(shifts));
    localStorage.setItem(TLK,JSON.stringify(timeLogs));
    localStorage.setItem(TMK,JSON.stringify(templates));
    localStorage.setItem(RTK,JSON.stringify(routines));
    localStorage.setItem(TRK,JSON.stringify(trash.slice(-50)));
    localStorage.setItem(WTK,JSON.stringify(waterLog));
    localStorage.setItem(DPK,JSON.stringify(dispatches));
    localStorage.setItem(EXK,JSON.stringify(X));
    try{localStorage.setItem(BKP,JSON.stringify(makeBackup()))}catch(e){}
  }catch(e){if(showAlertOnFail)alert("Storage full or unavailable. Export your data soon.")}
}
function logAction(type,label,meta={}){
  X.actionLog=[...(Array.isArray(X.actionLog)?X.actionLog:[]),{id:gid(),type,label,date:new Date().toISOString(),meta}].slice(-400);
}
function ensureEnhancementStyles(){
  if(document.getElementById("enhanceStyles"))return;
  const st=document.createElement("style");st.id="enhanceStyles";
  st.textContent=`
  html,body,#app{max-width:100%;overflow-x:hidden}*,*::before,*::after{max-width:100%}
  body.big-tap .chk{width:28px;height:28px}body.big-tap .cact{min-width:44px;min-height:44px;width:44px;height:44px;font-size:15px}body.big-tap .card{padding:14px 16px}
  body.tasks-touch:not(.big-tap) .chk{min-width:44px;min-height:44px}body.tasks-touch:not(.big-tap) .cact{min-width:44px;min-height:44px;width:44px;height:44px;font-size:15px}body.tasks-touch:not(.big-tap) .nlp-btn{min-width:48px;min-height:48px}body.tasks-touch:not(.big-tap) .fbtn{min-height:44px;padding:0 14px}body.tasks-touch:not(.big-tap) .task-filters-toggle{min-height:44px;padding-top:10px;padding-bottom:10px}body.tasks-touch:not(.big-tap) .sort-row select{min-height:44px;font-size:13px}body.tasks-touch:not(.big-tap) .drag-handle{min-width:40px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}
  body.tasks-touch:not(.big-tap) .task-batch-pick{display:flex;align-items:flex-start;padding-top:2px;margin-right:4px}body.tasks-touch:not(.big-tap) .task-batch-pick input{width:22px;height:22px}
  .dash-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:12px 14px calc(104px + env(safe-area-inset-bottom,0px))}.dash-card{background:var(--card);border:1.5px solid var(--border);border-radius:16px;padding:14px;min-height:118px}.dash-card.full{grid-column:1/-1}.dash-title{font-size:12px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}.dash-big{font-size:26px;font-weight:900}.dash-sub{font-size:12px;color:var(--text2);line-height:1.35}.mini-list{display:flex;flex-direction:column;gap:6px}.mini-item{font-size:12px;color:var(--text2);padding:6px 8px;background:var(--bg2);border-radius:10px}
  .prayer-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:12px 14px calc(72px + env(safe-area-inset-bottom,0px))}.prayer-item{background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:12px}.prayer-item.now{border-color:var(--accent);background:var(--abg)}
  .prayer-strip{margin:10px 14px 0;background:var(--card);border:1.5px solid var(--border);border-radius:16px;padding:12px}.prayer-strip-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:10px}.prayer-strip-title{font-size:12px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.04em}.prayer-strip-next{font-size:15px;font-weight:800}.prayer-chip-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.prayer-chip{padding:10px 12px;border-radius:12px;background:var(--bg2);border:1px solid var(--border)}.prayer-chip b{display:block;font-size:12px;margin-bottom:2px}.prayer-chip span{display:block;font-size:16px;font-weight:800}.prayer-chip.next{border-color:var(--accent);background:var(--abg)}
  .hero-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.chip-btn{padding:0 12px;min-height:40px;border-radius:999px;border:1.5px solid var(--border);background:var(--card);font-size:12px;font-weight:700;color:var(--text2);display:inline-flex;align-items:center;justify-content:center;line-height:1.2;box-sizing:border-box}.chip-btn.on{border-color:var(--accent);color:var(--accent);background:var(--abg)}
  .matrix-grid{padding:12px 14px calc(72px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.matrix-box{background:var(--card);border:1.5px solid var(--border);border-radius:16px;padding:12px;min-height:200px}.matrix-box h3{font-size:13px;margin-bottom:8px}.matrix-box .mini-item{font-size:11px}
  .kid-tabs{display:flex;gap:6px;overflow:auto;padding:10px 14px 0}.kid-tab{padding:9px 12px;border-radius:999px;border:1.5px solid var(--border);background:var(--card);font-size:12px;font-weight:700;white-space:nowrap}.kid-tab.active{border-color:var(--accent);background:var(--abg);color:var(--accent)}
  .panel{background:var(--card);border:1.5px solid var(--border);border-radius:16px;padding:14px;margin:10px 14px;overflow:hidden}.panel:last-child{margin-bottom:calc(70px + env(safe-area-inset-bottom,0px))}.panel h3{font-size:13px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px}.list-row{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)}.list-row:last-child{border-bottom:none}.list-main{min-width:0;flex:1}.list-main b{display:block;font-size:13px;word-break:break-word}.list-main span{display:block;font-size:11px;color:var(--text3);line-height:1.45;word-break:break-word}
  .focus-ov{position:fixed;inset:0;z-index:180;background:var(--bg);padding:24px;display:flex;flex-direction:column;justify-content:center;text-align:center}.focus-title{font-size:28px;font-weight:900;margin:14px 0}.focus-notes{font-size:14px;color:var(--text2);margin:0 auto 18px;max-width:320px}.focus-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.focus-actions button{padding:14px 18px;border:none;border-radius:14px;font-weight:800}
  .timeline{padding:12px 14px calc(72px + env(safe-area-inset-bottom,0px))}.time-row{display:grid;grid-template-columns:72px 1fr;gap:10px;position:relative}.time-row:not(:last-child){padding-bottom:12px}.time-stamp{font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace;padding-top:6px}.time-card{background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:10px 12px}.time-type{font-size:10px;font-weight:800;text-transform:uppercase;color:var(--text3);margin-bottom:4px}
  .nav-slot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px}.nav-slot{padding:10px 12px;border-radius:14px;border:1.5px solid var(--border);background:var(--card);text-align:left;color:var(--text)!important}.nav-slot.active{border-color:var(--accent);background:var(--abg)}.nav-slot small{display:block;font-size:10px;color:var(--text3)!important;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}.nav-slot b{font-size:13px;color:var(--text)!important}.nav-chooser{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.nav-choice{padding:10px 12px;border-radius:14px;border:1.5px solid var(--border);background:var(--card);text-align:left;color:var(--text)!important}.nav-choice.on{border-color:var(--accent);background:var(--abg);color:var(--accent)!important}
  .action-pulse{animation:popDone .4s ease}.sparkle{position:fixed;z-index:250;font-size:22px;animation:spark .8s ease forwards;pointer-events:none} @keyframes spark{0%{opacity:0;transform:scale(.5) translateY(10px)}30%{opacity:1}100%{opacity:0;transform:scale(1.4) translateY(-26px)}}@keyframes popDone{0%{transform:scale(.97)}50%{transform:scale(1.02)}100%{transform:scale(1)}}
  .task-swipe-left{box-shadow:inset 80px 0 0 rgba(34,197,94,.12)}.task-swipe-right{box-shadow:inset -80px 0 0 rgba(239,68,68,.10)}
  .card.completing{opacity:.45;transform:scale(.985);filter:saturate(.6);transition:opacity var(--complete-fade-ms,.55s) ease,transform var(--complete-fade-ms,.55s) ease,filter var(--complete-fade-ms,.55s) ease}
  .card.completing .ctitle{text-decoration:line-through;text-decoration-thickness:2px}
  .prayer-top,.money-top{padding:10px 14px 0}.safe-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.safe-row>*{margin:0!important}
  .task-filter-head{padding:8px 14px 0}.task-filter-label{font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}.task-filter-actions{display:flex;gap:8px;flex-wrap:wrap}.filters.task-cat-row{padding-top:6px}.sort-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 14px 0}.sort-row #taskCountLabel{display:flex;align-items:center;min-height:32px}.sort-row select{height:32px;margin:0}.more-group{margin-bottom:18px}.more-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.more-card{padding:12px;border-radius:16px;border:1.5px solid var(--border);background:var(--card);color:var(--text);text-align:left;overflow:hidden}.more-card-top{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;min-width:0}.more-card-top b{font-size:13px;color:var(--text);overflow-wrap:anywhere;word-break:break-word}.more-card span{display:block;font-size:11px;line-height:1.4;color:var(--text2);overflow-wrap:anywhere;word-break:break-word}.more-emoji{font-size:20px;line-height:1;flex:0 0 auto}
  .task-link-row{padding:6px 14px 0;display:flex;justify-content:flex-end}.task-link-btn{border:none;background:transparent;color:var(--text3);font-size:12px;font-weight:700;padding:4px 2px;text-decoration:underline;cursor:pointer}.task-link-btn:hover{color:var(--accent)}
  .prod-toolbar{padding:10px 14px 0}.prod-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}.prod-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.prod-kpi{background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:12px;cursor:pointer;transition:transform .1s,opacity .1s}.prod-kpi:active{transform:scale(.93);opacity:.7}.prod-kpi b{display:block;font-size:20px;font-weight:900}.prod-kpi span{display:block;font-size:11px;color:var(--text3);margin-top:4px}.coach-card{background:linear-gradient(180deg,var(--card),var(--bg2));border:1.5px solid var(--border);border-radius:18px;padding:14px}.coach-title{font-size:18px;font-weight:900;margin-bottom:6px}.coach-copy{font-size:12px;color:var(--text2);line-height:1.45}.reason-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.reason-chip{padding:6px 8px;border-radius:999px;background:var(--bg2);border:1px solid var(--border);font-size:10px;font-weight:700;color:var(--text2)}.plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.plan-card{background:var(--card);border:1.5px solid var(--border);border-radius:16px;padding:12px}.plan-card h4{font-size:12px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}.queue-line{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border)}.queue-line:last-child{border-bottom:none;padding-bottom:0}.queue-line b{display:block;font-size:13px}.queue-line span{display:block;font-size:11px;color:var(--text3);line-height:1.35}.queue-min{white-space:nowrap;font-size:10px;color:var(--text3);font-weight:800}.lane-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:var(--bg2);border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2)}.lane-pill.on{border-color:var(--accent);background:var(--abg);color:var(--accent)}.focus-queue{display:flex;flex-direction:column;gap:10px}.focus-step{padding:10px 12px;border-radius:14px;background:var(--bg2);border:1px solid var(--border)}.focus-step b{display:block;font-size:13px}.focus-step span{display:block;font-size:11px;color:var(--text3);margin-top:4px}.coach-banner{margin:10px 14px 0;padding:12px 14px;border-radius:16px;border:1.5px solid var(--border);background:var(--card)}.coach-banner h3{font-size:13px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}.coach-banner p{font-size:12px;color:var(--text2);line-height:1.45;margin:0}.compact-cards .card{margin:0 0 8px}.compact-cards .card:last-child{margin-bottom:0}
  .task-desktop-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}.task-main-col{min-width:0}.task-side-col{display:flex;flex-direction:column;gap:10px}.task-stack{padding-top:8px}.bulk-import-panel .xbtn{flex:1}.bulk-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.bulk-help{font-size:11px;color:var(--text3);line-height:1.45}.bulk-preview{margin-top:12px;max-height:280px;overflow:auto}.bulk-preview-item{padding:10px 12px;border-radius:12px;background:var(--bg2);border:1px solid var(--border);margin-bottom:8px}.bulk-meta{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.bulk-pill{padding:6px 10px;border-radius:999px;background:var(--bg2);border:1px solid var(--border);font-size:10px;font-weight:800;color:var(--text2)}.due-row.is-disabled{opacity:.55;pointer-events:none}
  body.mobile-shell .task-desktop-grid{display:block}.mobile-shell .task-side-col{margin-top:10px}.mobile-shell .task-side-col .panel:last-child{margin-bottom:calc(74px + env(safe-area-inset-bottom,0px))}.mobile-shell .mo-in{max-width:min(92vw,520px)}.mobile-shell .panel:last-child{margin-bottom:calc(74px + env(safe-area-inset-bottom,0px))}
  @media (max-width:380px){.dash-grid,.prayer-grid,.matrix-grid,.prayer-chip-row,.nav-slot-grid,.nav-chooser,.more-grid,.plan-grid,.prod-kpis{grid-template-columns:1fr}}
  body.desktop-shell{max-width:none!important;padding:20px 20px 28px 0!important;background:linear-gradient(180deg,var(--bg),var(--bg2));}
  .desktop-shell #app{max-width:1380px!important;min-height:calc(100vh - 40px);padding:0 0 36px 124px!important;margin:0 auto!important}
  .desktop-shell .bnav{left:18px;top:18px;bottom:18px;transform:none;width:88px;max-width:none!important;flex-direction:column;justify-content:flex-start;gap:6px;padding:10px 8px;border-top:none;border-right:1px solid var(--border);border-radius:24px;box-shadow:0 18px 40px rgba(0,0,0,.14);height:auto}
  .desktop-shell .bnav button{min-height:62px;padding:8px 6px;border-radius:16px;font-size:10px;line-height:1.15}.desktop-shell .bnav button.active{background:var(--abg)}.desktop-shell .bnav button:hover{background:var(--bg2);color:var(--accent)}
  .desktop-shell .hdr,.desktop-shell .nlp-bar,.desktop-shell .nlp-hint-wrap,.desktop-shell .suggest-bar,.desktop-shell .task-filters-wrap,.desktop-shell .task-filter-head,.desktop-shell .filters,.desktop-shell .sort-row,.desktop-shell .search-row,.desktop-shell .settings,.desktop-shell .cal,.desktop-shell .timeline,.desktop-shell .sv,.desktop-shell .dash-grid,.desktop-shell .prayer-grid,.desktop-shell .kid-tabs,.desktop-shell .coach-banner,.desktop-shell .prod-toolbar{max-width:1230px;margin-left:auto;margin-right:auto}
  .desktop-shell .hdr{margin-top:0;border-radius:28px;padding:24px 14px 18px;box-shadow:0 20px 40px rgba(15,23,42,.16)}
  .desktop-shell .task-desktop-grid{max-width:1230px;margin:0 auto;grid-template-columns:minmax(0,1.35fr) 360px;align-items:start;gap:18px;padding:0 14px}.desktop-shell #taskList.task-stack:not(.task-stack-grouped){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:8px 0 0!important}.desktop-shell #taskList.task-stack:not(.task-stack-grouped) .card{margin-bottom:0}.desktop-shell #taskList.task-stack:not(.task-stack-grouped) .empty{grid-column:1/-1}.desktop-shell #taskList.task-stack.task-stack-grouped{display:flex;flex-direction:column;gap:18px;padding:8px 0 0!important}.desktop-shell #taskList.task-stack.task-stack-grouped .task-sec{width:100%;min-width:0}.desktop-shell #taskList.task-stack.task-stack-grouped .task-sec-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.desktop-shell #taskList.task-stack.task-stack-grouped .task-sec-cards .card{margin-bottom:0}.desktop-shell #taskList.task-stack.task-stack-grouped .task-sec-cards .empty{grid-column:1/-1}.desktop-shell .task-side-col{position:sticky;top:18px}
  .desktop-shell .dash-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.desktop-shell .dash-card.full{grid-column:1/-1}.desktop-shell .plan-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.desktop-shell .more-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.desktop-shell .prod-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}
  .desktop-shell .filters,.desktop-shell .kid-tabs,.desktop-shell .task-filter-actions,.desktop-shell .safe-row{overflow:visible;flex-wrap:wrap}.desktop-shell .task-filter-actions{row-gap:8px}.desktop-shell .panel{max-width:1230px;margin-left:auto;margin-right:auto}.desktop-shell .panel:last-child{margin-bottom:36px}
  .desktop-shell .mo{padding:16px 24px 20px 128px;overflow-y:auto;align-items:flex-start;justify-content:flex-start}.desktop-shell .mo-in{margin:12px auto;max-width:min(1000px,calc(100vw - 220px));border-radius:26px;padding:22px 22px 26px;box-shadow:0 30px 60px rgba(2,6,23,.26)}.desktop-shell .mo-h{margin-bottom:16px}
  .desktop-shell .frow{align-items:flex-end}.desktop-shell .cgrid,.desktop-shell .cgrid3,.desktop-shell .cgrid4{gap:8px}.desktop-shell .emoji-grid{grid-template-columns:repeat(8,1fr)}.desktop-shell .color-grid{grid-template-columns:repeat(8,1fr)}.desktop-shell textarea.finp{min-height:88px}
  .desktop-shell .settings{padding-bottom:40px}.desktop-shell .clist{padding-bottom:40px}.desktop-shell .timeline,.desktop-shell .cal,.desktop-shell .sv{padding-bottom:40px}.desktop-shell .settings .xbtn:hover,.desktop-shell .safe-row .xbtn:hover,.desktop-shell .chip-btn:hover{border-color:var(--accent);color:var(--accent)}
  .desktop-shell .search-row input:focus,.desktop-shell .nlp-bar input:focus,.desktop-shell .finp:focus{box-shadow:0 0 0 4px var(--abg)}
  @media (min-width:1280px){.desktop-shell .dash-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.desktop-shell .task-desktop-grid{grid-template-columns:minmax(0,1.5fr) 380px}.desktop-shell .more-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
  @media (min-width:1500px){.desktop-shell #app{max-width:1480px!important}.desktop-shell .hdr,.desktop-shell .nlp-bar,.desktop-shell .nlp-hint-wrap,.desktop-shell .suggest-bar,.desktop-shell .task-filters-wrap,.desktop-shell .task-filter-head,.desktop-shell .filters,.desktop-shell .sort-row,.desktop-shell .search-row,.desktop-shell .settings,.desktop-shell .cal,.desktop-shell .timeline,.desktop-shell .sv,.desktop-shell .dash-grid,.desktop-shell .kid-tabs,.desktop-shell .coach-banner,.desktop-shell .prod-toolbar,.desktop-shell .panel,.desktop-shell .task-desktop-grid{max-width:1320px}.desktop-shell #taskList.task-stack:not(.task-stack-grouped){grid-template-columns:repeat(3,minmax(0,1fr))}.desktop-shell #taskList.task-stack.task-stack-grouped .task-sec-cards{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media (max-width:720px){.desktop-shell #taskList.task-stack.task-stack-grouped .task-sec-cards{grid-template-columns:1fr}}
  .hdr h1{font-size:24px;letter-spacing:-.03em}.hdr-date,.sdesc,.dash-sub,.coach-copy,.queue-line span,.list-main span{line-height:1.5}.card,.panel,.dash-card,.more-card,.plan-card,.coach-card{box-shadow:0 10px 24px rgba(15,23,42,.06)}[data-theme='dark'] .card,[data-theme='dark'] .panel,[data-theme='dark'] .dash-card,[data-theme='dark'] .more-card,[data-theme='dark'] .plan-card,[data-theme='dark'] .coach-card{box-shadow:none}.fbtn.active,.chip-btn.on,.lane-pill.on{box-shadow:0 8px 20px rgba(234,88,12,.12)}.task-filter-actions .chip-btn,.safe-row .xbtn,.hero-actions .chip-btn{min-height:40px}.more-card{min-height:112px}.desktop-shell .bnav button.active{box-shadow:inset 0 0 0 1px rgba(234,88,12,.18)}
  body.mobile-shell .cact{min-width:44px;min-height:44px;width:44px;height:44px;box-sizing:border-box}
  body.mobile-shell .chip-btn{min-width:44px;min-height:44px;padding:0 14px;box-sizing:border-box}
  body.mobile-shell .task-filter-actions .chip-btn,body.mobile-shell .hero-actions .chip-btn,body.mobile-shell .safe-row .chip-btn{min-width:44px;min-height:44px}
  `;
  document.head.appendChild(st);
}
function applyTheme(){
  if(S.darkMode)document.documentElement.setAttribute("data-theme","dark");else document.documentElement.removeAttribute("data-theme");
  const preset=THEME_PRESETS[X?.themeColor]||THEME_PRESETS.blue;
  document.documentElement.style.setProperty('--accent',preset.accent);
  document.documentElement.style.setProperty('--accent2',preset.accent2);
  document.documentElement.style.setProperty('--abg',preset.abg);
  document.body.classList.toggle('big-tap',!!X?.bigTap);
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',S.darkMode?"#0F172A":preset.accent);
}
function getPrayerCacheKey(ds){return `ottawa-${ds}`}
function getCachedPrayerTimes(ds){return X.prayerCache[getPrayerCacheKey(ds)]||null}
function isAutoPrayerTask(r){return !!(r&&Array.isArray(r.tags)&&r.tags.includes('prayer')&&r.tags.includes('auto'));}
function getTaskVisibleList(src=R){return (src||[]).filter(r=>!isAutoPrayerTask(r));}
function rTaskPrayerStrip(ds){const p=getPrayerSummary(ds);if(!p)return `<div class="prayer-strip"><div class="prayer-strip-top"><div><div class="prayer-strip-title">Prayer times</div><div class="dash-sub">Ottawa times for today</div></div><div class="safe-row"><button class="chip-btn" onclick="syncPrayerTimesForDay('${ds}')">Sync Ottawa</button><button class="chip-btn" onclick="go('prayers')">Open</button></div></div></div>`;const entries=Object.entries(p.timings||{});return `<div class="prayer-strip"><div class="prayer-strip-top"><div><div class="prayer-strip-title">Prayer times</div><div class="prayer-strip-next">${esc(p.next?.name||'Today')} · ${esc(p.next?.time||'')}</div><div class="dash-sub">Ottawa · shown here without turning them into tasks</div></div><div class="safe-row"><button class="chip-btn" onclick="syncPrayerTimesForDay('${ds}')">Refresh</button><button class="chip-btn" onclick="go('prayers')">Full view</button></div></div><div class="prayer-chip-row">${entries.map(([name,time])=>`<div class="prayer-chip${p.next?.name===name?' next':''}"><b>${esc(name)}</b><span>${esc(time)}</span></div>`).join('')}</div></div>`;}
async function syncPrayerTimesForDay(ds){
  if(prayerSyncing)return getCachedPrayerTimes(ds);
  const cached=getCachedPrayerTimes(ds);if(cached)return cached;
  if(!navigator.onLine)return null;
  prayerSyncing=true;
  try{
    const [y,m,d]=ds.split('-');
    const url=`https://api.aladhan.com/v1/timingsByCity/${d}-${m}-${y}?city=Ottawa&country=Canada&method=2`;
    const res=await fetch(url);const json=await res.json();
    const data=json?.data;if(!data?.timings)throw new Error('No timings');
    const out={date:ds,timings:{Fajr:data.timings.Fajr,Dhuhr:data.timings.Dhuhr,Asr:data.timings.Asr,Maghrib:data.timings.Maghrib,Isha:data.timings.Isha},hijri:data.date?.hijri||null};
    X.prayerCache[getPrayerCacheKey(ds)]=out;
    sv(false);
    if(view==="prayers"||view==="dashboard")render();
    return out;
  }catch(e){return cached||null}
  finally{prayerSyncing=false}
}
function addPrayerTasks(ds,data){
  if(!data?.timings)return;
  const order=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  order.forEach(name=>{
    const due=new Date(ds+'T'+String(data.timings[name]).slice(0,5));
    if(Number.isNaN(due.getTime()))return;
    const exists=R.some(r=>!r.completed&&r.tags?.includes('prayer')&&r.title===name&&fmtLD(new Date(r.dueDate))===ds);
    if(exists)return;
    R.push(normalizeReminder({id:gid(),title:name,notes:'Auto-added Ottawa prayer time',dueDate:due.toISOString(),startDate:due.toISOString(),category:'personal',priority:name==='Fajr'?'high':'medium',recurrence:'none',alerts:['15'],tags:['prayer','auto'],subtasks:[],completed:false,pinned:false,bundle:name==='Fajr'?'morning':name==='Maghrib'?'evening':'afternoon'},R.length));
  });
}
function detectClipboardSuggestion(){
  if(!navigator.clipboard||!window.isSecureContext)return;
  navigator.clipboard.readText().then(txt=>{
    txt=String(txt||'').trim();
    if(!txt||txt.length>140)return;
    if(!/\b(\d{1,2}:\d{2}|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(txt))return;
    X.clipboardSuggestion=txt;sv(false);if(S.showClipboardDateBanner&&(view==='tasks'||view==='dashboard'))render();
  }).catch(()=>{});
}
function bundleLabel(b){return b?b[0].toUpperCase()+b.slice(1):'Any time'}
function getTodayTop3(){return (X.top3ByDate?.[fmtLD(new Date())]||[]).map(id=>R.find(r=>r.id===id&&!r.completed)).filter(Boolean)}
function toggleTop3(id){
  const key=fmtLD(new Date());
  if(!X.top3ByDate[key])X.top3ByDate[key]=[];
  const arr=X.top3ByDate[key];
  const i=arr.indexOf(id);if(i>=0)arr.splice(i,1);else if(arr.length<3)arr.push(id);else {showToast('Top 3 already full');return;}
  sv(false);
  const modal=document.getElementById('top3M');
  if(modal){refreshTop3Modal()}else{render()}
}
function isInTop3(id){return (X.top3ByDate?.[fmtLD(new Date())]||[]).includes(id)}
function getEnergyMultiplier(r){const e=X.energyLevel||'normal';const eff=Number(r.effort||0);if(e==='low')return eff<=15?12:eff>=60?-10:0;if(e==='high')return eff>=30?8:0;return 0}
function getShiftLoadForDate(ds){return getShiftsForDate(ds).reduce((a,s)=>a+getShiftMinutes(s),0)}
function bestTaskDateSuggestion(r){
  const base=new Date();let best={score:Infinity,date:fmtLD(base)};
  for(let i=0;i<7;i++){const d=new Date(base);d.setDate(d.getDate()+i);const ds=fmtLD(d);const shiftLoad=getShiftLoadForDate(ds);const taskLoad=R.filter(x=>!x.completed&&fmtLD(new Date(x.dueDate))===ds).length;let score=shiftLoad/60+taskLoad*8;if(i===0)score-=5;if(score<best.score)best={score,date:ds};}
  return best.date;
}
function getPrayerSummary(ds){const p=getCachedPrayerTimes(ds);if(!p)return null;const now=new Date();const entries=Object.entries(p.timings).map(([k,v])=>({name:k,time:v,dt:new Date(ds+'T'+String(v).slice(0,5))})).filter(x=>!Number.isNaN(x.dt.getTime()));let next=entries.find(x=>x.dt>now)||entries[0];return {...p,next};}

function setEnergyLevel(level){X.energyLevel=level||'normal';sv(false);render()}
function setAvailableMinutes(mins){X.availableMinutes=Math.max(10,Math.min(180,Number(mins)||30));sv(false);render()}
function setFocusStyle(style){X.focusStyle=style||'balanced';sv(false);render()}
function getEffortMinutes(task){const raw=parseInt(task?.effort||'',10);if(Number.isFinite(raw)&&raw>0)return raw;const sub=(task?.subtasks||[]).length;if(sub)return Math.min(120,Math.max(10,sub*12));if(task?.notes)return 30;return 20}
function getTaskMode(task){const effort=getEffortMinutes(task);if(task?.category==='flowline'||task?.category==='work')return effort>=30?'deep':'work';if(task?.category==='bills'||task?.category==='school')return effort<=20?'admin':'deep';if(task?.category==='health'||task?.category==='kids'||task?.category==='car')return effort<=20?'errand':'admin';if(effort<=15)return 'quick';if(effort>=45||((task?.subtasks||[]).length>=3))return 'deep';return 'admin'}
function getShiftPressureProfile(ds=fmtLD(new Date())){const entries=getShiftsForDate(ds);const hours=getShiftLoadForDate(ds)/60;const current=entries.some(s=>isShiftActiveNow(s,new Date()));const overnight=entries.some(s=>{const sh=parseInt(String(s.start||'').slice(0,2),10);const eh=parseInt(String(s.end||'').slice(0,2),10);return Number.isFinite(sh)&&Number.isFinite(eh)&&(sh>=18||eh<=6||eh<sh)});return {entries,hours,current,overnight,heavy:hours>=8||current}}
function getProductivityCoach(plan){if(!plan.primary)return {title:'Clear runway',body:'You are caught up. Use this calm window for planning, templates, or recovery.'};if(plan.shift.current)return {title:'Protect your brainpower',body:'A shift is active right now, so the app is biasing toward shorter, easier wins and admin cleanup.'};if(plan.shift.heavy&&plan.energy!=='high')return {title:'Keep today light',body:'You have a heavier shift load today. Knock out quick wins and admin tasks before deeper work.'};if(plan.style==='deep'&&plan.energy==='high')return {title:'Use your sharp window',body:'Energy and time both support deeper work. Lean into one meaningful task instead of scattering effort.'};if(plan.stats.overdue>=4)return {title:'Reduce the pile first',body:'Start with the fastest overdue wins to get momentum back before touching optional work.'};if(plan.queue.length>=3)return {title:'You have a clean runway',body:`Your next ${plan.minutes} minutes can cover ${plan.queue.length} well-fitting tasks without context switching.`};return {title:'Start small, then build',body:'Pick one doable task, complete it, and let momentum carry the next step.'}}
function explainTaskReasons(task,ctx){const reasons=[];const state=urg(task.dueDate);if(state==='overdue')reasons.push('overdue');else if(state==='urgent')reasons.push('urgent');if(isInTop3(task.id))reasons.push('top 3');if(task.pinned)reasons.push('pinned');const effort=getEffortMinutes(task);if(effort<=ctx.minutes)reasons.push(`fits ${ctx.minutes} min`);if(ctx.style==='quick'&&effort<=15)reasons.push('quick win');if(ctx.style==='deep'&&getTaskMode(task)==='deep')reasons.push('deep work fit');if(ctx.style==='admin'&&['admin','errand','quick'].includes(getTaskMode(task)))reasons.push('light admin');if(ctx.shift.heavy&&effort<=20)reasons.push('good on a shift day');if(ctx.energy==='low'&&effort<=15)reasons.push('low-energy friendly');if(ctx.energy==='high'&&effort>=30)reasons.push('uses high energy');return reasons.slice(0,4)}
function buildProductivityPlan(opts={}){const minutes=Math.max(10,Math.min(180,Number(opts.minutes||X.availableMinutes)||30));const energy=opts.energy||X.energyLevel||'normal';const style=opts.style||X.focusStyle||'balanced';const shift=getShiftPressureProfile(fmtLD(new Date()));const active=R.filter(r=>!r.completed&&(isTaskStartVisible(r))).filter(r=>!(r.dependsOn&&R.find(x=>x.id===r.dependsOn&&!x.completed)));
  const priorityScore={critical:34,high:24,medium:12,low:4};
  const scored=active.map(task=>{const effort=getEffortMinutes(task);const mode=getTaskMode(task);let score=priorityScore[task.priority]||0;const u=urg(task.dueDate);if(u==='overdue')score+=90;else if(u==='urgent')score+=68;else if(u==='soon')score+=38;else score+=10;if(effort<=minutes)score+=16;else score-=Math.min(24,Math.round((effort-minutes)/5));if(task.pinned)score+=12;if(isInTop3(task.id))score+=16;score-=Math.min(14,(task.snoozeCount||0)*2);score+=getEnergyMultiplier({effort:String(effort)});if(style==='quick'){if(effort<=15)score+=22;else score-=8;}else if(style==='deep'){if(mode==='deep')score+=24;else if(effort<=15)score-=6;}else if(style==='admin'){if(['admin','errand','quick'].includes(mode))score+=20;else if(mode==='deep')score-=10;}else{if(mode==='quick'&&shift.heavy)score+=10;if(mode==='deep'&&!shift.heavy&&energy==='high')score+=10;}
    if(shift.heavy){if(mode==='deep')score-=18;else if(effort<=20)score+=8;}if(task.category==='work'&&shift.current)score+=14;if(['bills','school','health'].includes(task.category)&&style==='admin')score+=8;const ctx={minutes,energy,style,shift};const reasons=explainTaskReasons(task,ctx);return {...task,effort,mode,score,reasons,bestDay:bestTaskDateSuggestion(task)};}).sort((a,b)=>b.score-a.score||(new Date(a.dueDate)-new Date(b.dueDate)));
  const quickWins=scored.filter(t=>t.effort<=15||t.mode==='quick').slice(0,4);
  const deepWork=scored.filter(t=>t.mode==='deep').slice(0,4);
  const queue=[];let budget=minutes;for(const task of scored){if(queue.length>=4)break;const reserve=queue.length?0:10;if(task.effort<=budget+reserve||queue.length===0){queue.push(task);budget=Math.max(0,budget-Math.min(task.effort,budget));}}
  const bucketMap={};scored.slice(0,12).forEach(task=>{const key=task.category||task.mode;if(!bucketMap[key])bucketMap[key]=[];bucketMap[key].push(task)});
  const batches=Object.entries(bucketMap).filter(([,items])=>items.length>=2).map(([key,items])=>({key,label:getCategory(key)?.label||key,icon:getCategory(key)?.icon||'📦',items:items.slice(0,3)})).slice(0,3);
  const recovery=scored.filter(t=>urg(t.dueDate)==='overdue').sort((a,b)=>a.effort-b.effort||b.score-a.score).slice(0,4);
  const stats={overdue:scored.filter(t=>urg(t.dueDate)==='overdue').length,quick:quickWins.length,deep:deepWork.length,fit:scored.filter(t=>t.effort<=minutes).length};
  const primary=scored[0]||null;const plan={minutes,energy,style,shift,scored,primary,queue,quickWins,deepWork,batches,recovery,stats};plan.coach=getProductivityCoach(plan);return plan;}
function openPowerHourPlan(){const plan=buildProductivityPlan();const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>${plan.minutes}-minute plan</h3><div class="sdesc">${esc(plan.coach.body)}</div><div class="focus-queue" style="margin-top:12px">${plan.queue.length?plan.queue.map((task,i)=>`<div class="focus-step"><b>${i+1}. ${esc(task.title)}</b><span>${esc(getCategory(task.category).icon)} ${esc(getCategory(task.category).label)} · ~${task.effort} min · ${esc(task.reasons.join(' • ')||'good fit')}</span><div class="safe-row" style="margin-top:8px"><button class="chip-btn" onclick="openFocus('${task.id}')">Focus</button><button class="chip-btn" onclick="openEdit('${task.id}')">Edit</button></div></div>`).join(''):'<div class="sdesc">No tasks fit this plan yet.</div>'}</div><div class="safe-row" style="margin-top:14px"><button class="xbtn" onclick="setFocusStyle('quick')">Quick wins</button><button class="xbtn" onclick="setFocusStyle('deep')">Deep work</button><button class="xbtn" onclick="this.closest('.mo').remove()">Close</button></div></div>`;document.body.appendChild(ov)}
function openRecoveryPlan(){const plan=buildProductivityPlan({style:'quick',minutes:20});const ov=document.createElement('div');ov.className='mo';ov.onclick=e=>{if(e.target===ov)ov.remove()};ov.innerHTML=`<div class="mo-in" onclick="event.stopPropagation()"><div class="mo-h"></div><h3>Momentum reset</h3><div class="sdesc">When the list feels heavy, start with the easiest overdue wins. No bulk changes are made automatically.</div>${plan.recovery.length?plan.recovery.map(task=>`<div class="list-row"><div class="list-main"><b>${esc(task.title)}</b><span>${fmtD(task.dueDate)} · ~${task.effort} min</span></div><div style="display:flex;gap:6px"><button class="cact" onclick="openFocus('${task.id}')">🎯</button><button class="cact" onclick="openSnooze('${task.id}')">💤</button></div></div>`).join(''):'<div class="sdesc" style="margin-top:12px">No overdue tasks right now.</div>'}<div class="safe-row" style="margin-top:14px"><button class="xbtn" onclick="go('myday');this.closest('.mo').remove()">Open My Day</button></div></div>`;document.body.appendChild(ov)}
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
    if(isToday(r.dueDate)){today.push(r);return;}
    const u=urg(r.dueDate);
    if(u==='overdue'){overdue.push(r);return;}
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
  let h=rHdr('Todo Flow','A cleaner place to capture and finish things',{hideHeaderOverdueStat:filter==='all'});
  h+=`<div class="nlp-bar"><input id="nlpIn" value="${esc(nlpDraft)}" placeholder="Try: soccer Tuesday 4pm, dentist Friday, pick up milk" ${nlpParsing?'disabled':''} oninput="queueNlp(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();nlpAdd()}"><button class="nlp-btn add" ${nlpParsing?'disabled':''} onclick="openAdd()">${nlpParsing?'⏳':'+'}</button></div>`;
  if(!nlpHintDismissed())h+=`<div class="nlp-hint-wrap"><p class="nlp-hint">Natural language, voice, long-press & bulk import — clipboard hint optional in Settings.</p><button type="button" class="nlp-hint-dismiss" onclick="dismissNlpHint()" aria-label="Dismiss hint">✕</button></div>`;
  h+=`<div class="search-row" style="padding:8px 14px 0"><input id="searchIn" value="${esc(search)}" placeholder="Search title, notes, tags, or subject" style="width:100%;padding:10px 12px;font-size:13px;border:1.5px solid var(--border);border-radius:12px;background:var(--card);outline:none" oninput="queueSearch(this.value)"></div>`;
  if(S.showClipboardDateBanner&&X.clipboardSuggestion)h+=`<div class="suggest-bar"><span>📋</span><span class="st">Clipboard looks like a date/reminder: ${esc(X.clipboardSuggestion)}</span><button onclick="useClipboardSuggestion()">Use</button><button class="dism" onclick="dismissClipboardSuggestion()">✕</button></div>`;
  if(ttActive)h+=rTTActive();
  const dupCount=getDuplicateTaskIdSet().size;
  const recentAddedCount=getTaskVisibleList(R).filter(r=>!r.completed&&isRecentlyAddedTask(r)).length;
  const filteredTasks=getFiltered();
  const groupedBase=getTasksForGroupedMainView();
  const listCount=filter==='all'?groupedBase.length:filteredTasks.length;
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
        <div class="cacts"><button class="cact" onclick="openEdit('${r.id}')">✏️</button><button class="cact" onclick="delR('${r.id}')">🗑</button></div>
      </div>
    </div>`;
  }).join('');
}
function resetTouchState(){if(touchState.timer)clearTimeout(touchState.timer);touchState={id:null,x:0,y:0,t:0,timer:null,menuOpened:false,cancelled:false};}
function taskTouchStart(e,id){const t=e.changedTouches?.[0];if(!t)return;resetTouchState();touchState={id,x:t.clientX,y:t.clientY,t:Date.now(),timer:setTimeout(()=>{touchState.menuOpened=true;openTaskMenu(id)},520),menuOpened:false,cancelled:false};}
function taskTouchMove(e,id){const t=e.changedTouches?.[0];if(!t||touchState.id!==id)return;const dx=t.clientX-touchState.x,dy=t.clientY-touchState.y;if(Math.abs(dx)>12||Math.abs(dy)>12){touchState.cancelled=true;if(touchState.timer){clearTimeout(touchState.timer);touchState.timer=null;}}}
function taskTouchCancel(e,id){if(touchState.id===id)resetTouchState();}
function taskTouchEnd(e,id){const t=e.changedTouches?.[0];if(!t)return;const dx=t.clientX-touchState.x,dy=t.clientY-touchState.y;const menuOpened=touchState.menuOpened;const cancelled=touchState.cancelled;if(touchState.timer)clearTimeout(touchState.timer);resetTouchState();if(menuOpened||cancelled)return;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)){if(dx<0)toggleComp(id);else openSnooze(id);}}
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

// ==================== CHAT AI FEATURE ====================
// Simple Chat AI - added at end, doesn't modify original code

(function() {
  const CHAT_STORE_KEY = 'rp3_chat_history_v1';
  const AI_ACTION_AUDIT_KEY = 'rp3_ai_action_audit_v1';
  let pendingDryRunConfirm = null;
  const DRY_RUN_CONFIRM_TTL_MS = 5 * 60 * 1000;
  function makeDryRunConfirmToken(){
    return `drc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
  }
  function isPendingDryRunConfirmValid(token){
    if(!pendingDryRunConfirm)return { ok:false, reason:'missing' };
    if(!token || String(token)!==String(pendingDryRunConfirm.token||''))return { ok:false, reason:'stale' };
    const expiresAt=Number(pendingDryRunConfirm.expiresAt||0);
    if(!expiresAt||Date.now()>expiresAt)return { ok:false, reason:'expired' };
    return { ok:true };
  }
  function clearPendingDryRunConfirm(){
    pendingDryRunConfirm=null;
    document.getElementById('chat-dryrun-confirm-card')?.remove();
  }
  function appendDryRunAssistantNote(msg){
    const messages=document.getElementById('chat-messages');
    if(!messages)return;
    const aiMsg=document.createElement('div');
    aiMsg.innerHTML='<div style="background:#f0f0f0;padding:12px 16px;border-radius:12px;font-size:13px;max-width:80%;color:#333;">'+esc(String(msg||''))+'</div>';
    messages.appendChild(aiMsg);
    appendChatHistory('assistant',String(msg||''));
    messages.scrollTop=messages.scrollHeight;
  }

  function loadChatHistory() {
    try {
      const raw = localStorage.getItem(CHAT_STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string') : [];
    } catch (e) {
      return [];
    }
  }
  function loadAiActionAudit() {
    try {
      const raw = localStorage.getItem(AI_ACTION_AUDIT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  function appendAiActionAudit(entry) {
    try {
      const next = [entry, ...loadAiActionAudit()].slice(0, 80);
      localStorage.setItem(AI_ACTION_AUDIT_KEY, JSON.stringify(next));
    } catch (_) {}
  }
  function renderAiActionLogModal() {
    const old = document.getElementById('ai-action-log-modal');
    if (old) old.remove();
    const list = loadAiActionAudit();
    const modal = document.createElement('div');
    modal.id = 'ai-action-log-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:250;display:flex;align-items:center;justify-content:center;padding:14px;';
    const body = document.createElement('div');
    body.style.cssText = 'width:min(760px,96vw);max-height:82vh;overflow:auto;background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:14px;padding:14px;';
    const rows = list.map(function (x) {
      const when = x?.at ? new Date(x.at).toLocaleString() : '-';
      const prompt = esc(String(x?.prompt || '').slice(0, 220));
      const summary = esc(String(x?.summary || ''));
      const lines = Array.isArray(x?.changes) ? x.changes.slice(0, 10).map(function (c) { return `<li>${esc(String(c || ''))}</li>`; }).join('') : '';
      const more = Array.isArray(x?.changes) && x.changes.length > 10 ? `<div style="color:var(--text3);font-size:11px">+${x.changes.length - 10} more</div>` : '';
      return `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:10px;background:var(--bg)"><div style="display:flex;justify-content:space-between;gap:8px"><b>${summary || 'Action run'}</b><span style="color:var(--text3);font-size:11px">${when}</span></div><div style="font-size:12px;color:var(--text2);margin-top:4px">Prompt: ${prompt || '-'}</div>${lines ? `<ul style="margin:8px 0 4px 18px;padding:0;font-size:12px">${lines}</ul>` : '<div style="margin-top:6px;font-size:12px;color:var(--text3)">No detailed changes captured.</div>'}${more}</div>`;
    }).join('');
    body.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0">AI Action Log</h3><button type="button" onclick="document.getElementById('ai-action-log-modal')?.remove()" style="border:1px solid var(--border);background:var(--bg2);color:var(--text);border-radius:8px;padding:6px 10px;cursor:pointer">Close</button></div>${rows || '<div style="color:var(--text2);font-size:13px">No AI action runs logged yet.</div>'}`;
    modal.appendChild(body);
    modal.onclick = function (ev) { if (ev.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  }
  window.openAiActionLogModal = renderAiActionLogModal;

  function saveChatHistory(messages) {
    try {
      localStorage.setItem(CHAT_STORE_KEY, JSON.stringify(messages.slice(-40)));
    } catch (e) {}
  }

  function appendChatHistory(role, text) {
    const next = [...loadChatHistory(), { role, text: String(text || '').trim(), at: Date.now() }];
    saveChatHistory(next);
    return next;
  }

  function renderChatHistory(container) {
    if (!container) return;
    const history = loadChatHistory();
    if (!history.length) {
      container.innerHTML = '<div style="display:flex;"><div style="background:var(--bg2);padding:12px 16px;border-radius:12px;font-size:13px;max-width:80%;color:var(--text);border:1px solid var(--border);">Hi! 👋 Ask me anything about your tasks. I can see your pending list when the AI server is connected.</div></div>';
      return;
    }
    container.innerHTML = history.map(item => {
      if (item.role === 'user') {
        return '<div style="display:flex;justify-content:flex-end;"><div style="background:#2563EB;color:#fff;padding:12px 16px;border-radius:12px;font-size:13px;max-width:80%;">' + esc(item.text) + '</div></div>';
      }
      return '<div style="display:flex;"><div style="background:var(--bg2);padding:12px 16px;border-radius:12px;font-size:13px;max-width:80%;color:var(--text);border:1px solid var(--border);">' + esc(item.text) + '</div></div>';
    }).join('');
  }

  function chatApiBase() {
    const b = (typeof window !== 'undefined' && window.__TF_API_BASE__) ? String(window.__TF_API_BASE__).trim() : '';
    return b.replace(/\/+$/, '');
  }

  /** Compact task list for secure backend (no secrets). */
  function chatTodayHint() {
    try {
      return typeof fmtLD === 'function' ? fmtLD(new Date()) : new Date().toISOString().slice(0, 10);
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function buildChatTaskContext() {
    if (typeof R === 'undefined' || !Array.isArray(R)) return [];
    return R.filter(r => r && !r.completed).slice(0, 45).map(r => {
      const undated = !!(r.unscheduled || (typeof isUnscheduledISO === 'function' && isUnscheduledISO(r.dueDate)));
      return {
        id: r.id,
        title: r.title,
        priority: r.priority,
        category: r.category,
        dueDate: undated ? '' : r.dueDate,
        unscheduled: undated,
        completed: !!r.completed,
        overdueHint: undated ? '' : (typeof urg === 'function' && urg(r.dueDate) === 'overdue') ? 'overdue' : '',
      };
    });
  }

  async function fetchServerChatReply(text) {
    reserveAiCall('chat');
    const history = loadChatHistory().slice(-12).map(m => ({ role: m.role, content: m.text }));
    const tasks = buildChatTaskContext();
    const base = chatApiBase();
    const url = (base || '') + '/api/chat';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history, tasks, todayHint: chatTodayHint() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data && (data.error || data.message) ? String(data.error || data.message) : ('HTTP ' + response.status);
      throw new Error(err);
    }
    return String(data?.reply || '').trim() || 'I could not generate a reply.';
  }

  function buildTaskActionContext() {
    const hist = loadChatHistory().slice(-10);
    if (hist.length < 2) return '';
    return hist.map(function (m) {
      return (m.role === 'user' ? 'USER' : 'ASSISTANT') + ': ' + String(m.text || '').trim();
    }).join('\n');
  }

  async function fetchServerTaskAction(text) {
    reserveAiCall('action');
    const base = chatApiBase();
    const url = (base || '') + '/api/chat-action';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        context: buildTaskActionContext(),
        categories: Array.isArray(CATS) ? CATS.map(function(c){ return String(c?.key || '').trim().toLowerCase(); }).filter(Boolean).slice(0,64) : [],
        todayHint: chatTodayHint(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data && (data.error || data.message) ? String(data.error || data.message) : ('HTTP ' + response.status);
      throw new Error(err);
    }
    return data?.task || null;
  }

  async function fetchServerTaskEdit(text) {
    reserveAiCall('edit');
    const tasks =
      typeof R === 'undefined' || !Array.isArray(R)
        ? []
        : R.filter(function (r) {
            return r && !r.completed;
          })
            .slice(0, 55)
            .map(function (r) {
              const undated = !!(r.unscheduled || (typeof isUnscheduledISO === 'function' && isUnscheduledISO(r.dueDate)));
              return {
                id: r.id,
                title: r.title,
                priority: r.priority,
                category: r.category,
                dueDate: undated ? '' : r.dueDate,
                unscheduled: undated,
                completed: !!r.completed,
              };
            });
    const base = chatApiBase();
    const url = (base || '') + '/api/chat-edit';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, context: buildTaskActionContext(), tasks, todayHint: chatTodayHint() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data && (data.error || data.message) ? String(data.error || data.message) : ('HTTP ' + response.status);
      throw new Error(err);
    }
    return data?.edit || null;
  }

  async function fetchServerShiftPlan(text) {
    reserveAiCall('shift');
    const shiftSnapshot =
      Array.isArray(shifts)
        ? shifts
            .slice()
            .sort(sortShiftEntries)
            .slice(-40)
            .map(function (s) {
              return {
                date: String(s && s.date || ''),
                type: String(s && s.type || ''),
                start: String(s && s.start || ''),
                end: String(s && s.end || ''),
                notes: String(s && s.notes || ''),
                onCall: !!(s && s.onCall),
              };
            })
        : [];
    const base = chatApiBase();
    const url = (base || '') + '/api/chat-shift';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, context: buildTaskActionContext(), shifts: shiftSnapshot, todayHint: chatTodayHint() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data && (data.error || data.message) ? String(data.error || data.message) : ('HTTP ' + response.status);
      throw new Error(err);
    }
    return data?.plan || { entries: [] };
  }

  async function fetchServerShiftIntent(text) {
    reserveAiCall('shift-intent');
    const shiftSnapshot =
      Array.isArray(shifts)
        ? shifts
            .slice()
            .sort(sortShiftEntries)
            .slice(-60)
            .map(function (s) {
              return {
                date: String(s && s.date || ''),
                type: String(s && s.type || ''),
                start: String(s && s.start || ''),
                end: String(s && s.end || ''),
                notes: String(s && s.notes || ''),
                onCall: !!(s && s.onCall),
              };
            })
        : [];
    const base = chatApiBase();
    const url = (base || '') + '/api/chat-shift-intent';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, context: buildTaskActionContext(), shifts: shiftSnapshot, todayHint: chatTodayHint() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data && (data.error || data.message) ? String(data.error || data.message) : ('HTTP ' + response.status);
      throw new Error(err);
    }
    return data?.intent || null;
  }
  async function fetchServerChatPlan(text) {
    reserveAiCall('chat');
    const tasks =
      typeof R === 'undefined' || !Array.isArray(R)
        ? []
        : R.filter(function (r) { return r && !r.completed; }).slice(0, 80).map(function (r) {
            const undated = !!(r.unscheduled || (typeof isUnscheduledISO === 'function' && isUnscheduledISO(r.dueDate)));
            return {
              id: r.id,
              title: r.title,
              priority: r.priority,
              category: r.category,
              dueDate: undated ? '' : r.dueDate,
              unscheduled: undated,
              completed: !!r.completed,
            };
          });
    const shiftSnapshot =
      Array.isArray(shifts)
        ? shifts
            .slice()
            .sort(sortShiftEntries)
            .slice(-60)
            .map(function (s) {
              return {
                date: String(s && s.date || ''),
                type: String(s && s.type || ''),
                start: String(s && s.start || ''),
                end: String(s && s.end || ''),
              };
            })
        : [];
    const moduleSummary={
      expensesCount:Array.isArray(X?.expenses)?X.expenses.length:0,
      homeworkCount:Array.isArray(X?.homework)?X.homework.length:0,
      medicationLogCount:Array.isArray(X?.medicationLogs)?X.medicationLogs.length:0,
      childrenCount:Array.isArray(X?.children)?X.children.length:0,
      categoryCounts:(function(){
        const out={};
        if(Array.isArray(R)){
          R.forEach(function(t){
            if(!t||t.completed)return;
            const key=String(t.category||'General');
            out[key]=(out[key]||0)+1;
          });
        }
        return out;
      })(),
      recentExpenses:Array.isArray(X?.expenses)
        ? X.expenses.slice(-20).reverse().slice(0,5).map(function(e){
            return {
              title:String(e?.title||e?.name||''),
              amount:Number(e?.amount||0)||0,
              category:String(e?.category||''),
            };
          })
        : [],
      recentHomework:Array.isArray(X?.homework)
        ? X.homework.slice(-20).reverse().slice(0,5).map(function(h){
            return {
              title:String(h?.title||h?.task||''),
              child:String(h?.child||h?.childName||''),
              dueDate:String(h?.dueDate||''),
              done:!!h?.done,
            };
          })
        : [],
      recentMedicationLogs:Array.isArray(X?.medicationLogs)
        ? X.medicationLogs.slice(-20).reverse().slice(0,5).map(function(m){
            return {
              medication:String(m?.medication||m?.name||''),
              child:String(m?.child||m?.childName||''),
              at:String(m?.at||m?.time||m?.date||''),
            };
          })
        : [],
      children:Array.isArray(X?.children)
        ? X.children.slice(0,8).map(function(c){
            return String(c?.name||c?.title||'').trim();
          }).filter(Boolean)
        : [],
    };
    const base = chatApiBase();
    const url = (base || '') + '/api/chat-plan';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        context: buildTaskActionContext(),
        tasks,
        shifts: shiftSnapshot,
        categories: Array.isArray(CATS) ? CATS.map(function(c){ return String(c?.key || '').trim().toLowerCase(); }).filter(Boolean).slice(0,64) : [],
        moduleSummary,
        todayHint: chatTodayHint(),
        actionCap: getChatActionCap(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data && (data.error || data.message) ? String(data.error || data.message) : ('HTTP ' + response.status);
      throw new Error(err);
    }
    return data?.plan || { actions: [] };
  }
  function summarizeChatPlan(plan){
    const actions=Array.isArray(plan?.actions)?plan.actions:[];
    if(!actions.length)return 'no changes';
    const labels=actions.slice(0,6).map(function(a){
      const t=String(a?.type||'').toLowerCase();
      if(t==='task.create')return 'create task';
      if(t==='task.update')return 'edit task';
      if(t==='task.bulk_update')return 'bulk edit tasks';
      if(t==='task.delete_duplicates')return 'delete duplicates';
      if(t==='task.delete_completed')return 'delete completed';
      if(t==='task.delete_overdue')return 'delete overdue';
      if(t==='shift.intent')return 'update shifts';
      if(t==='settings.update')return 'update settings';
      return t||'change';
    });
    return `${labels.join(', ')}${actions.length>6?` +${actions.length-6} more`:''}`;
  }
  function executeChatPlanActions(plan){
    const actions=(Array.isArray(plan?.actions)?plan.actions:[]).slice(0,getChatActionCap());
    if(!actions.length)return {executed:0,notes:['No executable actions'],statuses:[]};
    const notes=[];
    const statuses=[];
    let executed=0;
    actions.forEach(function(a,idx){
      const t=String(a?.type||'').toLowerCase();
      if(t==='task.create'&&a.task){
        const validated=validateChatTaskDraft(a.task,'');
        if(validated?.ok&&addTaskFromChatTask(validated.task)){executed++;notes.push(`Added "${validated.task.title}"`);statuses.push({index:idx+1,type:t,status:'applied',message:`Added "${validated.task.title}"`});}
        else statuses.push({index:idx+1,type:t,status:'skipped',message:'Validation failed or duplicate detected'});
        return;
      }
      if(t==='task.update'&&a.edit&&a.edit.action==='update'){
        const updated=applyTaskEditFromChat(a.edit);
        if(updated){executed++;notes.push(`Updated "${updated.title}"`);statuses.push({index:idx+1,type:t,status:'applied',message:`Updated "${updated.title}"`});}
        else statuses.push({index:idx+1,type:t,status:'skipped',message:'No matching task found'});
        return;
      }
      if(t==='task.bulk_update'&&Array.isArray(a.updates)){
        let n=0;
        const titles=[];
        a.updates.slice(0,getChatActionCap()).forEach(function(edit){
          const updated=applyTaskEditFromChat(edit);
          if(updated){n++;if(updated.title)titles.push(String(updated.title));}
        });
        if(n){
          executed++;
          const sample=titles.slice(0,10);
          const preview=sample.length?`: ${sample.map(function(s){return `"${s}"`;}).join(', ')}${titles.length>sample.length?' ...':''}`:'';
          notes.push(`Bulk-updated ${n} task${n===1?'':'s'}`);
          statuses.push({index:idx+1,type:t,status:'applied',message:`Bulk-updated ${n} task${n===1?'':'s'}${preview}`,changedTitles:titles});
        }
        else statuses.push({index:idx+1,type:t,status:'skipped',message:'No tasks matched bulk update'});
        return;
      }
      if(t==='task.delete_duplicates'){
        const n=applyDuplicateDeletePlan(buildDuplicateDeletePlan());
        if(n){executed++;notes.push(`Deleted ${n} duplicate task${n===1?'':'s'}`);statuses.push({index:idx+1,type:t,status:'applied',message:`Deleted ${n} duplicate task${n===1?'':'s'}`});}
        else statuses.push({index:idx+1,type:t,status:'skipped',message:'No duplicates found'});
        return;
      }
      if(t==='task.delete_completed'){
        const n=applyGenericDeletePlan(buildCompletedDeletePlan(),'completed');
        if(n){executed++;notes.push(`Deleted ${n} completed task${n===1?'':'s'}`);statuses.push({index:idx+1,type:t,status:'applied',message:`Deleted ${n} completed task${n===1?'':'s'}`});}
        else statuses.push({index:idx+1,type:t,status:'skipped',message:'No completed tasks found'});
        return;
      }
      if(t==='task.delete_overdue'){
        const n=applyGenericDeletePlan(buildOverdueDeletePlan(),'overdue');
        if(n){executed++;notes.push(`Deleted ${n} overdue task${n===1?'':'s'}`);statuses.push({index:idx+1,type:t,status:'applied',message:`Deleted ${n} overdue task${n===1?'':'s'}`});}
        else statuses.push({index:idx+1,type:t,status:'skipped',message:'No overdue tasks found'});
        return;
      }
      if(t==='shift.intent'&&a.intent){
        const res=applyShiftIntentFromAi(a.intent);
        if(res?.applied){executed++;if(res.reply)notes.push(res.reply);statuses.push({index:idx+1,type:t,status:'applied',message:String(res.reply||'Shift intent applied')});}
        else statuses.push({index:idx+1,type:t,status:'skipped',message:'Shift intent not applied'});
        return;
      }
      if(t==='settings.update'&&a.updates&&typeof a.updates==='object'){
        let touched=0;
        if(typeof a.updates.chatDryRun==='boolean'){S.chatDryRun=!!a.updates.chatDryRun;touched++;}
        if(Number.isFinite(Number(a.updates.chatActionCap))){S.chatActionCap=Math.max(1,Math.min(200,Number(a.updates.chatActionCap)));touched++;}
        if(typeof a.updates.chatAutonomyMode==='string'&&['assistive','agentic'].includes(String(a.updates.chatAutonomyMode))){S.chatAutonomyMode=String(a.updates.chatAutonomyMode);touched++;}
        if(touched){sv(false);render();executed++;notes.push(`Updated ${touched} chat setting${touched===1?'':'s'}`);statuses.push({index:idx+1,type:t,status:'applied',message:`Updated ${touched} chat setting${touched===1?'':'s'}`});}
        else statuses.push({index:idx+1,type:t,status:'skipped',message:'No allowlisted settings in request'});
        return;
      }
      if(t==='money.expense_add'&&a.expense&&typeof a.expense==='object'){
        const title=String(a.expense.title||'').trim();
        if(!title){statuses.push({index:idx+1,type:t,status:'skipped',message:'Missing expense title'});return;}
        const amount=Number(a.expense.amount);
        X.expenses=Array.isArray(X.expenses)?X.expenses:[];
        X.expenses.unshift({
          id:gid(),
          title,
          amount:Number.isFinite(amount)?amount:0,
          category:String(a.expense.category||'Other').trim()||'Other',
          date:(a.expense.date&&String(a.expense.date).trim())?new Date(String(a.expense.date)).toISOString():new Date().toISOString(),
        });
        sv(false);render();executed++;notes.push(`Logged expense "${title}"`);statuses.push({index:idx+1,type:t,status:'applied',message:`Logged expense "${title}"`});
        return;
      }
      if(t==='kids.homework_add'&&a.homework&&typeof a.homework==='object'){
        const title=String(a.homework.title||'').trim();
        if(!title){statuses.push({index:idx+1,type:t,status:'skipped',message:'Missing homework title'});return;}
        const kids=Array.isArray(X.children)?X.children:[];
        const childId=String(a.homework.childId||'').trim();
        const resolvedChild=kids.some(c=>String(c.id)===childId)?childId:(kids[0]?.id||'');
        X.homework=Array.isArray(X.homework)?X.homework:[];
        X.homework.unshift({
          id:gid(),
          childId:resolvedChild,
          subject:String(a.homework.subject||'General').trim()||'General',
          title,
          grade:String(a.homework.grade||'').trim(),
          date:(a.homework.date&&String(a.homework.date).trim())?new Date(String(a.homework.date)).toISOString():new Date().toISOString(),
          done:false,
        });
        sv(false);render();executed++;notes.push(`Added homework "${title}"`);statuses.push({index:idx+1,type:t,status:'applied',message:`Added homework "${title}"`});
        return;
      }
      if(t==='health.medication_log'&&a.medicationLog&&typeof a.medicationLog==='object'){
        const meds=Array.isArray(X.medications)?X.medications:[];
        const medId=String(a.medicationLog.medId||'').trim();
        const resolvedMed=meds.some(m=>String(m.id)===medId)?medId:(meds[0]?.id||'');
        if(!resolvedMed){statuses.push({index:idx+1,type:t,status:'skipped',message:'No medication profile available'});return;}
        X.medicationLogs=Array.isArray(X.medicationLogs)?X.medicationLogs:[];
        X.medicationLogs.unshift({
          id:gid(),
          medId:resolvedMed,
          date:(a.medicationLog.date&&String(a.medicationLog.date).trim())?new Date(String(a.medicationLog.date)).toISOString():new Date().toISOString(),
          dose:String(a.medicationLog.dose||'').trim(),
          childId:String(a.medicationLog.childId||'').trim(),
        });
        sv(false);render();executed++;notes.push('Logged medication dose');statuses.push({index:idx+1,type:t,status:'applied',message:'Logged medication dose'});
        return;
      }
      statuses.push({index:idx+1,type:t,status:'skipped',message:'Unsupported action type'});
    });
    return {executed,notes,statuses};
  }
  function collectRunChangedTitles(run){
    const out=[];
    const seen=new Set();
    const statuses=Array.isArray(run?.statuses)?run.statuses:[];
    statuses.forEach(function(s){
      if(s?.status!=='applied')return;
      if(Array.isArray(s.changedTitles)){
        s.changedTitles.forEach(function(t){
          const v=String(t||'').trim();
          if(!v)return;
          const k=v.toLowerCase();
          if(seen.has(k))return;
          seen.add(k);
          out.push(v);
        });
      }else{
        const msg=String(s?.message||'');
        const matches=msg.match(/"([^"]+)"/g)||[];
        matches.forEach(function(raw){
          const v=String(raw||'').replace(/^"|"$/g,'').trim();
          if(!v)return;
          const k=v.toLowerCase();
          if(seen.has(k))return;
          seen.add(k);
          out.push(v);
        });
      }
    });
    return out;
  }

  function shouldCreateShiftFromChat(text) {
    const t = String(text || '').toLowerCase();
    const mentionsShift = /\bshift|shifts|schedule|roster\b/.test(t);
    const wantsAdd = /\b(add|set|put|create|update|save|post)\b/.test(t);
    const hasDays = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|next week|week)\b/.test(t);
    return mentionsShift && (wantsAdd || hasDays);
  }

  function recentlyDiscussedShifts() {
    const hist = loadChatHistory().slice(-8);
    if (!hist.length) return false;
    return hist.some(function (m) {
      const t = String(m && m.text || '').toLowerCase();
      return /\bshift|shifts|shift page|shifts page|schedule|roster\b/.test(t);
    });
  }

  function shouldRouteShiftFromChat(text) {
    if (shouldCreateShiftFromChat(text)) return true;
    const t = String(text || '').toLowerCase();
    const mentionsShift = /\bshift|shifts|shift page|shifts page|schedule|roster\b/.test(t);
    const correctionLike =
      /\b(redo|fix|correct|off by a day|wrong day|shift by a day|move by a day|one day earlier|one day later|you are off)\b/.test(t) ||
      /\b(update|change|adjust)\s+(it|them|those|schedule|shifts)\b/.test(t);
    if (mentionsShift && /\b(fix|correct|adjust|cleanup|clean up|repair|sort out|resolve)\b/.test(t)) return true;
    return correctionLike && (mentionsShift || recentlyDiscussedShifts());
  }

  function getNextWeekRange() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay() + 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end, startKey: fmtLD(start), endKey: fmtLD(end) };
  }

  function dateFromWeekdayToken(token, preferNextWeek) {
    const map = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    };
    const day = map[String(token || '').toLowerCase()];
    if (!Number.isFinite(day)) return '';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const base = new Date(now);
    const diff = (day - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + diff);
    if (preferNextWeek || base <= now) base.setDate(base.getDate() + 7);
    return fmtLD(base);
  }

  function getWeekRangeByRef(ref) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thisStart = new Date(now);
    thisStart.setDate(thisStart.getDate() - thisStart.getDay());
    const nextStart = new Date(thisStart);
    nextStart.setDate(nextStart.getDate() + 7);
    const start = String(ref || 'next_week') === 'this_week' ? thisStart : nextStart;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end, startKey: fmtLD(start), endKey: fmtLD(end) };
  }

  function dateFromWeekdayInWeekRef(day, weekRef) {
    const map = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    };
    const idx = map[String(day || '').toLowerCase()];
    if (!Number.isFinite(idx)) return '';
    const wr = getWeekRangeByRef(weekRef || 'next_week');
    const d = new Date(wr.start);
    d.setDate(d.getDate() + idx);
    return fmtLD(d);
  }

  function applyShiftIntentFromAi(intent) {
    if (!intent || typeof intent !== 'object') return { applied: false };
    const action = String(intent.action || '').toLowerCase();
    const confidence = Number(intent.confidence || 0);
    if (action === 'clarify') {
      const q = String(intent.question || '').trim();
      return { applied: true, reply: q || 'Do you want me to update this week or next week shifts?' };
    }
    if (!action || action === 'none') return { applied: false };
    if (confidence > 0 && confidence < 0.45) return { applied: false };

    const weekRef = String(intent.weekRef || 'next_week').toLowerCase() === 'this_week' ? 'this_week' : 'next_week';
    const range = getWeekRangeByRef(weekRef);

    if (action === 'delete_week') {
      const before = shifts.length;
      const cap = getChatActionCap();
      let removed = 0;
      shifts = (Array.isArray(shifts) ? shifts : []).filter(function (s) {
        const ds = String(s && s.date || '');
        const inWeek = ds >= range.startKey && ds <= range.endKey;
        if (!inWeek) return true;
        if (removed >= cap) return true;
        removed += 1;
        return false;
      });
      const clipped = (before - shifts.length) > cap || removed >= cap;
      sv();
      render();
      return { applied: true, reply: removed ? `Deleted ${removed} shift${removed === 1 ? '' : 's'} for ${weekRef === 'this_week' ? 'this week' : 'next week'}${clipped ? ` (capped to ${cap})` : ''}.` : `No shifts found for ${weekRef === 'this_week' ? 'this week' : 'next week'}.` };
    }

    if (action === 'move_week') {
      const delta = Math.max(-2, Math.min(2, parseInt(String(intent.days || 0), 10) || 0));
      if (!delta) return { applied: false };
      const cap = getChatActionCap();
      let moved = 0;
      shifts = (Array.isArray(shifts) ? shifts : []).map(function (s) {
        if (!s || !s.date) return s;
        if (s.date < range.startKey || s.date > range.endKey) return s;
        if (moved >= cap) return s;
        const d = new Date(s.date + 'T00:00:00');
        if (Number.isNaN(d.getTime())) return s;
        d.setDate(d.getDate() + delta);
        moved += 1;
        return { ...s, date: fmtLD(d) };
      });
      shifts = shifts.sort(sortShiftEntries);
      sv();
      render();
      return { applied: true, reply: moved ? `Moved ${moved} shift${moved === 1 ? '' : 's'} ${delta < 0 ? 'earlier' : 'later'} by ${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'}${moved >= cap ? ` (capped to ${cap})` : ''}.` : 'No shifts found to move.' };
    }

    if (action === 'set_day_off') {
      const day = String(intent.day || '').toLowerCase();
      const date = dateFromWeekdayInWeekRef(day, weekRef);
      if (!date) return { applied: false };
      shifts = (Array.isArray(shifts) ? shifts : []).filter(function (s) { return String(s && s.date || '') !== date; });
      shifts.push({ id: gid(), date, type: 'Off', start: '', end: '', notes: 'Set from chat intent', onCall: false, clientId: '' });
      shifts = shifts.sort(sortShiftEntries);
      sv();
      render();
      return { applied: true, reply: `${day ? day[0].toUpperCase() + day.slice(1) : 'That day'} is set to Off (${weekRef === 'this_week' ? 'this week' : 'next week'}).` };
    }

    if (action === 'set_day_shift') {
      const day = String(intent.day || '').toLowerCase();
      const date = dateFromWeekdayInWeekRef(day, weekRef);
      if (!date) return { applied: false };
      const type = String(intent.type || 'Shift').trim() || 'Shift';
      const off = /^off$/i.test(type);
      const start = off ? '' : String(intent.start || '').trim();
      const end = off ? '' : String(intent.end || '').trim();
      const notes = String(intent.notes || '').trim();
      shifts = (Array.isArray(shifts) ? shifts : []).filter(function (s) { return String(s && s.date || '') !== date; });
      shifts.push({ id: gid(), date, type, start, end, notes, onCall: false, clientId: '' });
      shifts = shifts.sort(sortShiftEntries);
      sv();
      render();
      return { applied: true, reply: `Updated ${day ? day[0].toUpperCase() + day.slice(1) : 'day'} shift.` };
    }

    if (action === 'replace_week_schedule') {
      const entries = Array.isArray(intent.entries) ? intent.entries : [];
      if (!entries.length) return { applied: false };
      const cap = getChatActionCap();
      const mapped = entries
        .map(function (e) {
          const day = String(e && e.day || '').toLowerCase();
          const date = dateFromWeekdayInWeekRef(day, weekRef);
          if (!date) return null;
          const type = String(e && e.type || 'Shift').trim() || 'Shift';
          const off = /^off$/i.test(type);
          return {
            id: gid(),
            date,
            type,
            start: off ? '' : String(e && e.start || '').trim(),
            end: off ? '' : String(e && e.end || '').trim(),
            notes: String(e && e.notes || '').trim(),
            onCall: !!(e && e.onCall),
            clientId: '',
          };
        })
        .filter(Boolean);
      if (!mapped.length) return { applied: false };
      const clipped = mapped.length > cap;
      const scoped = mapped.slice(0, cap);
      shifts = (Array.isArray(shifts) ? shifts : []).filter(function (s) {
        const ds = String(s && s.date || '');
        return !(ds >= range.startKey && ds <= range.endKey);
      });
      scoped.forEach(function (m) { shifts.push(m); });
      shifts = shifts.sort(sortShiftEntries);
      sv();
      render();
      return { applied: true, reply: `Replaced ${weekRef === 'this_week' ? 'this week' : 'next week'} schedule with ${scoped.length} shift entr${scoped.length===1?'y':'ies'}${clipped ? ` (capped to ${cap})` : ''}.` };
    }

    return { applied: false };
  }

  function tryApplyDeterministicShiftCommand(text) {
    const t = String(text || '').toLowerCase().trim();
    if (!t) return null;
    const hasShiftContext = /\bshift|shifts|schedule|roster\b/.test(t) || recentlyDiscussedShifts();
    if (!hasShiftContext) return null;
    const nextWeek = getNextWeekRange();

    if (
      /\b(delete|remove|clear)\b/.test(t) &&
      /\b(all\s+)?shifts?\b/.test(t) &&
      /\bnext week\b/.test(t)
    ) {
      const before = shifts.length;
      const cap = getChatActionCap();
      let removed = 0;
      shifts = (Array.isArray(shifts) ? shifts : []).filter(function (s) {
        const ds = String(s && s.date || '');
        const inWeek = ds >= nextWeek.startKey && ds <= nextWeek.endKey;
        if (!inWeek) return true;
        if (removed >= cap) return true;
        removed += 1;
        return false;
      });
      const clipped = (before - shifts.length) > cap || removed >= cap;
      if (removed > 0) {
        sv();
        render();
        return { applied: true, reply: `Deleted ${removed} shift${removed === 1 ? '' : 's'} for next week${clipped ? ` (capped to ${cap})` : ''}.` };
      }
      return { applied: true, reply: 'No shifts found for next week to delete.' };
    }

    if (
      /\b(move|shift)\b/.test(t) &&
      /\bone day\b/.test(t) &&
      /\b(up|earlier|back)\b/.test(t)
    ) {
      const cap = getChatActionCap();
      let moved = 0;
      shifts = (Array.isArray(shifts) ? shifts : []).map(function (s) {
        if (!s || !s.date) return s;
        if (s.date < nextWeek.startKey || s.date > nextWeek.endKey) return s;
        if (moved >= cap) return s;
        const d = new Date(s.date + 'T00:00:00');
        if (Number.isNaN(d.getTime())) return s;
        d.setDate(d.getDate() - 1);
        moved += 1;
        return { ...s, date: fmtLD(d) };
      });
      if (moved > 0) {
        shifts = shifts.sort(sortShiftEntries);
        sv();
        render();
        return { applied: true, reply: `Moved ${moved} next-week shift${moved === 1 ? '' : 's'} one day earlier${moved >= cap ? ` (capped to ${cap})` : ''}.` };
      }
      return { applied: true, reply: 'No next-week shifts found to move.' };
    }

    const dayMatch = t.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (dayMatch && /\b(i am off|i'm off|off)\b/.test(t)) {
      const date = dateFromWeekdayToken(dayMatch[1], /\bnext week\b/.test(t) || recentlyDiscussedShifts());
      if (!date) return null;
      shifts = (Array.isArray(shifts) ? shifts : []).filter(function (s) {
        return String(s && s.date || '') !== date;
      });
      shifts.push({ id: gid(), date, type: 'Off', start: '', end: '', notes: 'Set from chat', onCall: false, clientId: '' });
      shifts = shifts.sort(sortShiftEntries);
      sv();
      render();
      return { applied: true, reply: `${dayMatch[1][0].toUpperCase() + dayMatch[1].slice(1)} is now set to Off.` };
    }

    return null;
  }

  function applyShiftPlanFromChat(plan) {
    const entries = Array.isArray(plan && plan.entries) ? plan.entries : [];
    if (!entries.length) return { added: 0, updated: 0 };
    const normalized = entries
      .map(function (e) {
        const date = String(e && e.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
        const rawType = String(e && e.type || 'Shift').trim();
        const type = rawType || 'Shift';
        const off = /^off$/i.test(type);
        const start = off ? '' : String(e && e.start || '').trim();
        const end = off ? '' : String(e && e.end || '').trim();
        const notes = String(e && e.notes || '').trim();
        const onCall = !!(e && e.onCall);
        return { date, type, start, end, notes, onCall };
      })
      .filter(Boolean);
    if (!normalized.length) return { added: 0, updated: 0 };

    function canonType(t) {
      return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    function isNearDuplicate(a, b) {
      if (!a || !b) return false;
      if (a.date !== b.date || a.start !== b.start || a.end !== b.end) return false;
      const ta = canonType(a.type);
      const tb = canonType(b.type);
      return ta === tb || ta.indexOf(tb) >= 0 || tb.indexOf(ta) >= 0;
    }

    const deduped = [];
    normalized.forEach(function (e) {
      const i = deduped.findIndex(function (x) {
        return isNearDuplicate(x, e);
      });
      if (i < 0) {
        deduped.push(e);
        return;
      }
      const existing = deduped[i];
      const keepNew = String(e.type || '').length >= String(existing.type || '').length;
      deduped[i] = keepNew ? e : existing;
    });

    let added = 0;
    let updated = 0;
    const cap = getChatActionCap();
    const clipped = deduped.length > cap;
    const scoped = deduped.slice(0, cap);
    // For weekly schedule plans, replace the date window to avoid stale/duplicated days.
    if (scoped.length >= 4 && !clipped) {
      const dates = scoped.map(function (e) { return e.date; }).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      shifts = (Array.isArray(shifts) ? shifts : []).filter(function (s) {
        const ds = String(s && s.date || '');
        return !(ds >= minDate && ds <= maxDate);
      });
    }

    scoped.forEach(function (e) {
      const date = e.date;
      const type = e.type;
      const start = e.start;
      const end = e.end;
      const notes = e.notes;
      const onCall = e.onCall;
      const idx = shifts.findIndex(function (s) {
        if (!s || s.date !== date) return false;
        return (
          String(s.type || '').toLowerCase() === String(type || '').toLowerCase() &&
          String(s.start || '') === String(start || '') &&
          String(s.end || '') === String(end || '')
        );
      });
      if (idx >= 0) {
        shifts[idx] = { ...shifts[idx], date, type, start, end, notes: notes || shifts[idx].notes || '', onCall };
        updated += 1;
      } else {
        shifts.push({ id: gid(), date, type, start, end, notes, onCall, clientId: '' });
        added += 1;
      }
    });
    if (added || updated) {
      shifts = (Array.isArray(shifts) ? shifts : []).sort(sortShiftEntries);
      sv();
      render();
    }
    return { added, updated, clipped, cap };
  }

  function shouldEditTaskFromChat(text) {
    const t = String(text || '').toLowerCase();
    if (/^(add|create)\s+\w/.test(t) && !/\b(fix|change|correct|wrong|edit|update)\b/.test(t)) return false;
    return (
      /\b(change|fix|correct|update|edit|move|resched|postpone|wrong|mistake|typo|instead|actually|should be|rename|wrong year|bad date|due date)\b/.test(t) ||
      /\b(set|push|move)\s+(the\s+)?(due|date)\b/.test(t) ||
      /\b(make|turn)\s+it\b/.test(t) ||
      /\d{4}\s*[-–—>]\s*\d{4}/.test(t) ||
      /\b(to|into)\s+20\d{2}\b/.test(t)
    );
  }

  function findTaskIndexForChatEdit(edit) {
    if (!edit || typeof edit !== 'object') return -1;
    const tid = String(edit.taskId || '').trim();
    if (tid) {
      const i = R.findIndex(function (r) {
        return r && String(r.id) === tid;
      });
      if (i >= 0) return i;
    }
    const mt = String(edit.matchTitle || '').trim().toLowerCase();
    if (mt.length >= 2) {
      const j = R.findIndex(function (r) {
        return r && !r.completed && String(r.title || '').toLowerCase().indexOf(mt) >= 0;
      });
      if (j >= 0) return j;
    }
    return -1;
  }

  function applyTaskEditFromChat(edit) {
    if (typeof R === 'undefined' || !Array.isArray(R)) return null;
    if (!edit || edit.action !== 'update' || !edit.patches || typeof edit.patches !== 'object') return null;
    const idx = findTaskIndexForChatEdit(edit);
    if (idx < 0) return null;
    const cur = R[idx];
    if (!cur) return null;
    const prevSnapshot = JSON.parse(JSON.stringify(cur));
    const p = edit.patches;
    const merged = Object.assign({}, cur);

    if (typeof p.title === 'string' && p.title.trim()) merged.title = p.title.trim();
    if (typeof p.notes === 'string') merged.notes = p.notes;

    if (typeof p.category === 'string' && CATS.some(function (c) { return c.key === p.category; })) {
      merged.category = p.category;
    }
    if (typeof p.priority === 'string' && PRIS.some(function (x) { return x.key === p.priority; })) {
      merged.priority = p.priority;
    }
    if (typeof p.recurrence === 'string' && RECS.some(function (x) { return x.key === p.recurrence; })) {
      merged.recurrence = p.recurrence;
    }

    if (p.unscheduled === true) {
      merged.unscheduled = true;
      merged.dueDate = UNSCHEDULED_SENTINEL_ISO;
      merged.startDate = '';
    } else if (typeof p.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate.trim())) {
      const ds0 = p.dueDate.trim();
      if (parseInt(ds0.slice(0, 4), 10) >= 2099) {
        merged.unscheduled = true;
        merged.dueDate = UNSCHEDULED_SENTINEL_ISO;
        merged.startDate = '';
      } else {
      const tm =
        typeof p.dueTime === 'string' && /^\d{1,2}:\d{2}/.test(p.dueTime.trim()) ? p.dueTime.trim() : '09:00';
      merged.dueDate = buildTaskDateIso(ds0, tm);
      merged.unscheduled = false;
      merged.startDate = merged.dueDate;
      }
    } else if (typeof p.dueTime === 'string' && /^\d{1,2}:\d{2}/.test(p.dueTime.trim()) && cur.dueDate && !cur.unscheduled) {
      const base = new Date(cur.dueDate);
      if (!Number.isNaN(base.getTime())) {
        const y = base.getFullYear();
        const mo = String(base.getMonth() + 1).padStart(2, '0');
        const d = String(base.getDate()).padStart(2, '0');
        merged.dueDate = buildTaskDateIso(y + '-' + mo + '-' + d, p.dueTime.trim());
        merged.unscheduled = false;
        merged.startDate = merged.dueDate;
      }
    }

    merged.sourceMode = 'chat-ai';
    const normalized = normalizeReminder(merged, idx);
    R[idx] = normalized;
    _undoCallback = () => {
      R[idx] = normalizeReminder(prevSnapshot, idx);
      sv();
      render();
    };
    sv();
    render();
    if (typeof showToast === 'function') showToast('Task updated from chat', 'Undo');
    return normalized;
  }

  let pendingChatTaskDraft = null;
  const TASK_DRAFT_CONFIRM_TTL_MS = 5 * 60 * 1000;
  function makeTaskDraftToken(){
    return `td_${Math.random().toString(36).slice(2,8)}`;
  }
  function buildPendingTaskDraft(task){
    const now=Date.now();
    return { task, token: makeTaskDraftToken(), createdAt: now, expiresAt: now + TASK_DRAFT_CONFIRM_TTL_MS };
  }
  function parseTaskDraftToken(text, mode){
    const t=String(text||'').trim().toLowerCase();
    if(mode==='confirm'){
      const m=t.match(/^(confirm|yes|ok|add it|do it)(\s+([a-z0-9_]{3,16}))?$/i);
      return m && m[3] ? String(m[3]).toLowerCase() : '';
    }
    const m=t.match(/^(cancel|no|skip|don'?t add)(\s+([a-z0-9_]{3,16}))?$/i);
    return m && m[3] ? String(m[3]).toLowerCase() : '';
  }
  function validatePendingTaskDraft(state, text){
    if(!state||!state.task)return { ok:false, reason:'missing' };
    if(Date.now()>Number(state.expiresAt||0))return { ok:false, reason:'expired' };
    const token=parseTaskDraftToken(text,'confirm')||parseTaskDraftToken(text,'cancel');
    if(token && token!==String(state.token||''))return { ok:false, reason:'stale' };
    return { ok:true };
  }

  function normalizeChatDraftTitle(v) {
    return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function userAskedForDateInText(text) {
    const t = String(text || '').toLowerCase();
    return (
      /\b(today|tomorrow|tonight|next week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(t) ||
      /\b\d{4}-\d{2}-\d{2}\b/.test(t) ||
      /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(t) ||
      /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/.test(t)
    );
  }

  function validateChatTaskDraft(task, sourceText) {
    if (!task || typeof task !== 'object') return { ok: false, error: 'I could not parse a valid task from that request.' };
    const title = String(task.title || '').trim().replace(/\s+/g, ' ');
    if (!title || title.length < 2) return { ok: false, error: 'Task title is too short. Please include what you want to do.' };
    if (title.length > 180) return { ok: false, error: 'Task title is too long. Keep it under 180 characters.' };

    const category = CATS.some(function (c) { return c.key === task.category; }) ? task.category : 'personal';
    const priority = PRIS.some(function (p) { return p.key === task.priority; }) ? task.priority : 'medium';
    const recurrence = RECS.some(function (r) { return r.key === task.recurrence; }) ? task.recurrence : 'none';
    const notes = String(task.notes || '').trim().slice(0, 4000);

    let dueDateStr = String(task.dueDate || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr) && parseInt(dueDateStr.slice(0, 4), 10) >= 2099) dueDateStr = '';
    if (dueDateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) return { ok: false, error: 'Date format was invalid. Please use YYYY-MM-DD.' };

    let dueTimeStr = String(task.dueTime || '').trim();
    if (dueTimeStr) {
      if (!/^\d{2}:\d{2}$/.test(dueTimeStr)) return { ok: false, error: 'Time format was invalid. Please use HH:MM (24h).' };
      const hh = parseInt(dueTimeStr.slice(0, 2), 10);
      const mm = parseInt(dueTimeStr.slice(3, 5), 10);
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return { ok: false, error: 'Time value was invalid.' };
    } else {
      dueTimeStr = '09:00';
    }

    const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDateStr);
    const dueDate = hasDate ? buildTaskDateIso(dueDateStr, dueTimeStr) : UNSCHEDULED_SENTINEL_ISO;
    const unscheduled = !hasDate;
    const riskyReasons = [];
    if (unscheduled && userAskedForDateInText(sourceText)) riskyReasons.push('I could not confidently resolve the due date.');
    if (title.length < 4) riskyReasons.push('Title looks very short.');

    return {
      ok: true,
      needsConfirm: riskyReasons.length > 0,
      riskyReasons: riskyReasons,
      task: {
        title: title,
        notes: notes,
        category: category,
        priority: priority,
        recurrence: recurrence,
        dueDate: dueDate,
        unscheduled: unscheduled,
      },
    };
  }

  function findDuplicateTaskCandidate(task) {
    if (!Array.isArray(R)) return null;
    const titleNorm = normalizeChatDraftTitle(task && task.title);
    if (!titleNorm) return null;
    return R.find(function (r) {
      if (!r || r.completed) return false;
      if (normalizeChatDraftTitle(r.title) !== titleNorm) return false;
      const rUnscheduled = !!(r.unscheduled || (typeof isUnscheduledISO === 'function' && isUnscheduledISO(r.dueDate)));
      if (!!task.unscheduled !== rUnscheduled) return false;
      if (task.unscheduled) return true;
      const a = new Date(task.dueDate).getTime();
      const b = new Date(r.dueDate).getTime();
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return Math.abs(a - b) <= 2 * 60 * 60 * 1000;
    }) || null;
  }

  function clearPendingChatDraft() {
    pendingChatTaskDraft = null;
  }

  function taskDraftPreviewLine(task) {
    if (!task) return '';
    return `"${task.title}"${task.unscheduled ? ' (no due date)' : ` due ${fmtD(task.dueDate)}`}, ${task.priority}`;
  }

  function shouldCreateTaskFromChat(text) {
    const t = String(text || '').toLowerCase();
    const verb =
      /\b(add|create|make|save|remind|schedule|set|put)\b/.test(t) ||
      /\b(i\s+)?(also\s+)?(want|need|wish)(\s+to)?\s+\S/.test(t) ||
      /\b(don't|don’t|do not)\s+forget\b/.test(t);
    if (!verb) return false;
    if (/^(what|why|how|when|who|where|which)\b/.test(t.trim())) return false;
    const noun = /\b(task|todo|todos|reminder|reminders|item|items|list|lists|board|boards)\b/.test(t);
    const referent = /\b(it|this|that|those|them)\b/.test(t);
    const prep = /\b(for|on|at|by)\b/.test(t);
    const toList = /\bto\s+my\s+(list|tasks?)\b/.test(t) || /\binto\s+my\s+(list|tasks?)\b/.test(t);
    const timeCue =
      /\b(tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month)\b/.test(t) ||
      /\b\d{1,2}\/\d{1,2}\b/.test(t) ||
      /\b\d{4}-\d{2}-\d{2}\b/.test(t);
    const colonTitle = /:\s*\S/.test(t);
    const bareAdd = /\b(add|create)\s+[^.?!]{4,}/.test(String(text || ''));
    return noun || referent || prep || toList || timeCue || colonTitle || bareAdd;
  }

  let pendingDuplicateDeletePlan = null;
  let pendingCompletedDeletePlan = null;
  let pendingOverdueDeletePlan = null;
  const DELETE_CONFIRM_TTL_MS = 5 * 60 * 1000;

  function makeDeleteConfirmToken(){
    return Math.random().toString(36).slice(2,8);
  }
  function wrapDeleteConfirmPlan(plan){
    const now=Date.now();
    return {
      plan: plan,
      token: makeDeleteConfirmToken(),
      createdAt: now,
      expiresAt: now + DELETE_CONFIRM_TTL_MS,
    };
  }
  function parseConfirmTokenText(text){
    const t=String(text||'').trim().toLowerCase();
    const m=t.match(/^(confirm|yes|ok|do it|delete them)\s+([a-z0-9]{4,12})$/i);
    return m ? String(m[2]||'').toLowerCase() : '';
  }
  function parseCancelTokenText(text){
    const t=String(text||'').trim().toLowerCase();
    const m=t.match(/^(cancel|no|skip|don'?t delete)\s+([a-z0-9]{4,12})$/i);
    return m ? String(m[2]||'').toLowerCase() : '';
  }
  function isDeleteConfirmValid(state, text){
    if(!state||!state.plan)return { ok:false, reason:'missing' };
    const now=Date.now();
    if(now>Number(state.expiresAt||0))return { ok:false, reason:'expired' };
    const suppliedConfirmToken=parseConfirmTokenText(text);
    const suppliedCancelToken=parseCancelTokenText(text);
    const supplied=suppliedConfirmToken||suppliedCancelToken;
    if(supplied&&String(supplied)!==String(state.token||''))return { ok:false, reason:'stale' };
    return { ok:true };
  }

  function shouldDeleteDuplicatesFromChat(text) {
    const t = String(text || '').toLowerCase();
    const hasDeleteVerb = /\b(delete|remove|clean|dedupe|deduplicate)\b/.test(t);
    const hasDupWord = /\b(duplicate|duplicates|dupe|copy|repeated)\b/.test(t);
    return hasDeleteVerb && hasDupWord;
  }

  function shouldDeleteCompletedFromChat(text) {
    const t = String(text || '').toLowerCase();
    return /\b(delete|remove|clear|clean)\b/.test(t) && /\b(completed|done|finished)\b/.test(t);
  }

  function shouldDeleteOverdueFromChat(text) {
    const t = String(text || '').toLowerCase();
    return /\b(delete|remove|clear|clean)\b/.test(t) && /\b(overdue|late|past due)\b/.test(t);
  }

  function normalizedTaskTitleForDup(v) {
    return String(v || '')
      .toLowerCase()
      .replace(/\(copy\)/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function dueDayKeyForDup(r) {
    if (!r || r.unscheduled || (typeof isUnscheduledISO === 'function' && isUnscheduledISO(r.dueDate))) return 'undated';
    const d = new Date(r.dueDate);
    if (Number.isNaN(d.getTime())) return 'undated';
    return fmtLD(d);
  }

  function buildDuplicateDeletePlan() {
    if (!Array.isArray(R)) return { removeIds: [], keepIds: [] };
    const map = new Map();
    R.filter(function (r) {
      return r && !r.completed;
    }).forEach(function (r) {
      const title = normalizedTaskTitleForDup(r.title);
      if (!title) return;
      const key = title + '|' + dueDayKeyForDup(r);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });

    const removeIds = [];
    const keepIds = [];
    map.forEach(function (items) {
      if (!items || items.length < 2) return;
      const sorted = items.slice().sort(function (a, b) {
        const ta = new Date(a.createdAt || a.updated_at || 0).getTime() || 0;
        const tb = new Date(b.createdAt || b.updated_at || 0).getTime() || 0;
        return ta - tb;
      });
      const keep = sorted[0];
      keepIds.push(keep.id);
      sorted.slice(1).forEach(function (dup) {
        removeIds.push(dup.id);
      });
    });
    return { removeIds, keepIds };
  }

  function applyDuplicateDeletePlan(plan) {
    if (!plan || !Array.isArray(plan.removeIds) || !plan.removeIds.length) return 0;
    const backup = R.slice();
    const cap=getChatActionCap();
    const scopedIds=plan.removeIds.slice(0,cap);
    const toRemove = new Set(scopedIds.map(String));
    const removedTasks = [];
    R.forEach(function (r) {
      if (r && toRemove.has(String(r.id))) removedTasks.push(r);
    });
    if (!removedTasks.length) return 0;

    removedTasks.forEach(function (r) {
      const copy = { ...r, deletedAt: new Date().toISOString() };
      trash.push(copy);
    });
    R = R.filter(function (r) {
      return !(r && toRemove.has(String(r.id)));
    });
    removedTasks.forEach(function (r) {
      if (r && r.id) clearReminderKeys(r.id);
    });
    reindexOrders(false);
    _undoCallback = function () {
      R = backup;
      sv();
      render();
    };
    sv();
    render();
    if (typeof showToast === 'function') {
      const clipped=plan.removeIds.length>scopedIds.length?` (capped to ${cap})`:'';
      showToast(`Deleted ${removedTasks.length} duplicate task${removedTasks.length===1?'':'s'}${clipped}`, 'Undo');
    }
    return removedTasks.length;
  }

  function buildCompletedDeletePlan() {
    const removeIds = (Array.isArray(R) ? R : [])
      .filter(function (r) { return r && r.completed; })
      .map(function (r) { return r.id; });
    return { removeIds };
  }

  function buildOverdueDeletePlan() {
    const removeIds = (Array.isArray(R) ? R : [])
      .filter(function (r) { return r && !r.completed && typeof urg === 'function' && urg(r.dueDate) === 'overdue'; })
      .map(function (r) { return r.id; });
    return { removeIds };
  }

  function applyGenericDeletePlan(plan, label) {
    if (!plan || !Array.isArray(plan.removeIds) || !plan.removeIds.length) return 0;
    const backup = R.slice();
    const cap=getChatActionCap();
    const scopedIds=plan.removeIds.slice(0,cap);
    const toRemove = new Set(scopedIds.map(String));
    const removedTasks = [];
    R.forEach(function (r) {
      if (r && toRemove.has(String(r.id))) removedTasks.push(r);
    });
    if (!removedTasks.length) return 0;
    removedTasks.forEach(function (r) {
      const copy = { ...r, deletedAt: new Date().toISOString() };
      trash.push(copy);
    });
    R = R.filter(function (r) {
      return !(r && toRemove.has(String(r.id)));
    });
    removedTasks.forEach(function (r) {
      if (r && r.id) clearReminderKeys(r.id);
    });
    reindexOrders(false);
    _undoCallback = function () {
      R = backup;
      sv();
      render();
    };
    sv();
    render();
    if (typeof showToast === 'function') {
      const clipped=plan.removeIds.length>scopedIds.length?` (capped to ${cap})`:'';
      showToast(`Deleted ${removedTasks.length} ${label} task${removedTasks.length===1?'':'s'}${clipped}`, 'Undo');
    }
    return removedTasks.length;
  }

  function addTaskFromChatTask(task) {
    if (!task || !String(task.title || '').trim()) return null;
    const rec = normalizeReminder({
      id: gid(),
      title: String(task.title || '').trim(),
      notes: String(task.notes || '').trim(),
      dueDate: task.dueDate,
      startDate: task.unscheduled ? '' : task.dueDate,
      unscheduled: !!task.unscheduled,
      category: CATS.some(function (c) { return c.key === task.category; }) ? task.category : 'personal',
      priority: PRIS.some(function (p) { return p.key === task.priority; }) ? task.priority : 'medium',
      recurrence: RECS.some(function (r) { return r.key === task.recurrence; }) ? task.recurrence : 'none',
      alerts: ['15'],
      tags: ['chat-ai'],
      sourceMode: 'chat-ai',
      subtasks: [],
      completed: false,
      createdAt: new Date().toISOString(),
    }, R.length);

    R.push(rec);
    sv();
    render();
    if (typeof showToast === 'function') showToast('Task added from chat');
    return rec;
  }

  function buildLocalChatReply(text) {
    const lower = String(text || '').toLowerCase();
    if (!lower.trim()) return 'Share a task idea and I can help break it down.';
    if (/\b(help|what should i do|next)\b/.test(lower)) {
      const next = R.filter(r => !r.completed).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
      if (!next) return 'You are all caught up. Add one small task to keep momentum.';
      return `Start with "${next.title}". It is the soonest pending task.`;
    }
    if (/\b(overdue|late)\b/.test(lower)) {
      const overdue = R.filter(r => !r.completed && urg(r.dueDate) === 'overdue').length;
      return overdue ? `You have ${overdue} overdue task${overdue === 1 ? '' : 's'}. Tackle the shortest one first.` : 'No overdue tasks right now. Nice work.';
    }
    const parsed = parseNLP(text);
    const due = parsed.date ? ` for ${parsed.date}${parsed.time ? ` at ${parsed.time}` : ''}` : '';
    return `I can draft it as "${parsed.title}" in ${parsed.cat} with ${parsed.pri} priority${due}. Please confirm/save it in the app.`;
  }
  function getChatMutationIntentSummary(text){
    const t=String(text||'');
    if(!t.trim())return '';
    if(/\b(recategorize|re-categorize|reclassify|sort\s+.*categor|organi[sz]e\s+.*categor)\b/i.test(t))return 'bulk edit tasks';
    if(shouldRouteShiftFromChat(t))return 'apply shift updates';
    if(shouldEditTaskFromChat(t))return 'edit existing task(s)';
    if(shouldCreateTaskFromChat(t))return 'create new task(s)';
    if(shouldDeleteDuplicatesFromChat(t))return 'delete duplicate tasks';
    if(shouldDeleteCompletedFromChat(t))return 'delete completed tasks';
    if(shouldDeleteOverdueFromChat(t))return 'delete overdue tasks';
    if(window.__aiRecatPreview?.changes?.length)return 'apply AI recategorization';
    return '';
  }
  function getChatMutationRiskLevel(intent,text){
    const i=String(intent||'').toLowerCase();
    const t=String(text||'').toLowerCase();
    if(i.includes('delete')||i.includes('replace')||/\bdelete|remove|clear|wipe|replace\b/.test(t))return 'high';
    if(i.includes('shift')||i.includes('edit')||i.includes('recategor')||i.includes('create'))return 'medium';
    return 'low';
  }
  function getPlanRiskLevel(plan,text){
    const actions=Array.isArray(plan?.actions)?plan.actions:[];
    let risk='low';
    actions.forEach(function(a){
      const t=String(a?.type||'').toLowerCase();
      const declared=String(a?.risk||'').toLowerCase();
      if(declared==='high')risk='high';
      if(risk!=='high'&&declared==='medium')risk='medium';
      if(t.includes('delete')||t==='shift.intent')risk='high';
      if(t==='settings.update'&&a?.updates&&typeof a.updates==='object'){
        const n=Object.keys(a.updates).length;
        if(n>1)risk='high';
        else if(risk==='low')risk='medium';
      }
    });
    if(risk==='low'&&String(text||'').trim())return getChatMutationRiskLevel(summarizeChatPlan(plan),text);
    return risk;
  }
  function renderDryRunConfirmCard(container){
    if(!container||!pendingDryRunConfirm)return;
    const risk=String(pendingDryRunConfirm.risk||'medium');
    const riskBg=risk==='high'?'rgba(220,38,38,.14)':risk==='medium'?'rgba(245,158,11,.16)':'rgba(22,163,74,.14)';
    const riskFg=risk==='high'?'#DC2626':risk==='medium'?'#B45309':'#15803D';
    const token=String(pendingDryRunConfirm.token||'');
    const secondsLeft=Math.max(0,Math.ceil((Number(pendingDryRunConfirm.expiresAt||0)-Date.now())/1000));
    const card=document.createElement('div');
    card.id='chat-dryrun-confirm-card';
    card.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);padding:10px 12px;border-radius:12px;max-width:86%;font-size:12px;color:var(--text)"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px"><div style="font-weight:700">Preview ready</div><span style="padding:2px 8px;border-radius:999px;background:${riskBg};color:${riskFg};font-weight:800;text-transform:uppercase;font-size:10px;letter-spacing:.04em">${risk} risk</span></div><div style="color:var(--text2);margin-bottom:6px">Action: ${esc(pendingDryRunConfirm.intent)}.</div><div style="color:var(--text3);font-size:11px;margin-bottom:8px">Confirmation expires in ${secondsLeft}s.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" onclick="confirmDryRunChatAction('${token}')" style="border:none;border-radius:10px;padding:7px 12px;background:var(--accent);color:#fff;font-weight:700;cursor:pointer">Confirm run</button><button type="button" onclick="cancelDryRunChatAction('${token}')" style="border:1px solid var(--border);border-radius:10px;padding:7px 12px;background:var(--bg2);color:var(--text);font-weight:700;cursor:pointer">Cancel</button></div></div>`;
    container.appendChild(card);
  }
  window.confirmDryRunChatAction=function(token){
    const valid=isPendingDryRunConfirmValid(token);
    if(!valid.ok){
      if(valid.reason==='expired'){
        clearPendingDryRunConfirm();
        appendDryRunAssistantNote('This confirmation expired. Please run the request again to generate a fresh preview.');
      }else if(valid.reason==='stale'){
        appendDryRunAssistantNote('That confirmation is no longer valid. Use the latest preview card.');
      }
      return;
    }
    const input=document.getElementById('chat-input');
    const text=pendingDryRunConfirm.text;
    window.__chatBypassDryRunText=String(text||'');
    clearPendingDryRunConfirm();
    if(input)input.value=text;
    if(typeof window.sendChatMsg==='function')window.sendChatMsg();
  };
  window.cancelDryRunChatAction=function(token){
    const valid=isPendingDryRunConfirmValid(token);
    clearPendingDryRunConfirm();
    if(valid.reason==='stale'){
      appendDryRunAssistantNote('Canceled latest preview.');
      return;
    }
    appendDryRunAssistantNote('Canceled. No changes were made.');
  };
  
  const CHAT_UI_ENABLED = false; // v1: keep chat code, hide UI
  if (CHAT_UI_ENABLED) {
    setTimeout(function() {
      if (document.getElementById('chat-btn')) return;
      const btn = document.createElement('button');
      btn.id = 'chat-btn';
      btn.textContent = '💬 Chat';
      btn.style.cssText = 'position:fixed;top:18px;right:18px;background:#7C3AED;color:#fff;border:none;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;z-index:80;font-family:DM Sans';
      btn.onclick = openChatModal;
      document.body.appendChild(btn);
    }, 1000);
  }
  
  function openChatModal() {
    if (!CHAT_UI_ENABLED) return;
    if (document.getElementById('chat-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'chat-modal';
    modal.style.cssText = 'position:fixed;bottom:0;right:0;width:90vw;max-width:400px;height:600px;background:#fff;border-left:1px solid #e0e0e0;z-index:200;border-radius:20px 20px 0 0;display:flex;flex-direction:column;box-shadow:0 -10px 40px rgba(0,0,0,0.1)';
    modal.innerHTML = '<div style="padding:16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--card);"><h2 style="margin:0;font-size:16px;font-weight:600;color:var(--text);">💬 Chat AI</h2><div style="display:flex;gap:8px;align-items:center"><button type="button" onclick="openAiActionLogModal()" style="border:1px solid var(--border);border-radius:8px;padding:4px 8px;background:var(--bg2);color:var(--text);font-size:12px;cursor:pointer">Action log</button><button type="button" onclick="document.getElementById(\'chat-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3);">✕</button></div></div><div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--bg);"></div><div style="padding:16px;border-top:1px solid var(--border);display:flex;gap:8px;background:var(--card);"><input type="text" id="chat-input" placeholder="Ask about your tasks… (Enter to send)" style="flex:1;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;outline:none;font-family:DM Sans,sans-serif;background:var(--bg);color:var(--text);"><button type="button" id="chat-send-btn" onclick="sendChatMsg()" style="min-width:44px;height:40px;border:none;border-radius:10px;background:#2563EB;color:#fff;cursor:pointer;font-size:16px;font-weight:700;">→</button></div>';
    modal.style.background = 'var(--card)';
    modal.style.border = '1px solid var(--border)';
    document.body.appendChild(modal);
    renderChatHistory(document.getElementById('chat-messages'));
    const msgs = document.getElementById('chat-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    const inp = document.getElementById('chat-input');
    if (inp) {
      inp.addEventListener('keydown', function(ev) {
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        sendChatMsg();
      });
      inp.focus();
    }
  }
  
  window.sendChatMsg = async function() {
    const input = document.getElementById('chat-input');
    const messages = document.getElementById('chat-messages');
    if (!input || !messages) return;
    const sendBtn = document.getElementById('chat-send-btn');
    
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.6'; }
    
    // Add user message
    const userMsg = document.createElement('div');
    userMsg.style.cssText = 'display:flex;justify-content:flex-end;';
    userMsg.innerHTML = '<div style="background:#2563EB;color:#fff;padding:12px 16px;border-radius:12px;font-size:13px;max-width:80%;">' + text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
    messages.appendChild(userMsg);
    appendChatHistory('user', text);
    messages.scrollTop = messages.scrollHeight;
    
    // Add loading
    const loading = document.createElement('div');
    loading.id = 'chat-loading';
    loading.innerHTML = '<div style="background:#f0f0f0;padding:12px 16px;border-radius:12px;"><div style="display:flex;gap:4px;"><span style="width:6px;height:6px;background:#999;border-radius:50%;animation:bounce 1.4s infinite;"></span><span style="width:6px;height:6px;background:#999;border-radius:50%;animation:bounce 1.4s infinite;animation-delay:0.2s;"></span><span style="width:6px;height:6px;background:#999;border-radius:50%;animation:bounce 1.4s infinite;animation-delay:0.4s;"></span></div></div>';
    messages.appendChild(loading);
    messages.scrollTop = messages.scrollHeight;
    
    try {
      let reply = '';
      try {
        const mutIntent=getChatMutationIntentSummary(text);
        const bypassDryRun=window.__chatBypassDryRunText&&String(window.__chatBypassDryRunText)===String(text||'');
        window.__chatBypassDryRunText='';
        let plannerTried=false;
        let plannerBlockedMutation=false;
        if(getChatAutonomyMode()==='agentic'&&isChatPlannerEnabled()){
          plannerTried=true;
          try{
            const plan=await fetchServerChatPlan(text);
            const planSummary=summarizeChatPlan(plan);
            const hasPlanActions=Array.isArray(plan?.actions)&&plan.actions.length>0&&planSummary!=='no changes';
            const planRisk=getPlanRiskLevel(plan,text);
            if(hasPlanActions&&!bypassDryRun&&(isChatDryRunEnabled()||planRisk==='high')){
              const now=Date.now();
              pendingDryRunConfirm={text,intent:planSummary,risk:getPlanRiskLevel(plan,text),at:now,token:makeDryRunConfirmToken(),expiresAt:now+DRY_RUN_CONFIRM_TTL_MS,plan};
              const why=isChatDryRunEnabled()?'Dry run is ON.':'High-risk plan requires confirmation.';
              reply=`${why} Planner prepared: ${planSummary}. No data was changed yet.\n\nUse Confirm run below to execute once, or Cancel. Action cap is ${getChatActionCap()} per request.`;
            }else if(hasPlanActions){
              const run=executeChatPlanActions(plan);
              appendAiActionAudit({
                at: Date.now(),
                prompt: text,
                summary: summarizeChatPlan(plan),
                changes: (run.statuses || []).map(function(s){ return `${s.status==='applied'?'APPLIED':'SKIPPED'}: ${s.message}`; }),
              });
              if(run.executed){
                const lines=(run.statuses||[]).slice(0,8).map(function(s){return `${s.status==='applied'?'✅':'⚪'} #${s.index} ${s.type}: ${s.message}`;});
                const changed=collectRunChangedTitles(run);
                const changedPreview=changed.length
                  ? `\n\nLast changes:\n- ${changed.slice(0,10).join('\n- ')}${changed.length>10?`\n- +${changed.length-10} more`:''}`
                  : '';
                reply=`Executed ${run.executed} planned action${run.executed===1?'':'s'}.\n${lines.join('\n')}${changedPreview}`;
              }else{
                const lines=(run.statuses||[]).slice(0,8).map(function(s){return `⚪ #${s.index} ${s.type}: ${s.message}`;});
                reply=lines.length?`No actions were applied.\n${lines.join('\n')}`:String(plan?.assistantReply||'Planner did not find executable changes.');
              }
            }else if(!mutIntent&&String(plan?.assistantReply||'').trim()){
              reply=String(plan.assistantReply).trim();
            }else if(mutIntent&&!hasPlanActions){
              const fallbackText=String(plan?.assistantReply||'').trim();
              plannerBlockedMutation=true;
              reply=fallbackText||`I understood this as "${mutIntent}", but I could not build a safe executable plan. I did not create any task automatically. Try a more explicit instruction (for example: "recategorize active tasks by title and due date").`;
            }
          }catch(_plannerErr){
            // Planner is additive in phase 1; legacy routing remains fallback.
          }
        }
        if(!reply&&getChatAutonomyMode()==='agentic'&&isChatDryRunEnabled()&&mutIntent&&!bypassDryRun){
          const now=Date.now();
          pendingDryRunConfirm={text,intent:mutIntent,risk:getChatMutationRiskLevel(mutIntent,text),at:now,token:makeDryRunConfirmToken(),expiresAt:now+DRY_RUN_CONFIRM_TTL_MS};
          reply=`Dry run is ON. I understood this as: ${mutIntent}. No data was changed yet.\n\nUse Confirm run below to execute once, or Cancel. Action cap is ${getChatActionCap()} per request.`;
        } else if(!reply&&!(plannerTried&&mutIntent)&&!plannerBlockedMutation)
        if (shouldRouteShiftFromChat(text)) {
          const shiftIntent = await fetchServerShiftIntent(text);
          const byIntent = applyShiftIntentFromAi(shiftIntent);
          if (byIntent && byIntent.applied) {
            reply = byIntent.reply;
          } else {
            const directShift = tryApplyDeterministicShiftCommand(text);
            if (directShift && directShift.applied) {
              reply = directShift.reply;
            } else {
              const shiftPlan = await fetchServerShiftPlan(text);
              const shiftRes = applyShiftPlanFromChat(shiftPlan);
              if (shiftRes.added || shiftRes.updated) {
                reply =
                  `Updated Shifts page: ${shiftRes.added} added, ${shiftRes.updated} updated.` +
                  `${shiftRes.clipped ? ` (capped to ${shiftRes.cap})` : ''} Open the Shifts page calendar to review next week.`;
              } else {
                reply = 'I could not safely extract concrete shift edits from that request. Include the target week/day changes (for example: "move all next-week shifts one day earlier" or list each day and time), and I will apply them to the Shifts page.';
              }
            }
          }
        } else if (shouldEditTaskFromChat(text)) {
          const editPlan = await fetchServerTaskEdit(text);
          if (editPlan && editPlan.action === 'update') {
            const updated = applyTaskEditFromChat(editPlan);
            if (updated) {
              reply = `Updated "${updated.title}"${updated.unscheduled ? ' (no due date).' : ` — due ${fmtD(updated.dueDate)}.`}`;
            } else {
              reply = await fetchServerChatReply(text);
            }
          } else {
            reply = await fetchServerChatReply(text);
          }
        } else if (pendingDuplicateDeletePlan && /^(confirm|yes|y|ok|do it|delete them)(\s+[a-z0-9]{4,12})?$/i.test(text)) {
          const valid=isDeleteConfirmValid(pendingDuplicateDeletePlan,text);
          if(!valid.ok){
            pendingDuplicateDeletePlan=null;
            if(valid.reason==='expired') reply='That delete confirmation expired. Ask again and I will generate a new preview token.';
            else if(valid.reason==='stale') reply='That token does not match the latest delete preview.';
            else reply='No pending duplicate-delete confirmation was found.';
          } else {
          const removed = applyDuplicateDeletePlan(pendingDuplicateDeletePlan.plan);
          pendingDuplicateDeletePlan = null;
          reply = removed
            ? `Done. I deleted ${removed} duplicate task${removed===1?'':'s'}.`
            : 'I could not find duplicates to delete anymore.';
          }
        } else if (pendingCompletedDeletePlan && /^(confirm|yes|y|ok|do it|delete them)(\s+[a-z0-9]{4,12})?$/i.test(text)) {
          const valid=isDeleteConfirmValid(pendingCompletedDeletePlan,text);
          if(!valid.ok){
            pendingCompletedDeletePlan=null;
            if(valid.reason==='expired') reply='That delete confirmation expired. Ask again and I will generate a new preview token.';
            else if(valid.reason==='stale') reply='That token does not match the latest delete preview.';
            else reply='No pending completed-delete confirmation was found.';
          } else {
          const removed = applyGenericDeletePlan(pendingCompletedDeletePlan.plan, 'completed');
          pendingCompletedDeletePlan = null;
          reply = removed
            ? `Done. I deleted ${removed} completed task${removed===1?'':'s'}.`
            : 'I could not find completed tasks to delete anymore.';
          }
        } else if (pendingOverdueDeletePlan && /^(confirm|yes|y|ok|do it|delete them)(\s+[a-z0-9]{4,12})?$/i.test(text)) {
          const valid=isDeleteConfirmValid(pendingOverdueDeletePlan,text);
          if(!valid.ok){
            pendingOverdueDeletePlan=null;
            if(valid.reason==='expired') reply='That delete confirmation expired. Ask again and I will generate a new preview token.';
            else if(valid.reason==='stale') reply='That token does not match the latest delete preview.';
            else reply='No pending overdue-delete confirmation was found.';
          } else {
          const removed = applyGenericDeletePlan(pendingOverdueDeletePlan.plan, 'overdue');
          pendingOverdueDeletePlan = null;
          reply = removed
            ? `Done. I deleted ${removed} overdue task${removed===1?'':'s'}.`
            : 'I could not find overdue tasks to delete anymore.';
          }
        } else if (pendingDuplicateDeletePlan && /^(cancel|no|n|skip|don'?t delete)(\s+[a-z0-9]{4,12})?$/i.test(text)) {
          const valid=isDeleteConfirmValid(pendingDuplicateDeletePlan,text);
          pendingDuplicateDeletePlan = null;
          reply = valid.ok ? 'Canceled. I did not delete any tasks.' : 'Canceled latest preview.';
        } else if (pendingCompletedDeletePlan && /^(cancel|no|n|skip|don'?t delete)(\s+[a-z0-9]{4,12})?$/i.test(text)) {
          const valid=isDeleteConfirmValid(pendingCompletedDeletePlan,text);
          pendingCompletedDeletePlan = null;
          reply = valid.ok ? 'Canceled. I did not delete completed tasks.' : 'Canceled latest preview.';
        } else if (pendingOverdueDeletePlan && /^(cancel|no|n|skip|don'?t delete)(\s+[a-z0-9]{4,12})?$/i.test(text)) {
          const valid=isDeleteConfirmValid(pendingOverdueDeletePlan,text);
          pendingOverdueDeletePlan = null;
          reply = valid.ok ? 'Canceled. I did not delete overdue tasks.' : 'Canceled latest preview.';
        } else if (pendingChatTaskDraft && /^(confirm|yes|y|ok|add it|do it)(\s+[a-z0-9_]{3,16})?$/i.test(text)) {
          const taskDraftState = pendingChatTaskDraft;
          const valid = validatePendingTaskDraft(taskDraftState, text);
          if(!valid.ok){
            clearPendingChatDraft();
            if(valid.reason==='expired') reply='That task draft confirmation expired. Please ask again and I will re-draft it.';
            else if(valid.reason==='stale') reply='That token does not match the latest task draft preview.';
            else reply='No pending task draft was found.';
          } else {
          const dup = findDuplicateTaskCandidate(taskDraftState.task);
          if (dup) {
            reply = `I did not add it because a similar open task already exists: "${dup.title}".`;
          } else {
            const createdFromDraft = addTaskFromChatTask(taskDraftState.task);
            if (createdFromDraft) {
              reply = `Added "${createdFromDraft.title}" to your tasks${createdFromDraft.unscheduled ? '.' : ` for ${fmtD(createdFromDraft.dueDate)}.`}`;
            } else {
              reply = 'I could not add that draft task. Please try again.';
            }
          }
          clearPendingChatDraft();
          }
        } else if (pendingChatTaskDraft && /^(cancel|no|n|skip|don'?t add)(\s+[a-z0-9_]{3,16})?$/i.test(text)) {
          const valid = validatePendingTaskDraft(pendingChatTaskDraft, text);
          clearPendingChatDraft();
          reply = valid.ok ? 'Canceled. I did not add that task.' : 'Canceled latest task draft.';
        } else if (shouldDeleteDuplicatesFromChat(text)) {
          const plan = buildDuplicateDeletePlan();
          if (!plan.removeIds.length) {
            reply = 'I did not find duplicate active tasks to delete.';
          } else {
            pendingCompletedDeletePlan = null;
            pendingOverdueDeletePlan = null;
            pendingDuplicateDeletePlan = wrapDeleteConfirmPlan(plan);
            reply = `I found ${plan.removeIds.length} duplicate task${plan.removeIds.length===1?'':'s'} to remove. Reply "confirm ${pendingDuplicateDeletePlan.token}" to delete or "cancel ${pendingDuplicateDeletePlan.token}" to keep everything.`;
          }
        } else if (shouldDeleteCompletedFromChat(text)) {
          const plan = buildCompletedDeletePlan();
          if (!plan.removeIds.length) {
            reply = 'I did not find completed tasks to delete.';
          } else {
            pendingDuplicateDeletePlan = null;
            pendingOverdueDeletePlan = null;
            pendingCompletedDeletePlan = wrapDeleteConfirmPlan(plan);
            reply = `I found ${plan.removeIds.length} completed task${plan.removeIds.length===1?'':'s'} to delete. Reply "confirm ${pendingCompletedDeletePlan.token}" to continue or "cancel ${pendingCompletedDeletePlan.token}" to keep them.`;
          }
        } else if (shouldDeleteOverdueFromChat(text)) {
          const plan = buildOverdueDeletePlan();
          if (!plan.removeIds.length) {
            reply = 'I did not find overdue tasks to delete.';
          } else {
            pendingDuplicateDeletePlan = null;
            pendingCompletedDeletePlan = null;
            pendingOverdueDeletePlan = wrapDeleteConfirmPlan(plan);
            reply = `I found ${plan.removeIds.length} overdue task${plan.removeIds.length===1?'':'s'} to delete. Reply "confirm ${pendingOverdueDeletePlan.token}" to continue or "cancel ${pendingOverdueDeletePlan.token}" to keep them.`;
          }
        } else if (shouldCreateTaskFromChat(text)) {
          const extractedTask = await fetchServerTaskAction(text);
          const validated = validateChatTaskDraft(extractedTask, text);
          if (!validated.ok) {
            reply = validated.error || 'I could not safely parse a task from that request.';
            if (typeof showToast === 'function') showToast(reply);
          } else {
            const dup = findDuplicateTaskCandidate(validated.task);
            if (dup) {
              reply = `I did not add it because a similar open task already exists: "${dup.title}".`;
            } else if (validated.needsConfirm) {
              pendingChatTaskDraft = buildPendingTaskDraft(validated.task);
              reply =
                `I parsed this task: ${taskDraftPreviewLine(validated.task)}.\n` +
                `${validated.riskyReasons.join(' ')} Reply "confirm ${pendingChatTaskDraft.token}" to add it or "cancel ${pendingChatTaskDraft.token}" to skip.`;
            } else {
              const created = addTaskFromChatTask(validated.task);
              if (created) {
                reply = `Added "${created.title}" to your tasks${created.unscheduled ? '.' : ` for ${fmtD(created.dueDate)}.`}`;
              } else {
                reply = await fetchServerChatReply(text);
              }
            }
          }
        } else {
          reply = await fetchServerChatReply(text);
        }
      } catch (serverErr) {
        const msg = String(serverErr && serverErr.message ? serverErr.message : 'AI unavailable');
        if (typeof showToast === 'function') showToast(msg, 5000);
        reply = '⚠️ ' + msg + '\n\n' + buildLocalChatReply(text);
      }
      loading.remove();
      if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
      
      const aiMsg = document.createElement('div');
      aiMsg.innerHTML = '<div style="background:#f0f0f0;padding:12px 16px;border-radius:12px;font-size:13px;max-width:80%;color:#333;">' + reply.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
      messages.appendChild(aiMsg);
      appendChatHistory('assistant', reply);
      if(pendingDryRunConfirm)renderDryRunConfirmCard(messages);
      messages.scrollTop = messages.scrollHeight;
    } catch (err) {
      loading.remove();
      if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
      const errMsg = document.createElement('div');
      errMsg.innerHTML = '<div style="background:#fee;color:#c33;padding:12px 16px;border-radius:12px;font-size:13px;">❌ Error: ' + String(err && err.message ? err.message : err) + '</div>';
      messages.appendChild(errMsg);
    }
  };
})();
