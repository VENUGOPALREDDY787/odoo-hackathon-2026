/**
 * Job type registry — every job type BullMQ workers can execute.
 *
 * Jobs are intentionally all SQL-backed: heavy work produces rows in MySQL
 * (or writes export files to a shared Docker volume), so results survive
 * container scale-up/scale-down and are visible from any replica.
 */
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { getDatabase } from '../utils/database.js';
import { buildExport } from './handlers/exportJob.js';

const JOBS = {
  /**
   * Heavy sales-report export. Streams the same data as
   * GET /api/reporting/export/csv|xlsx, but through the queue so huge exports
   * never block an HTTP worker. Writes the file to a shared volume and records
   * the row in the `job_exports` SQL table.
   */
  'report.export': async (payload) => buildExport(payload),

  /**
   * Aggregates quotations into the `job_metrics` table — an example of a
   * burst-safe, periodically-runnable SQL-backed job.
   */
  'metrics.compute': async (payload = {}) => {
    const db = getDatabase();
    const [row] = await db('quotations')
      .whereNull('deleted_at')
      .select([
        db.raw('COUNT(*) as total_quotations'),
        db.raw("SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted"),
        db.raw('COALESCE(SUM(grand_total), 0) as grand_total_sum'),
        db.raw('COALESCE(AVG(margin_percentage), 0) as avg_margin_pct'),
      ]);
    const metrics = {
      total_quotations: Number(row?.total_quotations || 0),
      accepted: Number(row?.accepted || 0),
      grand_total_sum: Number(row?.grand_total_sum || 0),
      avg_margin_pct: Number(row?.avg_margin_pct || 0),
    };
    await db('job_metrics').insert({
      id: uuidv4(),
      metric_key: payload.metric_key || 'quotations_summary',
      value: JSON.stringify(metrics),
      computed_at: db.fn.now(),
    });
    logger.info({ metrics }, 'metrics.compute finished');
    return metrics;
  },

  /**
   * Retention cleanup — same tables the hourly in-process job already clears,
   * runnable through the queue when bursts make it too heavy for request
   * workers.
   */
  'maintenance.cleanup': async () => {
    const db = getDatabase();
    const revoked = await db('refresh_tokens')
      .where('expires_at', '<', new Date())
      .update({ revoked_at: new Date() });
    const magicLinks = await db('magic_links')
      .where('expires_at', '<', new Date())
      .whereNull('used_at')
      .del();
    const oldAttempts = await db('login_attempts')
      .where('created_at', '<', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .del();
    return { revokedTokens: revoked, deletedMagicLinks: magicLinks, deletedLoginAttempts: oldAttempts };
  },
};

export function jobTypes() {
  return JOBS;
}

/**
 * Run a job inline (no Redis/BullMQ). Used as fallback when the queue is not
 * configured, and by the worker for actual processing.
 */
export async function runJob(type, payload) {
  const handler = JOBS[type];
  if (!handler) {
    throw new Error(`No handler registered for job type: ${type}`);
  }
  return handler(payload || {});
}

export default JOBS;
