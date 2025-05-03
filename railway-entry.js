/**
 * Railway Entry Point
 * 
 * This is a simplified entry point for Railway deployment that focuses on
 * providing a reliable health check endpoint while gradually initializing
 * the full application.
 */

// Load environment variables
require('dotenv').config();

// Import required modules
const express = require('express');
const http = require('http');
const cors = require('cors');

// Create Express app
const app = express();
const port = process.env.PORT || process.env.API_PORT || 3000;

// Set a different port for the main application to avoid conflicts
process.env.INTERNAL_API_PORT = '3001';

// Aktifkan WhatsApp (nonaktifkan mode headless)
process.env.WHATSAPP_HEADLESS = 'false';

// Basic middleware
app.use(cors());
app.use(express.json());

// Simple health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'WhatsApp Services API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'WhatsApp Services API is running',
    timestamp: new Date().toISOString()
  });
});

// API proxy to forward requests to the main application
app.use('/api', (req, res) => {
  // Forward API requests to the internal application
  const http = require('http');
  const options = {
    hostname: 'localhost',
    port: process.env.INTERNAL_API_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    console.error('Proxy request error:', e);
    res.status(500).json({ error: 'Internal server error' });
  });

  if (req.body) {
    proxyReq.write(JSON.stringify(req.body));
  }
  
  proxyReq.end();
});

// Create HTTP server
const server = http.createServer(app);

// Start the server
server.listen(port, '0.0.0.0', () => {
  console.log(`Railway entry point running on port ${port}`);
  console.log(`Health check endpoint available at: http://localhost:${port}/health`);
  
  // Once the server is running and health checks can pass,
  // initialize the full application in the background
  setTimeout(() => {
    try {
      console.log('Initializing full application...');
      // Check if we're in a Docker environment (where files are in the root directory)
      // or in a local environment (where files are in the node-api directory)
      const indexPath = require('fs').existsSync('./index.js') ? './index.js' : './node-api/index.js';
      console.log(`Loading application from: ${indexPath}`);
      
      // Wrap the require in a try-catch to prevent crash if the main app fails
      try {
        require(indexPath);
        console.log('Full application initialized successfully');
      } catch (appError) {
        console.error('Error in main application, but health check server will continue running:', appError);
      }
    } catch (error) {
      console.error('Error initializing full application:', error);
    }
  }, 2000); // Wait 2 seconds before initializing the full app
}).on('error', (error) => {
  console.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});

// Handle shutdown signals
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Don't exit the process to keep the health check endpoint alive
});
