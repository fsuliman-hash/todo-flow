'use strict';
const { handleChatEditPayload } = require('../lib/chat-handler');
const { createHandler } = require('../lib/api-handler');
module.exports = createHandler(handleChatEditPayload);
