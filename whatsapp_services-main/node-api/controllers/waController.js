const whatsappService = require('../services/serviceWA');

class WhatsAppController {
    async getStatus(req, res) {
        try {
            const client = whatsappService.getClient();
            const isReady = client?.info?.wid ? true : false;
            
            res.json({
                success: true,
                status: isReady ? 'connected' : 'disconnected'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async sendMessage(req, res) {
        try {
            const { phone, message } = req.body;

            if (!phone || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number and message are required'
                });
            }

            const result = await whatsappService.sendMessage(phone, message);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async checkNumber(req, res) {
        try {
            const { phone } = req.params;
            const client = whatsappService.getClient();
            const formattedNumber = phone.includes('@c.us') ? phone : `${phone}@c.us`;
            
            const isRegistered = await client.isRegisteredUser(formattedNumber);
            
            res.json({
                success: true,
                isRegistered,
                phone: formattedNumber
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getQR(req, res) {
        try {
            const qrData = await whatsappService.getQRCode();
            if (!qrData.success) {
                return res.status(404).json(qrData);
            }
            res.json(qrData);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new WhatsAppController();