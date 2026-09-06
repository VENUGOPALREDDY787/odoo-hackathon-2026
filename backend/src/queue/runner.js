/**
 * Embedded BullMQ worker — runs inside EVERY backend replica.
 *
 * All replicas point at the same Redis-backed queue, so BullMQ guarantees each
 * job is delivered to exactly one worker across the whole fleet. When Docker
 * adds replicas under load, new workers join the pool automatically; when a
 * replica scales down after its 3-minute idle period, its worker drains
 * cleanly (see server.js graceful shutdown) and its in-flight jobs are retried
 * by the remaining workers.
 */
import { Worker } from 'bullmq';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';
import { createBullConnection } from './connection.js';
import { QUEUE_NAME } from './index.js';
import { runJob } from './jobTypes.js';

let worker = null;

export function startWorker() {
  if (worker) {return worker;}
  const connection = createBullConnection('queue-worker');
  if (!connection) {
    logger.info('Queue worker not started (Redis not configured)');
    return null;
  }

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const startedAt = Date.now();
      logger.info({ jobId: job.id, type: job.name, attempt: job.attemptsMade + 1 }, 'Job started');
      try {
        const result = await runJob(job.name, job.data);
        logger.info({ jobId: job.id, type: job.name, durationMs: Date.now() - startedAt }, 'Job completed');
        return result ?? { ok: true };
      } catch (error) {
        logger.error({ jobId: job.id, type: job.name, err: error.message, stack: error.stack }, 'Job failed');
        throw error; // let BullMQ handle retries/backoff
      }
    },
    {
      connection,
      concurrency: config.QUEUE_CONCURRENCY,
      // Do not hold the process open just for the worker
      // (shutdown is coordinated explicitly in server.js)
    }
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, type: job.name }, 'Job completed event');
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'BullMQ worker error');
  });

  logger.info({ queue: QUEUE_NAME, concurrency: config.QUEUE_CONCURRENCY }, 'Queue worker started');
  return worker;
}

export async function stopWorker() {
  if (!worker) {return;}
  try {
    // Wait for in-flight jobs (up to 30s) so a scaling-down replica never
    // drops a job mid-flight — remaining replicas pick up the rest of the queue.
    await worker.close();
    logger.info('Queue worker closed cleanly');
  } catch (error) {
    logger.error({ err: error.message }, 'Error while closing queue worker');
  } finally {
    worker = null;
  }
}

/**
 * Inline execution path used when Redis is not configured.
 * Keeps the enqueue() API identical in both modes.
 */
export async function runJobInline(type, payload) {
  return runJob(type, payload);
}

export default { startWorker, stopWorker, runJobInline };
