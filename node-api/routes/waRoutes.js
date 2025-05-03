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
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                h1 {
                    color: #128C7E;
                }
                #qrcode {
                    max-width: 300px;
                    margin: 20px auto;
                    border: 10px solid white;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                #status {
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 5px;
                    background-color: #e0e0e0;
                    display: inline-block;
                }
                .success {
                    background-color: #d4edda;
                    color: #155724;
                }
                .error {
                    background-color: #f8d7da;
                    color: #721c24;
                }
                .waiting {
                    background-color: #fff3cd;
                    color: #856404;
                }
                .button {
                    background-color: #128C7E;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin: 10px;
                }
                .button:hover {
                    background-color: #0C6B5E;
                }
            </style>
            <script>
                let retryCount = 0;
                const maxRetries = 10;
                
                function refreshQR() {
                    fetch('/api/whatsapp/qr?t=' + new Date().getTime())
                        .then(response => response.json())
                        .then(data => {
                            const statusEl = document.getElementById('status');
                            
                            if(data.success && data.qr) {
                                document.getElementById('qrcode').src = data.qr;
                                statusEl.textContent = 'QR Code siap dipindai';
                                statusEl.className = 'success';
                                retryCount = 0; // Reset retry count on success
                            } else if(data.status === 'authenticated') {
                                statusEl.textContent = 'WhatsApp sudah terautentikasi!';
                                statusEl.className = 'success';
                                document.getElementById('qrcode').style.display = 'none';
                                document.getElementById('refresh-btn').style.display = 'none';
                            } else {
                                statusEl.textContent = data.message || 'QR tidak tersedia. Tunggu sebentar...';
                                statusEl.className = 'waiting';
                                
                                // Retry logic with backoff
                                if (retryCount < maxRetries) {
                                    retryCount++;
                                    const delay = Math.min(2000 * retryCount, 10000); // Exponential backoff with max 10s
                                    setTimeout(refreshQR, delay);
                                } else {
                                    statusEl.textContent = 'Gagal mendapatkan QR Code setelah beberapa percobaan. Silakan refresh halaman.';
                                    statusEl.className = 'error';
                                }
                            }
                        })
                        .catch(error => {
                            const statusEl = document.getElementById('status');
                            statusEl.textContent = 'Error: ' + error;
                            statusEl.className = 'error';
                            
                            // Retry on network errors
                            if (retryCount < maxRetries) {
                                retryCount++;
                                setTimeout(refreshQR, 3000);
                            }
                        });
                }

                function manualRefresh() {
                    const statusEl = document.getElementById('status');
                    statusEl.textContent = 'Memuat QR Code baru...';
                    statusEl.className = 'waiting';
                    document.getElementById('qrcode').src = '';
                    retryCount = 0;
                    refreshQR();
                }

                // Load QR when page loads
                window.onload = refreshQR;
                
                // Check status every 10 seconds
                setInterval(() => {
                    fetch('/api/whatsapp/status')
                        .then(response => response.json())
                        .then(data => {
                            if(data.success && data.status === 'connected') {
                                const statusEl = document.getElementById('status');
                                statusEl.textContent = 'WhatsApp sudah terautentikasi!';
                                statusEl.className = 'success';
                                document.getElementById('qrcode').style.display = 'none';
                                document.getElementById('refresh-btn').style.display = 'none';
                            }
                        })
                        .catch(error => console.error('Error checking status:', error));
                }, 10000);
            </script>
        </head>
        <body>
            <h1>WhatsApp QR Code</h1>
            <p>Pindai QR Code ini dengan aplikasi WhatsApp di ponsel Anda</p>
            <p id="status" class="waiting">Memuat QR Code...</p>
            <img id="qrcode" src="" alt="QR Code" />
            <div>
                <button id="refresh-btn" class="button" onclick="manualRefresh()">Refresh QR Code</button>
            </div>
            <p>Petunjuk:</p>
            <ol style="text-align: left; max-width: 500px; margin: 0 auto;">
                <li>Buka WhatsApp di ponsel Anda</li>
                <li>Ketuk Menu (⋮) atau Pengaturan</li>
                <li>Pilih WhatsApp Web/Desktop</li>
                <li>Arahkan kamera ke QR code ini</li>
                <li>Tunggu hingga terhubung</li>
            </ol>
        </body>
        </html>
    `);
});

module.exports = router;