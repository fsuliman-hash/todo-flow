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
    <div class="frow" style="margin-top:8px"><select id="tmplItemCat">${CATS.map(c=>`<option value="${c.key}">${esc(c.icon)} ${esc(c.label)}</option>`).join("")}</select><select id="tmplItemPri">${PRIS.map(p=>`<option value="${p.key}">${p.label}</option>`).join("")}</select></div>
    <button class="sbtn" onclick="saveTemplateForm()" style="margin-top:12px">Save</button></div>`;
  document.body.appendChild(ov);
  renderTemplateItems();
  setTimeout(()=>document.getElementById("tmplName")?.focus(),100);
}
function renderTemplateItems(){
  const wrap=document.getElementById("tmplItems");
  if(!wrap)return;
  if(!window._tmplItems?.length){wrap.innerHTML=`<div class="empty" style="margin:6px 0 0"><div class="empty-t">No items yet</div></div>`;return}
  wrap.innerHTML=window._tmplItems.map((item,i)=>`<div class="card" style="margin:6px 0;padding:10px"><div style="display:grid;grid-template-columns:1fr;gap:8px"><input class="finp" value="${esc(item.title)}" placeholder="Item title" oninput="updTmplItem(${i},'title',this.value)"><div class="frow"><select onchange="updTmplItem(${i},'cat',this.value)">${CATS.map(c=>`<option value="${c.key}"${item.cat===c.key?" selected":""}>${esc(c.icon)} ${esc(c.label)}</option>`).join("")}</select><select onchange="updTmplItem(${i},'pri',this.value)">${PRIS.map(p=>`<option value="${p.key}"${item.pri===p.key?" selected":""}>${p.label}</option>`).join("")}</select></div><div style="display:flex;justify-content:flex-end"><button class="cact" onclick="delTmplItem(${i})">🗑</button></div></div></div>`).join("")
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

