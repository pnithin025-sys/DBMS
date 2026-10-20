const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const config = require('./config/config');
const { testConnection } = require('./config/db');
const { initSocket } = require('./sockets/socketHandler');
const errorHandler = require('./middleware/errorHandler');

// Import Route Handlers
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const postRoutes = require('./routes/post.routes');
const reelRoutes = require('./routes/reel.routes');
const commentRoutes = require('./routes/comment.routes');
const interactionRoutes = require('./routes/interaction.routes');
const storyRoutes = require('./routes/story.routes');
const messageRoutes = require('./routes/message.routes');
const notificationRoutes = require('./routes/notification.routes');
const searchRoutes = require('./routes/search.routes');
const reportRoutes = require('./routes/report.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: true,
        credentials: true
    }
});
initSocket(io);

// Make io accessible globally in controllers if needed
app.set('io', io);

// Security & Parsing Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for ease of embedding local images/videos and Google fonts
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Assets
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// Mount API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

// Catch-all route to serve the SPA frontend
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Centralized Error Handler
app.use(errorHandler);

// Start Server
server.listen(config.PORT, async () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Pixora Platform Server is running!`);
    console.log(`📍 Web URL: http://localhost:${config.PORT}`);
    console.log(`🛡️  Environment: ${config.NODE_ENV}`);
    console.log(`======================================================\n`);

    await testConnection();
});

module.exports = { app, server };
