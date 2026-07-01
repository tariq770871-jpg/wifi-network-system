const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const config = require('./shared/config');

const errorHandler = require('./shared/middleware/errorHandler');

// Routes
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

// Security middleware
app.use(helmet());

// CORS - strict configuration (no wildcard fallback)
if (config.cors.origins.length === 0) {
    console.warn('[WARN] ALLOWED_ORIGINS is not set. CORS will reject all cross-origin requests.');
    console.warn('[WARN] Set ALLOWED_ORIGINS in .env e.g.: ALLOWED_ORIGINS=http://localhost:5173');
}
app.use(cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
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

// Swagger API Documentation
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

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'المسار غير موجود' });
});

// Error handler
app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${config.env}`);
    console.log(`API Docs: http://localhost:${PORT}/api-docs`);
});

module.exports = app;
