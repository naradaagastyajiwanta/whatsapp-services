const express = require('express');
const router = express.Router();
const waController = require('../controllers/waController');

router.get('/status', waController.getStatus);

router.post('/send', waController.sendMessage);

router.get('/check/:phone', waController.checkNumber);

router.get('/qr', waController.getQR);

router.get('/qr-display', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp QR Code</title>
            <script>
                function refreshQR() {
                    fetch('/api/whatsapp/qr')
                        .then(response => response.json())
                        .then(data => {
                            if(data.success && data.qr) {
                                document.getElementById('qrcode').src = data.qr;
                                document.getElementById('status').textContent = 'QR Code ready';
                            } else {
                                document.getElementById('status').textContent = data.message || 'QR not available';
                            }
                        })
                        .catch(error => {
                            document.getElementById('status').textContent = 'Error: ' + error;
                        });
                }

                // Refresh QR setiap 5 detik
                setInterval(refreshQR, 5000);
                // Load QR pertama kali
                window.onload = refreshQR;
            </script>
        </head>
        <body>
            <h1>WhatsApp QR Code</h1>
            <p id="status">Loading QR Code...</p>
            <img id="qrcode" src="" alt="QR Code" style="max-width: 300px"/>
        </body>
        </html>
    `);
});

module.exports = router;