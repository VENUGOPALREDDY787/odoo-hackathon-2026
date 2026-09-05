import { Router } from 'express';
import { container } from '../../../container/index.js';
import { validateBody, validateParams } from '../../../middleware/validate.js';
import { z } from 'zod';
import {
  subscriptionPlanSchema,
  subscriptionPlanUpdateSchema,
  generateScheduleSchema,
  cancelLineSchema,
} from '../validators/subscriptionSchemas.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const lineIdParamSchema = z.object({
  lineId: z.string().uuid(),
});

function getController() {
  return container.get('subscriptionController');
}

// ==================== SUBSCRIPTION PLANS CRUD ====================

router.get('/plans', (req, res, next) => getController().listPlans(req, res, next));
router.post('/plans', validateBody(subscriptionPlanSchema), (req, res, next) => getController().createPlan(req, res, next));
router.get('/plans/:id', validateParams(idParamSchema), (req, res, next) => getController().getPlan(req, res, next));
router.put('/plans/:id', validateParams(idParamSchema), validateBody(subscriptionPlanUpdateSchema), (req, res, next) =>
  getController().updatePlan(req, res, next)
);
router.delete('/plans/:id', validateParams(idParamSchema), (req, res, next) =>
  getController().deletePlan(req, res, next)
);

// ==================== BILLING SCHEDULES & CANCELLATIONS ====================

router.post('/schedules/generate', validateBody(generateScheduleSchema), (req, res, next) =>
  getController().generateSchedules(req, res, next)
);

router.get('/lines/:lineId/schedules', validateParams(lineIdParamSchema), (req, res, next) =>
  getController().getLineSchedules(req, res, next)
);

router.post('/lines/:lineId/cancel', validateParams(lineIdParamSchema), validateBody(cancelLineSchema.omit({ quotation_line_id: true })), (req, res, next) =>
  getController().cancelSubscriptionLine(req, res, next)
);

router.post('/lines/cancel', validateBody(cancelLineSchema), (req, res, next) =>
  getController().cancelSubscriptionLine(req, res, next)
);

export default router;
