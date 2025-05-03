require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const logger = require('./utils/logging'); // Import logger

// Import cron jobs
const { initCronJobs } = require('./cron-jobs');

const app = express();
// Use Railway's PORT environment variable or fallback to API_PORT or 3000
// If INTERNAL_API_PORT is set (by railway-entry.js), use that instead
const port = process.env.INTERNAL_API_PORT || process.env.PORT || process.env.API_PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'WhatsApp Services API is running',
    timestamp: new Date().toISOString()
  });
});

// Original health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'WhatsApp Services API is running',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);

// Tambahkan rute WhatsApp
const waRoutes = require('./routes/waRoutes');
app.use('/api/whatsapp', waRoutes);

app.use((req, res, next) => {
    res.status(404).json({
        message: 'Route tidak ditemukan'
    });
});

const server = http.createServer(app);

// Initialize WebSocket only if not in a test environment
let wsServer = null;
try {
  // Dynamically import the WebSocket setup to prevent errors if it fails
  const setupWebSocket = require('./websocket/websocket');
  wsServer = setupWebSocket(server);
  logger.info('WebSocket server initialized successfully');
} catch (error) {
  logger.error('Failed to initialize WebSocket server:', error);
  console.error('Failed to initialize WebSocket server:', error);
}

// Initialize cron jobs only if not in a test environment
try {
  if (process.env.DISABLE_CRON_JOBS !== 'true') {
    initCronJobs();
    logger.info('Cron jobs initialized successfully');
  } else {
    logger.info('Cron jobs disabled by environment variable');
  }
} catch (error) {
  logger.error('Failed to initialize cron jobs:', error);
  console.error('Failed to initialize cron jobs:', error);
}

const handleShutdown = async () => {
  logger.info('Server shutting down...');
  if (wsServer && typeof wsServer.close === 'function') {
    try {
      wsServer.close(() => {
        logger.info('WebSocket server closed.');
        process.exit(0);
      });
    } catch (error) {
      logger.error('Error closing WebSocket server:', error);
      process.exit(1);
    }
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

// Start the server with error handling
server.listen(port, '0.0.0.0', () => {
  logger.info(`Server is running on port ${port}`);
  console.log(`Server is running on port ${port}`);
  console.log(`Health check endpoint available at: http://localhost:${port}/health`);
}).on('error', (error) => {
  logger.error(`Failed to start server: ${error.message}`);
  console.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});