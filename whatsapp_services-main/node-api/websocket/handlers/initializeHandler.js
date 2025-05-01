const { handleClientLifecycle, checkSession, checkClientConnection } = require('../../services/waService');
const { checkLogin } = require('./authHandler');
const logger = require('../../utils/logging'); // Impor logger

const initializeHandler = async (ws, account_type, token) => {
    // Validasi token dan ambil data pengguna
    const decoded = checkLogin(ws, token);
    if (!decoded || !decoded.username || !decoded.id) {
        logger.warn(`Invalid token received`);
        ws.send(JSON.stringify({
            status: 'error',
            message: 'Autentikasi gagal. Token tidak valid atau kadaluarsa.'
        }));
        return;
    }

    const username = decoded.username;
    const userId = decoded.id;
    logger.info(`${username} is trying to initialize a client for account_type: ${account_type}`);

    try {
        // Cek status sesi dan koneksi client
        const sessionStatus = await checkSession(account_type, username);

        // Jika sesi valid, mulai client tanpa QR code
        if (sessionStatus.status === 'session_valid') {
            const session = await checkClientConnection(account_type, username);
            if (session.state === 'CONNECTED') {
                logger.info(`Account ${account_type} for ${username} is already connected`);
                ws.send(JSON.stringify({
                    username: username,
                    account_type,
                    status: session.state,
                    phoneNumber: session.phoneNumber,
                    message: 'Akun sudah terhubung.'
                }));
                return;
            }
            logger.info(`Session valid for ${account_type}, starting client without QR code`);
            ws.send(JSON.stringify({
                username: username,
                account_type,
                status: "Sedang menghubungkan kembali ke Whatsapp",
            }));
            act = "valid";
            const clientStatus = await handleClientLifecycle(act, account_type, username, (qrCodeStatus) => {
                ws.send(JSON.stringify({
                    username: username,
                    account_type,
                    status: qrCodeStatus.status,
                    message: qrCodeStatus.message,
                    qrCodeBase64: qrCodeStatus.qrCodeBase64,
                }));
            });
            return;
        }

        // Jika sesi tidak valid atau tidak ditemukan, buat koneksi baru dengan QR code
        if (sessionStatus.status === 'session_invalid' || sessionStatus.status === 'session_not_found') {
            logger.info(`No valid session found for ${account_type}, generating QR code`);
            ws.send(JSON.stringify({
                username: username,
                account_type,
                status: 'belum terhubung atau digunakan, Silahkan scan QR code',
            }));
            act = "invalid";
            const clientStatus = await handleClientLifecycle(act, account_type, username, (qrCodeStatus) => {
                ws.send(JSON.stringify({
                    username: username,
                    account_type,
                    status: qrCodeStatus.status,
                    message: qrCodeStatus.message,
                    qrCodeBase64: qrCodeStatus.qrCodeBase64,
                }));
            });
            return;
        }

        // Jika status sesi tidak dikenali
        logger.warn(`Unhandled session state for ${account_type}`);
        ws.send(JSON.stringify({
            username: username,
            account_type,
            status: 'unknown_error',
            message: 'Status sesi tidak dikenali.'
        }));
    } catch (error) {
        logger.error(`Error initializing client for ${account_type} by ${username}: ${error.message}`);
        ws.send(JSON.stringify({
            username: username,
            account_type,
            status: 'error',
            message: 'Gagal menghubungkan, coba lagi.',
            detail: error.message
        }));
    }
};

module.exports = initializeHandler;