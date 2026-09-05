import dealHealthRoutes from './routes/index.js';
import DealHealthController from './controllers/DealHealthController.js';
import DealHealthService from './services/DealHealthService.js';
import { createCache } from './services/cache.js';
import { startDealHealthJob } from './services/scheduler.js';

/**
 * Bootstrap the deal health module.
 *
 * Redis connection:
 *   - If REDIS_URL or REDIS_HOST is set, connects via ioredis.
 *   - Falls back to in-process cache transparently on connection failure.
 *
 * Socket.IO:
 *   - If an 'io' service is registered in the container, real-time push is enabled.
 *   - Clients connect and join the 'deal-health' room to receive alerts.
 */
export default function registerDealHealthModule(container) {
  // Build Redis client (optional)
  let redisClient = null;
  try {
    const config = container.get('config');
    const redisUrl = config.REDIS_URL || (config.REDIS_HOST ? `redis://${config.REDIS_HOST}:${config.REDIS_PORT || 6379}` : null);

    if (redisUrl) {
      // Dynamic import to avoid crashing when ioredis isn't used
      import('ioredis').then(({ default: Redis }) => {
        try {
          const client = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            connectTimeout: 5000,
          });

          client.on('connect', () => container.get('logger').info({ redisUrl }, 'Redis connected (deal health cache)'));
          client.on('error', (err) => container.get('logger').warn({ err: err.message }, 'Redis error — falling back to in-process cache'));

          // Re-register cache with live Redis client once connected
          const redisCache = createCache(client);
          container.register('dealHealthCache', () => redisCache);

          // Re-register service with Redis-backed cache
          const logger = container.get('logger');
          const db = container.get('database');
          const io = safeGet(container, 'io');
          const updatedService = new DealHealthService(db, logger, redisCache, io);
          container.register('dealHealthService', () => updatedService);
        } catch (err) {
          // Silent — falls through to in-process cache
        }
      }).catch(() => { /* ioredis not available */ });
    }
  } catch {
    // No config with Redis — fine, use in-process cache
  }

  // Register with in-process cache initially (Redis replaces this async if available)
  container.register('dealHealthCache', () => createCache(null));

  container.register('dealHealthService', (c) => {
    const db = c.get('database');
    const logger = c.get('logger');
    const cache = c.get('dealHealthCache');
    const io = safeGet(c, 'io');
    const config = c.get('config');

    return new DealHealthService(db, logger, cache, io, {
      stalledDaysThreshold: Number(process.env.STALLED_DEAL_DAYS) || 7,
      anomalyStdDevMultiplier: Number(process.env.ANOMALY_STDDEV_MULTIPLIER) || 1.5,
      minHistoricalQuotations: Number(process.env.MIN_HISTORICAL_QUOTATIONS) || 3,
    });
  });

  container.register('dealHealthController', (c) =>
    new DealHealthController(c.get('dealHealthService'))
  );

  container.register('dealHealthRoutes', () => dealHealthRoutes);

  // Start the scheduled job (deferred so container is fully built first)
  setImmediate(() => {
    try {
      const service = container.get('dealHealthService');
      const logger = container.get('logger');
      startDealHealthJob(service, logger);
    } catch (err) {
      try {
        container.get('logger').error({ err: err.message }, 'Failed to start deal health scheduler');
      } catch { /* */ }
    }
  });
}

/** Safely attempt to get a service that may not be registered */
function safeGet(container, name) {
  try {
    return container.get(name);
  } catch {
    return null;
  }
}
