import { Router } from 'express';
import { container } from '../../../container/index.js';
import { validateBody, validateQuery, validateParams } from '../../../middleware/validate.js';
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

router.get('/', validateQuery(quotationQuerySchema), (req, res, next) =>
  getController().list(req, res, next)
);

router.post('/', validateBody(createQuotationSchema), (req, res, next) =>
  getController().create(req, res, next)
);

router.get('/:id', validateParams(idParamSchema), (req, res, next) =>
  getController().getById(req, res, next)
);

router.post(
  '/:id/lines',
  validateParams(idParamSchema),
  validateBody(addQuotationLineSchema),
  (req, res, next) => getController().addLine(req, res, next)
);

router.put(
  '/:id/lines/:lineId',
  validateParams(lineIdParamSchema),
  validateBody(updateQuotationLineSchema),
  (req, res, next) => getController().updateLine(req, res, next)
);

router.delete(
  '/:id/lines/:lineId',
  validateParams(lineIdParamSchema),
  (req, res, next) => getController().removeLine(req, res, next)
);

router.post(
  '/:id/submit',
  validateParams(idParamSchema),
  validateBody(submitQuotationSchema),
  (req, res, next) => getController().submitForApproval(req, res, next)
);

export default router;
