import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid quotation ID format'),
});

export const lineIdParamSchema = z.object({
  id: z.string().uuid('Invalid quotation ID format'),
  lineId: z.string().uuid('Invalid line ID format'),
});

export const createQuotationSchema = z.object({
  customer_id: z.string().uuid('Customer ID must be a valid UUID'),
  assigned_rep_id: z.string().uuid().optional().nullable(),
  currency: z.string().length(3).default('USD'),
  payment_terms_days: z.number().int().positive().default(30),
  valid_until: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'valid_until must be a valid date' }),
  terms_and_conditions: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
  customer_notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
});

export const quotationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  customer_id: z.string().uuid().optional(),
  assigned_rep_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'accepted', 'expired', 'cancelled']).optional(),
  order_by: z.enum(['created_at', 'quotation_number', 'grand_total', 'blended_risk_score']).default('created_at'),
  order_dir: z.enum(['asc', 'desc']).default('desc'),
});

export const addQuotationLineSchema = z.object({
  line_type: z.enum(['one_time', 'recurring']).default('one_time'),
  product_id: z.string().uuid().optional().nullable(),
  variant_id: z.string().uuid().optional().nullable(),
  subscription_plan_id: z.string().uuid().optional().nullable(),
  custom_name: z.string().optional().nullable(),
  custom_description: z.string().optional().nullable(),
  quantity: z.number().positive('Quantity must be greater than 0').default(1),
  unit_of_measure: z.string().default('EA'),
  list_price: z.number().nonnegative().optional(),
  discount_percent: z.number().min(0).max(100).default(0),
  discount_amount: z.number().min(0).default(0),
  tax_rate: z.number().min(0).max(100).default(0),
  expected_version: z.number().int().positive().optional(),
  is_upsell: z.boolean().default(false),
});

export const updateQuotationLineSchema = addQuotationLineSchema.partial();

export const submitQuotationSchema = z.object({
  idempotency_key: z.string().optional(),
  expected_version: z.number().int().positive().optional(),
});
