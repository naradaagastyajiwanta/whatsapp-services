const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const WASession = require('../models/dataWA');

class WhatsAppService {
    constructor() {
        this.sessionData = null;
        this.client = null;
        this.qrCode = null;
        this.isReady = false;
        this.isAuthenticated = false;
        
        // Cek apakah mode headless (tanpa WhatsApp) diaktifkan
        this.headlessMode = process.env.WHATSAPP_HEADLESS === 'true';
        
        if (!this.headlessMode) {
            // Hanya inisialisasi client jika tidak dalam mode headless
            this.initializeClient();
        } else {
            console.log('WhatsApp running in headless mode. Client not initialized.');
        }
    }

    async initializeClient() {
        try {
            // Deteksi lingkungan Railway
            const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
            console.log(`Initializing WhatsApp client in ${isRailway ? 'Railway' : 'local'} environment`);
            
            // Coba beberapa path Chromium yang umum digunakan
            let chromiumPaths = [
                '/usr/bin/chromium',
                '/usr/bin/chromium-browser',
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable'
            ];
            
            // Log path yang akan dicoba
            console.log('Akan mencoba path Chromium berikut:', chromiumPaths.join(', '));
            
            // Menggunakan LocalAuth dari whatsapp-web.js
            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: './whatsapp-sessions'
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--disable-extensions',
                        '--disable-features=site-per-process',
                        '--ignore-certificate-errors',
                        '--ignore-certificate-errors-spki-list',
                        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    ],
                    // Gunakan path Chromium yang benar di Railway
                    executablePath: isRailway ? '/usr/bin/chromium' : (process.env.CHROME_BIN || null),
                    ignoreHTTPSErrors: true
                }
            });

            this.client.on('qr', async (qr) => {
                console.log('QR Code received:', qr.substring(0, 20) + '...');
                console.log('QR Code length:', qr.length);
                console.log('Event QR triggered at:', new Date().toISOString());
                try {
                    this.qrCode = qr;
                    // Tambahkan timeout untuk memastikan QR code diproses dengan benar
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    this.qrCodeBase64 = await new Promise((resolve, reject) => {
                        qrcode.toDataURL(qr, { 
                            errorCorrectionLevel: 'H',
                            margin: 4,
                            scale: 8,
                            color: {
                                dark: '#000000',
                                light: '#ffffff'
                            }
                        }, (err, url) => {
                            if (err) {
                                console.error('QR generation error:', err);
                                reject(err);
                            }
                            console.log('Base64 QR generated successfully, length:', url.length);
                            resolve(url);
                        });
                    });
                    console.log('QR Code base64 generated at:', new Date().toISOString());
                    
                    // Log QR code untuk debugging di Railway
                    console.log('QR Code URL:', this.qrCodeBase64.substring(0, 50) + '...');
                } catch (error) {
                    console.error('Detailed QR Generation Error:', error);
                    this.qrCode = null;
                    this.qrCodeBase64 = null;
                }
            });

            this.client.on('ready', () => {
                console.log('WhatsApp Client is ready!');
                this.isReady = true;
                this.qrCode = null;
                this.qrCodeBase64 = null;
            });

            this.client.on('authenticated', (session) => {
                console.log('WhatsApp Client is authenticated!');
                this.isAuthenticated = true;
                this.qrCode = null;
                this.qrCodeBase64 = null;
            });

            this.client.on('auth_failure', (msg) => {
                console.error('AUTH FAILURE:', msg);
                this.isAuthenticated = false;
                this.isReady = false;
                // Optional: clear session data here if needed
            });

            this.client.on('disconnected', (reason) => {
                console.warn('WhatsApp Client was logged out/disconnected:', reason);
                this.isAuthenticated = false;
                this.isReady = false;
                // Optional: clear session data here if needed
            });

            // Event listener untuk pesan masuk
            this.client.on('message', (message) => {
                console.log('Pesan masuk:', message.body);
                this.handleIncomingMessage(message);
            });

            console.log('Initializing WhatsApp client...');
            try {
                await this.client.initialize();
                console.log('WhatsApp client initialization completed');
            } catch (initError) {
                console.error('Failed to initialize WhatsApp client:', initError);
                
                // Jika gagal menginisialisasi karena masalah Chromium, aktifkan mode headless
                if (initError.message && initError.message.includes('Failed to launch the browser process')) {
                    console.log('Switching to headless mode due to browser launch failure');
                    this.headlessMode = true;
                }
                
                throw initError;
            }
        } catch (error) {
            console.error('Error in initializeClient:', error);
            throw error;
        }
    }

    async getQRCode() {
        try {
            if (this.headlessMode) {
                return {
                    success: false,
                    message: 'WhatsApp is running in headless mode',
                    status: 'headless'
                };
            }
            
            if (this.isAuthenticated) {
                return {
                    success: false,
                    message: 'Already authenticated',
                    status: 'authenticated'
                };
            }

            if (!this.qrCodeBase64) {
                return {
                    success: false,
                    message: 'QR Code not available yet. Please wait...',
                    status: 'waiting_for_qr'
                };
            }

            return {
                success: true,
                qr: this.qrCodeBase64,
                status: 'qr_ready'
            };
        } catch (error) {
            console.error('Error in getQRCode:', error);
            return {
                success: false,
                error: error.message,
                status: 'error'
            };
        }
    }

    // Method untuk mengecek status koneksi
    getStatus() {
        if (this.headlessMode) {
            return {
                isReady: false,
                isAuthenticated: false,
                hasQR: false,
                headlessMode: true
            };
        }
        
        return {
            isReady: this.isReady,
            isAuthenticated: this.isAuthenticated,
            hasQR: !!this.qrCodeBase64,
            headlessMode: false
        };
    }

    // Method untuk mendapatkan client WhatsApp
    getClient() {
        return this.client;
    }

    /**
     * Send WhatsApp Message with timeout and logging
     * @param {string} phone
     * @param {string} message
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async sendMessage(phone, message) {
        console.log(`[WA] sendMessage called at ${new Date().toISOString()} | phone: ${phone}, message: ${message}`);
        if (!this.client || !this.isReady) {
            console.error('[WA] WhatsApp client is not ready');
            return { success: false, error: 'WhatsApp client is not ready' };
        }

        // Timeout wrapper
        const TIMEOUT_MS = 10000; // 10 seconds
        function withTimeout(promise, ms) {
            return Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout sending message')), ms))
            ]);
        }

        const formattedNumber = phone.includes('@c.us') ? phone : `${phone}@c.us`;
        try {
            // Cek apakah nomor terdaftar di WhatsApp sebelum mengirim pesan
            const isRegistered = await this.client.isRegisteredUser(formattedNumber);
            console.log(`[WA] isRegisteredUser for ${formattedNumber}:`, isRegistered);
            if (!isRegistered) {
                return { success: false, error: 'Phone number is not registered on WhatsApp' };
            }
            const result = await withTimeout(this.client.sendMessage(formattedNumber, message), TIMEOUT_MS);
            console.log(`[WA] Message sent successfully to ${formattedNumber} | messageId: ${result.id._serialized}`);
            return { success: true, messageId: result.id._serialized };
        } catch (err) {
            console.error(`[WA] Failed to send message to ${formattedNumber}:`, err);
            return { success: false, error: err.message || 'Failed to send message' };
        }
    }

    handleIncomingMessage(message) {
        // Implementasi untuk menangani pesan masuk
        console.log('Pesan masuk dari:', message.from);
        console.log('Isi pesan:', message.body);
        
        // Kirim pesan ke webhook yang terdaftar
        this.sendToWebhooks({
            from: message.from,
            body: message.body,
            timestamp: message.timestamp,
            type: message.type,
            hasMedia: message.hasMedia,
            id: message.id._serialized,
            isGroup: message.isGroup,
            author: message.author || null,
            deviceType: message.deviceType,
            isForwarded: message.isForwarded
        });
    }

    // Menyimpan daftar webhook yang terdaftar
    webhooks = [];

    // Mendaftarkan webhook baru
    registerWebhook(url) {
        if (!this.webhooks.includes(url)) {
            this.webhooks.push(url);
            console.log(`Webhook registered: ${url}`);
            return true;
        }
        return false;
    }

    // Menghapus webhook
    unregisterWebhook(url) {
        const index = this.webhooks.indexOf(url);
        if (index !== -1) {
            this.webhooks.splice(index, 1);
            console.log(`Webhook unregistered: ${url}`);
            return true;
        }
        return false;
    }

    // Mengirim data ke semua webhook yang terdaftar
    async sendToWebhooks(data) {
        const axios = require('axios');
        
        for (const webhookUrl of this.webhooks) {
            try {
                console.log(`Sending data to webhook: ${webhookUrl}`);
                await axios.post(webhookUrl, data);
                console.log(`Data sent successfully to: ${webhookUrl}`);
            } catch (error) {
                console.error(`Error sending data to webhook ${webhookUrl}:`, error.message);
            }
        }
    }
}

module.exports = new WhatsAppService();