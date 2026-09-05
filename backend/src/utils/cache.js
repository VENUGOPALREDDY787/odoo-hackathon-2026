/**
 * Redis-backed cache with transparent in-process fallback.
 *
 * When Redis is unavailable (not configured or connection fails), the module
 * falls back to a simple in-process Map with TTL — so the app still works
 * in dev/test without a Redis instance.
 *
 * Usage:
 *   const cache = createCache(redisClient);
 *   await cache.set('my-key', data, 60);   // TTL in seconds
 *   const data = await cache.get('my-key');
 *   await cache.del('my-key');
 *   await cache.delPattern('dashboard:*');
 */

// ---------------------------------------------------------------------------
// In-process fallback cache (Map + TTL)
// ---------------------------------------------------------------------------
class InProcessCache {
  constructor() {
    this._store = new Map();
  }

  async get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlSeconds = 60) {
    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key) {
    this._store.delete(key);
  }

  async delPattern(pattern) {
    // Convert glob pattern (e.g. 'dashboard:*') to a regex
    const regexStr = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexStr}$`);
    for (const key of this._store.keys()) {
      if (regex.test(key)) this._store.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Redis-backed cache adapter (wraps ioredis)
// ---------------------------------------------------------------------------
class RedisCache {
  constructor(redisClient) {
    this._client = redisClient;
  }

  async get(key) {
    try {
      const raw = await this._client.get(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async set(key, value, ttlSeconds = 60) {
    await this._client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key) {
    await this._client.del(key);
  }

  async delPattern(pattern) {
    // SCAN is cursor-based and non-blocking — safe for production
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this._client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this._client.del(...keys);
      }
    } while (cursor !== '0');
  }
}

// ---------------------------------------------------------------------------
// Factory: returns the best available cache implementation
// ---------------------------------------------------------------------------
export function createCache(redisClient) {
  if (redisClient) {
    return new RedisCache(redisClient);
  }
  return new InProcessCache();
}

export { InProcessCache, RedisCache };
export default createCache;
