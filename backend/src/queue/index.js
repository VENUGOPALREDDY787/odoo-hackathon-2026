/**
 * Request queue (BullMQ) — embedded in every backend replica.
 *
 * Architecture per requirements:
 *  - Each backend container runs its own producer + worker (BullMQ lives
 *    inside the backend, not as a separate service).
 *  - All replicas share ONE Redis-backed queue, so a burst of requests is
 *    queued and the first idle worker (on any replica) picks jobs up —
 *    horizontal scaling spreads the load automatically.
 *  - Job results are persisted to SQL (MySQL) where they produce artifacts,
 *    so no work or data is lost across scale-up/scale-down events.
 *
 * If Redis is not configured (dev without redis), enqueue() falls back to
 * running the handler inline so the API keeps working single-container.
 */
import { Queue } from 'bullmq';
import { logger } from '../utils/logger.js';
import { createBullConnection } from './connection.js';
import { jobTypes as getJobTypes } from './jobTypes.js';

export const QUEUE_NAME = 'dealflow-requests';

let queue = null;
let stopping = false;

/**
 * Get (or lazily create) the shared queue producer for this replica.
 * Returns null when Redis is not configured.
 */
export function getRequestQueue() {
  if (queue || stopping) {return queue;}
  const connection = createBullConnection('queue-producer');
  if (!connection) {return null;}

  queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    },
  });
  return queue;
}

/**
 * Enqueue a job. Falls back to inline execution when Redis is unavailable —
 * the API response shape is identical either way.
 */
export async function enqueueJob(type, payload = {}, options = {}) {
  if (!getJobTypes()[type]) {
    throw new Error(`Unknown job type: ${type}`);
  }

  const q = getRequestQueue();
  if (!q) {
    logger.warn({ type }, 'Queue unavailable — executing job inline');
    const { runJobInline } = await import('./runner.js');
    const result = await runJobInline(type, payload);
    return { mode: 'inline', job: { id: `inline-${Date.now()}`, type }, result };
  }

  const job = await q.add(type, payload, options);
  logger.info({ jobId: job.id, type }, 'Job enqueued');
  return { mode: 'queued', job: { id: job.id, type } };
}

export async function closeQueue() {
  stopping = true;
  if (queue) {
    await queue.close();
    queue = null;
    logger.info('Request queue producer closed');
  }
}

export default { QUEUE_NAME, getRequestQueue, enqueueJob, closeQueue };
