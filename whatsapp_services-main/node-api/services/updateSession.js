require('dotenv').config();
const { connectDB, sequelize } = require('../config/db');
const { Session } = require('../models/session');
const logger = require('../utils/logging'); // Impor logger

connectDB();

const saveSessionToDatabase = async (account_type, username, whatsapp_number) => {
    try {
        logger.info(`Saving session info for account ${account_type} and username ${username} to database`);
        const existingSession = await Session.findOne({ 
            where: { 
                username,
                account_type
            } 
        });

        if (existingSession) {
            await existingSession.update({
                status: 'active',
                whatsapp_number
            });
            logger.info(`Session info for account ${account_type} and username ${username} updated in database`);
        } else {
            await Session.create({
                username,
                account_type,
                status: 'active',
                whatsapp_number
            });
            logger.info(`Session info for account ${account_type} and username ${username} created in database`);
        }
        return { status: 'success', message: 'Session saved successfully' };
    } catch (error) {
        logger.error('Error saving session info to database:', error);
        return { status: 'error', message: 'Failed to save session info to database' };
    }
};

const deleteSessionFromDatabase = async (account_type, username) => {
    try {
        logger.info(`Deleting session info for account ${account_type} from database`);
        await Session.destroy({ where: { account_type, username } });
        logger.info(`Session info for account ${account_type} deleted from database`);
        return { status: 'success', message: 'Session saved successfully' };
    } catch (error) {
        logger.error('Error deleting session info from database:', error);
        return { status: 'error', message: 'Failed to save session info to database' };
    }
};

const checkAccountInDatabase = async (account_type, username) => {
    try {
        const existingSession = await Session.findOne({ 
            where: { 
                username,
                account_type
            } 
        });

        if (existingSession) {
            logger.info(`Account ${account_type} for username ${username} found in database`);
            return {
                status: "terhubung",
                message: "Akun sudah terhubung.",
                username: existingSession.username,
                account_type: existingSession.account_type,
            };
        } else {
            logger.warn(`Account ${account_type} for username ${username} not found in database`);
            return null;
        }
    } catch (error) {
        logger.error('Error checking account in database:', error);
        return null;
    }
};

module.exports = {
    saveSessionToDatabase,
    deleteSessionFromDatabase,
    checkAccountInDatabase,
};