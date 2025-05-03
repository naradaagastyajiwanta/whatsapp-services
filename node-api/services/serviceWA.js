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
        this.initializeClient();
    }

    async initializeClient() {
        try {
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
                        '--disable-gpu'
                    ]
                }
            });

            this.client.on('qr', async (qr) => {
                console.log('QR Code string:', qr.substring(0, 50) + '...');
                console.log('Event QR triggered');
                try {
                    this.qrCode = qr;
                    this.qrCodeBase64 = await new Promise((resolve, reject) => {
                        qrcode.toDataURL(qr, (err, url) => {
                            if (err) {
                                console.error('QR generation error:', err);
                                reject(err);
                            }
                            console.log('Base64 generated successfully');
                            resolve(url);
                        });
                    });
                    console.log('QR Code base64 length:', this.qrCodeBase64.length);
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
                console.error('WhatsApp authentication failed:', msg);
                this.isAuthenticated = false;
            });

            console.log('Initializing WhatsApp client...');
            await this.client.initialize();
            console.log('WhatsApp client initialization completed');

        } catch (error) {
            console.error('Error in initializeClient:', error);
            throw error;
        }
    }

    async getQRCode() {
        try {
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
        return {
            isReady: this.isReady,
            isAuthenticated: this.isAuthenticated,
            hasQR: !!this.qrCodeBase64
        };
    }

    // Method untuk mendapatkan client WhatsApp
    getClient() {
        return this.client;
    }

    // Method untuk mengirim pesan WhatsApp
    async sendMessage(phone, message) {
        try {
            if (!this.client || !this.isReady) {
                return {
                    success: false,
                    error: 'WhatsApp client is not ready'
                };
            }

            // Format nomor telepon jika belum dalam format @c.us
            const formattedNumber = phone.includes('@c.us') ? phone : `${phone}@c.us`;
            
            // Cek apakah nomor terdaftar di WhatsApp
            const isRegistered = await this.client.isRegisteredUser(formattedNumber);
            if (!isRegistered) {
                return {
                    success: false,
                    error: 'Phone number is not registered on WhatsApp'
                };
            }

            // Kirim pesan
            const result = await this.client.sendMessage(formattedNumber, message);
            
            return {
                success: true,
                messageId: result.id._serialized,
                timestamp: result.timestamp,
                message: 'Message sent successfully'
            };
        } catch (error) {
            console.error('Error sending message:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new WhatsAppService();