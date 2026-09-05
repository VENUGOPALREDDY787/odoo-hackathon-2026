import { z } from 'zod';

export const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'return_for_revision'], {
    required_error: 'Action is required and must be one of: approve, reject, return_for_revision',
  }),
  comments: z.string().max(1000).optional().nullable(),
  expected_version: z.number().int().positive().optional().nullable(),
});

export default {
  approvalActionSchema,
};
