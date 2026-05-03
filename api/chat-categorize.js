'use strict';
const { handleChatCategorizePayload } = require('../lib/chat-handler');
const { createHandler } = require('../lib/api-handler');
module.exports = createHandler(handleChatCategorizePayload);
