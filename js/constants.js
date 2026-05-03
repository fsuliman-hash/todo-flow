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
const CHAT_UI_ENABLED=false;

let R=[],S={...SETTINGS_DEFAULTS},habits=[],shifts=[],timeLogs=[],templates=[],routines=[],trash=[],waterLog={},dispatches=[];
let view="tasks",filter="all",sortBy=localStorage.getItem("rp3_sort")||"date",search=localStorage.getItem("rp3_search")||"",calDate=new Date(),calSel=null,editId=null,notified=new Set();
let pomoActive=false,pomoId=null,pomoEnd=0,pomoBreak=false,pomoInterval=null;
let ttActive=null,ttStart=0,ttInterval=null;
let listening=false,dragId=null,notifInterval=null,searchTimer=null,nlpTimer=null,nlpDraft="",nlpParsing=false;
let completedSectionExpanded=false;
let taskFiltersOpen=localStorage.getItem("rp3_taskFiltersOpen")==="1";
let batchMode=false,batchSelected=new Set();
let tasksBatchMode=false,tasksBatchSelected=new Set();

