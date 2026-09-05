import { logger } from '../utils/logger.js';
import { isAppError, isOperationalError, AppError } from '../errors/AppError.js';
import config from '../config/index.js';

export function errorHandler(err, req, res, next) {
  const requestLogger = req.log || logger;
  const reqId = req.headers['x-request-id'] || req.id;

  if (isAppError(err)) {
    requestLogger.warn(
      { err: { code: err.code, message: err.message, details: err.details }, reqId },
      'Operational error'
    );

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
      },
    });
  }

  if (err.name === 'ZodError' || err.name === 'ValidationError') {
    const details = err.errors?.map(e => ({
      field: e.path?.join('.') || e.field,
      message: e.message,
    })) ?? err.details;

    requestLogger.warn({ err: details, reqId }, 'Validation error');

    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details,
      },
    });
  }

  if (err.name === 'UnauthorizedError' || err.code === 'EBADCSRFTOKEN') {
    requestLogger.warn({ err: err.message, reqId }, 'Authentication error');

    return res.status(401).json({
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid or expired token',
        details: null,
      },
    });
  }

  if (err.code === 'ER_DUP_ENTRY' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    const code = err.code === 'ER_DUP_ENTRY' ? 'CONFLICT' : 'FOREIGN_KEY_VIOLATION';
    const message = err.code === 'ER_DUP_ENTRY' ? 'Duplicate entry' : 'Referenced resource does not exist';

    requestLogger.warn({ err: { code: err.code, sqlMessage: err.sqlMessage }, reqId }, 'Database constraint error');

    return res.status(409).json({
      error: {
        code,
        message,
        details: config.NODE_ENV === 'development' ? { sqlMessage: err.sqlMessage } : null,
      },
    });
  }

  requestLogger.error({ err: { message: err.message, stack: err.stack }, reqId }, 'Unhandled error');

  if (!isProduction && !isOperationalError(err)) {
    console.error('💥 Unhandled error:', err);
  }

  const isProduction = config.NODE_ENV === 'production';

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      details: isProduction ? null : { stack: err.stack },
    },
  });
}

export function notFoundHandler(req, res) {
  const reqId = req.headers['x-request-id'] || req.id;
  logger.warn({ reqId, method: req.method, url: req.url }, 'Route not found');

  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.url} not found`,
      details: null,
    },
  });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}