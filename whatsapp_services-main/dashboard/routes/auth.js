const express = require('express');
const router = express.Router();
const axios = require('axios');
// const { body, validationResult } = require('express-validator');

require('dotenv').config();

const API_URL = process.env.BACKEND_URL;

router.get('/login', (req, res) => {
    res.render('auth/login', { 
        title: 'Login',
        error: ''
    });
});

router.get('/register', (req, res) => {
    res.render('auth/register', { 
        title: 'Register',
        error: ''
    });
});

router.post('/register', 
    // [
    //     body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
    //     body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
    // ],
    async (req, res) => {
        // const errors = validationResult(req);
        // if (!errors.isEmpty()) {
        //     return res.render('auth/register', { 
        //         title: 'Register',
        //         error: errors.array().map(err => err.msg).join(', ')
        //     });
        // }

        const { username, password } = req.body;

        try {
            const response = await axios.post(`${API_URL}/api/register`, { username, password });

            if (response.status === 201) {
                res.redirect('/auth/login');
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Registration failed';
            res.render('auth/register', { 
                title: 'Register',
                error: errorMessage 
            });
        }
    }
);

router.post('/login', 
    // [
    //     body('username').notEmpty().withMessage('Username is required'),
    //     body('password').notEmpty().withMessage('Password is required')
    // ],
    async (req, res) => {
        // const errors = validationResult(req);
        // if (!errors.isEmpty()) {
        //     return res.render('auth/login', { 
        //         title: 'Login',
        //         error: errors.array().map(err => err.msg).join(', ')
        //     });
        // }

        const { username, password } = req.body;

        try {
            const response = await axios.post(`${API_URL}/api/login`, { username, password });
            if (response.status === 200) {
                const token = response.data.token; 
                const username = response.data.username;
                const user_id = response.data.user_id;
                req.session.token = token;
                req.session.username = username;
                req.session.user_id = user_id;
                res.redirect('/dashboard');
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Invalid credentials';
            res.render('auth/login', {
                title: 'Login', 
                error: errorMessage 
            });
        }
    }
);

module.exports = router;