import Joi from 'joi';

export const runNegotiationSchema = Joi.object({
  // Seller parameters (set by internal system / rep, provided in request body)
  seller_min: Joi.number().positive().required()
    .description("Seller's absolute floor price — will not go below this"),
  seller_max: Joi.number().positive().required()
    .description("Seller's starting ask (current list/quoted price)"),

  // Buyer parameters (set by the customer)
  buyer_min: Joi.number().positive().required()
    .description("Buyer's initial opening offer"),
  buyer_max: Joi.number().positive().required()
    .description("Buyer's absolute ceiling — will not go above this"),

  // Algorithm tuning
  step_percent: Joi.number().min(0.1).max(50).default(5)
    .description('% each side moves per round'),
  max_rounds: Joi.number().integer().min(1).max(50).default(10)
    .description('Maximum negotiation rounds before FAILED'),
  convergence_threshold: Joi.number().min(0).max(1).default(0.02)
    .description('Gap ratio threshold for auto-deal (relative to seller_min)'),

  // Customer message (stored in negotiation_logs for the rep to read)
  message: Joi.string().max(2000).optional().allow('', null),
})
  .custom((value, helpers) => {
    if (value.seller_min > value.seller_max) {
      return helpers.error('any.invalid', { message: 'seller_min must be <= seller_max' });
    }
    if (value.buyer_min > value.buyer_max) {
      return helpers.error('any.invalid', { message: 'buyer_min must be <= buyer_max' });
    }
    return value;
  });

export default { runNegotiationSchema };
