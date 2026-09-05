import Joi from 'joi';

// Shared filter schema for both UI and Export requests
const reportFilters = {
  start_date: Joi.string().isoDate().optional(), // YYYY-MM-DD
  end_date: Joi.string().isoDate().optional(),   // YYYY-MM-DD
  rep_id: Joi.string().uuid().optional(),
  status: Joi.string().valid('draft','pending_approval','approved','rejected','sent','accepted','expired','cancelled').optional(),
  product_id: Joi.string().uuid().optional(),
  category_id: Joi.string().uuid().optional(),
  customer_tier: Joi.string().valid('Bronze', 'Silver', 'Gold').optional(),
};

export const getSalesReportSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  order_by: Joi.string().valid('created_at', 'grand_total', 'margin_percentage').default('created_at'),
  order_dir: Joi.string().valid('asc', 'desc').default('desc'),
  ...reportFilters
});

export const exportReportSchema = Joi.object({
  ...reportFilters
});
