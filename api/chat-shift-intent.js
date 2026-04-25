/**
 * Serverless: parse natural language into structured shift intent.
 */
const { handleChatShiftIntentPayload } = require('../lib/chat-handler');

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

  try {
    const out = await handleChatShiftIntentPayload(parsed, env);
    res.statusCode = out.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(out.json));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message || 'Server error.' }));
  }
};

