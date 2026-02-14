import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .nullable()
    .optional()
    .default(null),
  avatar_url: z
    .string()
    .url('Must be a valid URL')
    .max(500, 'Avatar URL must be at most 500 characters')
    .nullable()
    .optional()
    .default(null),
});

export const updateTeamSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name must be at least 1 character')
      .max(100, 'Name must be at most 100 characters')
      .optional(),
    description: z
      .string()
      .max(500, 'Description must be at most 500 characters')
      .nullable()
      .optional(),
    avatar_url: z
      .string()
      .url('Must be a valid URL')
      .max(500, 'Avatar URL must be at most 500 characters')
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.avatar_url !== undefined,
    { message: 'At least one field must be provided' },
  );

export const createInvitationSchema = z.object({
  expires_in_hours: z
    .number()
    .int()
    .min(1, 'Must be at least 1 hour')
    .max(720, 'Must be at most 720 hours (30 days)')
    .optional()
    .default(168),
  max_uses: z
    .number()
    .int()
    .min(1, 'Must be at least 1')
    .max(1000, 'Must be at most 1000')
    .nullable()
    .optional()
    .default(null),
  role: z
    .enum(['member', 'facilitator', 'admin'])
    .optional()
    .default('member'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'facilitator', 'member'], {
    errorMap: () => ({ message: 'Role must be admin, facilitator, or member' }),
  }),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').optional().default(1),
  per_page: z.coerce
    .number()
    .int()
    .min(1, 'Per page must be at least 1')
    .max(100, 'Per page must be at most 100')
    .optional()
    .default(20),
});

export const uuidParamSchema = z.string().uuid('Invalid UUID format');
