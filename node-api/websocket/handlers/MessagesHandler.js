const { sendMessage, sendMessageMedia, checkClientConnection  } = require('../../services/waService');
const { ReceivedData } = require('../../models/receivedData');
const { Results } = require('../../models/results');
const { checkLogin } = require('./authHandler');
const logger = require('../../utils/logging');

const isValidPhoneNumber = (number) => {
    const phoneRegex = /^[1-9]\d{1,14}$/;
    return phoneRegex.test(number);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendMessagesHandler = async (ws, account_type, typeProject, data, token, fileUrl = null, isPDF = false, isDOCX = false) => {
    const decoded = checkLogin(ws, token);
    if (!decoded) return;

    const username = decoded.username;
    const userId = decoded.id;

    logger.info(`Sending messages for account_type: ${account_type}, typeProject: ${typeProject}`);
    const { messages } = data;
    let totalSuccess = 0;
    let totalFailed = 0;
    let statusMessage = 0;
    let messageText = '';
    const details = [];

    try {
        const connectionStatus = await checkClientConnection(account_type, username);
        if (!connectionStatus.isConnected) {
            logger.warn(`WhatsApp account ${username}-${account_type} is not connected. Status: ${connectionStatus.state}`);
            
            let responseMessage = 'WhatsApp belum terhubung. Silakan hubungkan akun terlebih dahulu.';
            let reconnectOption = false;
            
            // If client can be reconnected automatically
            if (connectionStatus.state === 'AUTO_DISCONNECTED' && connectionStatus.canReconnect) {
                responseMessage = 'WhatsApp terputus karena tidak aktif. Silakan menghubungkan kembali.';
                reconnectOption = true;
            }
            
            ws.send(JSON.stringify({
                status: false,
                code: 'whatsapp_not_connected',
                message: responseMessage,
                canReconnect: reconnectOption
            }));
            return;
        }
        for (const messageData of messages) {
            let { number, message, fileUrl: messageFileUrl, fileName } = messageData;
            // Gunakan fileUrl dari parameter jika tidak ada di messageData
            const effectiveFileUrl = messageFileUrl || fileUrl;

            if (!number || !message || !isValidPhoneNumber(number)) {
                totalFailed++;
                statusMessage++;
                details.push({
                    account_type,
                    typeProject,
                    whatsapp_number: number,
                    status: false,
                    detail: 'Nomor atau pesan tidak valid'
                });
                ws.send(JSON.stringify({ status: 'proses', total: statusMessage, totalMessages: messages.length }));
                continue;
            }

            messageText = message;
            const randomDelay = (Math.random() * 10) + 3; // 3-13 detik delay dalam bentuk float
            await delay(randomDelay * 1000); // Konversi ke milidetik

            try {
                if (typeProject === 'text') {
                    await sendMessage(account_type, username, number, message);
                } else if (typeProject === 'file' || typeProject === 'pdf' || typeProject === 'docx') {
                    if (!effectiveFileUrl && !isPDF && !isDOCX) {
                        throw new Error('File URL is required for file, PDF, or DOCX type');
                    }
                    await sendMessageMedia(account_type, username, number, message, typeProject, effectiveFileUrl, fileName);
                } else {
                    throw new Error(`Unknown typeProject: ${typeProject}`);
                }

                totalSuccess++;
                statusMessage++;
                details.push({
                    account_type,
                    typeProject,
                    whatsapp_number: number,
                    status: true,
                    detail: 'Berhasil'
                });
                // ws.send(JSON.stringify({ status: 'proses', total: statusMessage, totalMessages: messages.length }));
            } catch (error) {
                logger.error(`Error sending message to ${number} from account ${account_type}: ${error.message}`);
                totalFailed++;
                statusMessage++;
                details.push({
                    account_type,
                    typeProject,
                    whatsapp_number: number,
                    status: false,
                    detail: `Error: ${error.message || 'Terjadi kesalahan, periksa nomor, pesan, file, atau koneksi'}`
                });
                // ws.send(JSON.stringify({ status: 'proses', total: statusMessage, totalMessages: messages.length }));
            }
        }

        const totalMessages = totalSuccess + totalFailed;
        const responseData = {
            typeProject,
            message: messageText,
            totalSuccess,
            totalFailed,
            totalMessages
        };

        // Simpan ke database
        await ReceivedData.create({
            account_type,
            typeProject,
            message: messageText,
            totalSuccess,
            totalFailed,
            totalMessages
        });

        await Promise.all(details.map(res => Results.create(res)));

        ws.send(JSON.stringify({
            status: true,
            message: 'Messages processed',
            data: responseData,
            details
        }));
    } catch (error) {
        logger.error('Error in sendMessagesHandler:', error.stack);
        ws.send(JSON.stringify({
            status: false,
            message: 'Failed to process messages',
            error: error.message
        }));
    }
};

// Wrapper untuk fungsi spesifik
const sendTextMessagesHandler = async (ws, account_type, typeProject, data, token) => {
    await sendMessagesHandler(ws, account_type, 'text', data, token);
};

const sendFileMessagesHandler = async (ws, account_type, typeProject, fileUrl, data, token) => {
    await sendMessagesHandler(ws, account_type, typeProject, data, token, fileUrl);
};

const sendFileMessagesPDFHandler = async (ws, account_type, typeProject, data, token) => {
    await sendMessagesHandler(ws, account_type, 'pdf', data, token, null, true);
};

const sendFileMessagesDOCXHandler = async (ws, account_type, typeProject, data, token) => {
    await sendMessagesHandler(ws, account_type, 'docx', data, token, null, false, true);
};

module.exports = {
    sendTextMessagesHandler,
    sendFileMessagesHandler,
    sendFileMessagesPDFHandler,
    sendFileMessagesDOCXHandler
};