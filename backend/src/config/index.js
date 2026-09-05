import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  DB_SSL: z.coerce.boolean().default(false),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().positive().default(12),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Frontend URL (for magic links)
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Feature flags
  ENABLE_SWAGGER: z.coerce.boolean().default(false),

  // Redis (optional — deal health dashboard cache)
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  // Deal health detection thresholds
  DEAL_HEALTH_CRON: z.string().default('0,30 * * * *'),
  STALLED_DEAL_DAYS: z.coerce.number().int().positive().default(7),
  ANOMALY_STDDEV_MULTIPLIER: z.coerce.number().positive().default(1.5),
  MIN_HISTORICAL_QUOTATIONS: z.coerce.number().int().positive().default(3),
});

let config;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment configuration:');
  if (error.errors) {
    error.errors.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
  }
  process.exit(1);
}

export default Object.freeze(config);