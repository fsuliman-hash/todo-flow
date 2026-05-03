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

