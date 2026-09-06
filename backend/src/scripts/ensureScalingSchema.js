/**
 * Safe additive schema bootstrap.
 *
 * Guarantees for EXISTING data (your requirement: same SQL server, data intact):
 *  - Only CREATE TABLE IF NOT EXISTS / CREATE INDEX guards — no DROP, no
 *    TRUNCATE, no ALTER on existing tables, no DELETE anywhere.
 *  - Existing tables and rows are never touched; only missing tables/indexes
 *    are created. Safe to run on every boot, on every replica concurrently.
 *
 * New tables added for the scaling/queue feature:
 *  - job_exports  : rows describing queued export artifacts
 *  - job_metrics  : rows storing queued metric computations
 */
import { logger } from '../utils/logger.js';

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`job_exports\` (
    \`id\` CHAR(36) NOT NULL,
    \`job_type\` VARCHAR(64) NOT NULL,
    \`format\` ENUM('csv','xlsx') NOT NULL,
    \`filters\` JSON,
    \`file_path\` VARCHAR(500) NOT NULL,
    \`file_size_bytes\` BIGINT NULL,
    \`status\` ENUM('processing','ready','failed') NOT NULL DEFAULT 'processing',
    \`error_message\` TEXT NULL,
    \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`completed_at\` DATETIME NULL,
    PRIMARY KEY (\`id\`),
    KEY \`idx_job_exports_status\` (\`status\`),
    KEY \`idx_job_exports_created\` (\`created_at\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`job_metrics\` (
    \`id\` CHAR(36) NOT NULL,
    \`metric_key\` VARCHAR(64) NOT NULL,
    \`value\` JSON,
    \`computed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`idx_job_metrics_key\` (\`metric_key\`, \`computed_at\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
];

// Guarded index creation (MySQL has no IF NOT EXISTS for indexes).
const INDEXES = [
  { table: 'job_exports', name: 'idx_job_exports_status', column: 'status' },
  { table: 'job_exports', name: 'idx_job_exports_created', column: 'created_at' },
  { table: 'job_metrics', name: 'idx_job_metrics_key', column: 'metric_key, computed_at' },
];

export async function ensureScalingSchema(db) {
  for (const sql of STATEMENTS) {
    await db.schema.raw(sql);
  }

  for (const { table, name, column } of INDEXES) {
    const exists = await db('information_schema.statistics')
      .where({ table_schema: db.client.config.connection.database, table_name: table, index_name: name })
      .first();
    if (!exists) {
      await db.schema.raw(`CREATE INDEX \`${name}\` ON \`${table}\` (${column})`);
    }
  }

  logger.info('Scaling schema ensured (job_exports, job_metrics)');
}

export default ensureScalingSchema;
