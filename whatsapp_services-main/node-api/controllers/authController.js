const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models/users');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

const register = async (req, res) => {
    const { username, password } = req.body;

    console.log('Register Request Received:', { username });

    try {
        console.log('Checking if username exists...');
        const existingUser = await User.findOne({ where: { username } });
        
        if (existingUser) {
            console.log('Username already exists:', username);
            return res.status(400).json({ message: 'Username is already taken.' });
        }

        console.log('Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log('Creating new user...');
        const newUser = await User.create({ 
            username, 
            password: hashedPassword 
        });

        console.log('User registered successfully:', newUser.username);
        res.status(201).json({ 
            message: 'User registered successfully.', 
            user: { id: newUser.user_id, username: newUser.username } 
        });

    } catch (error) {
        console.error('FULL Registration Error:', error);
        res.status(500).json({ 
            message: 'Internal server error during registration.',
            errorDetails: {
                name: error.name,
                message: error.message
            }
        });
    }
};

const login = async (req, res) => {
    const { username, password } = req.body;

    console.log('Login Request Received:', { username });

    try {
        console.log('Searching for user...');
        const user = await User.findOne({ where: { username } });
        
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        console.log('Comparing passwords...');
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            console.log('Invalid password for user:', username);
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        console.log('Generating JWT token...');
        const token = jwt.sign(
            { id: user.user_id, username: user.username }, 
            JWT_SECRET, 
            { expiresIn: JWT_EXPIRES_IN }
        );

        console.log('Login successful for user:', username);
        res.status(200).json({ 
            message: 'Login successful.', 
            username, 
            token 
        });

    } catch (error) {
        console.error('FULL Login Error:', error);
        res.status(500).json({ 
            message: 'Internal server error during login.',
            errorDetails: {
                name: error.name,
                message: error.message
            }
        });
    }
};

const authenticate = (req, res, next) => {
    console.log('Authentication middleware triggered');
    
    const token = req.headers.authorization?.split(' ')[1];

    console.log('Received token:', token ? 'Token present' : 'No token');

    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ message: 'No token provided.' });
    }

    try {
        console.log('Verifying token...');
        const decoded = jwt.verify(token, JWT_SECRET);
        
        console.log('Token verified for user:', decoded.username);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token Verification Error:', error);
        res.status(401).json({ 
            message: 'Invalid token.',
            errorDetails: {
                name: error.name,
                message: error.message
            }
        });
    }
};

module.exports = {
    register,
    login,
    authenticate,
};