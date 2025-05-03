// filepath: /c:/mhartian/project/whatsapp_services/node-api/utils/logging.js
const { createLogger, format, transports } = require('winston');
const { combine, printf, colorize } = format;
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
try {
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
} catch (error) {
    console.error('Error creating logs directory:', error);
    // Continue without file logging if directory creation fails
}

// Format log dengan timezone Jakarta
const logFormat = printf(({ level, message, timestamp }) => {
    const jakartaTime = moment(timestamp).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
    return `${jakartaTime} ${level}: ${message}`;
});

// Determine transports based on environment
const logTransports = [
    new transports.Console({
        format: combine(
            colorize(),
            format.timestamp(),
            logFormat
        )
    })
];

// Only add file transports if we're not in a read-only environment (like Railway)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
    try {
        logTransports.push(
            new transports.File({ filename: path.join(logsDir, 'combined.log') }),
            new transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' })
        );
    } catch (error) {
        console.error('Error setting up file transports:', error);
    }
}

// Buat logger
const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        format.timestamp(),
        logFormat
    ),
    transports: logTransports
});

module.exports = logger;