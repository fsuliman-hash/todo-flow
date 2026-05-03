'use strict';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'same-origin',
};

// Sliding-window rate limiter keyed by user ID or IP.
// State is per-lambda-instance on Vercel (resets on cold start), so this is
// a best-effort abuse brake rather than a hard enforcer.
const rateLimitStore = new Map();

function getClientKey(req, body) {
  const bodyUser = String(body?.userId || '').trim().toLowerCase();
  if (bodyUser) return `user:${bodyUser.slice(0, 160)}`;
  const headerUser = String(req.headers?.['x-user-id'] || '').trim().toLowerCase();
  if (headerUser) return `user:${headerUser.slice(0, 160)}`;
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || String(req.socket?.remoteAddress || '').trim() || 'unknown';
  return `ip:${ip.slice(0, 100)}`;
}

function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (rateLimitStore.get(key) || []).filter((t) => t > cutoff);
  if (timestamps.length >= limit) {
    rateLimitStore.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  return false;
}

function setCors(res, origin) {
  const allowed = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader(
    'Access-Control-Allow-Origin',
    allowed === '*' ? '*' : allowed
  );
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

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

/**
 * Creates a Vercel-compatible serverless handler with CORS, body parsing,
 * rate limiting, security headers, and error handling built in.
 *
 * @param {Function} payloadFn  - async (parsedBody, env) => { status, json }
 * @param {object}   opts
 * @param {number}   opts.rateLimit     - max requests per window (default 30)
 * @param {number}   opts.rateLimitMs   - window size in ms (default 60 000)
 */
function createHandler(payloadFn, opts = {}) {
  const limit = opts.rateLimit ?? 30;
  const windowMs = opts.rateLimitMs ?? 60_000;

  return async (req, res) => {
    const origin = req.headers?.origin || '';
    setCors(res, origin);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    let parsed = {};
    try {
      const raw = await readRequestBody(req);
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }

    const key = getClientKey(req, parsed);
    if (checkRateLimit(key, limit, windowMs)) {
      return sendJson(res, 429, { error: `Too many requests. Max ${limit} per ${windowMs / 1000}s.` });
    }

    const env = {
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
      CLAUDE_MODEL: process.env.CLAUDE_MODEL || '',
    };

    try {
      const out = await payloadFn(parsed, env);
      return sendJson(res, out.status, out.json);
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Server error.' });
    }
  };
}

module.exports = { createHandler };
