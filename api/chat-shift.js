'use strict';
const { handleChatShiftPayload } = require('../lib/chat-handler');
const { createHandler } = require('../lib/api-handler');
module.exports = createHandler(handleChatShiftPayload);
