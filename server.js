const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Node.js does not read `.env` by itself. Load `CLAUDE_API_KEY`, `SUPABASE_*`, etc. from project root.
 * Does not override non-empty values already in `process.env` (CI / explicit shell export wins).
 * Empty-string vars still get values from `.env` (Windows often leaves `CLAUDE_API_KEY=` set but blank).
 */
function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const text = fs.readFileSync(envPath, 'utf8');
    for (let raw of text.split(/\r?\n/)) {
      raw = raw.replace(/^\uFEFF/, '');
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      const existing = process.env[key];
      if (existing !== undefined && existing !== '') continue;
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\r/g, '\r');
      }
      process.env[key] = val;
    }
  } catch (err) {
    console.warn('[server] Could not read .env:', err.message);
  }
}

loadDotEnv();

const {
  handleChatPayload,
  handleChatActionPayload,
  handleChatEditPayload,
  handleChatCategorizePayload,
  handleChatShiftPayload,
  handleChatShiftIntentPayload,
  handleParseTasksPayload,
} = require('./lib/chat-handler');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 5500);
const ROOT = path.resolve(__dirname);

const env = {
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || '',
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'same-origin',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS });
  res.end(JSON.stringify(body));
}

// Simple in-memory rate limiter: max requests per window per IP.
const rateLimitStore = new Map();
function checkRateLimit(ip, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  let entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(ip, entry);
  }
  entry.count++;
  return entry.count > limit;
}
// Prune stale entries every 5 minutes to avoid unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(ip);
  }
}, 300_000);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function serveRuntimeConfig(res) {
  const payload = {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    apiBase: process.env.PUBLIC_API_BASE || '',
  };
  const body = `window.__TF_SUPABASE_URL__=${JSON.stringify(payload.supabaseUrl)};window.__TF_SUPABASE_ANON_KEY__=${JSON.stringify(payload.supabaseAnonKey)};window.__TF_API_BASE__=${JSON.stringify(payload.apiBase)};`;
  res.writeHead(200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
  });
  res.end(body);
}

/** Resolve a URL path to a file under ROOT without path traversal. */
function resolvePublicPath(urlPath) {
  let pathname = urlPath.split('?')[0];
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (pathname === '/' || pathname === '') pathname = '/index.html';

  if (pathname === '/runtime-config.js') {
    return { special: 'runtime-config' };
  }

  // Critical on Windows: path.normalize("/index.html") -> "\\index.html", which isAbsolute → 403.
  // Always strip leading slashes so we join a *relative* path under ROOT.
  const relative = pathname.replace(/^\/+/, '');
  if (!relative || relative.includes('\0')) return null;

  const normalized = path.normalize(relative);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) return null;

  const filePath = path.resolve(ROOT, normalized);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (filePath !== ROOT && !filePath.startsWith(rootWithSep)) return null;

  return { filePath };
}

function serveStatic(req, res) {
  const resolved = resolvePublicPath(req.url);
  if (!resolved) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  if (resolved.special === 'runtime-config') {
    return serveRuntimeConfig(res);
  }

  fs.readFile(resolved.filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(resolved.filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, ...SECURITY_HEADERS });
    res.end(content);
  });
}

const AI_ROUTES = new Set(['/api/chat', '/api/chat-action', '/api/chat-edit', '/api/chat-categorize', '/api/chat-shift', '/api/chat-shift-intent', '/api/parse-tasks']);

const server = http.createServer(async (req, res) => {
  const pathname = req.url.split('?')[0];
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

  if (req.method === 'POST' && AI_ROUTES.has(pathname)) {
    if (checkRateLimit(ip)) {
      return sendJson(res, 429, { error: 'Too many requests. Please slow down.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/chat') {
    let parsed = {};
    try {
      const raw = await readBody(req);
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }
    try {
      const out = await handleChatPayload(parsed, env);
      return sendJson(res, out.status, out.json);
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Server error.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/chat-action') {
    let parsed = {};
    try {
      const raw = await readBody(req);
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }
    try {
      const out = await handleChatActionPayload(parsed, env);
      return sendJson(res, out.status, out.json);
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Server error.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/chat-edit') {
    let parsed = {};
    try {
      const raw = await readBody(req);
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }
    try {
      const out = await handleChatEditPayload(parsed, env);
      return sendJson(res, out.status, out.json);
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Server error.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/chat-categorize') {
    let parsed = {};
    try {
      const raw = await readBody(req);
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }
    try {
      const out = await handleChatCategorizePayload(parsed, env);
      return sendJson(res, out.status, out.json);
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Server error.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/chat-shift') {
    let parsed = {};
    try {
      const raw = await readBody(req);
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }
    try {
      const out = await handleChatShiftPayload(parsed, env);
      return sendJson(res, out.status, out.json);
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Server error.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/chat-shift-intent') {
    let parsed = {};
    try {
      const raw = await readBody(req);
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }
    try {
      const out = await handleChatShiftIntentPayload(parsed, env);
      return sendJson(res, out.status, out.json);
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Server error.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/parse-tasks') {
    let parsed = {};
    try {
      const raw = await readBody(req);
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body.' });
    }
    try {
      const out = await handleParseTasksPayload(parsed, env);
      return sendJson(res, out.status, out.json);
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Server error.' });
    }
  }

  return serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Todo app server running at http://${HOST}:${PORT}`);
  if (!env.CLAUDE_API_KEY) {
    console.warn('[server] CLAUDE_API_KEY is empty. Add it to .env in the project folder (same folder as server.js), then restart the server.');
  }
});
