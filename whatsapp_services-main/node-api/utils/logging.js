// filepath: /c:/mhartian/project/whatsapp_services/node-api/utils/logging.js
const { createLogger, format, transports } = require('winston');
const { combine, printf, colorize } = format;
const moment = require('moment-timezone');

// Format log dengan timezone Jakarta
const logFormat = printf(({ level, message, timestamp }) => {
    const jakartaTime = moment(timestamp).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
    return `${jakartaTime} ${level}: ${message}`;
});

// Buat logger
const logger = createLogger({
    level: 'info',
    format: combine(
        format.timestamp(),
        logFormat
    ),
    transports: [
        new transports.Console({
            format: combine(
                colorize(),
                format.timestamp(),
                logFormat
            )
        }),
        new transports.File({ filename: 'logs/combined.log' }), // Semua log
        new transports.File({ filename: 'logs/error.log', level: 'error' }) // Log error saja
    ]
});

module.exports = logger;