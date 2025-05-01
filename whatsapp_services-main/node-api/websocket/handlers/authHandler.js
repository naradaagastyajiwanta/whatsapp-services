const { User } = require('../../models/users');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../../utils/logging');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'mwjdj92jddkdk20k02kd2d';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const checkLogin = (ws, token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;

    } catch (error) {
        ws.send(JSON.stringify({
            status: 'error',
            message: 'Anda harus login terlebih dahulu untuk menggunakan fitur ini.',
            error: error.message
        }));
        logger.error(`Login check failed: ${error.message}`);
    }
};

const loginHandler = async (ws, username, password) => {
    try {
        const user = await User.findOne({ where: { username: username } });

        if (!user) {
            logger.warn(`User not found: ${username}`);
            ws.send(JSON.stringify({ status: 'error', message: 'Login gagal. Password tidak valid.' }));
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            logger.warn(`Invalid password for user: ${username}`);
            ws.send(JSON.stringify({ status: 'error', message: 'Login gagal. Password tidak valid.' }));
            return;
        }

        const token = jwt.sign(
            { id: user.user_id, username: user.username }, 
            JWT_SECRET, 
            { expiresIn: JWT_EXPIRES_IN }
        );

        ws.send(JSON.stringify({
            status: 'success',
            message: 'Berhasil login.',
            userId: user.user_id,
            username: user.username,
            token: token
        }));
        logger.info(`User logged in: ${username}`);
    } catch (error) {
        ws.send(JSON.stringify({
            status: 'error',
            message: 'Terjadi kesalahan saat login.',
            error: error.message
        }));
        logger.error(`Error in loginHandler: ${error.message}`);
    }
};

const registerHandler = async (ws, username, password) => {
    try {
        const existingUser = await User.findOne({ where: { username: username } });

        if (existingUser) {
            logger.warn(`Registration failed. Username already exists: ${username}`);
            ws.send(JSON.stringify({ status: 'error', message: 'Registrasi gagal. Username sudah terdaftar.' }));
            return;
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            username: username,
            password: hashedPassword
        });

        ws.send(JSON.stringify({ 
            userId: newUser.user_id, 
            username: newUser.username, 
            status: 'success', 
            message: 'Registrasi berhasil. Silakan login untuk melanjutkan.' 
        }));
        logger.info(`User registered: ${username}`);
    } catch (error) {
        ws.send(JSON.stringify({
            status: 'error',
            message: 'Terjadi kesalahan saat registrasi.',
            error: error.message
        }));
        logger.error(`Error in registerHandler: ${error.message}`);
    }
};

module.exports = { loginHandler, registerHandler, checkLogin };