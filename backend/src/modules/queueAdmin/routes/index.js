import { Router } from 'express';
import { container } from '../../../container/index.js';
import { authenticate, requireRole } from '../../auth/middleware/auth.js';

const router = Router();

function getController() {
  return container.get('queueAdminController');
}

// Queue administration is admin-only.
router.use(authenticate(), requireRole('admin'));

/**
 * GET /api/queue/stats
 * Queue depth counters (waiting/active/completed/failed) across all replicas.
 */
router.get('/stats', (req, res, next) => getController().getStats(req, res, next));

/**
 * GET /api/queue/exports
 * Recent export artifacts produced by report.export jobs (SQL-backed).
 */
router.get('/exports', (req, res, next) => getController().listExports(req, res, next));

/**
 * POST /api/queue/jobs  { type, payload, options }
 * Enqueue a job. Accepted types: report.export, metrics.compute, maintenance.cleanup
 */
router.post('/jobs', (req, res, next) => getController().enqueue(req, res, next));

/**
 * GET /api/queue/jobs/:id
 * Inspect a queued/running/completed job.
 */
router.get('/jobs/:id', (req, res, next) => getController().getJob(req, res, next));

export default router;
