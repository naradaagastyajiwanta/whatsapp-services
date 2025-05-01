const { Sequelize } = require('sequelize');
require('dotenv').config();
const logger = require('../utils/logging'); // Impor logger

// Opsi 1: Menggunakan string koneksi DATABASE_URL (disarankan untuk Railway)
const sequelize = process.env.DATABASE_URL 
    ? new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: (msg) => logger.info(msg),
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false // Diperlukan jika menggunakan SSL
            },
            connectTimeout: 30000  // 30 detik
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 60000, // 60 detik
            idle: 10000
        }
    })
    // Opsi 2: Menggunakan kredensial terpisah (fallback)
    : new Sequelize(
        process.env.DB_NAME, 
        process.env.DB_USER, 
        process.env.DB_PASSWORD, 
        {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            dialect: 'postgres',
            logging: (msg) => logger.info(msg),
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                },
                connectTimeout: 30000  // 30 detik
            },
            pool: {
                max: 5,
                min: 0,
                acquire: 60000, // 60 detik
                idle: 10000
            }
        }
    );

const connectDB = async () => {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            await sequelize.authenticate();
            logger.info('Connection has been established successfully.');
            
            const models = Object.keys(sequelize.models);
            
            logger.info('Models to be synchronized:');
            models.forEach(modelName => {
                logger.info(`- ${modelName}`);
            });

            await sequelize.sync({ 
                alter: false,
                logging: (sql) => {
                    if (sql.includes('CREATE TABLE') || sql.includes('ALTER TABLE')) {
                        logger.info('Sync Action:', sql);
                    }
                }
            });

            logger.info('All models were synchronized successfully.');
            
            // Tampilkan tabel beserta kolomnya (PostgreSQL syntax)
            const [tables] = await sequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `);
            
            logger.info('Tables and their columns:');
            for (const table of tables) {
                const tableName = table.table_name;
                
                // Query untuk mendapatkan kolom dari setiap tabel (PostgreSQL)
                const [columns] = await sequelize.query(`
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = '${tableName}'
                `);
                
                logger.info(`\nTable: ${tableName}`);
                logger.info('Columns:');
                columns.forEach(column => {
                    logger.info(`- ${column.column_name}: ${column.data_type} ${column.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${column.column_default ? `DEFAULT ${column.column_default}` : ''}`);
                });
            }

            return;
        } catch (error) {
            attempt++;
            logger.error(`Attempt ${attempt} failed:`, error.message);

            if (attempt < maxRetries) {
                logger.info(`Retrying to connect in 5 seconds... (${attempt}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            } else {
                logger.error('All retry attempts failed. Unable to connect to the database.');
                throw error;
            }
        }
    }
};

module.exports = { sequelize, connectDB };