const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const expressSession = require('express-session');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');

const app = express();

app.use((req, res, next) => {
    res.locals.ws_url = process.env.WS_URL;
    next();
});

app.use(cors());
app.options('*', cors());
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(expressSession({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use((req, res, next) => {
    if (req.session.username) {
        res.locals.username = req.session.username;
    }
    next();
});

const isAuthenticated = (req, res, next) => {
    if (req.session.token) {
        next();
    } else {
        res.redirect('/auth/login');
    }
};

const redirectIfAuthenticated = (req, res, next) => {
    if (req.session.token) {
        return res.redirect('/dashboard');
    }
    next();
};

app.get('/', (req, res) => res.redirect('/dashboard'));

app.use('/dashboard', (req, res, next) => {
    req.showSidebar = true;
    next();
}, isAuthenticated, dashboardRoutes);

app.use('/profile', (req, res, next) => {
    req.showSidebar = true;
    next();
}, isAuthenticated, profileRoutes);

app.use('/auth', redirectIfAuthenticated, authRoutes);

app.use('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login');
});

app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).render('error', {
        title: status === 404 ? '404 Not Found' : 'Error',
        message: status === 404 ? 'Page not found' : 'Something went wrong!',
        stack: process.env.NODE_ENV === 'development' ? err.stack : null
    });
});

app.use((req, res) => {
    res.status(404).render('error', {
        title: '404 Not Found',
        message: 'Page not found'
    });
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

const port = process.env.DASHBOARD_PORT|| 4000;

app.listen(port, () => {
    console.log(`Server is running on ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});