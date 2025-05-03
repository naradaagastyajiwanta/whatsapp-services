require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const setupWebSocket = require('./websocket/websocket');
const logger = require('./utils/logging'); // Import logger

// Import cron jobs
const { initCronJobs } = require('./cron-jobs');

const app = express();
// Use Railway's PORT environment variable or fallback to API_PORT or 3000
const port = process.env.PORT || process.env.API_PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint untuk Railway
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'WhatsApp Services API is running',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);

app.use((req, res, next) => {
    res.status(404).json({
        message: 'Route tidak ditemukan'
    });
});

const server = http.createServer(app);

// Store the WebSocket server instance
const wsServer = setupWebSocket(server);

// Inisialisasi cron jobs
try {
    initCronJobs();
} catch (error) {
    logger.error('Error initializing cron jobs:', error);
    console.error('Error initializing cron jobs:', error);
}

const handleShutdown = async () => {
    logger.info('Server shutting down...');
    if (wsServer && typeof wsServer.close === 'function') {
        wsServer.close(() => {
            logger.info('WebSocket server closed.');
            process.exit(0);
        });
    } else {
        logger.info('No WebSocket server to close or already closed.');
        process.exit(0);
    }
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

process.on('uncaughtException', async (err) => {
    logger.error('Uncaught Exception:', err);
    console.error('Uncaught Exception:', err);
    await handleShutdown();
});

server.listen(port, '0.0.0.0', () => {
    logger.info(`Server is running on port ${port}`);
    console.log(`Server is running on port ${port}`);
});