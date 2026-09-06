/**
 * Queue admin service — thin wrapper around the queue for API access.
 */
import { enqueueJob, getRequestQueue, QUEUE_NAME } from '../../../queue/index.js';
import { jobTypes } from '../../../queue/jobTypes.js';

export class QueueAdminService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  /** Enqueue a job of the given type. */
  async enqueue(type, payload, options = {}) {
    if (!jobTypes()[type]) {
      const error = new Error(`Unknown job type: ${type}`);
      error.statusCode = 400;
      throw error;
    }
    return enqueueJob(type, payload, options);
  }

  /** Job status from BullMQ when Redis-backed, null otherwise. */
  async getJob(jobId) {
    const q = getRequestQueue();
    if (!q) {return null;}
    return q.getJob(jobId);
  }

  /** Queue depth counters (waiting/active/completed/failed). */
  async getCounters() {
    const q = getRequestQueue();
    if (!q) {
      return { queue: QUEUE_NAME, available: false, waiting: 0, active: 0, completed: 0, failed: 0 };
    }
    const [waiting, active, completed, failed] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getCompletedCount(),
      q.getFailedCount(),
    ]);
    return { queue: QUEUE_NAME, available: true, waiting, active, completed, failed };
  }

  /** List recent export artifacts produced by the queue (SQL-backed). */
  async listExports({ limit = 20, offset = 0 } = {}) {
    const rows = await this.db('job_exports')
      .orderBy('created_at', 'desc')
      .limit(Math.min(Number(limit) || 20, 100))
      .offset(Number(offset) || 0)
      .select('*');
    const [{ total }] = await this.db('job_exports').count('id as total');
    return { items: rows, total: Number(total) };
  }
}

export default QueueAdminService;
