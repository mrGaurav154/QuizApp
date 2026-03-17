const path = require('path');

// Load environment variables - support both local .env and Render env vars
// Check if we're in production/Render (MONGODB_URI already set) or development
if (!process.env.MONGODB_URI) {
  // Only load .env file if MONGODB_URI is not already set (local development)
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const { app, configureSession } = require('./app');
const connectDB = require('./config/db');
const http = require('http');
const socketIo = require('socket.io');

// =============================================================================
// SERVER STARTUP & WEBSOCKETS
// =============================================================================

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Adjust in production
        methods: ["GET", "POST"]
    }
});

// Socket.io Connection Logic for Live Leaderboard
io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);

    // Join a specific quiz room (Teacher Dashboard)
    socket.on('join_quiz_room', (quizId) => {
        socket.join(quizId);
        console.log(`👨‍🏫 Client joined room for Quiz: ${quizId}`);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

// Make io accessible to global scope (or routes)
app.set('io', io);

const PORT = process.env.PORT || 3000;

/**
 * Start the server
 */
const startServer = async () => {
    try {
        // Log environment info (for debugging)
        console.log('Environment variables loaded:');
        console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
        console.log(`  MONGODB_URI: ${process.env.MONGODB_URI ? 'Set ✓' : 'NOT SET ✗'}`);
        console.log(`  SESSION_SECRET: ${process.env.SESSION_SECRET ? 'Set ✓' : 'NOT SET ✗'}`);
        
        // Connect to MongoDB
        await connectDB();
        
        // Configure session middleware (after dotenv and MongoDB connection)
        configureSession();
        
        // Start HTTP Server (which includes Express & Socket.io)
        server.listen(PORT, () => {
            console.log('');
            console.log('╔═══════════════════════════════════════════════════════════╗');
            console.log('║                                                           ║');
            console.log('║   ██████╗ ██╗   ██╗██╗███████╗ ██████╗██████╗  █████╗ ███████╗████████╗  ║');
            console.log('║  ██╔═══██╗██║   ██║██║╚══███╔╝██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝  ║');
            console.log('║  ██║   ██║██║   ██║██║  ███╔╝ ██║     ██████╔╝███████║█████╗     ██║     ║');
            console.log('║  ██║▄▄ ██║██║   ██║██║ ███╔╝  ██║     ██╔══██╗██╔══██║██╔══╝     ██║     ║');
            console.log('║  ╚██████╔╝╚██████╔╝██║███████╗╚██████╗██║  ██║██║  ██║██║        ██║     ║');
            console.log('║   ╚══▀▀═╝  ╚═════╝ ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝     ║');
            console.log('║                                                           ║');
            console.log('╚═══════════════════════════════════════════════════════════╝');
            console.log('');
            console.log(`   ✓ Server running on http://localhost:${PORT}`);
            console.log(`   ✓ WebSockets (Socket.io) enabled`);
            console.log(`   ✓ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   ✓ Authentication: Session-based (MongoDB store)`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
