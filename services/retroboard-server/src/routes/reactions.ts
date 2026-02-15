import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { reactionService } from '../services/reaction-service.js';
import { sql } from '../db/connection.js';
import { z } from 'zod';

function okRes(data: unknown) {
  return { ok: true, data };
}

function errRes(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

const reactionsRouter = new Hono();
reactionsRouter.use('*', requireAuth);

// Schema for reaction toggle
const toggleReactionSchema = z.object({
  emoji: z.string().min(1),
});

// POST /api/v1/cards/:cardId/reactions — Toggle reaction
reactionsRouter.post('/cards/:cardId/reactions', async (c) => {
  const cardId = c.req.param('cardId');
  const user = c.get('user');

  const body = await c.req.json().catch(() => ({}));
  const parsed = toggleReactionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(errRes('VALIDATION_ERROR', 'Validation failed'), 400);
  }

  const { emoji } = parsed.data;

  // Check card exists
  const [card] = await sql`SELECT board_id FROM cards WHERE id = ${cardId}`;
  if (!card) {
    return c.json(errRes('CARD_NOT_FOUND', 'Card not found'), 404);
  }

  const boardId = card.board_id as string;

  // Check user is team member
  const [teamCheck] = await sql`
    SELECT tm.role
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    JOIN team_members tm ON tm.team_id = s.team_id
    WHERE b.id = ${boardId} AND tm.user_id = ${user.id}
  `;

  if (!teamCheck) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  try {
    const result = await reactionService.toggle(cardId, user.id, emoji);
    return c.json(okRes({
      added: result.added,
      emoji: result.emoji,
      reactions: result.summary,
    }));
  } catch (err: any) {
    if (err.code === 'INVALID_EMOJI') {
      return c.json(errRes('VALIDATION_ERROR', err.message), 400);
    }
    if (err.code === 'BOARD_LOCKED') {
      return c.json(errRes('BOARD_LOCKED', err.message), 403);
    }
    if (err.code === 'CARD_NOT_FOUND') {
      return c.json(errRes('CARD_NOT_FOUND', err.message), 404);
    }
    throw err;
  }
});

export { reactionsRouter };
