import { Router } from 'express';
import { container } from '../../../container/index.js';
import { validateBody, validateQuery, validateParams } from '../../../middleware/validate.js';
import { cacheMiddleware } from '../../../middleware/cacheMiddleware.js';
import { authenticate, requireInternal } from '../../auth/middleware/auth.js';
import {
  idParamSchema,
  quotationIdParamSchema,
  discountTierSchema,
  discountTierUpdateSchema,
  discountTierQuerySchema,
  approvalChainSchema,
  approvalChainUpdateSchema,
  approvalChainQuerySchema,
  evaluateRiskSchema,
  approvalActionSchema,
} from '../validators/discountSchemas.js';

const router = Router();

function getController() {
  return container.get('discountController');
}

// ==================== DISCOUNT TIERS ====================

router.get(
  '/tiers', 
  validateQuery(discountTierQuerySchema), 
  cacheMiddleware({ key: (req) => `discounts:tiers:list:${new URLSearchParams(req.query).toString()}`, ttl: 86400 }),
  (req, res, next) => getController().listDiscountTiers(req, res, next)
);

router.post('/tiers', validateBody(discountTierSchema), (req, res, next) =>
  getController().createDiscountTier(req, res, next)
);

router.get('/tiers/:id', validateParams(idParamSchema), (req, res, next) =>
  getController().getDiscountTier(req, res, next)
);

router.put(
  '/tiers/:id',
  validateParams(idParamSchema),
  validateBody(discountTierUpdateSchema),
  (req, res, next) => getController().updateDiscountTier(req, res, next)
);

router.delete('/tiers/:id', validateParams(idParamSchema), (req, res, next) =>
  getController().deleteDiscountTier(req, res, next)
);

// ==================== APPROVAL CHAINS ====================

router.get(
  '/approval-chains', 
  validateQuery(approvalChainQuerySchema), 
  cacheMiddleware({ key: (req) => `discounts:chains:list:${new URLSearchParams(req.query).toString()}`, ttl: 86400 }),
  (req, res, next) => getController().listApprovalChains(req, res, next)
);

router.post('/approval-chains', validateBody(approvalChainSchema), (req, res, next) =>
  getController().createApprovalChain(req, res, next)
);

router.get('/approval-chains/:id', validateParams(idParamSchema), (req, res, next) =>
  getController().getApprovalChain(req, res, next)
);

router.put(
  '/approval-chains/:id',
  validateParams(idParamSchema),
  validateBody(approvalChainUpdateSchema),
  (req, res, next) => getController().updateApprovalChain(req, res, next)
);

router.delete('/approval-chains/:id', validateParams(idParamSchema), (req, res, next) =>
  getController().deleteApprovalChain(req, res, next)
);

// ==================== RISK EVALUATION & WORKFLOW ====================

router.post('/evaluate-risk', validateBody(evaluateRiskSchema), (req, res, next) =>
  getController().evaluateLinesRisk(req, res, next)
);

router.post(
  '/quotations/:quotationId/evaluate-risk',
  validateParams(quotationIdParamSchema),
  (req, res, next) => getController().evaluateQuotationRisk(req, res, next)
);

router.post(
  '/quotations/:quotationId/approval',
  authenticate(),
  requireInternal(),
  validateParams(quotationIdParamSchema),
  validateBody(approvalActionSchema),
  (req, res, next) => getController().processApprovalDecision(req, res, next)
);

router.post(
  '/quotations/:quotationId/action',
  authenticate(),
  requireInternal(),
  validateParams(quotationIdParamSchema),
  validateBody(approvalActionSchema),
  (req, res, next) => getController().handleApprovalAction(req, res, next)
);

router.post(
  '/quotations/:quotationId/approve',
  authenticate(),
  requireInternal(),
  validateParams(quotationIdParamSchema),
  (req, res, next) => {
    req.body = { ...req.body, action: 'approve' };
    return getController().handleApprovalAction(req, res, next);
  }
);

router.post(
  '/quotations/:quotationId/reject',
  authenticate(),
  requireInternal(),
  validateParams(quotationIdParamSchema),
  (req, res, next) => {
    req.body = { ...req.body, action: 'reject' };
    return getController().handleApprovalAction(req, res, next);
  }
);

router.post(
  '/quotations/:quotationId/return',
  authenticate(),
  requireInternal(),
  validateParams(quotationIdParamSchema),
  (req, res, next) => {
    req.body = { ...req.body, action: 'return_for_revision' };
    return getController().handleApprovalAction(req, res, next);
  }
);

router.get(
  '/quotations/:quotationId/approval-logs',
  validateParams(quotationIdParamSchema),
  (req, res, next) => getController().getApprovalLogs(req, res, next)
);

export default router;
