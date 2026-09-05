import { z } from 'zod';

export const subscriptionPlanSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().optional().nullable(),
  interval_type: z.enum(['monthly', 'quarterly', 'yearly']),
  interval_count: z.number().int().min(1).optional().default(1),
  base_price: z.number().nonnegative(),
  setup_fee: z.number().nonnegative().optional().default(0.00),
  trial_days: z.number().int().min(0).optional().default(0),
  proration_rule: z.enum(['none', 'full', 'partial', 'day_based']).optional().default('day_based'),
  max_users: z.number().int().positive().optional().nullable(),
  features: z.record(z.any()).optional().default({}),
  is_active: z.boolean().optional().default(true),
});

export const subscriptionPlanUpdateSchema = subscriptionPlanSchema.partial();

export const generateScheduleSchema = z.object({
  quotation_id: z.string().uuid(),
  start_date: z.string().optional(),
  default_cycles: z.number().int().min(1).optional().default(12),
});

export const cancelLineSchema = z.object({
  quotation_line_id: z.string().uuid(),
  cancellation_date: z.string().optional(),
  cancellation_reason: z.string().min(3, 'Cancellation reason is required for audit trail'),
});

export default {
  subscriptionPlanSchema,
  subscriptionPlanUpdateSchema,
  generateScheduleSchema,
  cancelLineSchema,
};
