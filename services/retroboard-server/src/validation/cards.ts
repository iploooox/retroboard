import { z } from 'zod';

export const addCardSchema = z.object({
  column_id: z.string().uuid('Invalid column_id format'),
  content: z.string().trim().min(1, 'Content is required').max(2000, 'Content must be at most 2000 characters'),
});

export const updateCardSchema = z.object({
  content: z.string().trim().min(1, 'Content cannot be empty').max(2000, 'Content must be at most 2000 characters').optional(),
  column_id: z.string().uuid().optional(),
  position: z.number().int().min(0).optional(),
});

export const createGroupSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  card_ids: z.array(z.string().uuid()).optional().default([]),
});

export const updateGroupSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(200, 'Title must be at most 200 characters').optional(),
  add_card_ids: z.array(z.string().uuid()).optional(),
  remove_card_ids: z.array(z.string().uuid()).optional(),
  position: z.number().int().min(0).optional(),
});
