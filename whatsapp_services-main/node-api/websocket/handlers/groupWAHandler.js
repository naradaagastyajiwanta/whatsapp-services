const { createGroup, sendMessageToGroup, inviteToGroup } = require('../../services/waService');
const { checkLogin } = require('./authHandler');
const logger = require('../../utils/logging');

const isValidPhoneNumber = (number) => {
    const phoneRegex = /^[1-9]\d{1,14}$/;
    return phoneRegex.test(number);
};

const createGroupHandler = async (ws, account_type, groupName, participants, token) => {
    const decoded = checkLogin(ws, token);
    if (!decoded) return;
    const username = decoded.username;
    const userId = decoded.id;

    // Validate each phone number
    const invalidNumbers = participants.filter(number => !isValidPhoneNumber(number));
    if (invalidNumbers.length > 0) {
        ws.send(JSON.stringify({
            status: 'error',
            message: 'Invalid phone numbers found',
            invalidNumbers: invalidNumbers
        }));
        logger.warn(`Invalid phone numbers found: ${invalidNumbers.join(', ')}`);
        return;
    }

    try {
        const result = await createGroup(account_type, username, groupName, participants);
        ws.send(JSON.stringify(result));
        logger.info(`Group created successfully: ${groupName} by ${username}`);
    } catch (error) {
        logger.error(`Error creating group: ${error.message}`);
        ws.send(JSON.stringify({
            status: 'error',
            message: 'Failed to create group',
            error: error.message
        }));
    }
};

const sendMessageToGroupHandler = async (ws, account_type, groupId, messageGroup, token) => {
    const decoded = checkLogin(ws, token);
    if (!decoded) return;
    
    const username = decoded.username;

    try {
        await sendMessageToGroup(account_type, username, groupId, messageGroup);
        ws.send(JSON.stringify({
            status: 'success',
            message: 'Pesan berhasil dikirim ke grup',
            groupId: groupId
        }));
        logger.info(`Message sent to group ${groupId} by ${username}`);
    } catch (error) {
        logger.error(`Error sending message to group: ${error.message}`);
        ws.send(JSON.stringify({
            status: 'error',
            message: 'Gagal mengirim pesan ke grup',
            error: error.message
        }));
    }
};

const inviteToGroupHandler = async (ws, account_type, groupId, participants, token) => {
    try {
        const decoded = checkLogin(ws, token);
        if (!decoded) return;
        
        const username = decoded.username;
        logger.info(`Attempting to invite participants to group ${groupId} for ${username}-${account_type}`);

        const result = await inviteToGroup(account_type, username, groupId, participants);
        ws.send(JSON.stringify(result));

    } catch (error) {
        logger.error('Error in inviteToGroupHandler:', error);
        ws.send(JSON.stringify({
            status: 'error',
            message: `Gagal mengundang peserta ke grup: ${error.message}`
        }));
    }
};

module.exports = {
    createGroupHandler,
    sendMessageToGroupHandler,
    inviteToGroupHandler
};