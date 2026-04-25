// ==================== AI MODULE ====================
// Deprecated for production: calls Anthropic from the browser (key exposure + CORS).
// Use /api/chat via server.js or Vercel `api/chat.js` instead. Kept for reference only.
class AIAssistant {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.model = 'claude-3-5-sonnet-20241022';
    this.maxTokens = 1024;
    this.isAnalyzing = false;
  }

  async analyzeTask(input) {
    if (!input.trim()) return null;
    if (!this.apiKey) return null;
    
    this.isAnalyzing = true;
    const listeners = this.listeners || [];
    listeners.forEach(cb => cb({ analyzing: true }));

    try {
      const systemPrompt = `You are a productivity assistant. Analyze the user's task input and return ONLY valid JSON (no markdown, no extra text) with:
{
  "title": "cleaned task title",
  "category": "work|personal|bills|health|kids|school|car|flowline|other",
  "priority": "low|medium|high|critical",
  "dueDate": "YYYY-MM-DD or null",
  "dueTime": "HH:MM or null",
  "notes": "additional notes or null",
  "recurrence": "none|daily|weekly|biweekly|monthly|weekdays|first_mon",
  "suggestion": "brief helpful suggestion"
}

Categories: work, personal, bills, health, kids, school, car, flowline, other
Priorities: low, medium, high, critical
Recurrence: none, daily, weekly, biweekly, monthly, weekdays, first_mon

Be smart about:
- Extracting dates (today, tomorrow, next Monday, etc)
- Extracting times (3pm, 14:30, etc)
- Inferring category from keywords (doctor→health, rent→bills, homework→school)
- Inferring priority (urgent/critical→high/critical, ASAP→high)
- Detecting recurring patterns (every day, weekly, etc)`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          system: systemPrompt,
          messages: [
            { role: 'user', content: input }
          ]
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'AI analysis failed');
      }

      const data = await response.json();
      const content = data.content[0].text;

      // Parse JSON response
      let result = JSON.parse(content);
      
      // Validate and clean result
      result = {
        title: String(result.title || input).trim(),
        category: CATS.some(c => c.key === result.category) ? result.category : 'personal',
        priority: PRIS.some(p => p.key === result.priority) ? result.priority : 'medium',
        dueDate: result.dueDate || null,
        dueTime: result.dueTime || null,
        notes: result.notes || null,
        recurrence: RECS.some(r => r.key === result.recurrence) ? result.recurrence : 'none',
        suggestion: String(result.suggestion || '')
      };

      this.isAnalyzing = false;
      listeners.forEach(cb => cb({ analyzing: false, result }));
      return result;
    } catch (err) {
      console.error('AI analysis error:', err);
      this.isAnalyzing = false;
      listeners.forEach(cb => cb({ analyzing: false, error: err.message }));
      return null;
    }
  }

  async generateSuggestions(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) return [];
    if (!this.apiKey) return [];

    try {
      const prompt = `Based on these tasks: ${JSON.stringify(tasks.slice(0, 10).map(t => ({ title: t.title, priority: t.pri, category: t.cat })))}

Generate 3 smart suggestions to improve productivity:
1. A quick win (something to do now)
2. A priority shift (something to prioritize)
3. A pattern suggestion (something about task management)

Return ONLY a JSON array:
[
  { "title": "suggestion 1", "reason": "why this helps" },
  { "title": "suggestion 2", "reason": "why this helps" },
  { "title": "suggestion 3", "reason": "why this helps" }
]`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) return [];
      
      const data = await response.json();
      const content = data.content[0].text;
      return JSON.parse(content);
    } catch (err) {
      console.error('Suggestions error:', err);
      return [];
    }
  }

  async parseBulkTasks(text) {
    if (!text.trim()) return [];
    if (!this.apiKey) return [];

    try {
      const prompt = `Parse these tasks from natural language and return a JSON array:
"${text}"

Return ONLY a JSON array of objects with title, category, priority:
[
  { "title": "task 1", "category": "cat", "priority": "level" },
  ...
]

Categories: work, personal, bills, health, kids, school, car, flowline, other
Priorities: low, medium, high, critical`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) return [];
      
      const data = await response.json();
      const content = data.content[0].text;
      return JSON.parse(content);
    } catch (err) {
      console.error('Bulk parse error:', err);
      return [];
    }
  }

  onAnalysisChange(callback) {
    if (!this.listeners) this.listeners = [];
    this.listeners.push(callback);
  }

  isLoading() {
    return this.isAnalyzing;
  }
}

const ai = new AIAssistant(CLAUDE_API_KEY);
