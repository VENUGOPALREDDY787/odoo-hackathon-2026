import { createApp } from './app.js';
import config from './config/index.js';
import { logger } from './utils/logger.js';
import { getDatabase, closeDatabase } from './utils/database.js';
import { container } from './container/index.js';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { createCache } from './utils/cache.js';
import { socketAuth } from './middleware/socketAuth.js';

import { registerAuthModule } from './modules/auth/index.js';
import { registerProductModule } from './modules/products/index.js';

async function bootstrap() {
  try {
    const db = getDatabase();
    await db.raw('SELECT 1');
    logger.info('Database connection established');
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to connect to database');
    process.exit(1);
  }

  // Build Redis client (optional)
  let redisClient = null;
  const redisUrl = config.REDIS_URL || (config.REDIS_HOST ? `redis://${config.REDIS_HOST}:${config.REDIS_PORT || 6379}` : null);
  
  if (redisUrl) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
    });
    
    redisClient.on('connect', () => logger.info({ redisUrl }, 'Redis connected'));
    redisClient.on('error', (err) => logger.warn({ err: err.message }, 'Redis error — falling back to in-process cache'));
  }

  const globalCache = createCache(redisClient);
  container.registerSingleton('cache', globalCache);
  // Alias for backward compatibility while we refactor
  container.registerSingleton('dealHealthCache', globalCache);

  registerServices(container);
  await registerModules(container);
  startCleanupJobs(container);

  // Register all module routes before creating the app so createApp() can mount them.
  const app = createApp();

  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info({ port: config.PORT, host: config.HOST, env: config.NODE_ENV }, 'Server started');
  });

  // Attach Socket.IO to the HTTP server
  const io = new SocketIOServer(server, {
    cors: {
      origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  if (redisUrl) {
    const pubClient = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
    const subClient = pubClient.duplicate();
    pubClient.on('error', () => {});
    subClient.on('error', () => {});
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO using Redis adapter');
  } else {
    logger.info('Socket.IO using in-memory adapter');
  }

  // Register io in the container so services can emit events
  container.registerSingleton('io', io);

  // Authenticate socket connections
  io.use(socketAuth);

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id, user: socket.user }, 'Socket.IO client connected');

    socket.on('join:quote', async ({ quoteId }) => {
      // Basic authorization: ensure user has access to this quote
      // In a real app we would query the DB. For this hackathon, we assume 
      // if they have the ID and are authenticated, they can subscribe to updates for it.
      const roomName = `quote:${quoteId}`;
      socket.join(roomName);
      logger.debug({ socketId: socket.id, quoteId, user: socket.user }, 'Client joined quote room');
      socket.emit('subscribed', { room: roomName, timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Socket.IO client disconnected');
    });
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(async () => {
      logger.info('HTTP server closed');
      await closeDatabase();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error.message, stack: error.stack }, 'Uncaught exception');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason: String(reason) }, 'Unhandled rejection');
  });

  return server;
}

function registerServices(container) {
  container.registerSingleton('config', config);
  container.registerSingleton('logger', logger);
  container.registerSingleton('database', getDatabase());
  container.registerSingleton('emailService', createEmailService());
}

async function registerModules(container) {
  registerAuthModule(container);
  registerProductModule(container);

  const moduleNames = [
    'discounts',
    'quotations',
    'approvals',
    'warehouses',
    'subscriptions',
    'upsell',
    'negotiation',
    'dealHealth',
    'reporting',
  ];

  for (const moduleName of moduleNames) {
    try {
      const module = await import(`./modules/${moduleName}/index.js`);
      if (module.default) {
        module.default(container);
      }
    } catch (error) {
      logger.debug({ module: moduleName }, 'Module not yet implemented');
    }
  }
}

function createEmailService() {
  return {
    async sendMagicLink(email, magicLink, expiresAt) {
      if (config.NODE_ENV === 'development') {
        logger.info({ email, magicLink, expiresAt }, 'DEV MODE: Magic link email would be sent');
        return;
      }
      // TODO: Integrate with real email provider (SendGrid, AWS SES, etc.)
      logger.warn({ email }, 'Email service not configured - magic link not sent');
    },
  };
}

function startCleanupJobs(container) {
  const db = container.get('database');
  const cleanupInterval = 60 * 60 * 1000;

  setInterval(async () => {
    try {
      await db('refresh_tokens').where('expires_at', '<', new Date()).update({ revoked_at: new Date() });
      await db('magic_links').where('expires_at', '<', new Date()).whereNull('used_at').del();
      await db('login_attempts').where('created_at', '<', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).del();
      logger.debug('Auth cleanup job completed');
    } catch (error) {
      logger.error({ err: error.message }, 'Auth cleanup job failed');
    }
  }, cleanupInterval).unref();

  logger.info('Auth cleanup jobs started');
}

bootstrap().catch((error) => {
  logger.fatal({ err: error.message, stack: error.stack }, 'Failed to bootstrap application');
  process.exit(1);
});