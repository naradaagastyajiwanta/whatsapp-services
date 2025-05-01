const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

const API_URL = process.env.BACKEND_URL || 'http://node-api:3000';

// Rute untuk halaman dashboard
router.get('/', (req, res) => {
    res.render('dashboard/index', {
        title: 'Dashboard',
        showSidebar: req.showSidebar // Pastikan showSidebar didefinisikan
    });
});

// Rute untuk mendapatkan data pesan yang sudah dikirim berdasarkan accountId
router.get('/getData', async (req, res) => {
    const { accountId } = req.query;
    if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required' });
    }

    try {
        // Lakukan permintaan ke backend
        const response = await axios.post(`${API_URL}/api/getData`, {
            accountId,
        });
        const data = response.data; // Asumsikan data yang diterima dalam bentuk JSON

        // Render halaman dashboard dengan data dari backend
        res.json(data)
    } catch (error) {
        console.error('Error fetching data from backend:', error.message);
        res.status(500).json({ error: 'Failed to fetch sent messages' });
    }
});

module.exports = router;