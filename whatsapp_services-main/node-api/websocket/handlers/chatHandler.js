const { getLastOutgoingMessages, getChatHistoryWithContact } = require('../../services/waService');
const { checkLogin } = require('./authHandler');
const logger = require('../../utils/logging'); // Impor logger

const chatHandler = async (ws, account_type, token, options = {}) => {
    const decoded = checkLogin(ws, token);
    if (!decoded) return;

    const username = decoded.username;
    const { action, targetNumber, limit, daysAgo } = options;

    try {
        if (action === 'unrepliedMessages') {
            const effectiveDaysAgo = daysAgo !== undefined ? parseInt(daysAgo, 10) : 2;
            if (isNaN(effectiveDaysAgo) || effectiveDaysAgo < 0) {
                throw new Error('daysAgo must be a non-negative number');
            }

            logger.info(`Fetching unreplied messages for ${username} on account_type: ${account_type}, daysAgo: ${effectiveDaysAgo}`);
            const result = await getLastOutgoingMessages(account_type, username, effectiveDaysAgo);

            ws.send(JSON.stringify({
                status: result.status || 'success',
                message: result.message || 'Unreplied messages retrieved successfully',
                data: result.data || result,
                date: result.date
            }));
        } else if (action === 'chatHistory') {
            // Validasi targetNumber dan limit
            if (!targetNumber || typeof targetNumber !== 'string') {
                throw new Error('targetNumber is required and must be a string');
            }
            const effectiveLimit = limit !== undefined ? parseInt(limit, 10) : 10;
            if (isNaN(effectiveLimit) || effectiveLimit <= 0) {
                throw new Error('limit must be a positive number');
            }

            logger.info(`Fetching chat history for ${username} on account_type: ${account_type}, target: ${targetNumber}, limit: ${effectiveLimit}`);
            const history = await getChatHistoryWithContact(account_type, username, targetNumber, effectiveLimit);

            if (!history) {
                throw new Error('No chat history found for the given target number');
            }

            ws.send(JSON.stringify({
                status: 'success',
                message: 'Chat history retrieved successfully',
                data: history
            }));
        } else {
            throw new Error('Invalid action specified');
        }
    } catch (error) {
        logger.error(`Error in chatHandler for ${username} (account_type: ${account_type}): ${error.stack}`);
        ws.send(JSON.stringify({
            status: 'error',
            message: 'Failed to process request',
            error: error.message
        }));
    }
};

// Wrapper untuk mempertahankan kompatibilitas
const unrepliedMessagesHandler = async (ws, account_type, token, daysAgo) => {
    await chatHandler(ws, account_type, token, { action: 'unrepliedMessages', daysAgo });
};

const chatHistoryWAHandler = async (ws, account_type, token, targetNumber, limit) => {
    await chatHandler(ws, account_type, token, { action: 'chatHistory', targetNumber, limit });
};

module.exports = {
    unrepliedMessagesHandler,
    chatHistoryWAHandler
};