const express = require('express');
const router = express.Router();

// Rute untuk halaman utama Openai
router.get('/', (req, res) => {
    res.render('profile/index', {
        title: 'Profile',
        showSidebar: req.showSidebar,
        username: res.locals.username // Ambil username dari res.locals
    });
});

module.exports = router;