import { z } from 'zod';

export const addCardSchema = z.object({
  column_id: z.string().uuid('Invalid column_id format'),
  content: z.string().min(1, 'Content is required'),
});

export const updateCardSchema = z.object({
  content: z.string().min(1).optional(),
  column_id: z.string().uuid().optional(),
  position: z.number().int().min(0).optional(),
});

export const createGroupSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  card_ids: z.array(z.string().uuid()).optional().default([]),
});

export const updateGroupSchema = z.object({
  title: z.string().min(1).optional(),
  add_card_ids: z.array(z.string().uuid()).optional(),
  remove_card_ids: z.array(z.string().uuid()).optional(),
  position: z.number().int().min(0).optional(),
});
