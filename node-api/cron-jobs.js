/**
 * Cron Jobs untuk WhatsApp Service
 * 
 * File ini berisi cron jobs untuk pemantauan otomatis dan pemeliharaan WhatsApp Service
 */

const { memoryUsage } = require('process');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logging');
const { getActiveClients, disconnectClientButKeepSession } = require('./services/waService');

// Monitoring penggunaan memory
const monitorMemoryUsage = () => {
  try {
    const memUsage = memoryUsage();
    const memoryStats = {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
      activeClients: Object.keys(getActiveClients() || {}).length
    };
    
    logger.info(`Memory monitoring: ${JSON.stringify(memoryStats)}`);
    
    // Jika penggunaan heap mencapai threshold tinggi (80% dari batas)
    const heapLimit = parseInt(process.env.NODE_OPTIONS?.match(/--max-old-space-size=(\d+)/)?.[1] || 1024);
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapUsagePercent = (heapUsedMB / heapLimit) * 100;
    
    if (heapUsagePercent > 80) {
      logger.warn(`Memory usage high (${heapUsagePercent.toFixed(2)}% of limit). Auto-disconnecting some inactive clients...`);
      
      // Temukan client yang paling tidak aktif dan putuskan
      autoDisconnectInactiveClients();
    }
  } catch (error) {
    logger.error(`Error monitoring memory: ${error.message}`);
  }
};

// Auto-disconnect client paling tidak aktif jika memori tinggi
const autoDisconnectInactiveClients = () => {
  try {
    const clients = getActiveClients();
    if (!clients) {
      logger.info('No active clients to disconnect');
      return;
    }
    
    const clientEntries = Object.entries(clients);
    
    if (clientEntries.length === 0) return;
    
    // Urutkan client berdasarkan waktu aktivitas terakhir (dari paling lama)
    const sortedClients = clientEntries.sort((a, b) => {
      return (a[1].lastActivity || 0) - (b[1].lastActivity || 0);
    });
    
    // Putuskan 2 client paling tidak aktif
    const disconnectCount = Math.min(2, sortedClients.length);
    for (let i = 0; i < disconnectCount; i++) {
      const [clientId, _] = sortedClients[i];
      const [username, account_type] = clientId.split('-').reverse();
      
      logger.info(`Auto-disconnecting inactive client due to memory pressure: ${clientId}`);
      disconnectClientButKeepSession(account_type, username)
        .then(() => logger.info(`Successfully disconnected ${clientId} due to memory pressure`))
        .catch(err => logger.error(`Error disconnecting ${clientId}: ${err.message}`));
    }
  } catch (error) {
    logger.error(`Error in autoDisconnectInactiveClients: ${error.message}`);
  }
};

// Log penggunaan disk untuk direktori sessions
const monitorDiskUsage = () => {
  try {
    const sessionDir = path.resolve(__dirname, '.wwebjs_auth');
    
    if (!fs.existsSync(sessionDir)) {
      logger.info(`Session directory does not exist: ${sessionDir}`);
      return;
    }
    
    // Calculate directory size using Node.js instead of 'du' command
    const calculateDirSize = (dirPath) => {
      let totalSize = 0;
      
      try {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            totalSize += calculateDirSize(filePath);
          } else {
            totalSize += stats.size;
          }
        }
      } catch (err) {
        logger.error(`Error calculating directory size: ${err.message}`);
      }
      
      return totalSize;
    };
    
    const totalSizeBytes = calculateDirSize(sessionDir);
    const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
    
    logger.info(`WhatsApp sessions disk usage: ${totalSizeMB} MB`);
  } catch (error) {
    logger.error(`Error monitoring disk usage: ${error.message}`);
  }
};

// Inisialisasi cron jobs
const initCronJobs = () => {
  try {
    // Memory monitoring setiap 15 menit
    setInterval(monitorMemoryUsage, 15 * 60 * 1000);
    
    // Disk usage monitoring setiap 1 jam
    setInterval(monitorDiskUsage, 60 * 60 * 1000);
    
    logger.info('Cron jobs initialized');
  } catch (error) {
    logger.error(`Error initializing cron jobs: ${error.message}`);
    // Don't throw the error, just log it
  }
};

// Export untuk digunakan di main app
module.exports = {
  initCronJobs
};