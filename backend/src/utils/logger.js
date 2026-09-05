import pino from 'pino';
import config from '../config/index.js';

const isProduction = config.NODE_ENV === 'production';

const baseLogger = pino({
  level: config.LOG_LEVEL,
  transport: config.LOG_PRETTY && !isProduction ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname,reqId,res,responseTime',
    },
  } : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  base: {
    service: 'dealflow360-backend',
    env: config.NODE_ENV,
  },
  redact: {
    paths: [
      'token',
      'rawToken',
      'password',
      'authorization',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.refreshToken',
      'requestBody.password',
      'requestBody.token',
      'requestBody.refreshToken',
      'responseBody.token',
      'responseBody.refreshToken',
    ],
    censor: '[REDACTED]',
  },
});

export const logger = baseLogger;

export function createChildLogger(bindings) {
  return baseLogger.child(bindings);
}

export function createRequestLogger(req) {
  const reqId = req.headers['x-request-id'] || req.id || crypto.randomUUID();
  return baseLogger.child({
    reqId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
}

export default baseLogger;