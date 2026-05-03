'use strict';
const { handleParseTasksPayload } = require('../lib/chat-handler');
const { createHandler } = require('../lib/api-handler');
module.exports = createHandler(handleParseTasksPayload, { rateLimit: 10, rateLimitMs: 60_000 });
