import { container } from '../container/index.js';
import { logger } from '../utils/logger.js';

/**
 * Express middleware for Redis cache-aside pattern.
 * Intercepts the response to cache the JSON output.
 * If cache hits, serves the cached payload immediately.
 * 
 * @param {Object} options
 * @param {string|Function} options.key - Cache key string or function(req) returning string
 * @param {number} options.ttl - Time to live in seconds
 */
export const cacheMiddleware = ({ key, ttl = 300 }) => {
  return async (req, res, next) => {
    // Only cache GET requests (safe default)
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const cache = container.get('cache');
      if (!cache) {
        return next(); // Fail-open if cache is not registered
      }

      // Determine the dynamic key based on request
      const cacheKey = typeof key === 'function' ? key(req) : key;
      if (!cacheKey) {
        return next();
      }

      // Try fetching from cache
      const cachedResponse = await cache.get(cacheKey);
      if (cachedResponse) {
        logger.debug({ cacheKey }, 'Cache hit');
        return res.json(cachedResponse);
      }

      logger.debug({ cacheKey }, 'Cache miss');

      // Hook res.json to capture the response payload before sending
      const originalJson = res.json;
      res.json = function (body) {
        // Only cache successful JSON responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.set(cacheKey, body, ttl).catch(err => {
            // Log but don't fail the request if saving to cache fails
            logger.warn({ err: err.message, cacheKey }, 'Failed to write to cache');
          });
        }
        
        // Call the original res.json
        return originalJson.call(this, body);
      };

      next();
    } catch (err) {
      // Fail-open: log the error and continue without caching
      logger.warn({ err: err.message }, 'Cache middleware error (failing open)');
      next();
    }
  };
};

export default cacheMiddleware;
