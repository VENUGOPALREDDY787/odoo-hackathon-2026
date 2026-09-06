import { z } from 'zod';

export const auditTrailQuerySchema = z.object({
  table_name: z.string().trim().min(1).max(100).optional(),
  record_id: z.string().trim().min(1).max(64).optional(),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
  changed_by: z.string().trim().min(1).max(64).optional(),
  changed_by_role: z.string().trim().min(1).max(32).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export default auditTrailQuerySchema;
