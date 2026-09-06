/**
 * Queue admin controller — HTTP surface for queue observability/testing.
 * All routes are admin-only (see routes/index.js).
 */
export class QueueAdminController {
  constructor(queueAdminService) {
    this.queueAdminService = queueAdminService;
  }

  /** POST /api/queue/jobs  { type, payload } */
  enqueue = async (req, res, next) => {
    try {
      const { type, payload = {}, options = {} } = req.body || {};
      if (!type) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'type is required' } });
      }
      const result = await this.queueAdminService.enqueue(type, payload, options);
      const status = result.mode === 'inline' ? 200 : 202;
      return res.status(status).json({
        data: {
          ...result,
          message: result.mode === 'inline'
            ? 'Executed inline (queue unavailable)'
            : 'Job queued',
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  /** GET /api/queue/jobs/:id */
  getJob = async (req, res, next) => {
    try {
      const job = await this.queueAdminService.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found (or queue not available)' } });
      }
      const state = await job.getState();
      return res.json({
        data: {
          id: job.id,
          type: job.name,
          state,
          attemptsMade: job.attemptsMade,
          progress: job.progress,
          result: job.returnvalue ?? null,
          failedReason: job.failedReason ?? null,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  /** GET /api/queue/stats */
  getStats = async (req, res, next) => {
    try {
      const counters = await this.queueAdminService.getCounters();
      return res.json({ data: counters });
    } catch (error) {
      return next(error);
    }
  };

  /** GET /api/queue/exports */
  listExports = async (req, res, next) => {
    try {
      const { limit, offset } = req.query;
      const result = await this.queueAdminService.listExports({ limit, offset });
      return res.json({ data: result });
    } catch (error) {
      return next(error);
    }
  };
}

export default QueueAdminController;
