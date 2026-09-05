import { listAlertsQuerySchema } from '../validators/dealHealthSchemas.js';

export class DealHealthController {
  constructor(dealHealthService) {
    this.dealHealthService = dealHealthService;
  }

  /**
   * GET /api/dealHealth/dashboard
   *
   * Returns the aggregated dashboard summary.
   * Response is Redis-cached for DASHBOARD_CACHE_TTL_SECONDS (120s).
   * Cache is invalidated whenever new alerts are written.
   */
  getDashboard = async (req, res, next) => {
    try {
      const summary = await this.dealHealthService.getDashboardSummary();
      return res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/dealHealth/alerts
   *
   * Paginated list of deal_health_alerts with optional filters.
   */
  listAlerts = async (req, res, next) => {
    try {
      const { error, value } = listAlertsQuerySchema.validate(req.query, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.details },
        });
      }

      const { page, limit, order_by, order_dir, ...filters } = value;
      const result = await this.dealHealthService.listAlerts(filters, {
        page,
        limit,
        orderBy: order_by,
        orderDir: order_dir,
      });

      return res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/dealHealth/alerts/:alertId/acknowledge
   *
   * Marks an alert as acknowledged.
   * Also invalidates the dashboard summary cache.
   */
  acknowledgeAlert = async (req, res, next) => {
    try {
      const { alertId } = req.params;
      if (!alertId) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'alertId is required' } });
      }

      const updated = await this.dealHealthService.acknowledgeAlert(alertId, req.user?.id);
      if (!updated) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } });
      }

      return res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/dealHealth/scan (internal/admin)
   *
   * Manually triggers a full scan outside of the cron schedule.
   * Useful for testing and ops.
   */
  triggerScan = async (req, res, next) => {
    try {
      const results = await this.dealHealthService.runAllDetectors();
      return res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  };
}

export default DealHealthController;
