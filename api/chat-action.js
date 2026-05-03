'use strict';
const { handleChatActionPayload } = require('../lib/chat-handler');
const { createHandler } = require('../lib/api-handler');
module.exports = createHandler(handleChatActionPayload);
