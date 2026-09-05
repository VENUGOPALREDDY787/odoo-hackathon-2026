import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const quotationIdParamSchema = z.object({
  quotationId: z.string().uuid('Invalid quotation ID format'),
});

const baseDiscountTierSchema = z.object({
  customer_tier: z.enum(['Bronze', 'Silver', 'Gold']),
  category_id: z.string().uuid().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  min_quantity: z.number().int().positive().default(1),
  max_quantity: z.number().int().positive().optional().nullable(),
  discount_percent: z.number().min(0, 'Discount % cannot be negative').max(100, 'Discount % cannot exceed 100'),
  discount_fixed_amount: z.number().min(0).default(0),
  priority: z.number().int().default(0),
  is_active: z.boolean().default(true),
  effective_from: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Effective from must be a valid date' }),
  effective_to: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Effective to must be a valid date' }).optional().nullable(),
});

export const discountTierSchema = baseDiscountTierSchema.refine(_data => {
  // Either category_id or product_id or both can be specified, but at least one preferred
  return true;
});

export const discountTierUpdateSchema = baseDiscountTierSchema.partial();

export const discountTierQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  customer_tier: z.enum(['Bronze', 'Silver', 'Gold']).optional(),
  category_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  is_active: z.preprocess(val => {
    if (val === 'true' || val === true) { return true; }
    if (val === 'false' || val === false) { return false; }
    return undefined;
  }, z.boolean().optional()),
});

export const approvalChainSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional().nullable(),
  min_discount_percent: z.number().min(0).max(100).default(0),
  max_discount_percent: z.number().min(0).max(100),
  required_approver_roles: z.array(z.enum(['rep', 'manager', 'finance', 'admin'])).min(1, 'At least one approver role required'),
  min_approvals_required: z.number().int().positive().default(1),
  is_active: z.boolean().default(true),
});

export const approvalChainUpdateSchema = approvalChainSchema.partial();

export const approvalChainQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  is_active: z.preprocess(val => {
    if (val === 'true' || val === true) { return true; }
    if (val === 'false' || val === false) { return false; }
    return undefined;
  }, z.boolean().optional()),
});

export const evaluateRiskSchema = z.object({
  customer_tier: z.enum(['Bronze', 'Silver', 'Gold']).default('Bronze'),
  lines: z.array(
    z.object({
      line_number: z.number().int().optional(),
      product_id: z.string().uuid().optional().nullable(),
      category_id: z.string().uuid().optional().nullable(),
      discount_percent: z.number().min(0).max(100).default(0),
    })
  ).min(1, 'At least one line item required for evaluation'),
});

export const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'return_for_revision', 'approved', 'rejected', 'returned']),
  comments: z.string().max(1000).optional(),
});
