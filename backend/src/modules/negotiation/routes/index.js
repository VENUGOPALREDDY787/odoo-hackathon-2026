import { Router } from 'express';
import { container } from '../../../container/index.js';
import { authenticate, requireCustomer } from '../../auth/middleware/auth.js';

const router = Router();

function getController() {
  return container.get('negotiationController');
}

// ---------------------------------------------------------------------------
// SECURITY: All negotiation routes require:
//   1. authenticate()     — valid JWT (magic-link or regular token)
//   2. requireCustomer()  — role must be 'customer' (magic-link session)
//
// NegotiationService._assertOwnsQuotation() then enforces that the
// authenticated customer can only touch THEIR OWN quotations.
// Cross-customer access returns 403 (never 404 to prevent enumeration).
// ---------------------------------------------------------------------------

router.use(authenticate(), requireCustomer());

/**
 * POST /api/negotiation/quotations/:quotationId/negotiate
 *
 * Runs the negotiate() engine and persists the outcome.
 * Body: { seller_min, seller_max, buyer_min, buyer_max, step_percent?, max_rounds?, convergence_threshold?, message? }
 *
 * Outcomes:
 *   DEAL   → if re-crosses risk threshold → status=pending_approval (NOT auto-accepted)
 *   DEAL   → if within risk threshold → status=accepted
 *   FAILED → deal_health_alert raised for manual escalation
 */
router.post(
  '/quotations/:quotationId/negotiate',
  (req, res, next) => getController().runNegotiation(req, res, next)
);

/**
 * GET /api/negotiation/quotations/:quotationId/history
 *
 * Returns full negotiation_logs for the quotation (customer-scoped).
 * Supports replay and audit of individual round records.
 */
router.get(
  '/quotations/:quotationId/history',
  (req, res, next) => getController().getNegotiationHistory(req, res, next)
);

export default router;
