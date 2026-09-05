import { Router } from 'express';
import { container } from '../../../container/index.js';
import { authenticate, requireInternal, canViewDealHealth } from '../../auth/middleware/auth.js';

const router = Router();

function getController() {
  return container.get('dealHealthController');
}

// All deal health routes require authentication + internal role
router.use(authenticate(), requireInternal());

/**
 * GET /api/dealHealth/dashboard
 *
 * Redis-cached aggregate dashboard summary.
 * Cache TTL: 120 seconds. Invalidated on new alert.
 * Roles: manager, finance, admin, rep (read-only)
 */
router.get('/dashboard', (req, res, next) => getController().getDashboard(req, res, next));

/**
 * GET /api/dealHealth/alerts
 * ?alert_type=stalled_deal|discount_anomaly|delivery_slippage|negotiation_failed
 * ?severity=low|medium|high|critical
 * ?is_acknowledged=true|false
 * ?quotation_id=<uuid>
 * ?page=1&limit=20&order_by=created_at&order_dir=desc
 */
router.get('/alerts', (req, res, next) => getController().listAlerts(req, res, next));

/**
 * POST /api/dealHealth/alerts/:alertId/acknowledge
 *
 * Marks an alert as acknowledged and invalidates the dashboard cache.
 * Roles: manager, finance, admin
 */
router.post(
  '/alerts/:alertId/acknowledge',
  canViewDealHealth,
  (req, res, next) => getController().acknowledgeAlert(req, res, next)
);

/**
 * POST /api/dealHealth/scan
 *
 * Manually triggers a full detection scan.
 * Admin/manager only — not exposed to reps.
 */
router.post(
  '/scan',
  (req, res, next) => getController().triggerScan(req, res, next)
);

export default router;
