const express = require('express');
const { register, login, authenticate } = require('../controllers/authController');
// const { body } = require('express-validator');
const router = express.Router();

router.post('/register', 
    // [
    //     body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
    //     body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
    // ],
    register
);

router.post('/login', 
    // [
    //     body('username').notEmpty().withMessage('Username is required'),
    //     body('password').notEmpty().withMessage('Password is required')
    // ],
    login
);

// Contoh rute yang dilindungi
router.get('/protected', authenticate, (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
});

module.exports = router;