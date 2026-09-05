import { z } from 'zod';

export const warehouseSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(255),
  address: z.record(z.any()).optional().default({}),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().max(50).optional().nullable(),
  is_default: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
});

export const warehouseUpdateSchema = warehouseSchema.partial();

export const stockLevelSchema = z.object({
  warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional().nullable(),
  quantity_on_hand: z.number().int().min(0),
  reorder_point: z.number().int().min(0).optional().default(0),
  reorder_quantity: z.number().int().min(0).optional().default(0),
});

export const stockAdjustmentSchema = z.object({
  warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional().nullable(),
  quantity_change: z.number().int(), // positive for replenishment, negative for audit loss
  reason: z.string().optional().nullable(),
});

export const splitOverrideSchema = z.object({
  quotation_line_id: z.string().uuid(),
  override_reason: z.string().min(3, 'Override reason is required for manual split adjustment'),
  custom_splits: z.array(
    z.object({
      warehouse_id: z.string().uuid(),
      quantity: z.number().positive('Quantity must be greater than 0'),
    })
  ).min(1, 'At least one warehouse split is required'),
});

export default {
  warehouseSchema,
  warehouseUpdateSchema,
  stockLevelSchema,
  stockAdjustmentSchema,
  splitOverrideSchema,
};
