const { checkClientConnection } = require('../../services/waService');
const { checkLogin } = require('./authHandler');
const logger = require('../../utils/logging'); // Impor logger
const fs = require('fs').promises;
const path = require('path');
const { Session } = require('../../models/session');

const checkStatusHandler = async (ws, account_type, token) => {
    const decoded = checkLogin(ws, token);
    if (!decoded) return;

    const username = decoded.username;
    const userId = decoded.id;
    logger.info(`Checking status for accountId: ${account_type} with username: ${decoded.username}`);
    try {
        const session = await checkClientConnection(account_type, username);
        if (session.state === 'CONNECTED') {
            ws.send(JSON.stringify({ account_type, username, status: 'Terhubung', phoneNumber: session.phoneNumber, state: session.state }));
        } else {
            ws.send(JSON.stringify({ status: 'disconnected' }));
        }
    } catch (error) {
        logger.error('Error checking status:', error);
        ws.send(JSON.stringify({ message: 'Failed to check status' }));
    }
};

const listSessionFolders = async (ws) => {
    try {
        const authFolder = path.resolve(__dirname, '../../.wwebjs_auth');
        
        // Check if auth folder exists
        let folderExists = false;
        try {
            await fs.access(authFolder);
            folderExists = true;
        } catch (error) {
            return ws.send(JSON.stringify({
                exists: false,
                message: '.wwebjs_auth folder not found',
                error: error.code
            }));
        }
        
        // Get all folders inside .wwebjs_auth
        const folderContents = await fs.readdir(authFolder);
        
        return ws.send(JSON.stringify({
            exists: true,
            path: authFolder,
            sessions: folderContents,
            count: folderContents.length
        }));
    } catch (error) {
        logger.error('Error listing session folders:', error);
        return ws.send(JSON.stringify({
            exists: false,
            message: 'Error listing session folders',
            error: error.message
        }));
    }
};

const checkSpecificSessionFolder = async (ws, account_type, username) => {
    try {
        const account = `${username}-${account_type}`;
        const authFolder = path.resolve(__dirname, '../../.wwebjs_auth');
        const sessionFolder = path.join(authFolder, account);
        
        // Check if session folder exists
        let folderExists = false;
        try {
            await fs.access(sessionFolder);
            folderExists = true;
        } catch (error) {
            return ws.send(JSON.stringify({
                exists: false,
                message: `Session folder for ${account} not found`,
                error: error.code
            }));
        }
        
        // List files in the session folder
        const files = await fs.readdir(sessionFolder);
        
        return ws.send(JSON.stringify({
            exists: true,
            path: sessionFolder,
            files: files,
            count: files.length
        }));
    } catch (error) {
        logger.error(`Error checking session folder for ${username}-${account_type}:`, error);
        return ws.send(JSON.stringify({
            exists: false,
            message: 'Error checking session folder',
            error: error.message
        }));
    }
};

const getSessionsFromDatabase = async (ws) => {
    try {
        const sessions = await Session.findAll({
            attributes: ['username', 'account_type', 'status', 'whatsapp_number', 'createdAt', 'updatedAt']
        });
        
        return ws.send(JSON.stringify({
            status: 'success',
            message: `Found ${sessions.length} sessions in database`,
            sessions: sessions.map(s => s.dataValues),
            count: sessions.length
        }));
    } catch (error) {
        logger.error('Error fetching sessions from database:', error);
        return ws.send(JSON.stringify({
            status: 'error',
            message: 'Failed to fetch sessions from database',
            error: error.message
        }));
    }
};

const cleanupOrphanedSessionFolders = async (ws) => {
    try {
        logger.info('Starting cleanup of orphaned session folders');
        
        // Get all sessions from database
        const sessions = await Session.findAll({
            attributes: ['username', 'account_type']
        });
        
        // Create a lookup map for faster checking
        const dbSessionMap = new Map();
        sessions.forEach(session => {
            const key = `${session.username}-${session.account_type}`;
            dbSessionMap.set(key, true);
        });
        
        // Get all folders in .wwebjs_auth
        const authFolder = path.resolve(__dirname, '../../.wwebjs_auth');
        
        // Check if auth folder exists
        try {
            await fs.access(authFolder);
        } catch (error) {
            return ws.send(JSON.stringify({
                status: 'error',
                message: '.wwebjs_auth folder not found',
                error: error.code
            }));
        }
        
        // List all folders
        const folderContents = await fs.readdir(authFolder);
        
        // Find orphaned folders (exist in filesystem but not in DB)
        const orphanedFolders = [];
        const deletedFolders = [];
        const errorFolders = [];
        
        for (const folderName of folderContents) {
            // Skip non-session folders (like temporary files)
            if (!folderName.includes('-')) continue;
            
            // Check if folder has corresponding DB entry
            if (!dbSessionMap.has(folderName)) {
                orphanedFolders.push(folderName);
                
                // Delete the orphaned folder
                try {
                    const folderPath = path.join(authFolder, folderName);
                    await fs.rm(folderPath, { recursive: true, force: true });
                    deletedFolders.push(folderName);
                    logger.info(`Deleted orphaned session folder: ${folderName}`);
                } catch (error) {
                    errorFolders.push({ folder: folderName, error: error.message });
                    logger.error(`Error deleting orphaned folder ${folderName}:`, error);
                }
            }
        }
        
        // Send results
        return ws.send(JSON.stringify({
            status: 'success',
            message: `Cleanup complete. Found ${orphanedFolders.length} orphaned folders, deleted ${deletedFolders.length} successfully.`,
            dbSessionCount: sessions.length,
            orphanedFolders,
            deletedFolders,
            errorFolders,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        logger.error('Error cleaning up orphaned session folders:', error);
        return ws.send(JSON.stringify({
            status: 'error',
            message: 'Failed to clean up orphaned session folders',
            error: error.message
        }));
    }
};

const listOrphanedSessionFolders = async (ws) => {
    try {
        logger.info('Scanning for orphaned session folders');
        
        // Get all sessions from database
        const sessions = await Session.findAll({
            attributes: ['username', 'account_type']
        });
        
        // Create a lookup map for faster checking
        const dbSessionMap = new Map();
        sessions.forEach(session => {
            const key = `${session.username}-${session.account_type}`;
            dbSessionMap.set(key, true);
        });
        
        // Get all folders in .wwebjs_auth
        const authFolder = path.resolve(__dirname, '../../.wwebjs_auth');
        
        // Check if auth folder exists
        try {
            await fs.access(authFolder);
        } catch (error) {
            return ws.send(JSON.stringify({
                status: 'error',
                message: '.wwebjs_auth folder not found',
                error: error.code
            }));
        }
        
        // List all folders
        const folderContents = await fs.readdir(authFolder);
        
        // Find orphaned folders (exist in filesystem but not in DB)
        const orphanedFolders = [];
        const validFolders = [];
        
        for (const folderName of folderContents) {
            // Skip non-session folders (like temporary files)
            if (!folderName.includes('-')) continue;
            
            // Check if folder has corresponding DB entry
            if (dbSessionMap.has(folderName)) {
                validFolders.push(folderName);
            } else {
                orphanedFolders.push(folderName);
            }
        }
        
        // Send results
        return ws.send(JSON.stringify({
            status: 'success',
            message: `Found ${orphanedFolders.length} orphaned folders out of ${folderContents.length} total folders.`,
            dbSessionCount: sessions.length,
            totalFolders: folderContents.length,
            orphanedFolders,
            validFolders,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        logger.error('Error listing orphaned session folders:', error);
        return ws.send(JSON.stringify({
            status: 'error',
            message: 'Failed to list orphaned session folders',
            error: error.message
        }));
    }
};

module.exports = {
    checkStatusHandler,
    listSessionFolders,
    checkSpecificSessionFolder,
    getSessionsFromDatabase,
    cleanupOrphanedSessionFolders,
    listOrphanedSessionFolders
};