/**
 * Todo Flow — Claude chat endpoint (serverless handler).
 * Vercel uses the root `api/chat.js` file by convention; this file re-exports the same
 * implementation so you can also point other hosts (Netlify, Railway, etc.) at `backend/chat.js`.
 */
module.exports = require('../api/chat.js');
