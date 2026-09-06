/**
 * Shared Redis connection factory for BullMQ.
 *
 * BullMQ requires dedicated connections per role (queue producer, worker,
 * scheduler). Every replica runs its own producer + worker, so each backend
 * container opens its own connections — the queue state itself lives in the
 * shared Redis instance, which is what lets N replicas drain one queue.
 */
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';

export function resolveRedisUrl() {
  if (config.REDIS_URL) {return config.REDIS_URL;}
  if (config.REDIS_HOST) {
    return `redis://${config.REDIS_HOST}:${config.REDIS_PORT || 6379}`;
  }
  return null;
}

const connections = [];

/**
 * Create a BullMQ-compatible connection, or null when Redis is not configured.
 * Callers must handle the null case by falling back to direct execution so the
 * app keeps working in single-container / no-Redis environments.
 */
export function createBullConnection(label = 'bullmq') {
  const url = resolveRedisUrl();
  if (!url) {
    logger.warn({ label }, 'REDIS_HOST/REDIS_URL not set — BullMQ disabled, jobs will run inline');
    return null;
  }

  const connection = new Redis(url, {
    maxRetriesPerRequest: null, // BullMQ requirement — commands queue while reconnecting
    enableReadyCheck: true,
    connectTimeout: 10000,
  });

  connection.on('error', (err) => {
    logger.warn({ label, err: err.message }, 'BullMQ redis connection error');
  });
  connection.on('connect', () => {
    logger.info({ label, url }, 'BullMQ redis connection established');
  });

  connections.push(connection);
  return connection;
}

/** Close every BullMQ connection opened by this replica. */
export async function closeConnections() {
  await Promise.all(
    connections.map(async (c) => {
      try {
        await c.quit();
      } catch {
        c.disconnect();
      }
    })
  );
  connections.length = 0;
}

export default createBullConnection;
