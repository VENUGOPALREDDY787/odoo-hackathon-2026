import { Router } from 'express';
import { container } from '../../../container/index.js';
import { validateBody, validateQuery, validateParams } from '../../../middleware/validate.js';
import { cacheMiddleware } from '../../../middleware/cacheMiddleware.js';
import { authenticate, requireInternal, requireQuotationAccess } from '../../auth/middleware/auth.js';
import {
  idParamSchema,
  lineIdParamSchema,
  createQuotationSchema,
  quotationQuerySchema,
  addQuotationLineSchema,
  updateQuotationLineSchema,
  submitQuotationSchema,
} from '../validators/quotationSchemas.js';

const router = Router();

function getController() {
  return container.get('quotationController');
}

router.get('/', authenticate(), validateQuery(quotationQuerySchema), (req, res, next) =>
  getController().list(req, res, next)
);

router.post('/', authenticate(), validateBody(createQuotationSchema), (req, res, next) =>
  getController().create(req, res, next)
);

router.get(
  '/:id', 
  authenticate(),
  requireQuotationAccess('admin', 'manager', 'finance'),
  validateParams(idParamSchema), 
  cacheMiddleware({ key: (req) => `quotations:item:${req.params.id}`, ttl: 300 }),
  (req, res, next) => getController().getById(req, res, next)
);

router.post(
  '/:id/lines',
  authenticate(),
  requireQuotationAccess('admin', 'manager', 'finance'),
  validateParams(idParamSchema),
  validateBody(addQuotationLineSchema),
  (req, res, next) => getController().addLine(req, res, next)
);

router.put(
  '/:id/lines/:lineId',
  authenticate(),
  requireQuotationAccess('admin', 'manager', 'finance'),
  validateParams(lineIdParamSchema),
  validateBody(updateQuotationLineSchema),
  (req, res, next) => getController().updateLine(req, res, next)
);

router.delete(
  '/:id/lines/:lineId',
  authenticate(),
  requireQuotationAccess('admin', 'manager', 'finance'),
  validateParams(lineIdParamSchema),
  (req, res, next) => getController().removeLine(req, res, next)
);

router.post(
  '/:id/submit',
  authenticate(),
  requireQuotationAccess('admin', 'manager', 'finance'),
  validateParams(idParamSchema),
  validateBody(submitQuotationSchema),
  (req, res, next) => getController().submitForApproval(req, res, next)
);

router.post(
  '/:id/accept',
  authenticate(),
  requireQuotationAccess('admin', 'manager', 'finance'),
  validateParams(idParamSchema),
  (req, res, next) => getController().accept(req, res, next)
);

export default router;
