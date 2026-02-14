import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Invalid email format')
    .max(255, 'Email must be at most 255 characters'),
  password: z.string()
    .min(8, 'Must be at least 8 characters')
    .max(128, 'Must be at most 128 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one digit'),
  display_name: z.string()
    .trim()
    .min(2, 'Must be at least 2 characters')
    .max(50, 'Must be at most 50 characters'),
}).strip();

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Invalid email format')
    .max(255),
  password: z.string()
    .min(1, 'Password is required')
    .max(128),
}).strip();

export const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
}).strip();

export const updateProfileSchema = z.object({
  display_name: z.string()
    .trim()
    .min(2, 'Must be at least 2 characters')
    .max(50, 'Must be at most 50 characters')
    .optional(),
  avatar_url: z.union([
    z.string()
      .max(500, 'Must be at most 500 characters')
      .url('Invalid URL format')
      .refine((url) => url.startsWith('https://'), 'Must use https:// protocol')
      .refine(
        (url) => !url.startsWith('javascript:') && !url.startsWith('data:') && !url.startsWith('vbscript:'),
        'Unsafe URL protocol',
      ),
    z.null(),
  ]).optional(),
}).strip().refine(
  (data) => data.display_name !== undefined || data.avatar_url !== undefined,
  { message: 'At least one field must be provided' },
);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
