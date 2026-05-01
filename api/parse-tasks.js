/**
 * Serverless: parse natural language into multiple structured tasks (Claude on server).
 */
const { handleParseTasksPayload } = require('../lib/chat-handler');
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const parseTaskRateLimit = new Map();

function setCors(res, origin) {
  const allowed = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowed === '*' ? '*' : origin || allowed);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 1_000_000) throw new Error('Request body too large');
  }
  return Buffer.concat(chunks).toString('utf8');
}

function getRateLimitKey(req, body) {
  const bodyUser = String(body?.userId || '').trim().toLowerCase();
  if (bodyUser) return `user:${bodyUser.slice(0, 160)}`;
  const headerUser = String(req.headers?.['x-user-id'] || '').trim().toLowerCase();
  if (headerUser) return `user:${headerUser.slice(0, 160)}`;
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || String(req.socket?.remoteAddress || '').trim() || 'unknown';
  return `anon:${ip.slice(0, 100)}`;
}

function isRateLimited(key, nowMs) {
  const start = nowMs - RATE_LIMIT_WINDOW_MS;
  const recent = (parseTaskRateLimit.get(key) || []).filter((ts) => ts > start);
  if (recent.length >= RATE_LIMIT_MAX) {
    parseTaskRateLimit.set(key, recent);
    return true;
  }
  recent.push(nowMs);
  parseTaskRateLimit.set(key, recent);
  return false;
}


module.exports = async (req, res) => {
  const origin = req.headers?.origin || '';

  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  setCors(res, origin);

  const env = {
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
    CLAUDE_MODEL: process.env.CLAUDE_MODEL || '',
  };

  let parsed = {};
  try {
    const raw = await readRequestBody(req);
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Invalid JSON body.' }));
  }

  const key = getRateLimitKey(req, parsed);
  if (isRateLimited(key, Date.now())) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Rate limit exceeded. Max 10 parse requests per minute per user.' }));
  }

  try {
    const out = await handleParseTasksPayload(parsed, env);
    res.statusCode = out.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(out.json));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message || 'Server error.' }));
  }
};
