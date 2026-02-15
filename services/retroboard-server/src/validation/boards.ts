import { z } from 'zod';

export const BOARD_PHASES = ['write', 'group', 'vote', 'discuss', 'action'] as const;
export type BoardPhase = (typeof BOARD_PHASES)[number];

export const FOCUS_ITEM_TYPES = ['card', 'group'] as const;
export type FocusItemType = (typeof FOCUS_ITEM_TYPES)[number];

// Allowed phase transitions: from -> [allowed targets]
export const ALLOWED_TRANSITIONS: Record<BoardPhase, BoardPhase[]> = {
  write: ['group'],
  group: ['write', 'vote'],
  vote: ['group', 'discuss'],
  discuss: ['vote', 'action'],
  action: ['discuss'],
};

export const createBoardSchema = z.object({
  template_id: z.string().uuid('Invalid template_id format'),
  anonymous_mode: z.boolean().optional().default(false),
  max_votes_per_user: z
    .number()
    .int()
    .min(1, 'Must be at least 1')
    .max(99, 'Must be at most 99')
    .optional()
    .default(5),
  max_votes_per_card: z
    .number()
    .int()
    .min(1, 'Must be at least 1')
    .max(99, 'Must be at most 99')
    .optional()
    .default(3),
});

export const updateBoardSchema = z.object({
  anonymous_mode: z.boolean().optional(),
  max_votes_per_user: z
    .number()
    .int()
    .min(1, 'Must be at least 1')
    .max(99, 'Must be at most 99')
    .optional(),
  max_votes_per_card: z
    .number()
    .int()
    .min(1, 'Must be at least 1')
    .max(99, 'Must be at most 99')
    .optional(),
});

export const setPhaseSchema = z.object({
  phase: z.enum(BOARD_PHASES, {
    errorMap: () => ({ message: `Phase must be one of: ${BOARD_PHASES.join(', ')}` }),
  }),
});

export const setFocusSchema = z.object({
  focus_item_id: z.string().uuid('Invalid focus_item_id format').nullable().optional(),
  focus_item_type: z
    .enum(FOCUS_ITEM_TYPES, {
      errorMap: () => ({ message: `Type must be one of: ${FOCUS_ITEM_TYPES.join(', ')}` }),
    })
    .nullable()
    .optional(),
  focusId: z.string().uuid('Invalid focusId format').nullable().optional(),
  focusType: z
    .enum(FOCUS_ITEM_TYPES, {
      errorMap: () => ({ message: `Type must be one of: ${FOCUS_ITEM_TYPES.join(', ')}` }),
    })
    .nullable()
    .optional(),
}).transform((data) => ({
  focus_item_id: data.focus_item_id ?? data.focusId ?? null,
  focus_item_type: data.focus_item_type ?? data.focusType ?? null,
})).refine(
  (data) =>
    (data.focus_item_id === null && data.focus_item_type === null) ||
    (data.focus_item_id !== null && data.focus_item_type !== null),
  { message: 'focus_item_id and focus_item_type must both be null or both be non-null' },
);

export const uuidParam = z.string().uuid('Invalid UUID format');
