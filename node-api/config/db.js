const { Sequelize } = require('sequelize');
require('dotenv').config();
const logger = require('../utils/logging'); // Impor logger

// Determine if we're running in Railway
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';

// Configure database connection options
const getDbConfig = () => {
    // Default SSL configuration
    const sslConfig = {
        require: true,
        rejectUnauthorized: false // Needed for self-signed certs
    };

    // Default connection options
    const connectionOptions = {
        dialect: 'postgres',
        logging: (msg) => logger.info(msg),
        dialectOptions: {
            ssl: sslConfig,
            connectTimeout: 30000  // 30 seconds
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 60000, // 60 seconds
            idle: 10000
        }
    };

    // If DATABASE_URL is provided (Railway provides this)
    if (process.env.DATABASE_URL) {
        logger.info('Using DATABASE_URL for connection');
        
        // For Railway, we need to ensure we're connecting to the correct host
        if (isRailway) {
            // In Railway, use the internal network hostname
            const railwayDbUrl = process.env.DATABASE_URL.replace('localhost', 'postgres.railway.internal')
                                                        .replace('127.0.0.1', 'postgres.railway.internal')
                                                        .replace('::1', 'postgres.railway.internal');
            
            logger.info(`Connecting to Railway database: ${railwayDbUrl.replace(/:[^:]*@/, ':****@')}`);
            return new Sequelize(railwayDbUrl, connectionOptions);
        }
        
        return new Sequelize(process.env.DATABASE_URL, connectionOptions);
    }
    
    // Fallback to individual connection parameters
    logger.info('Using individual database parameters for connection');
    return new Sequelize(
        process.env.DB_NAME, 
        process.env.DB_USER, 
        process.env.DB_PASSWORD, 
        {
            ...connectionOptions,
            host: isRailway ? 'postgres.railway.internal' : (process.env.DB_HOST || 'localhost'),
            port: process.env.DB_PORT || 5432
        }
    );
};

// Initialize Sequelize with the appropriate configuration
const sequelize = getDbConfig();

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
            
            // Display tables and their columns (PostgreSQL syntax)
            try {
                const [tables] = await sequelize.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                `);
                
                logger.info('Tables and their columns:');
                for (const table of tables) {
                    const tableName = table.table_name;
                    
                    // Query to get columns from each table (PostgreSQL)
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
            } catch (error) {
                logger.warn('Could not fetch table information:', error.message);
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