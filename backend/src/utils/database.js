import knex from 'knex';
import config from '../config/index.js';
import { logger } from './logger.js';

let dbInstance = null;

export function createKnexInstance(customConfig = {}) {
  const cfg = {
    client: 'mysql2',
    connection: {
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
      ssl: config.DB_SSL ? { rejectUnauthorized: false } : undefined,
      charset: 'utf8mb4',
      timezone: '+00:00',
    },
    pool: {
      min: 5,
      max: config.DB_CONNECTION_LIMIT,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './src/database/migrations',
    },
    seeds: {
      directory: './src/database/seeds',
    },
    debug: config.DEBUG_MODE,
    ...customConfig,
  };

  const instance = knex(cfg);

  instance.on('query', (queryData) => {
    if (config.DEBUG_MODE) {
      logger.debug({ sql: queryData.sql, bindings: queryData.bindings, duration: queryData.duration }, 'SQL Query');
    }
  });

  instance.on('query-error', (error, queryData) => {
    logger.error({ err: error.message, sql: queryData.sql, bindings: queryData.bindings }, 'SQL Error');
  });

  return instance;
}

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = createKnexInstance();
  }
  return dbInstance;
}

export async function closeDatabase() {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
    logger.info('Database connection closed');
  }
}

export async function healthCheck() {
  const db = getDatabase();
  try {
    await db.raw('SELECT 1');
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
}

export default getDatabase;