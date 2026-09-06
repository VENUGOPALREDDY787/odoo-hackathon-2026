import { Router } from 'express';
import { container } from '../../../container/index.js';
import { validateQuery } from '../../../middleware/validate.js';
import { authenticate, requireInternal } from '../../auth/middleware/auth.js';
import { auditTrailQuerySchema } from '../validators/auditSchemas.js';

const router = Router();

function getController() {
  return container.get('auditController');
}

// ---------------------------------------------------------------------------
// GET /api/audit
// Queryable, paginated audit trail. Every role-attributed operation recorded
// by any module (quotations, discounts, products, subscriptions, warehouses)
// can be retrieved here, filtered by table/record/operation/actor/role/date.
// Internal staff only — audit entries may reference sensitive record ids.
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate(),
  requireInternal(),
  validateQuery(auditTrailQuerySchema),
  (req, res, next) => getController().listAuditTrails(req, res, next)
);

export default router;
