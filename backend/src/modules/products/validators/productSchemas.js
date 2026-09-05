import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
});

export const variantIdParamSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
  variantId: z.string().uuid('Invalid variant ID format'),
});

export const priceListIdParamSchema = z.object({
  priceListId: z.string().uuid('Invalid price list ID format'),
});

export const priceListItemIdParamSchema = z.object({
  itemId: z.string().uuid('Invalid item ID format'),
});

export const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(100),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional().nullable(),
  category_id: z.string().uuid('Category ID must be a valid UUID'),
  base_price: z.number({ invalid_type_error: 'Base price must be a number' }).nonnegative('Base price cannot be negative').max(999999999.99),
  cost_price: z.number().nonnegative().max(999999999.99).optional().nullable(),
  unit_of_measure: z.string().max(50).default('EA'),
  weight_kg: z.number().positive().max(9999.999).optional().nullable(),
  dimensions_cm: z.record(z.any()).optional().nullable(),
  is_active: z.boolean().default(true),
  is_recurring_eligible: z.boolean().default(false),
  metadata: z.record(z.any()).default({}),
});

export const productUpdateSchema = productSchema.partial();

export const productVariantSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(100),
  name: z.string().min(1, 'Name is required').max(255),
  attributes: z.record(z.any()).default({}),
  price_adjustment: z.number().max(999999999.99).default(0),
  cost_adjustment: z.number().max(999999999.99).optional().nullable(),
  weight_kg: z.number().positive().max(9999.999).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const productVariantUpdateSchema = productVariantSchema.partial();

export const priceListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional().nullable(),
  currency: z.string().length(3, 'Currency must be a 3-character ISO code').default('USD'),
  is_default: z.boolean().default(false),
  effective_from: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Effective from must be a valid date' }),
  effective_to: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Effective to must be a valid date' }).optional().nullable(),
});

export const priceListUpdateSchema = priceListSchema.partial();

export const priceListItemSchema = z.object({
  price_list_id: z.string().uuid('Price list ID must be a valid UUID').optional(),
  product_id: z.string().uuid('Product ID must be a valid UUID'),
  variant_id: z.string().uuid('Variant ID must be a valid UUID').optional().nullable(),
  customer_tier: z.enum(['Bronze', 'Silver', 'Gold']).optional().nullable(),
  min_quantity: z.number().int().positive().default(1),
  max_quantity: z.number().int().positive().optional().nullable(),
  unit_price: z.number().nonnegative('Unit price cannot be negative').max(999999999.99),
});

export const priceListItemUpdateSchema = priceListItemSchema.partial();

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category_id: z.string().uuid().optional(),
  is_active: z.preprocess(val => {
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return undefined;
  }, z.boolean().optional()),
  search: z.string().optional(),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().positive().optional(),
  order_by: z.enum(['created_at', 'name', 'sku', 'base_price']).default('created_at'),
  order_dir: z.enum(['asc', 'desc']).default('desc'),
});

export const priceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  is_default: z.preprocess(val => {
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return undefined;
  }, z.boolean().optional()),
  currency: z.string().length(3).optional(),
  active_only: z.preprocess(val => {
    if (val === 'false' || val === false) return false;
    return true;
  }, z.boolean().default(true)),
  order_by: z.enum(['created_at', 'name', 'effective_from']).default('created_at'),
  order_dir: z.enum(['asc', 'desc']).default('desc'),
});

export const priceResolutionQuerySchema = z.object({
  customer_tier: z.enum(['Bronze', 'Silver', 'Gold']).default('Bronze'),
  currency: z.string().length(3).default('USD'),
  quantity: z.coerce.number().int().positive().default(1),
  variant_id: z.string().uuid().optional(),
});