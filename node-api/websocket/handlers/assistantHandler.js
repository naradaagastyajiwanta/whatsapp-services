const { Assistant } = require('../../models/assistants');
const { checkLogin } = require('./authHandler');
const logger = require('../../utils/logging'); // Impor logger

require('dotenv').config();

const activateAssistantHandler = async (ws, nomor_pengirim, token) => {
    try {
        const decoded = checkLogin(ws, token);
        if (!decoded) return;

        const username = decoded.username;
        const userId = decoded.id;

        let assistant = await Assistant.findOne({ where: { nomor_pengirim: nomor_pengirim } });

        if (assistant) {
            assistant.status = 'aktif';
            await assistant.save();
            ws.send(JSON.stringify({
                status: 'success',
                message: 'Assistant activated successfully.'
            }));
            logger.info(`Assistant activated for ${nomor_pengirim} by ${username}`);
            return;
        } else {
            assistant = await Assistant.create({
                username: username,
                nomor_pengirim: nomor,
                status: 'aktif',
            });
        }

        ws.send(JSON.stringify({
            status: 'success',
            message: 'Assistant activated successfully.'
        }));
        logger.info(`Assistant created and activated for ${nomor_pengirim} by ${username}`);
    } catch (error) {
        logger.error(`Failed to activate assistant for ${nomor_pengirim}: ${error.message}`);
        ws.send(JSON.stringify({
            status: 'error',
            message: 'Failed to activate assistant.',
            error: error.message
        }));
    }
};

const deactivateAssistantHandler = async (ws, nomor_pengirim, token) => {
    try {
        const decoded = checkLogin(ws, token);
        if (!decoded) return;

        const nomor = `${nomor_pengirim}@c.us`;

        const assistant = await Assistant.findOne({ where: { nomor_pengirim: nomor } });
        if (!assistant) {
            ws.send(JSON.stringify({
                status: 'error',
                message: 'Assistant not found.'
            }));
            logger.warn(`Assistant not found for ${nomor_pengirim}`);
            return;
        }

        assistant.status = 'nonaktif';
        await assistant.save();

        ws.send(JSON.stringify({
            status: 'success',
            message: 'Assistant deactivated successfully.'
        }));
        logger.info(`Assistant deactivated for ${nomor_pengirim}`);
    } catch (error) {
        logger.error(`Failed to deactivate assistant for ${nomor_pengirim}: ${error.message}`);
        ws.send(JSON.stringify({
            status: 'error',
            message: 'Failed to deactivate assistant.',
            error: error.message
        }));
    }
};

const deleteAssistantHandler = async (ws, nomor_pengirim, token) => {
    try {
        const decoded = checkLogin(ws, token);
        if (!decoded) return;

        const nomor = `${nomor_pengirim}@c.us`;

        const assistant = await Assistant.findOne({ where: { nomor_pengirim: nomor } });
        if (!assistant) {
            ws.send(JSON.stringify({
                status: 'error',
                message: 'Assistant not found.'
            }));
            logger.warn(`Assistant not found for ${nomor_pengirim}`);
            return;
        }

        await assistant.destroy();

        ws.send(JSON.stringify({
            status: 'success',
            message: 'Assistant deleted successfully.'
        }));
        logger.info(`Assistant deleted for ${nomor_pengirim}`);
    } catch (error) {
        logger.error(`Failed to delete assistant for ${nomor_pengirim}: ${error.message}`);
        ws.send(JSON.stringify({
            status: 'error',
            message: 'Failed to delete assistant.',
            error: error.message
        }));
    }
};

module.exports = {
    activateAssistantHandler,
    deactivateAssistantHandler,
    deleteAssistantHandler
};