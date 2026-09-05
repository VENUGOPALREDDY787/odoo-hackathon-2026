import { Router } from 'express';
import { container } from '../../../container/index.js';

const router = Router();

function getController() {
  return container.get('upsellController');
}

// ---------------------------------------------------------------------------
// READ-ONLY: Upsell suggestions for a specific quotation
// GET /api/upsell/quotations/:quotationId/suggestions?min_margin_percent=15&limit=5
//
// This is the core upsell panel endpoint.
// - Completely side-effect-free (safe to cache, retry, call speculatively)
// - "Dismiss" requires NO backend call
// - "Add to Quote" → POST /api/quotations/:id/lines (separate route)
// ---------------------------------------------------------------------------
router.get(
  '/quotations/:quotationId/suggestions',
  (req, res, next) => getController().getSuggestions(req, res, next)
);

// ---------------------------------------------------------------------------
// CRUD: Upsell rule management (admin / sales-ops)
// ---------------------------------------------------------------------------
router.get(
  '/rules',
  (req, res, next) => getController().listRules(req, res, next)
);

router.post(
  '/rules',
  (req, res, next) => getController().createRule(req, res, next)
);

router.get(
  '/rules/:id',
  (req, res, next) => getController().getRuleById(req, res, next)
);

router.put(
  '/rules/:id',
  (req, res, next) => getController().updateRule(req, res, next)
);

router.delete(
  '/rules/:id',
  (req, res, next) => getController().deleteRule(req, res, next)
);

export default router;
