const WebSocket = require('ws');
const config = require('../config/limit');
const initializeHandler = require('./handlers/initializeHandler');
const { checkStatusHandler, listSessionFolders, checkSpecificSessionFolder, getSessionsFromDatabase, listOrphanedSessionFolders, cleanupOrphanedSessionFolders } = require('./handlers/checkStatusHandler');
const { sendTextMessagesHandler, sendFileMessagesHandler, sendFileMessagesPDFHandler, sendFileMessagesDOCXHandler } = require('./handlers/MessagesHandler');
const disconnectHandler = require('./handlers/disconnectHandler');
const { loginHandler, registerHandler, checkLogin } = require('./handlers/authHandler');
const { chatHistoryWAHandler, unrepliedMessagesHandler } = require('./handlers/chatHandler');
const { activateAssistantHandler, deactivateAssistantHandler, deleteAssistantHandler } = require('./handlers/assistantHandler');
const { createGroupHandler, sendMessageToGroupHandler, inviteToGroupHandler } = require('./handlers/groupWAHandler');
const logger = require('../utils/logging');

require('events').EventEmitter.defaultMaxListeners = 100;

const validateParams = (params, required, types = {}) => {
    for (const param of required) {
        if (!params[param]) throw new Error(`Missing required parameter: ${param}`);
        if (types[param] && typeof params[param] !== types[param]) {
            throw new Error(`Invalid type for ${param}. Expected ${types[param]}.`);
        }
    }
};

const setupWebSocket = (server) => {
    const wss = new WebSocket.Server({
        server,
        clientTracking: true,
        maxPayload: config.WS_MAX_PAYLOAD,
    });

    const heartbeat = (ws) => {
        ws.isAlive = true;
    };

    const MAX_CLIENTS = 100;

    wss.on('connection', (ws, req) => {
        if (wss.clients.size >= MAX_CLIENTS) {
            ws.send(JSON.stringify({
                status: 'error',
                message: 'Server mencapai batas maksimum client. Silakan coba lagi nanti.'
            }));
            ws.terminate();
            return;
        }

        ws.isAlive = true;
        ws.hasReceivedFirstMessage = false;
        logger.info(`New client connected`);

        ws.on('pong', () => heartbeat(ws));

        let inactivityTimeout = setTimeout(() => {
            logger.warn(`Client timed out due to inactivity`);
            ws.terminate();
        }, config.INACTIVITY_TIMEOUT);

        ws.on('message', async (message) => {
            clearTimeout(inactivityTimeout);
            inactivityTimeout = setTimeout(() => {
                logger.warn(`Client timed out due to inactivity`);
                ws.terminate();
            }, config.INACTIVITY_TIMEOUT);

            try {
                const parsedMessage = JSON.parse(message.toString());
                ws.hasReceivedFirstMessage = true;

                const {
                    account_type,
                    typeProject,
                    action,
                    data,
                    fileUrl,
                    username,
                    password,
                    token,
                    nomor_pengirim,
                    groupName,
                    groupId,
                    messageGroup,
                    participants,
                    targetNumber,
                    limit,
                    daysAgo,
                } = parsedMessage;

                switch (action) {
                    case 'initialize':
                        validateParams({ account_type, token }, ['account_type', 'token'], { account_type: 'string', token: 'string' });
                        await initializeHandler(ws, account_type, token);
                        break;
                    case 'sendMessages':
                        validateParams({ account_type, typeProject, data, token }, ['account_type', 'typeProject', 'data', 'token']);
                        await sendTextMessagesHandler(ws, account_type, typeProject, data, token);
                        break;
                    case 'checkStatus':
                        validateParams({ account_type, token }, ['account_type', 'token']);
                        await checkStatusHandler(ws, account_type, token);
                        break;
                    case 'sendMessagesMedia':
                        validateParams({ account_type, typeProject, fileUrl, data, token }, ['account_type', 'typeProject', 'fileUrl', 'data', 'token']);
                        await sendFileMessagesHandler(ws, account_type, typeProject, fileUrl, data, token);
                        break;
                    case 'sendMessagesMediaPDF':
                        validateParams({ account_type, typeProject, data, token }, ['account_type', 'typeProject', 'data', 'token']);
                        await sendFileMessagesPDFHandler(ws, account_type, typeProject, data, token);
                        break;
                    case 'sendMessagesMediaDOCX':
                        validateParams({ account_type, typeProject, data, token }, ['account_type', 'typeProject', 'data', 'token']);
                        await sendFileMessagesDOCXHandler(ws, account_type, typeProject, data, token);
                        break;
                    case 'disconnect':
                        validateParams({ account_type, token }, ['account_type', 'token']);
                        await disconnectHandler(ws, account_type, token);
                        break;
                    case 'login':
                        validateParams({ username, password }, ['username', 'password']);
                        await loginHandler(ws, username, password);
                        break;
                    case 'register':
                        validateParams({ username, password }, ['username', 'password']);
                        await registerHandler(ws, username, password);
                        break;
                    case 'cekLogin':
                        validateParams({ token }, ['token']);
                        await checkLogin(ws, token);
                        break;
                    case 'historyWA':
                        validateParams({ account_type, token, targetNumber }, ['account_type', 'token', 'targetNumber']);
                        await chatHistoryWAHandler(ws, account_type, token, targetNumber, limit);
                        break;
                    case 'getUnrepliedMessages':
                        validateParams({ account_type, token }, ['account_type', 'token']);
                        await unrepliedMessagesHandler(ws, account_type, token, daysAgo);
                        break;
                    case 'activateAssistant':
                        validateParams({ nomor_pengirim, token }, ['nomor_pengirim', 'token']);
                        await activateAssistantHandler(ws, nomor_pengirim, token);
                        break;
                    case 'deactivateAssistant':
                        validateParams({ nomor_pengirim, token }, ['nomor_pengirim', 'token']);
                        await deactivateAssistantHandler(ws, nomor_pengirim, token);
                        break;
                    case 'deleteAssistant':
                        validateParams({ account_type, token }, ['account_type', 'token']);
                        await deleteAssistantHandler(ws, account_type, token);
                        break;
                    case 'createGroup':
                        validateParams({ account_type, groupName, participants, token }, ['account_type', 'groupName', 'participants', 'token']);
                        await createGroupHandler(ws, account_type, groupName, participants, token);
                        break;
                    case 'sendMessageToGroup':
                        validateParams({ account_type, token, groupId, messageGroup }, ['account_type', 'token', 'groupId', 'messageGroup']);
                        await sendMessageToGroupHandler(ws, account_type, groupId, messageGroup, token);
                        break;
                    case 'inviteToGroup':
                        validateParams({ account_type, token, groupId, participants }, ['account_type', 'token', 'groupId', 'participants']);
                        await inviteToGroupHandler(ws, account_type, groupId, participants, token);
                        break;
                    case 'folderSessions':
                        await listSessionFolders(ws);
                        break;
                    case 'listSession':
                        await getSessionsFromDatabase(ws);
                        break;
                    case 'list_orphaned_sessions':
                        await listOrphanedSessionFolders(ws);
                        break;
                    case 'cleanup_orphaned_sessions':
                        await cleanupOrphanedSessionFolders(ws);
                        break;

                    default:
                        ws.send(JSON.stringify({
                            status: 'error',
                            message: 'Unknown action provided.'
                        }));
                }
            } catch (error) {
                logger.error(`Handler error: ${error.message}`);
                ws.send(JSON.stringify({
                    status: 'error',
                    message: error.message
                }));
            }
        });

        const cleanup = () => {
            try {
                if (ws.waClient) {
                    ws.waClient.removeAllListeners();
                    ws.waClient.destroy();
                    delete ws.waClient;
                }
            } catch (error) {
                logger.error('Cleanup error:', error);
            }
        };

        ws.on('close', (code) => {
            logger.info(`Client disconnected with code: ${code}`);
            clearTimeout(inactivityTimeout);
            cleanup();
        });

        ws.on('error', (error) => {
            logger.error(`WebSocket error: ${error.message}`);
            clearTimeout(inactivityTimeout);
            cleanup();
        });
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                logger.warn(`Terminating inactive client`);
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, config.HEARTBEAT_INTERVAL);

    wss.on('close', () => {
        clearInterval(interval);
        wss.clients.forEach((ws) => ws.terminate());
        logger.info('WebSocket server closed');
    });

    logger.info('WebSocket server is running');
};

module.exports = setupWebSocket;