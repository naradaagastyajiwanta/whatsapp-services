const { disconnectClient } = require('../../services/waService');
const { checkLogin } = require('./authHandler');
const logger = require('../../utils/logging'); // Impor logger

const disconnectHandler = async (ws, account_type, token) => {
    const decoded = checkLogin(ws, token);
    if (!decoded) return;
    const username = decoded.username;
    const userId = decoded.id;

    logger.info(`Disconnecting client for accountId: ${account_type}`);

    try {
        const disconnectStatus = await disconnectClient(account_type, username);
        ws.send(JSON.stringify({
            username: username,
            account_type,
            status: disconnectStatus.status,
            message: disconnectStatus.message,
        }));
        logger.info(`Client disconnected for accountId: ${account_type}`);
    } catch (error) {
        logger.error(`Error disconnecting client for accountId ${account_type}: ${error.message}`);
        ws.send(JSON.stringify({
            username: username,
            account_type,
            status: 'error',
            message: `Gagal memutuskan koneksi: ${error.message}`,
        }));
    }
};

module.exports = disconnectHandler;