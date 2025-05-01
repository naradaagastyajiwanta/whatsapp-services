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
const port = process.env.API_PORT || 3000;

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

setupWebSocket(server);

// Inisialisasi cron jobs
initCronJobs();

const handleShutdown = async () => {
    logger.info('Server shutting down...');
    wss.close(() => {
        logger.info('WebSocket server closed.');
        process.exit(0);
    });
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

process.on('uncaughtException', async (err) => {
    logger.error('Uncaught Exception:', err);
    await handleShutdown();
});

server.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
    console.log(`Server is running on port ${port}`);
});