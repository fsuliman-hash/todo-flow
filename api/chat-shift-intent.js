'use strict';
const { handleChatShiftIntentPayload } = require('../lib/chat-handler');
const { createHandler } = require('../lib/api-handler');
module.exports = createHandler(handleChatShiftIntentPayload);
