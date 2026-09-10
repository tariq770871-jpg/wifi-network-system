const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const config = require('./shared/config');
const logger = require('./shared/utils/logger');
const { requestId } = require('./shared/middleware/requestId');
const { i18n } = require('./shared/i18n');
const { runMigrationsOnBoot, migrationState } = require('./shared/db/migrate');

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

// MIGRATIONS: عند تفعيل RUN_MIGRATIONS=true تعمل ترقيات المخطط (idempotent) مرة
// واحدة عند إقلاع كل حاوية — تستخدم لدفع تغييرات المخطط إلى قاعدة الإنتاج
// بدون وصول مباشر، وتُعرض حالتها في /health للتحقق
runMigrationsOnBoot();

// PROXY: Vercel يضع الطلب خلف وكيل واحد — بدون هذا يرفض express-rate-limit
// ترويسة X-Forwarded-For (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) ويفشل تحديد IP المستخدم
app.set('trust proxy', 1);

// SECURITY: حماية HTTP headers (XSS، clickjacking، sniffing...)
app.use(helmet({
    contentSecurityPolicy: config.env === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
}));

// PERFORMANCE: ضغط الاستجابات (gzip/deflate)
app.use(compression());

// Correlation: معرّف فريد لكل طلب + ترجمة حسب Accept-Language
app.use(requestId);
app.use(i18n);

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

// SECURITY: مصادقة إلزامية على مصافحة Socket.IO — لا اتصالات مجهولة
// يقبل: handshake.auth.token أو ترويسة Authorization أو كوكي الجلسة HttpOnly
io.use((socket, next) => {
  try {
    const bearer = (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    let cookieToken = null;
    const rawCookie = socket.handshake.headers?.cookie;
    if (rawCookie) {
      const match = /(?:^|;\s*)token=([^;]+)/.exec(rawCookie);
      if (match) cookieToken = decodeURIComponent(match[1]);
    }
    const token = socket.handshake.auth?.token || bearer || cookieToken;
    if (!token) return next(new Error('unauthorized'));
    const payload = jwt.verify(token, config.jwt.secret);
    socket.data.user = { userId: payload.userId, username: payload.username, role: payload.role };
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

// Make io accessible in routes/controllers via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  const { role } = socket.data.user || {};

  socket.on('join_room', (room) => {
    // SECURITY: يُسمح بالانضمام لغرفة دوره فقط — لا انتحال غرف admin/support
    if (typeof room !== 'string' || room !== role) return;
    socket.join(room);
  });

  socket.on('leave_room', (room) => {
    if (typeof room === 'string' && room === role) socket.leave(room);
  });

  socket.on('disconnect', () => {
    /* تنظيف تلقائي */
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
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging: morgan يمر عبر الـ logger المنظم مع request-id
morgan.token('id', (req) => req.id);
app.use(morgan(':id :method :url :status :res[content-length] - :response-time ms', {
    stream: { write: (line) => logger.info(line.trim()) },
    skip: (req) => req.url === '/health',
}));

// Health check: يتضمن فحص قاعدة البيانات
const { query } = require('./shared/db');
app.get('/health', async (req, res) => {
    let db = 'ok';
    try {
        await query('SELECT 1');
    } catch {
        db = 'degraded';
    }
    const payload = {
        status: 'ok',
        db,
        // حالة ترقيات المخطط الذاتية (disabled/running/done/failed)
        migration: migrationState.status,
        timestamp: new Date().toISOString(),
        env: config.env,
        uptime_s: Math.floor(process.uptime()),
    };
    if (migrationState.error) payload.migration_error = migrationState.error;
    res.status(db === 'ok' ? 200 : 503).json(payload);
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
    res.status(404).json({ success: false, error: req.t ? req.t('ROUTE_NOT_FOUND') : 'المسار غير موجود' });
});

// Error handler
app.use(errorHandler);

// STABILITY: منع انهيار العملية على أخطاء غير معالجة
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { reason: reason instanceof Error ? reason.stack : reason });
});
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception - exiting', { reason: err.stack });
    process.exit(1);
});

const PORT = config.port;

// Only start listening when run directly (not during tests / imports)
if (process.env.NODE_ENV !== 'test' && require.main === module) {
    server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`, { env: config.env, docs: `/api-docs` });
    });
}

module.exports = { app, server, io };