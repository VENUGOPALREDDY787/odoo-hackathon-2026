import Joi from 'joi';

const CONDITION_TYPES = ['always', 'quantity_threshold', 'customer_tier', 'custom'];

export const createUpsellRuleSchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: Joi.string().max(1000).optional().allow('', null),
  trigger_product_id: Joi.string().uuid().optional().allow(null),
  trigger_category_id: Joi.string().uuid().optional().allow(null),
  recommended_product_id: Joi.string().uuid().required(),
  recommended_variant_id: Joi.string().uuid().optional().allow(null),
  condition_type: Joi.string().valid(...CONDITION_TYPES).default('always'),
  condition_config: Joi.object().optional().default({}),
  discount_percent: Joi.number().min(0).max(100).default(0),
  priority: Joi.number().integer().min(0).default(0),
  is_active: Joi.boolean().default(true),
}).or('trigger_product_id', 'trigger_category_id'); // XOR enforced by DB CHECK; Joi ensures at least one

export const updateUpsellRuleSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  description: Joi.string().max(1000).optional().allow('', null),
  trigger_product_id: Joi.string().uuid().optional().allow(null),
  trigger_category_id: Joi.string().uuid().optional().allow(null),
  recommended_product_id: Joi.string().uuid().optional(),
  recommended_variant_id: Joi.string().uuid().optional().allow(null),
  condition_type: Joi.string().valid(...CONDITION_TYPES).optional(),
  condition_config: Joi.object().optional(),
  discount_percent: Joi.number().min(0).max(100).optional(),
  priority: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
}).min(1);

export const getSuggestionsQuerySchema = Joi.object({
  min_margin_percent: Joi.number().min(0).max(100).default(0),
  limit: Joi.number().integer().min(1).max(50).default(10),
});

export const listRulesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  is_active: Joi.boolean().optional(),
  condition_type: Joi.string().valid(...CONDITION_TYPES).optional(),
  trigger_product_id: Joi.string().uuid().optional(),
  trigger_category_id: Joi.string().uuid().optional(),
  order_by: Joi.string().valid('priority', 'created_at', 'name', 'discount_percent').default('priority'),
  order_dir: Joi.string().valid('asc', 'desc').default('desc'),
});

export default {
  createUpsellRuleSchema,
  updateUpsellRuleSchema,
  getSuggestionsQuerySchema,
  listRulesQuerySchema,
};
