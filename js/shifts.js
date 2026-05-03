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
