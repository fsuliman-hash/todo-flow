'use strict';
const { handleChatPlanPayload } = require('../lib/chat-handler');
const { createHandler } = require('../lib/api-handler');
module.exports = createHandler(handleChatPlanPayload);
