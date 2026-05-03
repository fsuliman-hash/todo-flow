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
  h+=`<div class="sc"><h4>By Category</h4>${catStats.map(c=>`<div class="sb-r"><span class="sb-l">${esc(c.icon)} ${esc(c.label)}</span><div class="sb-t"><div class="sb-f" style="width:${(c.count/maxC)*100}%;background:${c.color}"></div></div><span style="font-size:11px;font-weight:700;width:22px;text-align:right">${c.count}</span></div>`).join("")}</div>`;
  if(timeLogs.length){const total=timeLogs.reduce((a,l)=>a+l.duration,0);h+=`<div class="sc"><h4>Time Tracked</h4><div class="sm-n" style="text-align:center">${fmtDur(total)}</div></div>`}
  h+=`</div>`;return h;
}

