/**
 * Unit tests for the embedded BullMQ request queue.
 *
 * These tests run WITHOUT Redis or MySQL:
 *  - config and database modules are mocked.
 *  - enqueueJob() must fall back to inline execution when no Redis is
 *    configured (single-container mode) and still run the real handler.
 *  - job handlers are SQL-backed, so the mocked db verifies writes happen.
 *
 * NOTE: ESM mode (--experimental-vm-modules) requires @jest/globals and
 * jest.unstable_mockModule() before importing the modules under test.
 */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/index.js', () => ({
  default: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    LOG_PRETTY: false,
    DEBUG_MODE: false,
    REDIS_URL: undefined,
    REDIS_HOST: undefined,
    REDIS_PORT: 6379,
    QUEUE_CONCURRENCY: 5,
    EXPORT_DIR: '/tmp/test-exports',
    INSTANCE_ID: 'test-instance',
  },
}));

const dbState = { inserted: [], ddl: [] };

jest.unstable_mockModule('../../utils/database.js', () => {
  const rows = {
    quotations: [{ total_quotations: 7, accepted: 3, grand_total_sum: 1000, avg_margin_pct: 22.5 }],
  };
  const makeTable = (table) => {
    const chain = {
      whereNull: () => chain,
      whereNotNull: () => chain,
      where: () => chain,
      whereIn: () => chain,
      whereRaw: () => chain,
      select: () => Promise.resolve(rows[table] || [{}]),
      insert: (row) => {
        dbState.inserted.push({ table, row });
        return Promise.resolve([1]);
      },
      update: () => Promise.resolve(1),
      del: () => Promise.resolve(1),
      first: () => Promise.resolve({ index_name: 'already_exists', total: 0, count: 0 }),
      orderBy: () => chain,
      limit: () => chain,
      offset: () => Promise.resolve([]),
      count: () => chain,
    };
    return chain;
  };

  const db = (table) => makeTable(table);
  db.fn = { now: () => new Date() };
  db.raw = () => ({});
  db.schema = {
    raw: (sql) => {
      dbState.ddl.push(sql);
      return Promise.resolve([]);
    },
  };
  db.client = { config: { connection: { database: 'test' } } };

  return {
    getDatabase: () => db,
    closeDatabase: async () => {},
    createKnexInstance: () => db,
  };
});

const { jobTypes } = await import('../../queue/jobTypes.js');
const { ensureScalingSchema } = await import('../../scripts/ensureScalingSchema.js');
const queueModule = await import('../../queue/index.js');
const { getDatabase } = await import('../../utils/database.js');

describe('Request queue (embedded BullMQ layer)', () => {
  beforeEach(() => {
    dbState.inserted.length = 0;
    dbState.ddl.length = 0;
  });

  test('registers the expected job types', () => {
    expect(Object.keys(jobTypes()).sort()).toEqual([
      'maintenance.cleanup',
      'metrics.compute',
      'report.export',
    ]);
  });

  test('enqueueJob falls back to inline execution when Redis is not configured', async () => {
    const result = await queueModule.enqueueJob('metrics.compute', { metric_key: 'test_metrics' });
    expect(result.mode).toBe('inline');
    expect(result.job.type).toBe('metrics.compute');
    expect(result.result).toEqual(
      expect.objectContaining({ total_quotations: 7 })
    );
  });

  test('metrics.compute writes a job_metrics row', async () => {
    await queueModule.enqueueJob('metrics.compute', { metric_key: 'insert_check' });

    const inserts = dbState.inserted.filter((i) => i.table === 'job_metrics');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].row.metric_key).toBe('insert_check');
    expect(JSON.parse(inserts[0].row.value)).toEqual(
      expect.objectContaining({ total_quotations: 7 })
    );
  });

  test('enqueueJob rejects unknown job types', async () => {
    await expect(queueModule.enqueueJob('not.a.job', {})).rejects.toThrow('Unknown job type');
  });

  test('maintenance.cleanup is registered and callable', async () => {
    const result = await queueModule.enqueueJob('maintenance.cleanup', {});
    // Mocked db returns 1 row per mutation.
    expect(result.mode).toBe('inline');
    expect(result.result).toEqual({ revokedTokens: 1, deletedMagicLinks: 1, deletedLoginAttempts: 1 });
  });

  test('ensureScalingSchema only issues additive DDL', async () => {
    await ensureScalingSchema(getDatabase());

    const statements = dbState.ddl;
    expect(statements).toHaveLength(2);
    for (const sql of statements) {
      expect(sql).toMatch(/^CREATE TABLE IF NOT EXISTS/);
      expect(sql).not.toMatch(/DROP|TRUNCATE|DELETE|ALTER TABLE/i);
    }
  });
});
