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
