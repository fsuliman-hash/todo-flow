'use strict';

/**
 * Calls Anthropic Messages API with model fallback (env primary, then candidates).
 * API key never leaves the server / function runtime.
 */
async function callClaudeWithFallback(buildPayload, options) {
  const apiKey = options.apiKey;
  if (!apiKey) {
    return { ok: false, error: 'CLAUDE_API_KEY is not configured.' };
  }

  const configuredModel = options.model || '';
  const candidates = Array.isArray(options.modelCandidates)
    ? options.modelCandidates
    : ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest'];

  const modelList = configuredModel
    ? [configuredModel, ...candidates.filter((m) => m !== configuredModel)]
    : [...candidates];

  const apiUrl = options.apiUrl || 'https://api.anthropic.com/v1/messages';
  let lastError = 'Unable to reach Anthropic.';

  for (const model of modelList) {
    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(buildPayload(model)),
    });

    const data = await upstream.json().catch(() => ({}));
    if (upstream.ok) return { ok: true, data, model };

    const detail = data?.error?.message || `Anthropic error (${upstream.status})`;
    lastError = `${detail} [model: ${model}]`;
    if (!/model/i.test(detail)) return { ok: false, error: detail };
  }

  return { ok: false, error: lastError };
}

module.exports = { callClaudeWithFallback };
