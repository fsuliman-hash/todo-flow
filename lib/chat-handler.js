'use strict';

const { callClaudeWithFallback } = require('./anthropic');

const DEFAULT_MODEL_CANDIDATES = [
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-latest',
  'claude-3-5-sonnet-latest',
];

/**
 * Sanitize tasks from client: keep only fields needed for the model (no secrets).
 */
function isUndatedTaskPayload(t) {
  if (!t || typeof t !== 'object') return false;
  if (t.unscheduled === true || t.undated === true) return true;
  const s = String(t.dueDate == null ? '' : t.dueDate).trim();
  if (!s) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && parseInt(s.slice(0, 4), 10) >= 2099) return true;
  return /2099-12-31/i.test(s);
}

function sanitizeTasksForPrompt(rawTasks, maxTasks) {
  if (!Array.isArray(rawTasks)) return [];
  const cap = Math.min(Math.max(0, maxTasks || 45), 60);
  return rawTasks
    .filter((t) => t && typeof t === 'object')
    .slice(0, cap)
    .map((t) => ({
      title: String(t.title || '').trim().slice(0, 200),
      priority: String(t.priority || t.pri || 'medium').slice(0, 20),
      category: String(t.category || t.cat || '').slice(0, 40),
      due: isUndatedTaskPayload(t) ? '' : String(t.dueDate).slice(0, 40),
      completed: !!t.completed,
      overdueHint: String(t.overdueHint || '').slice(0, 20),
    }));
}

function buildTaskSummaryLines(tasks) {
  if (!tasks.length) return 'No tasks were provided (empty list).';
  const pending = tasks.filter((t) => !t.completed);
  const overdue = pending.filter((t) => t.overdueHint === 'overdue');
  const lines = pending.slice(0, 40).map((t, i) => {
    const due = t.due ? ` due:${t.due}` : '';
    return `${i + 1}. [${t.priority}] [${t.category}] ${t.title}${due}${t.completed ? ' (done)' : ''}`;
  });
  let header = `Pending tasks: ${pending.length}.`;
  if (overdue.length) header += ` Overdue (not completed): ${overdue.length}.`;
  return `${header}\n${lines.join('\n')}`;
}

function calendarContextLine(body) {
  const hint = String(body?.todayHint || body?.today || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(hint)) {
    return `Today is ${hint} (client local calendar date). When the user omits a year, use this year. Tasks with no due date must use "" for dueDate in JSON — never use 2099; that year is reserved internally and must not appear in model output.`;
  }
  return 'When the user omits a year, use the current calendar year. For undated tasks use "" for dueDate in JSON — never use year 2099.';
}

function getChatSystemPrompt(taskBlock, body) {
  const cal = calendarContextLine(body || {});
  return [
    'You are the built-in assistant for the Todo Flow productivity app.',
    'You receive a snapshot of the user\'s current tasks (titles, priorities, categories, due timestamps) and their chat message.',
    cal,
    'Give concise, practical answers (usually 2–4 short sentences).',
    'Use plain text only (no markdown headings/lists). Keep the response under 120 words and finish complete sentences.',
    'Reference real tasks from the list when relevant (e.g. overdue count, next due).',
    'The Todo Flow client may run a separate step that actually creates a task when the user asks to add one (you will not see that in this chat API).',
    'The client may also update an existing task (e.g. fix a wrong year) when the user asks to change or correct something.',
    'If the user asks you to add something and you are not sure it was created, suggest a clear title and due date; do not insist they must use the + button unless they are asking how the UI works.',
    '',
    '--- User task snapshot ---',
    taskBlock,
  ].join('\n');
}

/** Strip markdown fences and extract JSON object from model output. */
function parseTaskJsonFromModel(raw) {
  let s = String(raw || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    /* ignore */
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

const ACTION_CATEGORY_KEYS = new Set(['work', 'personal', 'bills', 'health', 'kids', 'school', 'car', 'flowline', 'other']);
const ACTION_PRIORITY_KEYS = new Set(['low', 'medium', 'high', 'critical']);
const ACTION_RECURRENCE_KEYS = new Set(['none', 'daily', 'weekly', 'biweekly', 'monthly', 'weekdays', 'first_mon']);
const PLAN_SCHEMA_VERSION = '1.0';
const PLAN_ACTION_TYPES = new Set([
  'task.create',
  'task.update',
  'task.bulk_update',
  'task.delete_duplicates',
  'task.delete_completed',
  'task.delete_overdue',
  'shift.intent',
  'settings.update',
  'money.expense_add',
  'kids.homework_add',
  'health.medication_log',
]);

function getAllowedCategoryKeys(extraCategories) {
  const out = new Set(ACTION_CATEGORY_KEYS);
  if (Array.isArray(extraCategories)) {
    extraCategories.slice(0, 64).forEach((c) => {
      const raw = typeof c === 'string' ? c : c && typeof c === 'object' ? c.key : '';
      const v = String(raw || '').trim().toLowerCase();
      if (v) out.add(v);
    });
  }
  return out;
}

function sanitizeTaskActionPayload(task, opts) {
  if (!task || typeof task !== 'object') return null;
  const title = String(task.title || '').trim().replace(/\s+/g, ' ').slice(0, 180);
  if (!title) return null;

  const notes = String(task.notes || '').trim().slice(0, 4000);
  const categoryRaw = String(task.category || '').trim().toLowerCase();
  const priorityRaw = String(task.priority || '').trim().toLowerCase();
  const recurrenceRaw = String(task.recurrence || '').trim().toLowerCase();

  const allowedCategories = getAllowedCategoryKeys(opts?.allowedCategories);
  const category = allowedCategories.has(categoryRaw) ? categoryRaw : 'personal';
  const priority = ACTION_PRIORITY_KEYS.has(priorityRaw) ? priorityRaw : 'medium';
  const recurrence = ACTION_RECURRENCE_KEYS.has(recurrenceRaw) ? recurrenceRaw : 'none';

  let dueDate = String(task.dueDate || '').trim();
  let dueTime = String(task.dueTime || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) dueDate = '';
  if (!/^\d{2}:\d{2}$/.test(dueTime)) dueTime = '';

  if (dueDate) {
    const y = parseInt(dueDate.slice(0, 4), 10);
    if (!Number.isFinite(y) || y < 2000 || y >= 2099) dueDate = '';
  }

  if (dueTime) {
    const hh = parseInt(dueTime.slice(0, 2), 10);
    const mm = parseInt(dueTime.slice(3, 5), 10);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) dueTime = '';
  }

  if (!dueDate) dueTime = '';
  return { title, notes, category, priority, dueDate, dueTime, recurrence };
}

function normalizeTaskPatches(rawPatches, opts) {
  if (!rawPatches || typeof rawPatches !== 'object') return null;
  const p = {};
  const allowedCategories = getAllowedCategoryKeys(opts?.allowedCategories);
  if (typeof rawPatches.title === 'string') {
    const v = String(rawPatches.title || '').trim().replace(/\s+/g, ' ').slice(0, 180);
    if (v) p.title = v;
  }
  if (typeof rawPatches.notes === 'string') p.notes = String(rawPatches.notes || '').trim().slice(0, 4000);
  if (typeof rawPatches.category === 'string') {
    const v = String(rawPatches.category || '').trim().toLowerCase();
    if (allowedCategories.has(v)) p.category = v;
  }
  if (typeof rawPatches.priority === 'string') {
    const v = String(rawPatches.priority || '').trim().toLowerCase();
    if (ACTION_PRIORITY_KEYS.has(v)) p.priority = v;
  }
  if (typeof rawPatches.recurrence === 'string') {
    const v = String(rawPatches.recurrence || '').trim().toLowerCase();
    if (ACTION_RECURRENCE_KEYS.has(v)) p.recurrence = v;
  }
  if (typeof rawPatches.dueDate === 'string') {
    const v = String(rawPatches.dueDate || '').trim();
    if (!v || /^\d{4}-\d{2}-\d{2}$/.test(v)) p.dueDate = v;
  }
  if (typeof rawPatches.dueTime === 'string') {
    const v = String(rawPatches.dueTime || '').trim();
    if (!v || /^\d{2}:\d{2}$/.test(v)) p.dueTime = v;
  }
  if (typeof rawPatches.unscheduled === 'boolean') p.unscheduled = !!rawPatches.unscheduled;
  return Object.keys(p).length ? p : null;
}

async function handleChatPayload(body, env) {
  const apiKey = env.CLAUDE_API_KEY || '';
  if (!apiKey) {
    return { status: 503, json: { error: 'CLAUDE_API_KEY is not configured on the server.' } };
  }

  const message = String(body?.message || '').trim();
  if (!message) {
    return { status: 400, json: { error: 'Message is required.' } };
  }

  const history = Array.isArray(body?.history)
    ? body.history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-12)
    : [];

  const tasks = sanitizeTasksForPrompt(body?.tasks, 45);
  const taskBlock = buildTaskSummaryLines(tasks);

  const result = await callClaudeWithFallback(
    (model) => ({
      model,
      max_tokens: 700,
      system: getChatSystemPrompt(taskBlock, body),
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ],
    }),
    {
      apiKey,
      model: env.CLAUDE_MODEL || '',
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
    }
  );

  if (!result.ok) {
    return { status: 502, json: { error: result.error } };
  }

  const reply = result.data?.content?.[0]?.text || 'I could not generate a response.';
  return { status: 200, json: { reply: String(reply).trim(), model: result.model } };
}

async function handleChatActionPayload(body, env) {
  const apiKey = env.CLAUDE_API_KEY || '';
  if (!apiKey) {
    return { status: 503, json: { error: 'CLAUDE_API_KEY is not configured on the server.' } };
  }

  const message = String(body?.message || '').trim();
  if (!message) {
    return { status: 400, json: { error: 'Message is required.' } };
  }

  const context = String(body?.context || '').trim();
  const categoryList = Array.isArray(body?.categories)
    ? body.categories
        .slice(0, 40)
        .map((c) => (typeof c === 'string' ? c : c && typeof c === 'object' ? c.key : ''))
        .map((c) => String(c || '').trim().toLowerCase())
        .filter(Boolean)
    : [];
  const categoryHint = categoryList.length
    ? `\nAllowed categories: ${categoryList.join(', ')}. Prefer these when assigning category.`
    : '';
  const userContent = context
    ? `Prior conversation (use it to resolve "it", "this", "that", or short follow-ups):\n${context}\n\nLatest user message — extract exactly ONE new task:\n${message}`
    : message;

  const cal = calendarContextLine(body);
  const result = await callClaudeWithFallback(
    (model) => ({
      model,
      max_tokens: 400,
      system:
        cal +
        '\nYou extract exactly one actionable task for Todo Flow. Use the full thread: pronouns like "it" refer to the assistant\'s last suggestion or the user\'s prior wording.\nReturn ONLY a strict JSON object (no prose) with keys: title (string), notes (string), category (work|personal|bills|health|kids|school|car|flowline|other), priority (low|medium|high|critical), dueDate (YYYY-MM-DD or ""), dueTime (HH:MM 24h or ""), recurrence (none|daily|weekly|biweekly|monthly|weekdays|first_mon). Use "" for unknown dates/times and sensible defaults.' +
        categoryHint,
      messages: [{ role: 'user', content: userContent }],
    }),
    {
      apiKey,
      model: env.CLAUDE_MODEL || '',
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
    }
  );

  if (!result.ok) {
    return { status: 502, json: { error: result.error } };
  }

  const content = String(result.data?.content?.[0]?.text || '').trim();
  const task = parseTaskJsonFromModel(content);
  if (!task || typeof task !== 'object' || !String(task.title || '').trim()) {
    return { status: 502, json: { error: 'Could not parse task JSON from Claude.' } };
  }
  const cleaned = sanitizeTaskActionPayload(task, { allowedCategories: body?.categories });
  if (!cleaned) {
    return { status: 502, json: { error: 'Claude task output was invalid.' } };
  }

  return { status: 200, json: { task: cleaned, model: result.model } };
}

function normalizeParsedTaskItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').trim().replace(/\s+/g, ' ').slice(0, 180);
  if (!title) return null;
  const notes = String(raw.notes || '').trim().slice(0, 4000);
  const dueRaw = String(raw.due_at || raw.dueAt || '').trim();
  if (!dueRaw) return { title, notes, due_at: '' };
  const parsedMs = Date.parse(dueRaw);
  if (!Number.isFinite(parsedMs)) return null;
  // Keep model-provided timestamp as-is to avoid server-timezone day drift.
  // Client-side parsing happens in the user's own timezone context.
  return { title, notes, due_at: dueRaw };
}

async function handleParseTasksPayload(body, env) {
  const apiKey = env.CLAUDE_API_KEY || '';
  if (!apiKey) {
    return { status: 503, json: { error: 'CLAUDE_API_KEY is not configured on the server.' } };
  }
  const input = String(body?.input || body?.message || '').trim();
  if (!input) {
    return { status: 400, json: { error: 'Input text is required.' } };
  }
  const anchorDate = String(body?.anchorDate || body?.todayHint || '').trim();
  const anchorNowIso = String(body?.anchorNowIso || '').trim();
  const timezone = String(body?.timezone || '').trim() || 'UTC';
  const result = await callClaudeWithFallback(
    (model) => ({
      model,
      max_tokens: 800,
      system:
        'You are a task parsing engine for a todo app.\n' +
        'Output valid JSON only.\n' +
        'Do not include markdown, code fences, or prose.\n' +
        'Output schema:\n' +
        '{"tasks":[{"title":"string","due_at":"ISO-8601 timestamp string or empty string","notes":"string"}]}\n' +
        'Rules:\n' +
        '- Split into separate tasks when the user clearly lists multiple items (commas, "and", or new lines).\n' +
        '- Keep meaningful title text; trim only surrounding whitespace.\n' +
        '- Resolve relative dates like "Tuesday", "next Friday", and "by the 1st" using the provided anchor date/time context.\n' +
        '- If the user explicitly names a weekday (e.g. Tuesday), due_at MUST land on that same weekday in the provided timezone.\n' +
        '- Never shift an explicit weekday by timezone conversion; preserve the user-intended local calendar day.\n' +
        '- Return due_at as full ISO-8601 date-time including timezone offset when possible (example: 2026-05-05T13:00:00-04:00).\n' +
        '- If a dated task has no explicit time, default to 09:00 local time.\n' +
        '- If no date is present, set due_at to "".\n' +
        '- notes should be "" unless brief extra context is explicitly present.\n' +
        '- If the input is non-actionable noise, return {"tasks":[]}.\n' +
        '- Return JSON only.',
      messages: [
        {
          role: 'user',
          content:
            `Anchor date: ${anchorDate || '(unknown)'}\n` +
            `Anchor timestamp: ${anchorNowIso || '(unknown)'}\n` +
            `Timezone: ${timezone}\n\n` +
            `Input:\n${input}`,
        },
      ],
    }),
    {
      apiKey,
      model: env.CLAUDE_MODEL || '',
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
    }
  );
  if (!result.ok) {
    return { status: 502, json: { error: result.error } };
  }
  const content = String(result.data?.content?.[0]?.text || '').trim();
  const parsed = parseTaskJsonFromModel(content);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) {
    return { status: 502, json: { error: 'Claude returned invalid task JSON.' } };
  }
  const tasks = parsed.tasks.slice(0, 25).map(normalizeParsedTaskItem).filter(Boolean);
  return { status: 200, json: { tasks, model: result.model } };
}

function sanitizeTasksForEditPrompt(rawTasks, maxTasks) {
  if (!Array.isArray(rawTasks)) return [];
  const cap = Math.min(Math.max(0, maxTasks || 50), 80);
  return rawTasks
    .filter((t) => t && typeof t === 'object')
    .slice(0, cap)
    .map((t) => ({
      id: String(t.id || '').trim().slice(0, 80),
      title: String(t.title || '').trim().slice(0, 220),
      priority: String(t.priority || '').slice(0, 24),
      category: String(t.category || '').slice(0, 48),
      due: isUndatedTaskPayload(t) ? '(no due date)' : String(t.dueDate || '').slice(0, 40),
      completed: !!t.completed,
    }));
}

function buildTaskListBlockForEdit(tasks) {
  if (!tasks.length) return 'No tasks in list.';
  return tasks
    .map((t, i) => {
      const done = t.completed ? ' DONE' : '';
      return `${i + 1}. id=${t.id} | ${t.title} | due:${t.due || '(unscheduled)'} | [${t.category}] [${t.priority}]${done}`;
    })
    .join('\n');
}

async function handleChatEditPayload(body, env) {
  const apiKey = env.CLAUDE_API_KEY || '';
  if (!apiKey) {
    return { status: 503, json: { error: 'CLAUDE_API_KEY is not configured on the server.' } };
  }

  const message = String(body?.message || '').trim();
  if (!message) {
    return { status: 400, json: { error: 'Message is required.' } };
  }

  const tasks = sanitizeTasksForEditPrompt(body?.tasks, 55);
  const taskBlock = buildTaskListBlockForEdit(tasks);
  const context = String(body?.context || '').trim();
  const userContent = context
    ? `Prior conversation:\n${context}\n\n--- Tasks (pending). Use exact id= value for taskId. ---\n${taskBlock}\n\nUser request (apply at most ONE task update):\n${message}`
    : `--- Tasks (pending). Use exact id= value for taskId. ---\n${taskBlock}\n\nUser request:\n${message}`;

  const cal = calendarContextLine(body);
  const result = await callClaudeWithFallback(
    (model) => ({
      model,
      max_tokens: 550,
      system:
        cal +
        '\nYou update at most ONE task in Todo Flow from the user message and task list.\n' +
        'Return ONLY strict JSON (no markdown, no prose):\n' +
        '{"action":"none"} — if you cannot identify a single task or no change is requested.\n' +
        '{"action":"update","taskId":"<copy exact id from list>","matchTitle":"<optional short substring of title for fallback>","patches":{...}} — otherwise.\n' +
        'Allowed patch keys (omit keys you do not change): title (string), notes (string), category (work|personal|bills|health|kids|school|car|flowline|other), priority (low|medium|high|critical), recurrence (none|daily|weekly|biweekly|monthly|weekdays|first_mon), dueDate (YYYY-MM-DD or ""), dueTime (HH:MM 24h), unscheduled (boolean).\n' +
        'If the user fixes a year, set dueDate to the corrected YYYY-MM-DD and unscheduled false. Never set a year to 2099. For "no date" use unscheduled true and omit dueDate or use "".',
      messages: [{ role: 'user', content: userContent }],
    }),
    {
      apiKey,
      model: env.CLAUDE_MODEL || '',
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
    }
  );

  if (!result.ok) {
    return { status: 502, json: { error: result.error } };
  }

  const content = String(result.data?.content?.[0]?.text || '').trim();
  const parsed = parseTaskJsonFromModel(content);
  if (!parsed || typeof parsed !== 'object') {
    return { status: 502, json: { error: 'Could not parse edit JSON from Claude.' } };
  }
  if (parsed.action === 'none' || !parsed.action) {
    return { status: 200, json: { edit: null, model: result.model } };
  }
  if (parsed.action !== 'update' || !parsed.patches || typeof parsed.patches !== 'object') {
    return { status: 502, json: { error: 'Invalid edit JSON from Claude.' } };
  }
  if (!String(parsed.taskId || '').trim() && !String(parsed.matchTitle || '').trim()) {
    return { status: 502, json: { error: 'Edit JSON must include taskId or matchTitle.' } };
  }

  return { status: 200, json: { edit: parsed, model: result.model } };
}

const PRI_KEYS = new Set(['low', 'medium', 'high', 'critical']);
const EFFORT_KEYS = new Set(['', '5', '15', '30', '60', '120']);

function normalizeAiCategory(parsed, categories) {
  const list = Array.isArray(categories) ? categories.filter((c) => c && c.key) : [];
  const raw = String(parsed?.category || '').trim().toLowerCase();
  if (!raw && list[0]) return list[0].key;
  const byKey = list.find((c) => String(c.key).toLowerCase() === raw);
  if (byKey) return byKey.key;
  const byLabel = list.find((c) => c.label && String(c.label).trim().toLowerCase() === raw);
  if (byLabel) return byLabel.key;
  const partial = list.find(
    (c) =>
      raw.length >= 4 &&
      (String(c.key).toLowerCase().includes(raw) || (c.label && String(c.label).toLowerCase().includes(raw)))
  );
  if (partial) return partial.key;
  return list[0]?.key || 'personal';
}

function normalizeAiPriority(parsed) {
  const p = String(parsed?.priority || '').trim().toLowerCase();
  if (PRI_KEYS.has(p)) return p;
  if (p === 'med' || p === 'medium') return 'medium';
  return 'medium';
}

function normalizeAiEffort(parsed) {
  const e = String(parsed?.effort != null ? parsed.effort : '').trim();
  if (EFFORT_KEYS.has(e)) return e;
  return '';
}

async function handleChatCategorizePayload(body, env) {
  const apiKey = env.CLAUDE_API_KEY || '';
  if (!apiKey) {
    return { status: 503, json: { error: 'CLAUDE_API_KEY is not configured on the server.' } };
  }

  const title = String(body?.title || '').trim();
  if (title.length < 2) {
    return { status: 400, json: { error: 'Title is required.' } };
  }

  const notes = String(body?.notes || '').trim();
  const categories = Array.isArray(body?.categories) ? body.categories.filter((c) => c && c.key).slice(0, 24) : [];
  const catLine =
    categories.length > 0
      ? `Allowed category keys (output must be exactly one key string): ${categories.map((c) => `${c.key}${c.label ? ` (${c.label})` : ''}`).join(', ')}.`
      : 'Allowed keys: work, personal, bills, health, kids, school, car, flowline, other.';

  const cal = calendarContextLine(body);
  const result = await callClaudeWithFallback(
    (model) => ({
      model,
      max_tokens: 220,
      system:
        cal +
        '\nYou classify one reminder for the Todo Flow app. ' +
        catLine +
        '\nReturn ONLY strict JSON (no markdown): {"category":"<key>","priority":"low|medium|high|critical","effort":"|5|15|30|60|120","reason":"<one short sentence why>"}\n' +
        'effort: use "" if unsure. priority: default medium unless urgency/deadline clearly warrants higher.',
      messages: [{ role: 'user', content: `Title:\n${title}\n\nNotes:\n${notes || '(none)'}` }],
    }),
    {
      apiKey,
      model: env.CLAUDE_MODEL || '',
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
    }
  );

  if (!result.ok) {
    return { status: 502, json: { error: result.error } };
  }

  const content = String(result.data?.content?.[0]?.text || '').trim();
  const parsed = parseTaskJsonFromModel(content);
  if (!parsed || typeof parsed !== 'object') {
    return { status: 502, json: { error: 'Could not parse category JSON from Claude.' } };
  }

  const category = normalizeAiCategory(parsed, categories);
  const priority = normalizeAiPriority(parsed);
  const effort = normalizeAiEffort(parsed);
  const reason = String(parsed.reason || '').trim().slice(0, 200);

  return {
    status: 200,
    json: {
      category,
      priority,
      effort,
      reason,
      model: result.model,
    },
  };
}

async function handleChatShiftPayload(body, env) {
  const apiKey = env.CLAUDE_API_KEY || '';
  if (!apiKey) {
    return { status: 503, json: { error: 'CLAUDE_API_KEY is not configured on the server.' } };
  }

  const message = String(body?.message || '').trim();
  if (!message) {
    return { status: 400, json: { error: 'Message is required.' } };
  }

  const context = String(body?.context || '').trim();
  const shiftSnapshot = Array.isArray(body?.shifts)
    ? body.shifts
        .filter((s) => s && typeof s === 'object')
        .slice(-50)
        .map((s) => ({
          date: String(s.date || '').slice(0, 10),
          type: String(s.type || '').slice(0, 80),
          start: String(s.start || '').slice(0, 10),
          end: String(s.end || '').slice(0, 10),
          notes: String(s.notes || '').slice(0, 120),
          onCall: !!s.onCall,
        }))
    : [];
  const shiftBlock = shiftSnapshot.length
    ? shiftSnapshot
        .map((s, i) => `${i + 1}. ${s.date} | ${s.type} | ${s.start || '--'}-${s.end || '--'}${s.onCall ? ' | on-call' : ''}`)
        .join('\n')
    : 'No current shift entries were provided.';
  const userContent = context
    ? `Prior conversation:\n${context}\n\nCurrent shifts snapshot:\n${shiftBlock}\n\nLatest user message:\n${message}`
    : `Current shifts snapshot:\n${shiftBlock}\n\nLatest user message:\n${message}`;

  const cal = calendarContextLine(body);
  const result = await callClaudeWithFallback(
    (model) => ({
      model,
      max_tokens: 650,
      system:
        cal +
        '\nExtract shift entries for Todo Flow Shifts page.\n' +
        'Return ONLY strict JSON (no markdown):\n' +
        '{"entries":[{"date":"YYYY-MM-DD","type":"string","start":"HH:MM","end":"HH:MM","notes":"string","onCall":false}]}\n' +
        'Rules:\n' +
        '- Include one entry per day/shift explicitly mentioned.\n' +
        '- If user asks to fix/redo/move existing shifts, use the provided current shifts snapshot as source and return corrected entries.\n' +
        '- Off days: set type to "Off", leave start/end as "".\n' +
        '- If a day has no year, use current year from context.\n' +
        '- Use 24h HH:MM.\n' +
        '- If nothing actionable, return {"entries":[]}.',
      messages: [{ role: 'user', content: userContent }],
    }),
    {
      apiKey,
      model: env.CLAUDE_MODEL || '',
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
    }
  );

  if (!result.ok) {
    return { status: 502, json: { error: result.error } };
  }

  const content = String(result.data?.content?.[0]?.text || '').trim();
  const parsed = parseTaskJsonFromModel(content);
  if (!parsed || typeof parsed !== 'object') {
    return { status: 502, json: { error: 'Could not parse shift JSON from Claude.' } };
  }
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  return { status: 200, json: { plan: { entries }, model: result.model } };
}

async function handleChatShiftIntentPayload(body, env) {
  const apiKey = env.CLAUDE_API_KEY || '';
  if (!apiKey) {
    return { status: 503, json: { error: 'CLAUDE_API_KEY is not configured on the server.' } };
  }

  const message = String(body?.message || '').trim();
  if (!message) {
    return { status: 400, json: { error: 'Message is required.' } };
  }

  const context = String(body?.context || '').trim();
  const shiftSnapshot = Array.isArray(body?.shifts)
    ? body.shifts
        .filter((s) => s && typeof s === 'object')
        .slice(-60)
        .map((s) => ({
          date: String(s.date || '').slice(0, 10),
          type: String(s.type || '').slice(0, 80),
          start: String(s.start || '').slice(0, 10),
          end: String(s.end || '').slice(0, 10),
        }))
    : [];
  const shiftBlock = shiftSnapshot.length
    ? shiftSnapshot.map((s, i) => `${i + 1}. ${s.date} | ${s.type} | ${s.start || '--'}-${s.end || '--'}`).join('\n')
    : 'No current shifts.';
  const userContent = context
    ? `Prior conversation:\n${context}\n\nCurrent shifts snapshot:\n${shiftBlock}\n\nUser message:\n${message}`
    : `Current shifts snapshot:\n${shiftBlock}\n\nUser message:\n${message}`;

  const cal = calendarContextLine(body);
  const result = await callClaudeWithFallback(
    (model) => ({
      model,
      max_tokens: 500,
      system:
        cal +
        '\nYou are an intent parser for Todo Flow Shifts actions. Return ONLY strict JSON.\n' +
        'Output schema:\n' +
        '{"action":"delete_week|move_week|set_day_off|set_day_shift|replace_week_schedule|clarify|none","weekRef":"next_week|this_week","day":"sunday|monday|tuesday|wednesday|thursday|friday|saturday","days":-2..2,"type":"string","start":"HH:MM|","end":"HH:MM|","notes":"string","entries":[{"day":"sunday..saturday","type":"string","start":"HH:MM|","end":"HH:MM|","notes":"string"}],"question":"string","confidence":0.0}\n' +
        'Rules:\n' +
        '- For "delete all shifts for next week" => action=delete_week, weekRef=next_week.\n' +
        '- For "move one day up/earlier" => action=move_week, days=-1.\n' +
        '- For "move one day down/later" => action=move_week, days=1.\n' +
        '- For "Sunday I am off" => action=set_day_off with day=sunday.\n' +
        '- If user asks to redo/fix a weekly schedule, use replace_week_schedule with entries.\n' +
        '- If ambiguous, use action=clarify with a short question.\n' +
        '- Never include markdown or prose outside JSON.',
      messages: [{ role: 'user', content: userContent }],
    }),
    {
      apiKey,
      model: env.CLAUDE_MODEL || '',
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
    }
  );

  if (!result.ok) {
    return { status: 502, json: { error: result.error } };
  }

  const content = String(result.data?.content?.[0]?.text || '').trim();
  const intent = parseTaskJsonFromModel(content);
  if (!intent || typeof intent !== 'object') {
    return { status: 502, json: { error: 'Could not parse shift intent JSON from Claude.' } };
  }
  return { status: 200, json: { intent, model: result.model } };
}

function sanitizeChatPlanActions(rawActions, opts) {
  const out = [];
  let dropped = 0;
  const cap = Math.min(Math.max(1, Number(opts?.actionCap) || 20), 50);
  const arr = Array.isArray(rawActions) ? rawActions : [];
  arr.slice(0, cap).forEach((a) => {
    if (!a || typeof a !== 'object') return;
    const type = String(a.type || '').trim().toLowerCase();
    if (!PLAN_ACTION_TYPES.has(type)) {
      dropped += 1;
      return;
    }
    const risk = ['low', 'medium', 'high'].includes(String(a.risk || '').toLowerCase())
      ? String(a.risk).toLowerCase()
      : 'medium';
    if (type === 'task.create') {
      const task = sanitizeTaskActionPayload(a.task || a.payload || {}, { allowedCategories: opts?.allowedCategories });
      if (!task) return;
      out.push({ type, risk, task });
      return;
    }
    if (type === 'task.update') {
      const edit = a.edit && typeof a.edit === 'object' ? a.edit : null;
      const patches = normalizeTaskPatches(edit?.patches, { allowedCategories: opts?.allowedCategories });
      if (!edit || !patches) {
        dropped += 1;
        return;
      }
      const taskId = String(edit.taskId || '').trim();
      const matchTitle = String(edit.matchTitle || '').trim();
      if (!taskId && !matchTitle) {
        dropped += 1;
        return;
      }
      out.push({
        type,
        risk,
        edit: {
          action: 'update',
          taskId,
          matchTitle,
          patches,
        },
      });
      return;
    }
    if (type === 'task.bulk_update') {
      const updates = Array.isArray(a.updates) ? a.updates : [];
      const cleaned = updates
        .slice(0, cap)
        .map((u) => {
          if (!u || typeof u !== 'object') return null;
          const patches = normalizeTaskPatches(u.patches, { allowedCategories: opts?.allowedCategories });
          if (!patches) return null;
          const taskId = String(u.taskId || '').trim();
          const matchTitle = String(u.matchTitle || '').trim();
          if (!taskId && !matchTitle) return null;
          return {
            action: 'update',
            taskId,
            matchTitle,
            patches,
          };
        })
        .filter(Boolean);
      if (!cleaned.length) {
        dropped += 1;
        return;
      }
      out.push({ type, risk, updates: cleaned });
      return;
    }
    if (type === 'task.delete_duplicates' || type === 'task.delete_completed' || type === 'task.delete_overdue') {
      out.push({ type, risk: 'high' });
      return;
    }
    if (type === 'settings.update') {
      const updates = a.updates && typeof a.updates === 'object' ? a.updates : null;
      if (!updates) return;
      const allow = {};
      if (typeof updates.chatDryRun === 'boolean') allow.chatDryRun = updates.chatDryRun;
      if (Number.isFinite(Number(updates.chatActionCap))) {
        allow.chatActionCap = Math.max(1, Math.min(200, Number(updates.chatActionCap)));
      }
      if (typeof updates.chatAutonomyMode === 'string') {
        const m = String(updates.chatAutonomyMode).toLowerCase();
        if (m === 'assistive' || m === 'agentic') allow.chatAutonomyMode = m;
      }
      if (!Object.keys(allow).length) {
        dropped += 1;
        return;
      }
      out.push({ type, risk, updates: allow });
      return;
    }
    if (type === 'money.expense_add') {
      const exp = a.expense && typeof a.expense === 'object' ? a.expense : null;
      if (!exp) {
        dropped += 1;
        return;
      }
      const title = String(exp.title || '').trim().slice(0, 160);
      if (!title) {
        dropped += 1;
        return;
      }
      const amount = Number(exp.amount);
      const category = String(exp.category || 'Other').trim().slice(0, 60) || 'Other';
      out.push({
        type,
        risk,
        expense: {
          title,
          amount: Number.isFinite(amount) ? amount : 0,
          category,
          date: String(exp.date || '').trim().slice(0, 40),
        },
      });
      return;
    }
    if (type === 'kids.homework_add') {
      const hw = a.homework && typeof a.homework === 'object' ? a.homework : null;
      if (!hw) {
        dropped += 1;
        return;
      }
      const title = String(hw.title || '').trim().slice(0, 160);
      if (!title) {
        dropped += 1;
        return;
      }
      out.push({
        type,
        risk,
        homework: {
          childId: String(hw.childId || '').trim().slice(0, 80),
          subject: String(hw.subject || 'General').trim().slice(0, 80) || 'General',
          title,
          grade: String(hw.grade || '').trim().slice(0, 80),
          date: String(hw.date || '').trim().slice(0, 40),
        },
      });
      return;
    }
    if (type === 'health.medication_log') {
      const med = a.medicationLog && typeof a.medicationLog === 'object' ? a.medicationLog : null;
      if (!med) {
        dropped += 1;
        return;
      }
      out.push({
        type,
        risk,
        medicationLog: {
          medId: String(med.medId || '').trim().slice(0, 80),
          dose: String(med.dose || '').trim().slice(0, 80),
          childId: String(med.childId || '').trim().slice(0, 80),
          date: String(med.date || '').trim().slice(0, 40),
        },
      });
      return;
    }
    if (type === 'shift.intent') {
      const intent = a.intent && typeof a.intent === 'object' ? a.intent : (a.payload && typeof a.payload === 'object' ? a.payload : null);
      if (!intent) {
        dropped += 1;
        return;
      }
      out.push({ type, risk, intent });
    }
  });
  return { actions: out, dropped, cap };
}

async function handleChatPlanPayload(body, env) {
  const apiKey = env.CLAUDE_API_KEY || '';
  if (!apiKey) {
    return { status: 503, json: { error: 'CLAUDE_API_KEY is not configured on the server.' } };
  }
  const message = String(body?.message || '').trim();
  if (!message) {
    return { status: 400, json: { error: 'Message is required.' } };
  }
  const context = String(body?.context || '').trim();
  const tasks = sanitizeTasksForEditPrompt(body?.tasks, 80);
  const taskBlock = buildTaskListBlockForEdit(tasks);
  const shiftSnapshot = Array.isArray(body?.shifts)
    ? body.shifts
        .filter((s) => s && typeof s === 'object')
        .slice(-60)
        .map((s) => ({
          date: String(s.date || '').slice(0, 10),
          type: String(s.type || '').slice(0, 80),
          start: String(s.start || '').slice(0, 10),
          end: String(s.end || '').slice(0, 10),
        }))
    : [];
  const shiftBlock = shiftSnapshot.length
    ? shiftSnapshot.map((s, i) => `${i + 1}. ${s.date} | ${s.type} | ${s.start || '--'}-${s.end || '--'}`).join('\n')
    : 'No current shifts.';
  const userContent = context
    ? `Prior conversation:\n${context}\n\nTasks snapshot:\n${taskBlock}\n\nShifts snapshot:\n${shiftBlock}\n\nUser request:\n${message}`
    : `Tasks snapshot:\n${taskBlock}\n\nShifts snapshot:\n${shiftBlock}\n\nUser request:\n${message}`;
  const moduleSummary = body?.moduleSummary && typeof body.moduleSummary === 'object' ? body.moduleSummary : {};
  const plannerCategories = Array.isArray(body?.categories)
    ? body.categories
        .slice(0, 40)
        .map((c) => (typeof c === 'string' ? c : c && typeof c === 'object' ? c.key : ''))
        .map((c) => String(c || '').trim().toLowerCase())
        .filter(Boolean)
    : [];
  const moduleLine = `Module summary: expenses=${Number(moduleSummary.expensesCount||0)}, homework=${Number(moduleSummary.homeworkCount||0)}, medicationLogs=${Number(moduleSummary.medicationLogCount||0)}, children=${Number(moduleSummary.childrenCount||0)}.`;
  const categoryCounts = moduleSummary?.categoryCounts && typeof moduleSummary.categoryCounts === 'object'
    ? Object.entries(moduleSummary.categoryCounts)
        .slice(0, 12)
        .map(([k, v]) => `${String(k).slice(0, 40)}:${Number(v || 0)}`)
        .join(', ')
    : '';
  const expenseHints = Array.isArray(moduleSummary?.recentExpenses)
    ? moduleSummary.recentExpenses
        .slice(0, 5)
        .map((e) => `${String(e?.title || '').slice(0, 40)} (${Number(e?.amount || 0) || 0})`)
        .filter(Boolean)
        .join('; ')
    : '';
  const homeworkHints = Array.isArray(moduleSummary?.recentHomework)
    ? moduleSummary.recentHomework
        .slice(0, 5)
        .map((h) => `${String(h?.title || '').slice(0, 40)}${h?.child ? ` for ${String(h.child).slice(0, 30)}` : ''}`)
        .filter(Boolean)
        .join('; ')
    : '';
  const medicationHints = Array.isArray(moduleSummary?.recentMedicationLogs)
    ? moduleSummary.recentMedicationLogs
        .slice(0, 5)
        .map((m) => `${String(m?.medication || '').slice(0, 40)}${m?.child ? ` for ${String(m.child).slice(0, 30)}` : ''}`)
        .filter(Boolean)
        .join('; ')
    : '';
  const childHints = Array.isArray(moduleSummary?.children)
    ? moduleSummary.children.slice(0, 8).map((c) => String(c || '').slice(0, 30)).filter(Boolean).join(', ')
    : '';

  const cal = calendarContextLine(body);
  const result = await callClaudeWithFallback(
    (model) => ({
      model,
      max_tokens: 900,
      system:
        cal +
        '\nYou are a planner for Todo Flow. Convert user request into an executable action list.' +
        '\n' + moduleLine +
        (plannerCategories.length ? `\nAllowed categories: ${plannerCategories.join(', ')}.` : '') +
        (categoryCounts ? `\nActive task categories: ${categoryCounts}.` : '') +
        (expenseHints ? `\nRecent expenses: ${expenseHints}.` : '') +
        (homeworkHints ? `\nRecent homework: ${homeworkHints}.` : '') +
        (medicationHints ? `\nRecent medication logs: ${medicationHints}.` : '') +
        (childHints ? `\nChildren: ${childHints}.` : '') +
        '\nReturn ONLY strict JSON with this schema:' +
        '\n{"assistantReply":"short plain-text summary","actions":[{"type":"task.create|task.update|task.bulk_update|task.delete_duplicates|task.delete_completed|task.delete_overdue|shift.intent|settings.update|money.expense_add|kids.homework_add|health.medication_log","risk":"low|medium|high","task":{},"edit":{},"updates":{},"intent":{},"expense":{},"homework":{},"medicationLog":{}}]}' +
        '\nRules:' +
        '\n- Prefer specific actions over prose.' +
        '\n- Keep actions ordered exactly as they should run.' +
        '\n- If no mutation is needed, return actions:[] and provide assistantReply.' +
        '\n- For task.create, include task object fields: title, notes, category, priority, dueDate, dueTime, recurrence.' +
        '\n- For task.update, include edit object: taskId or matchTitle, patches.' +
        '\n- For task.bulk_update, include updates:[{taskId|matchTitle, patches}] for batch recategorize/reprioritize/date fixes.' +
        '\n- For shift changes, use type=shift.intent with an intent payload compatible with shift-intent parser schema.' +
        '\n- For settings.update, only use allowlisted updates: chatDryRun (bool), chatActionCap (1..200), chatAutonomyMode (assistive|agentic).' +
        '\n- For money.expense_add include expense:{title,amount,category,date?}.' +
        '\n- For kids.homework_add include homework:{childId?,subject,title,grade?,date?}.' +
        '\n- For health.medication_log include medicationLog:{medId?,dose?,childId?,date?}.',
      messages: [{ role: 'user', content: userContent }],
    }),
    {
      apiKey,
      model: env.CLAUDE_MODEL || '',
      modelCandidates: DEFAULT_MODEL_CANDIDATES,
    }
  );
  if (!result.ok) {
    return { status: 502, json: { error: result.error } };
  }
  const content = String(result.data?.content?.[0]?.text || '').trim();
  const parsed = parseTaskJsonFromModel(content);
  if (!parsed || typeof parsed !== 'object') {
    return { status: 502, json: { error: 'Could not parse action plan JSON from Claude.' } };
  }
  const sanitized = sanitizeChatPlanActions(parsed.actions, { actionCap: body?.actionCap, allowedCategories: body?.categories });
  const assistantReply = String(parsed.assistantReply || '').trim().slice(0, 500);
  const planPayload = {
    version: PLAN_SCHEMA_VERSION,
    actionCapApplied: sanitized.cap,
    droppedActions: sanitized.dropped,
    actions: sanitized.actions,
    assistantReply,
  };
  return {
    status: 200,
    json: {
      version: PLAN_SCHEMA_VERSION,
      actions: sanitized.actions,
      assistantReply,
      actionCapApplied: sanitized.cap,
      droppedActions: sanitized.dropped,
      plan: planPayload,
      model: result.model,
    },
  };
}

module.exports = {
  handleChatPayload,
  handleChatActionPayload,
  handleParseTasksPayload,
  handleChatEditPayload,
  handleChatCategorizePayload,
  handleChatShiftPayload,
  handleChatShiftIntentPayload,
  handleChatPlanPayload,
  sanitizeTasksForPrompt,
  parseTaskJsonFromModel,
};
