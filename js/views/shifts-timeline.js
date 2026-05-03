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
