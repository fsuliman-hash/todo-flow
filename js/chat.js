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

  function buildAssistantChatBubbleEl(reply, opts) {
    const titles = opts && Array.isArray(opts.changedTitles) && opts.changedTitles.length ? opts.changedTitles : null;
    const headerText = opts && typeof opts.headerText === 'string' ? opts.headerText : '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:8px;width:100%;';
    const bubble = document.createElement('div');
    bubble.style.cssText = 'background:var(--bg2);padding:12px 16px;border-radius:12px;font-size:13px;max-width:80%;color:var(--text);border:1px solid var(--border);';
    if (titles && headerText) {
      bubble.textContent = headerText;
    } else {
      bubble.textContent = reply;
    }
    wrap.appendChild(bubble);
    if (titles && headerText) {
      const block = document.createElement('div');
      block.style.cssText = 'max-width:80%;';
      const h = document.createElement('div');
      h.style.cssText = 'font-weight:600;margin-bottom:6px;font-size:13px;color:var(--text);';
      h.textContent = 'Last changes:';
      block.appendChild(h);
      const list = document.createElement('div');
      list.style.cssText = 'margin:0 0 8px 0;font-size:13px;color:var(--text2);line-height:1.5;';
      titles.slice(0, 10).forEach(function (t) {
        const line = document.createElement('div');
        line.textContent = '- ' + t;
        list.appendChild(line);
      });
      if (titles.length > 10) {
        const more = document.createElement('div');
        more.style.cssText = 'font-size:12px;color:var(--text3);margin-top:4px;';
        more.textContent = '+' + (titles.length - 10) + ' more';
        list.appendChild(more);
      }
      block.appendChild(list);
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copy changed tasks';
      copyBtn.setAttribute('aria-label', 'Copy changed tasks to clipboard');
      copyBtn.style.cssText = 'border:1px solid var(--border);border-radius:8px;padding:6px 12px;background:var(--bg2);color:var(--text);font-size:12px;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;';
      copyBtn.onclick = function (ev) {
        ev.stopPropagation();
        const body = titles.join('\n');
        const label = 'Copy changed tasks';
        function flash() {
          copyBtn.textContent = 'Copied!';
          setTimeout(function () { copyBtn.textContent = label; }, 1800);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(body).then(flash).catch(function () {
            if (typeof showToast === 'function') showToast('Copy failed', 3000);
          });
        } else {
          try {
            const ta = document.createElement('textarea');
            ta.value = body;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;left:-9999px;top:0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            flash();
          } catch (_e) {
            if (typeof showToast === 'function') showToast('Copy failed', 3000);
          }
        }
      };
      block.appendChild(copyBtn);
      wrap.appendChild(block);
    }
    return wrap;
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
      let lastPlannerChangedTitles = null;
      let lastPlannerReplyHeader = null;
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
                const header=`Executed ${run.executed} planned action${run.executed===1?'':'s'}.\n${lines.join('\n')}`;
                const changedPreview=changed.length
                  ? `\n\nLast changes:\n- ${changed.slice(0,10).join('\n- ')}${changed.length>10?`\n- +${changed.length-10} more`:''}`
                  : '';
                reply=header+changedPreview;
                if(changed.length){
                  lastPlannerChangedTitles=changed.slice();
                  lastPlannerReplyHeader=header;
                }
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
      
      const aiMsg = buildAssistantChatBubbleEl(
        reply,
        lastPlannerChangedTitles && lastPlannerChangedTitles.length && lastPlannerReplyHeader
          ? { changedTitles: lastPlannerChangedTitles, headerText: lastPlannerReplyHeader }
          : null
      );
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
