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
