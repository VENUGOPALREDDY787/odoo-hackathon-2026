import { Router } from 'express';
import { container } from '../../../container/index.js';
import { authenticate, requireInternal } from '../../auth/middleware/auth.js';

const router = Router();

function getController() {
  return container.get('reportingController');
}

// All reporting routes require internal roles (rep, manager, finance, admin)
// Customers do not have access to these aggregate reports
router.use(authenticate(), requireInternal());

/**
 * GET /api/reporting/sales
 * Returns paginated sales report with aggregate totals
 */
router.get('/sales', (req, res, next) => getController().getSalesReport(req, res, next));

/**
 * GET /api/reporting/export/csv
 * Streams CSV export
 */
router.get('/export/csv', (req, res, next) => getController().exportCsv(req, res, next));

/**
 * GET /api/reporting/export/xlsx
 * Streams Excel export
 */
router.get('/export/xlsx', (req, res, next) => getController().exportXlsx(req, res, next));

export default router;
