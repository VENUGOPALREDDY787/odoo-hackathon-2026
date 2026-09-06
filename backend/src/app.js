import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config/index.js';
import { logger, createRequestLogger } from './utils/logger.js';
import pinoHttp from 'pino-http';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { container } from './container/index.js';
import { getDatabase } from './utils/database.js';

export function createApp() {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.use(cors({
    origin: config.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  app.use(compression());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  if (config.DEBUG_MODE) {
    app.use((req, res, next) => {
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      let responseBody;

      res.json = (body) => {
        responseBody = body;
        return originalJson(body);
      };
      res.send = (body) => {
        responseBody = body;
        return originalSend(body);
      };

      res.on('finish', () => {
        req.log?.debug({ requestBody: req.body, responseBody, statusCode: res.statusCode }, 'Request and response body');
      });
      next();
    });
  }

  const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          details: null,
        },
      });
    },
  });
  app.use(limiter);

  // Stricter rate limiter for auth routes (brute-force protection)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: 'Too many authentication attempts, please try again later',
          details: null,
        },
      });
    },
  });
  app.use('/api/auth', authLimiter);

  app.use(requestIdMiddleware);

  if (config.DEBUG_MODE) {
    app.use(pinoHttp({ logger, autoLogging: true }));
  }

  app.use((req, res, next) => {
    req.log = createRequestLogger(req);
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      req.log.info({ statusCode: res.statusCode, duration }, 'Request completed');
    });
    next();
  });

  app.get('/health', async (req, res) => {
    const dbHealth = await getDatabase().raw('SELECT 1').then(() => ({ status: 'healthy' })).catch(() => ({ status: 'unhealthy' }));
    const status = dbHealth.status === 'healthy' ? 200 : 503;
    res.status(status).json({
      status: dbHealth.status,
      service: 'dealflow360-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checks: { database: dbHealth },
    });
  });

  app.get('/ready', (req, res) => {
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  });

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function registerRoutes(app) {
  const apiRouter = express.Router();

  apiRouter.get('/', (req, res) => {
    res.json({
      name: 'DealFlow360 API',
      version: '1.0.0',
      docs: '/api/docs',
    });
  });

  const modules = [
    'auth',
    'products',
    'discounts',
    'quotations',
    'approvals',
    'warehouses',
    'subscriptions',
    'upsell',
    'negotiation',
    'dealHealth',
    'reporting',
    'audit',
  ];

  for (const moduleName of modules) {
    try {
      const moduleRoutes = container.get(`${moduleName}Routes`);
      if (moduleRoutes) {
        apiRouter.use(`/${moduleName}`, moduleRoutes);
      }
    } catch (error) {
      logger.debug({ module: moduleName }, 'Module routes not yet registered');
    }
  }

  app.use('/api', apiRouter);
}

export default createApp;