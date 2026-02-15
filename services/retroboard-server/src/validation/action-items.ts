import { z } from 'zod';

export const createActionItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  cardId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const updateActionItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.string().optional(),
});

export const listActionItemsSchema = z.object({
  status: z.enum(['open', 'in_progress', 'done']).optional(),
  assigneeId: z.string().uuid().optional(),
  sort: z.enum(['created_at', 'due_date', 'status', 'title']).optional().default('created_at'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const teamActionItemsSchema = z.object({
  status: z.enum(['open', 'in_progress', 'done']).optional(),
  sprintId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  sort: z.enum(['created_at', 'due_date', 'status', 'sprint']).optional().default('created_at'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
