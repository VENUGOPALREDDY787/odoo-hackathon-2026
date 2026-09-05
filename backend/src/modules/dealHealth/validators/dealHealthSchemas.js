import Joi from 'joi';

export const listAlertsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  alert_type: Joi.string()
    .valid('stalled_deal', 'discount_anomaly', 'delivery_slippage', 'negotiation_failed')
    .optional(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  is_acknowledged: Joi.boolean().optional(),
  quotation_id: Joi.string().uuid().optional(),
  order_by: Joi.string().valid('created_at', 'severity', 'alert_type').default('created_at'),
  order_dir: Joi.string().valid('asc', 'desc').default('desc'),
});

export const acknowledgeAlertParamSchema = Joi.object({
  alertId: Joi.string().uuid().required(),
});

export default { listAlertsQuerySchema, acknowledgeAlertParamSchema };
