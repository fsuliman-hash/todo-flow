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
let touchState={id:null,startX:0,startY:0,curX:0,curY:0,t:0,timer:null,menuOpened:false,cancelled:false};
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
function taskSourceBadge(r){const m=String(r?.sourceMode||'manual');if(m==='manual')return'';if(m==='chat-ai')return CHAT_UI_ENABLED?'<span class="ctag">🤖 AI chat</span>':'';if(m==='ai-suggest')return'<span class="ctag">✨ AI suggest</span>';if(m==='import')return'<span class="ctag">📥 import</span>';if(m==='auto')return'<span class="ctag">⚙️ auto</span>';return'';}
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
  body.tasks-touch:not(.big-tap) .chk{min-width:44px;min-height:44px}body.tasks-touch:not(.big-tap) .cact{min-width:44px;min-height:44px;width:44px;height:44px;font-size:15px}body.tasks-touch:not(.big-tap) .nlp-btn{min-width:48px;min-height:48px}body.tasks-touch:not(.big-tap) .fbtn{min-height:44px;padding:0 14px}body.tasks-touch:not(.big-tap) .task-filters-toggle{min-height:44px;padding-top:10px;padding-bottom:10px}body.tasks-touch:not(.big-tap) .sort-row select{min-height:44px;font-size:13px}body.tasks-touch:not(.big-tap) #taskList .drag-handle{display:none!important}body.tasks-touch:not(.big-tap).tasks-batch-select #taskList .drag-handle{min-width:40px;min-height:44px;display:inline-flex!important;align-items:center;justify-content:center}
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
