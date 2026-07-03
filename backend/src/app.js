const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const config = require('./shared/config');

const errorHandler = require('./shared/middleware/errorHandler');

const { authRoutes } = require('./modules/auth');
const { usersRoutes } = require('./modules/users');
const { ticketsRoutes } = require('./modules/tickets');
const { trackingRoutes } = require('./modules/tracking');
const { mapPointsRoutes } = require('./modules/map-points');
const { reportsRoutes } = require('./modules/reports');
const { signalRoutes } = require('./modules/signal');
const { networksRoutes } = require('./modules/networks');
const { devicesRoutes } = require('./modules/devices');

const specs = require('./shared/swagger');

const app = express();

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO
const corsOrigins = config.cors.origins;
const ioCorsOrigin = corsOrigins === true ? true : (Array.isArray(corsOrigins) && corsOrigins.length > 0 ? corsOrigins : true);

const io = new Server(server, {
  cors: {
    origin: ioCorsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  },
});

// Make io accessible in routes/controllers via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('leave_room', (room) => {
    socket.leave(room);
    console.log(`Socket ${socket.id} left room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// CORS - allow all origins if ALLOWED_ORIGINS is empty
app.use(cors({
    origin: corsOrigins === true ? true : (Array.isArray(corsOrigins) && corsOrigins.length > 0 ? corsOrigins : true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { success: false, error: 'طلبات كثيرة جداً، حاول لاحقاً' },
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: config.env });
});

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: { persistAuthorization: true },
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/map-points', mapPointsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/signal', signalRoutes);
app.use('/api/networks', networksRoutes);
app.use('/api/devices', devicesRoutes);

// 404
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'المسار غير موجود' });
});

// Error handler
app.use(errorHandler);

const PORT = config.port;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${config.env}`);
    console.log(`API Docs: http://localhost:${PORT}/api-docs`);
});

module.exports = { app, server, io };