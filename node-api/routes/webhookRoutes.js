const express = require('express');
const router = express.Router();
const whatsappService = require('../services/serviceWA');
const { authenticate } = require('../controllers/authController');

// Mendaftarkan webhook baru
router.post('/register', authenticate, (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }

    try {
        const isRegistered = whatsappService.registerWebhook(url);
        if (isRegistered) {
            res.json({
                success: true,
                message: 'Webhook registered successfully',
                url
            });
        } else {
            res.json({
                success: true,
                message: 'Webhook already registered',
                url
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Menghapus webhook
router.post('/unregister', authenticate, (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }

    try {
        const isUnregistered = whatsappService.unregisterWebhook(url);
        if (isUnregistered) {
            res.json({
                success: true,
                message: 'Webhook unregistered successfully',
                url
            });
        } else {
            res.json({
                success: false,
                message: 'Webhook not found',
                url
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Mendapatkan daftar webhook yang terdaftar
router.get('/list', authenticate, (req, res) => {
    try {
        res.json({
            success: true,
            webhooks: whatsappService.webhooks
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
