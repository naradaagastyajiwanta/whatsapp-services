const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { saveSessionToDatabase, deleteSessionFromDatabase, checkAccountInDatabase } = require('./updateSession');
const { Session } = require('../models/session');
const axios = require('axios');
const vCardParser = require('vcard-parser');
const { Assistant } = require('../models/assistants');
const logger = require('../utils/logging');
const { memoryUsage } = require('process');
require('dotenv').config();

const ASSISTANT_URL = process.env.ASSISTANT_URL;
const clients = {};
// 2 hari dalam milidetik (2 * 24 * 60 * 60 * 1000)
const INACTIVITY_TIMEOUT = 172800000;
// Interval pengecekan setiap 1 jam (60 * 60 * 1000)
const ACTIVITY_CHECK_INTERVAL = 3600000;
const MAX_CONCURRENT_CLIENTS = process.env.MAX_CONCURRENT_CLIENTS || 10; // Batas koneksi klien bersamaan
const MEMORY_LOG_INTERVAL = 30 * 60 * 1000; // Log penggunaan memori setiap 30 menit
let result;

// Implementasi Circuit Breaker sederhana
const circuitBreakers = {};

// Circuit breaker yang dapat memutuskan aliran jika terjadi kesalahan berulang
class CircuitBreaker {
    constructor(name, maxFailures = 3, resetTimeout = 30000) {
        this.name = name;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF-OPEN
        this.failureCount = 0;
        this.maxFailures = maxFailures;
        this.resetTimeout = resetTimeout;
        this.lastFailureTime = null;
        this.nextAttempt = null;
    }

    async execute(fn) {
        if (this.state === 'OPEN') {
            // Cek apakah sudah waktunya reset
            if (Date.now() > this.nextAttempt) {
                this.state = 'HALF-OPEN';
                logger.info(`CircuitBreaker ${this.name} is now HALF-OPEN`);
            } else {
                throw new Error(`Circuit ${this.name} is OPEN until ${new Date(this.nextAttempt).toISOString()}`);
            }
        }

        try {
            const result = await fn();
            if (this.state === 'HALF-OPEN') {
                this.reset();
            }
            return result;
        } catch (error) {
            this.recordFailure();
            throw error;
        }
    }

    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.maxFailures || this.state === 'HALF-OPEN') {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.resetTimeout;
            logger.warn(`CircuitBreaker ${this.name} is now OPEN until ${new Date(this.nextAttempt).toISOString()}`);
        }
    }

    reset() {
        this.failureCount = 0;
        this.state = 'CLOSED';
        this.lastFailureTime = null;
        this.nextAttempt = null;
        logger.info(`CircuitBreaker ${this.name} is now CLOSED`);
    }
}

// Mendapatkan atau membuat circuit breaker baru
const getCircuitBreaker = (name) => {
    if (!circuitBreakers[name]) {
        circuitBreakers[name] = new CircuitBreaker(name);
    }
    return circuitBreakers[name];
};

// Track client activity and auto-disconnect inactive clients
const trackClientActivity = (account_type, username) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    if (!client) return;
    
    // Initialize activity timestamp
    client.lastActivity = Date.now();
    logger.info(`Activity tracking started for ${account} (timeout: ${INACTIVITY_TIMEOUT/60000} minutes)`);
    
    // Log memory usage secara berkala
    const memoryLogger = setInterval(() => {
        const memUsage = memoryUsage();
        logger.info(`Memory usage stats: ${JSON.stringify({
            rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
            activeClients: Object.keys(clients).length
        })}`);
    }, MEMORY_LOG_INTERVAL);
    
    client.memoryLogger = memoryLogger;
    
    // Create inactivity checker
    const inactivityChecker = setInterval(() => {
        if (!clients[account]) {
            clearInterval(inactivityChecker);
            clearInterval(memoryLogger);
            return;
        }
        
        const inactiveTime = Date.now() - client.lastActivity;
        if (inactiveTime > INACTIVITY_TIMEOUT) {
            logger.info(`Auto-disconnecting ${account} after ${Math.round(inactiveTime/60000)} minutes of inactivity`);
            
            // Clear intervals first
            clearInterval(inactivityChecker);
            clearInterval(memoryLogger);
            
            // Disconnect the client but preserve the session
            disconnectClientButKeepSession(account_type, username)
                .then(() => {
                    logger.info(`Successfully auto-disconnected inactive client: ${account}`);
                })
                .catch(err => {
                    logger.error(`Error auto-disconnecting inactive client: ${account}`, err);
                });
        }
    }, ACTIVITY_CHECK_INTERVAL);
    
    client.inactivityChecker = inactivityChecker;
};

const updateClientActivity = (account_type, username) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    if (client) {
        client.lastActivity = Date.now();
        logger.debug(`Activity updated for ${account}`);
        return true;
    }
    return false;
};

const disconnectClientButKeepSession = async (account_type, username) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    if (!client) {
        return { status: 'not_found', message: `Client for ${account} not found` };
    }
    
    try {
        // Clear inactivity checker if it exists
        if (client.inactivityChecker) {
            clearInterval(client.inactivityChecker);
        }
        
        // Clear memory logger if it exists
        if (client.memoryLogger) {
            clearInterval(client.memoryLogger);
        }
        
        // Clean up client without removing from database or deleting files
        client.removeAllListeners();
        await client.destroy();
        delete clients[account];
        
        logger.info(`Client for ${account} disconnected (session preserved)`);
        return { status: 'disconnected', message: `Client for ${account} disconnected (session preserved)` };
    } catch (error) {
        logger.error(`Error disconnecting client for ${account}:`, error);
        return { status: 'error', message: `Error disconnecting client: ${error.message}` };
    }
};


const checkSession = async (account_type, username) => {
    const account = `${username}-${account_type}`;

    const sessionFilePath = path.resolve(__dirname, '../.wwebjs_auth', account);
    const sessionExists = fs.existsSync(sessionFilePath);

    if (sessionExists) {
        const accountExistsInDB = await checkAccountInDatabase(account_type, username);
        if (!accountExistsInDB) {
            logger.warn(`Session found for ${account}, but not in database. Deleting session...`);
            await fs.promises.rm(sessionFilePath, { recursive: true, force: true });
            result = { status: 'session_invalid', message: 'Session file found but not in database, deleted.' };
        } else {
            result = { status: 'session_valid', message: 'Session file and database entry found.' };
        }
    } else {
        result = { status: 'session_not_found', message: 'Session file not found.' };
    }
    return result;
};

const handleQRCode = async (qr) => {
    if (!qr || typeof qr !== 'string') {
        logger.warn('Invalid QR code data received');
        return { status: 'qr_error', message: 'Invalid QR code data.' };
    }
    try {
        const qrCodeBase64 = await qrcode.toDataURL(qr, { scale: 4, margin: 1 });
        logger.info('QR Code generated successfully');
        return { status: 'waiting_for_qr', message: 'Silakan scan QR Code untuk menghubungkan ke WhatsApp.', qrCodeBase64 };
    } catch (error) {
        logger.error('Error generating QR Code:', error);
        return { status: 'qr_error', message: 'Error generating QR Code.' };
    }
};

const initializeClient = async (account_type, username, qrCallback) => {
    const account = `${username}-${account_type}`;
    
    // Cek jumlah klien aktif
    const activeClientCount = Object.keys(clients).length;
    if (activeClientCount >= MAX_CONCURRENT_CLIENTS && !clients[account]) {
        logger.warn(`Maximum client limit (${MAX_CONCURRENT_CLIENTS}) reached, rejecting new connection for ${account}`);
        return { 
            status: 'connection_limit_reached', 
            message: `Batas maksimum koneksi (${MAX_CONCURRENT_CLIENTS}) tercapai. Coba lagi nanti.` 
        };
    }
    
    const sessionFilePath = path.resolve(__dirname, '../.wwebjs_auth', account);

    if (clients[account]) {
        logger.warn(`Existing client found for ${account}, cleaning up...`);
        await disconnectClientButKeepSession(account_type, username);
    }

    let qrCodeSent = false;

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: account,
            dataPath: sessionFilePath,
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',                    // Diperlukan di Docker
                '--disable-setuid-sandbox',        // Pendamping --no-sandbox
                '--disable-dev-shm-usage',         // Penting untuk Docker
                '--disable-gpu',                   // Tidak ada GPU di server
                '--disable-extensions',            // Keamanan dan efisiensi
                '--disable-crash-reporter',        // Mengurangi overheads
                '--disable-notifications',         // Menonaktifkan notifikasi
                '--disable-background-timer-throttling', // Mengurangi penggunaan CPU di background
                '--disable-backgrounding-occluded-windows', // Mengurangi penggunaan memori
                '--disable-breakpad',              // Menonaktifkan crash reporting
                '--disable-component-extensions-with-background-pages', // Mengurangi penggunaan memori
                '--disable-features=TranslateUI,BlinkGenPropertyTrees', // Menonaktifkan fitur yang tidak diperlukan
                '--disable-ipc-flooding-protection', // Mengurangi overhead IPC
                '--enable-low-end-device-mode',    // Mengoptimalkan untuk perangkat dengan spesifikasi rendah
            ],
            defaultViewport: { width: 800, height: 600 },
            ignoreHTTPSErrors: true,
            pipe: true,                           // Menggunakan pipe daripada WebSocket
        }
    })

    client.on('qr', async (qr) => {
        if (!qrCodeSent) {
            qrCodeSent = true;
            const qrStatus = await handleQRCode(qr);
            if (qrCallback) qrCallback(qrStatus);
        }
    });

    client.on('ready', async () => {
        logger.info(`Client for account ${account} is ready`);
        const whatsapp_number = client.info.wid._serialized;
        const saveResult = await saveSessionToDatabase(account_type, username, whatsapp_number);
        
        trackClientActivity(account_type, username);

        if (saveResult.status === 'success') {
            if (qrCallback) {
                qrCallback({
                    number: whatsapp_number,
                    status: 'client_ready',
                    message: 'Client berhasil terhubung.',
                });
            }
            return { number: whatsapp_number, status: 'client_ready', message: 'Client berhasil terhubung.' };
        } else {
            logger.error(`Failed to save session for account ${account}`);
            if (qrCallback) {
                qrCallback({
                    status: 'client_ready_failed',
                    message: 'Client berhasil terhubung, tetapi gagal menyimpan sesi.',
                });
            }
        }
    });

    client.on('message', async (msg) => {
        updateClientActivity(account_type, username);
        await handleMessage(msg, account_type, username);
    });

    client.on('disconnected', async (reason) => {
        logger.warn(`Client for account ${account} disconnected: ${reason}`);
        try {
            // Tambahkan timeout agar tidak blocking
            const deletePromise = deleteSessionFromDatabase(account_type, username);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Database timeout')), 5000)
            );
            
            await Promise.race([deletePromise, timeoutPromise])
                .catch(err => logger.error(`Error deleting session: ${err.message}`));
                
            if (client.inactivityChecker) {
                clearInterval(client.inactivityChecker);
            }
            
            client.removeAllListeners();
            await client.destroy();
            delete clients[account];
        } catch (error) {
            logger.error(`Error cleaning up client for ${account}:`, error);
        }
    });

    client.on('auth_failure', async () => {
        logger.error(`Authentication failed for ${account}`);
        try {
            // Tambahkan retry logic
            const maxRetries = 3;
            let retries = 0;
            
            const retryAuth = async () => {
                if (retries >= maxRetries) {
                    logger.error(`Max auth retries reached for ${account}, deleting session`);
                    await fs.promises.rm(sessionFilePath, { recursive: true, force: true });
                    return;
                }
                
                retries++;
                logger.info(`Retry ${retries}/${maxRetries} for ${account}`);
                
                try {
                    await client.initialize();
                    logger.info(`Client reinitialized for ${account} on retry ${retries}`);
                } catch (err) {
                    logger.error(`Retry ${retries} failed for ${account}: ${err.message}`);
                    setTimeout(retryAuth, 5000 * retries); // Exponential backoff
                }
            };
            
            setTimeout(retryAuth, 3000);
        } catch (error) {
            logger.error(`Error handling auth failure for ${account}:`, error);
        }
    });

    try {
        await client.initialize();
        logger.info(`Client initialized for account: ${account}`);
        clients[account] = client;
        // return { status: 'client_ready', message: 'Client initialized successfully.' };
    } catch (error) {
        logger.error(`Error initializing client for ${account}:`, error);
        delete clients[account];
        return { status: 'initialization_failed', message: `Error: ${error.message}` };
    }
};

const handleMessage = async (msg, account_type, username) => {
    try {
        const nomor_pengirim = msg.to;
        const question = msg.body;

        if (msg.type === 'contact' && msg.vCards.length > 0) {
            const vCardText = msg.vCards[0];
            const contactInfo = parseVCard(vCardText);
            logger.info(`Received contact: ${JSON.stringify(contactInfo)}`);

            const payload = {
                question: question,
                nomor_penerima: contactInfo.phoneNumbers,
                nomor_pengirim: nomor_pengirim,
                account_type: account_type,
                username: username,
            };

            // Gunakan circuit breaker untuk request ke assistant
            const circuitBreaker = getCircuitBreaker('assistant-api-contact');
            
            try {
                const response = await circuitBreaker.execute(async () => {
                    // Tambahkan timeout untuk request ke assistant
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);
                    
                    try {
                        const result = await axios.post(`${ASSISTANT_URL}/assistant/response`, payload, {
                            headers: { 'Content-Type': 'application/json' },
                            signal: controller.signal
                        });
                        clearTimeout(timeoutId);
                        return result;
                    } catch (axiosError) {
                        clearTimeout(timeoutId);
                        if (axios.isCancel(axiosError)) {
                            throw new Error('Request timeout');
                        }
                        throw axiosError;
                    }
                });
                
                if (response.data.status === "success") {
                    const reply = response.data.response;
                    await msg.reply(reply);
                    logger.info(`Message replied successfully: ${reply}`);
                } else {
                    logger.error(`Failed to get response from assistant: ${response.data.message}`);
                }
            } catch (error) {
                if (error.message.includes('Circuit') || error.message === 'Request timeout') {
                    logger.error(`Assistant service unavailable (${error.message})`);
                    await msg.reply("Maaf, layanan assistant sedang tidak tersedia. Silakan coba lagi nanti.");
                } else {
                    logger.error(`Error calling assistant API: ${error.message}`);
                    await msg.reply("Terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi nanti.");
                }
            }
        } else {
            const nomor_penerima = msg.from;
            const assistant = await Assistant.findOne({ where: { nomor_pengirim: nomor_pengirim, status: 'aktif' } });
            if (!assistant) {
                logger.warn(`No active assistant found for ${nomor_pengirim}`);
                return;
            }

            const payload = {
                question: question,
                nomor_penerima: nomor_penerima,
                nomor_pengirim: nomor_pengirim,
                account_type: account_type,
                username: username,
            };

            // Gunakan circuit breaker untuk request ke assistant
            const circuitBreaker = getCircuitBreaker('assistant-api-normal');
            
            try {
                const response = await circuitBreaker.execute(async () => {
                    // Tambahkan timeout untuk request ke assistant
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);
                    
                    try {
                        const result = await axios.post(`${ASSISTANT_URL}/assistant/response`, payload, {
                            headers: { 'Content-Type': 'application/json' },
                            signal: controller.signal
                        });
                        clearTimeout(timeoutId);
                        return result;
                    } catch (axiosError) {
                        clearTimeout(timeoutId);
                        if (axios.isCancel(axiosError)) {
                            throw new Error('Request timeout');
                        }
                        throw axiosError;
                    }
                });
                
                if (response.data.status === "success") {
                    const reply = response.data.response;
                    await msg.reply(reply);
                    logger.info(`Message replied successfully: ${reply}`);
                } else {
                    logger.error(`Failed to get response from assistant: ${response.data.message}`);
                }
            } catch (error) {
                if (error.message.includes('Circuit') || error.message === 'Request timeout') {
                    logger.error(`Assistant service unavailable (${error.message})`);
                    await msg.reply("Maaf, layanan assistant sedang tidak tersedia. Silakan coba lagi nanti.");
                } else {
                    logger.error(`Error calling assistant API: ${error.message}`);
                    await msg.reply("Terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi nanti.");
                }
            }
        }
    } catch (error) {
        logger.error(`Error processing message: ${error.message}`);
        try {
            await msg.reply("Terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi nanti.");
        } catch (replyError) {
            logger.error(`Failed to send error reply: ${replyError.message}`);
        }
    }
};

const handleClientLifecycle = async (act, account_type, username, qrCallback) => {
    const account = `${username}-${account_type}`;
    const sessionStatus = await checkSession(account_type, username);

    if (act === 'valid' && sessionStatus.status === 'session_valid') {
        logger.info(`Session valid for ${account}, starting client`);
        return initializeClient(account_type, username, qrCallback);
    }

    if (act === 'invalid' || sessionStatus.status !== 'session_valid') {
        logger.info(`No valid session for ${account}, initializing new client`);
        const sessionFilePath = path.resolve(__dirname, '../.wwebjs_auth', account);
        if (fs.existsSync(sessionFilePath)) {
            await fs.promises.rm(sessionFilePath, { recursive: true, force: true });
            logger.info(`Old session for ${account} cleared`);
        }
        return initializeClient(account_type, username, qrCallback);
    }

    return { status: 'unknown_error', message: 'Unhandled session state.' };
};

// Update checkClientConnection to check for auto-disconnected clients
const checkClientConnection = async (account_type, username) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    
    if (!client) {
        // Check if this is an auto-disconnected client that can be reconnected
        const accountExistsInDB = await checkAccountInDatabase(account_type, username);
        if (accountExistsInDB) {
            return { 
                state: 'AUTO_DISCONNECTED', 
                isConnected: false, 
                phoneNumber: null,
                canReconnect: true
            };
        }
        return { state: 'DISCONNECTED', isConnected: false, phoneNumber: null };
    }
    
    try {
        // Update activity when checking connection
        updateClientActivity(account_type, username);
        
        const state = await client.getState();
        const isConnected = client.info !== undefined;
        return {
            state: state || 'CONNECTED',
            isConnected,
            phoneNumber: client.info.wid._serialized.replace('@c.us', '')
        };
    } catch (error) {
        logger.error(`Error checking client connection for ${account}:`, error);
        return { state: 'ERROR', isConnected: false, phoneNumber: null };
    }
};

const sendMessageToGroup = async (account_type, username, groupId, messageGroup) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    if (!client) {
        logger.error(`Client for ${account} not found`);
        throw new Error(`Client for ${account} not found`);
    }

    try {
        const chat = await client.getChatById(groupId);
        await chat.sendMessage(messageGroup);
        logger.info(`Message sent to group ${groupId} from ${account}: ${messageGroup}`);
    } catch (error) {
        logger.error(`Error sending message to group:`, error);
        throw error;
    }
};

const disconnectClient = async (account_type, username) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    if (!client) {
        logger.warn(`Client for ${account} not found`);
        return { status: 'not_found', message: `Client for ${account} tidak ditemukan.` };
    }
    try {
        // Bersihkan semua event listeners untuk mencegah memory leak
        client.removeAllListeners(); 
        
        // Clear inactivity checker if it exists
        if (client.inactivityChecker) {
            clearInterval(client.inactivityChecker);
        }
        
        // Clear memory logger if it exists
        if (client.memoryLogger) {
            clearInterval(client.memoryLogger);
        }
        
        await client.destroy();
        logger.info(`Client for ${account} disconnected`);
        const sessionFilePath = path.resolve(__dirname, '../.wwebjs_auth', account);
        if (fs.existsSync(sessionFilePath)) {
            await fs.promises.rm(sessionFilePath, { recursive: true, force: true });
            logger.info(`Session file for ${account} deleted`);
        }
        await deleteSessionFromDatabase(account_type, username);
        delete clients[account];
        return { status: 'disconnected', message: `Akun ${account} berhasil diputuskan.` };
    } catch (error) {
        logger.error(`Error disconnecting client for ${account}:`, error);
        return { status: 'error', message: `Gagal memutuskan koneksi untuk ${account}` };
    }
};

// Update sendMessage to track activity
const sendMessage = async (account_type, username, number, message) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    if (!client) {
        logger.error(`Client for ${account} not found`);
        return { status: 'error_client', message: `Client for ${account} not found` };
    }
    
    // Update activity timestamp
    updateClientActivity(account_type, username);
    
    const chatId = `${number}@c.us`;
    try {
        // Tambahkan timeout untuk pengiriman pesan
        const sendPromise = client.sendMessage(chatId, message);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Message send timeout')), 10000)
        );
        
        await Promise.race([sendPromise, timeoutPromise]);
        
        logger.info(`Message sent to ${number} from ${account}: ${message}`);
        return { status: 'success', message: 'Pesan terkirim' };
    } catch (error) {
        if (error.message === 'Message send timeout') {
            logger.error(`Timeout sending message to ${number} from ${account}`);
            return { status: 'error_timeout', message: 'Timeout saat mengirim pesan' };
        }
        
        logger.error(`Error sending message:`, error);
        return { status: 'error', message: `Gagal mengirim pesan: ${error.message}` };
    }
};

const sendMessageMedia = async (account_type, username, number, message, typeProject, fileUrl, fileName) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    if (!client) {
        logger.error(`Client for ${account} not found`);
        return { status: 'error_client', message: `Client for ${account} not found` };
    }
    const chatId = `${number}@c.us`;
    try {
        if (typeProject === "file") {
            // Tambahkan timeout untuk download file
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            try {
                const response = await axios.get(fileUrl, { 
                    responseType: 'arraybuffer',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                const media = new MessageMedia('application/pdf', Buffer.from(response.data).toString('base64'), path.basename(new URL(fileUrl).pathname));
                await client.sendMessage(chatId, media, { caption: message });
                logger.info(`File sent to ${number} from ${account} with caption: ${message}`);
            } catch (axiosError) {
                clearTimeout(timeoutId);
                if (axios.isCancel(axiosError)) {
                    logger.error(`File download timeout for ${fileUrl}`);
                    throw new Error('File download timeout');
                } else {
                    throw axiosError;
                }
            }
        } else if (typeProject === "pdf") {
            const media = new MessageMedia('application/pdf', fileUrl, `${fileName}.pdf`);
            await client.sendMessage(chatId, media, { caption: message });
            logger.info(`PDF sent to ${number} from ${account} with caption: ${message}`);
        } else if (typeProject === "docx") {
            const media = new MessageMedia('application/vnd.openxmlformats-officedocument.wordprocessingml.document',  fileUrl, `${fileName}.docx`)
            await client.sendMessage(chatId, media, { caption: message });
            logger.info(`DOCX sent to ${number} from ${account} with caption: ${message}`);
        } else {
            // Tambahkan timeout untuk download gambar
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            try {
                const response = await axios.get(fileUrl, { 
                    responseType: 'arraybuffer',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                const media = new MessageMedia('image/jpeg', Buffer.from(response.data).toString('base64'));
                await client.sendMessage(chatId, media, { caption: message });
                logger.info(`Image sent to ${number} from ${account}: ${message}`);
            } catch (axiosError) {
                clearTimeout(timeoutId);
                if (axios.isCancel(axiosError)) {
                    logger.error(`Image download timeout for ${fileUrl}`);
                    throw new Error('Image download timeout');
                } else {
                    throw axiosError;
                }
            }
        }
        return { status: 'success', message: 'Media terkirim' };
    } catch (error) {
        logger.error(`Error sending media message:`, error);
        throw error;
    }
};

const createGroup = async (account_type, username, groupName, participants) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    if (!client) {
        logger.error(`Client for ${account} not found`);
        return { status: 'error', message: `Client for ${account} not found` };
    }
    if (!Array.isArray(participants) || participants.length < 2) {
        logger.error('Minimum 2 participants required for group creation');
        return { status: 'error', message: 'Minimal 2 peserta diperlukan untuk membuat grup' };
    }

    const formattedParticipants = participants.map(num => `${num}@c.us`);
    try {
        const group = await client.createGroup(groupName, formattedParticipants);
        logger.info(`Group '${groupName}' created with ID: ${group.gid._serialized}`);
        return { status: 'success', message: `Grup '${groupName}' berhasil dibuat`, groupId: group.gid._serialized };
    } catch (error) {
        logger.error('Error creating group:', error);
        return { status: 'error', message: 'Gagal membuat grup', error };
    }
};

const getChatHistoryWithContact = async (account_type, username, targetNumber, limit = 10) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    if (!client) {
        logger.error(`Client for ${account} not found`);
        throw new Error(`Client for ${account} not found`);
    }

    try {
        const chatId = `${targetNumber}@c.us`;
        const chat = await client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit });

        const result = {
            chatId: chat.id._serialized,
            name: chat.name,
            messages: messages.map(msg => ({
                id: msg.id._serialized,
                body: msg.body,
                timestamp: msg.timestamp,
                from: msg.from,
                fromMe: msg.fromMe,
                type: msg.type,
            }))
        };
        logger.info(`Chat history with ${targetNumber} retrieved successfully`);
        return result;
    } catch (error) {
        logger.error('Error retrieving chat history:', error);
        return null;
    }
};


const parseVCard = (vCardText) => {
    const lines = vCardText.split('\n');
    let contact = { name: '', phoneNumbers: [] };

    lines.forEach(line => {
        if (line.startsWith('FN:')) {
            contact.name = line.replace('FN:', '').trim();
        } else if (line.startsWith('TEL:') || line.startsWith('TEL;')) {
            contact.phoneNumbers.push(line.replace(/TEL(:|;.*:)/, '').trim());
        }
    });

    return contact;
};

const reconnectAllClients = async () => {
    try {
        const sessions = await Session.findAll({ where: { status: 'active' } });
        for (const session of sessions) {
            const { account_type, username } = session;
            await initializeClient(account_type, username, null);
        }
        logger.info('All clients reconnected successfully');
    } catch (error) {
        logger.error('Error reconnecting all clients:', error);
    }
};

const getLastOutgoingMessages = async (account_type, username, daysAgo = 2) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    if (!client) {
        logger.error(`Client for ${account} not found`);
        throw new Error(`Client for ${account} not found`);
    }

    try {
        const chats = await client.getChats();
        const lastMessagesFromTwoDaysAgo = [];

        const today = new Date();
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(today.getDate() - daysAgo);
        twoDaysAgo.setHours(0, 0, 0, 0);
        const endOfTwoDaysAgo = new Date(twoDaysAgo);
        endOfTwoDaysAgo.setHours(23, 59, 59, 999);

        for (const chat of chats) {
            if (chat.isGroup) continue;
            
            if (lastMessagesFromTwoDaysAgo.length >= 50) break;
            const messages = await chat.fetchMessages({ limit: 1 });
            const sortedMessages = messages.sort((a, b) => b.timestamp - a.timestamp);
            const lastMessage = sortedMessages[0];
            if (!lastMessage) continue;

            const lastMessageDate = new Date(lastMessage.timestamp * 1000);
            if (lastMessage.fromMe && 
                lastMessageDate >= twoDaysAgo && 
                lastMessageDate <= endOfTwoDaysAgo) {
                const contact = await chat.getContact();
                lastMessagesFromTwoDaysAgo.push({
                    chatId: chat.id._serialized,
                    name: contact.name || contact.pushname || contact.number,
                    number: contact.number,
                    lastMessage: lastMessage.body,
                    timestamp: lastMessage.timestamp,
                    messageDate: lastMessageDate.toISOString()
                });
            }
        }

        logger.info(`Found ${lastMessagesFromTwoDaysAgo.length} chats with last message from two days ago`);
        return {
            status: 'success',
            message: `Ditemukan ${lastMessagesFromTwoDaysAgo.length} chat dengan pesan terakhir dari ${daysAgo} hari yang lalu`,
            data: lastMessagesFromTwoDaysAgo,
            date: twoDaysAgo.toLocaleDateString()
        };
    } catch (error) {
        logger.error('Error getting last messages:', error);
        return { status: 'error', message: 'Gagal mendapatkan pesan', error: error.message };
    }
};

// Reconnect a previously disconnected client
const reconnectClient = async (account_type, username, qrCallback) => {
    const account = `${username}-${account_type}`;
    
    // Check if already connected
    if (clients[account]) {
        logger.info(`Client ${account} is already connected`);
        return { status: 'already_connected', message: 'Client sudah terhubung' };
    }
    
    // Check if session exists in database
    const accountExistsInDB = await checkAccountInDatabase(account_type, username);
    if (!accountExistsInDB) {
        logger.warn(`No session found in database for ${account}`);
        return { status: 'session_not_found', message: 'Session tidak ditemukan' };
    }
    
    logger.info(`Reconnecting client for ${account}`);
    return initializeClient(account_type, username, qrCallback);
};

// Fungsi untuk mendapatkan daftar active clients untuk health check
const getActiveClients = () => {
    return clients;
};

const inviteToGroup = async (account_type, username, groupId, participants) => {
    const account = `${username}-${account_type}`;
    const client = clients[account];
    
    if (!client) {
        logger.error(`Client for ${account} not found`);
        return { status: 'error', message: `Client untuk ${account} tidak ditemukan` };
    }

    try {
        // Update aktivitas client
        updateClientActivity(account_type, username);
        
        // Format nomor peserta
        const formattedParticipants = participants.map(num => `${num}@c.us`);
        
        // Dapatkan referensi grup
        const chat = await client.getChatById(`${groupId}@g.us`);
        
        // Tambahkan timeout untuk operasi grup
        const invitePromise = chat.addParticipants(formattedParticipants);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Invite timeout')), 15000)
        );
        
        await Promise.race([invitePromise, timeoutPromise]);
        
        logger.info(`Successfully invited ${participants.length} participants to group ${groupId}`);
        return { 
            status: 'success', 
            message: `Berhasil mengundang ${participants.length} peserta ke grup`,
            invited: participants 
        };
        
    } catch (error) {
        if (error.message === 'Invite timeout') {
            logger.error(`Timeout inviting participants to group ${groupId}`);
            return { 
                status: 'error_timeout', 
                message: 'Timeout saat mengundang peserta ke grup' 
            };
        }
        
        logger.error(`Error inviting participants to group:`, error);
        return { 
            status: 'error', 
            message: `Gagal mengundang peserta: ${error.message}` 
        };
    }
};

module.exports = {
    handleClientLifecycle,
    checkSession,
    initializeClient,
    handleQRCode,
    sendMessage,
    sendMessageMedia,
    checkClientConnection,
    disconnectClient,
    disconnectClientButKeepSession,
    reconnectClient,
    getChatHistoryWithContact,
    handleMessage,
    createGroup,
    reconnectAllClients,
    sendMessageToGroup,
    getLastOutgoingMessages,
    updateClientActivity,
    getActiveClients,
    inviteToGroup,
};