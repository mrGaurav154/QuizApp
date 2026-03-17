const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');

// Initialize Express app
const app = express();

// Trust proxy for Render/Heroku (required for secure cookies behind load balancer)
app.set('trust proxy', 1);

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Enable CORS with credentials
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    process.env.RENDER_EXTERNAL_URL, // Auto-set by Render
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:5501',
    'http://localhost:5501'
].filter(Boolean); // Remove undefined values

console.log('🌐 CORS allowed origins:', allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            callback(null, true);
        } else {
            console.warn('⚠️ CORS blocked origin:', origin);
            callback(null, true); // Allow for now, can restrict later
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie']
}));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// SESSION CONFIGURATION (called after dotenv is loaded)
// =============================================================================

/**
 * Configure session middleware and routes
 * Must be called AFTER dotenv.config() in server.js
 */
const configureSession = () => {
    // Validate MONGODB_URI is present
    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI not set - sessions will use memory store (not for production!)');
        // Fallback to memory store for development without MongoDB
        app.use(session({
            secret: process.env.SESSION_SECRET || 'quizcraft-secret-key',
            resave: false,
            saveUninitialized: false,
            cookie: {
                maxAge: 7 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: false,
                sameSite: 'lax'
            }
        }));
    } else {
        // PRODUCTION / RENDER SETUP
        // We are relaxing security slightly to ensure the cookie is accepted
        // secure: false (allows cookie over HTTP if proxy trust fails)
        // sameSite: 'lax' (standard for modern browsers, allows navigation)

        console.log('Production/Render environment detected');
        console.log('Configuring MongoStore session...');

        // Session middleware with MongoDB store
        app.use(session({
            secret: process.env.SESSION_SECRET || 'quizcraft-secret-key-change-in-production',
            resave: false,
            saveUninitialized: false,
            store: new MongoStore({
                mongoUrl: process.env.MONGODB_URI,
                collectionName: 'sessions',
                ttl: 7 * 24 * 60 * 60, // 7 days in seconds
                autoRemove: 'native'
            }),
            cookie: {
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
                httpOnly: true, // Prevents JavaScript access to cookie
                secure: false, // CHANGED: Set to false to rule out HTTPS/Proxy issues
                sameSite: 'lax' // CHANGED: Set to 'lax' for compatibility
            }
        }));

        console.log('✓ Session middleware configured with MongoDB store');
        console.log('  Cookie settings: secure=false, sameSite=lax');
    }

    // =============================================================================
    // STATIC FILES (after session so session is available)
    // =============================================================================

    // Serve static files from public directory
    app.use(express.static(path.join(__dirname, '../public')));

    // =============================================================================
    // API ROUTES (must be AFTER session middleware)
    // =============================================================================

    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            message: 'QuizCraft API is running',
            timestamp: new Date().toISOString()
        });
    });

    // Auth routes
    app.use('/api/auth', require('./routes/auth'));

    // User routes
    app.use('/api/users', require('./routes/user'));

    // Category routes
    app.use('/api/categories', require('./routes/category'));

    // Quiz routes
    app.use('/api/quizzes', require('./routes/quiz'));

    // Question routes
    app.use('/api/questions', require('./routes/question'));

    // Result routes
    app.use('/api/results', require('./routes/result'));

    // Student routes
    app.use('/api/students', require('./routes/student'));

    // AI routes
    app.use('/api/ai', require('./routes/ai'));

    // =============================================================================
    // SERVE FRONTEND
    // =============================================================================

    // Serve index.html for root route
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // Catch-all route for SPA - serve index.html for any unmatched routes
    app.get('*', (req, res) => {
        // Check if the request is for an API route
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API endpoint not found' });
        }
        // Otherwise serve the requested HTML file or index.html
        const htmlFile = path.join(__dirname, '../public', req.path);
        res.sendFile(htmlFile, (err) => {
            if (err) {
                res.sendFile(path.join(__dirname, '../public/index.html'));
            }
        });
    });

    // =============================================================================
    // ERROR HANDLING
    // =============================================================================

    // Global error handler
    app.use((err, req, res, next) => {
        console.error('Error:', err.stack);

        res.status(err.status || 500).json({
            error: {
                message: err.message || 'Internal Server Error',
                ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
            }
        });
    });
};

module.exports = { app, configureSession };
