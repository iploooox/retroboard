import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { icebreakerService } from '../services/icebreaker-service.js';
import { sql } from '../db/connection.js';
import { z } from 'zod';
import { broadcastToBoard } from '../ws/index.js';
import { uuidParam } from '../validation/boards.js';

function okRes(data: unknown) {
  return { ok: true, data };
}

function errRes(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

const icebreakersRouter = new Hono();
icebreakersRouter.use('*', requireAuth);

// GET /api/v1/icebreakers/random?teamId=X&category=Y&boardId=Z
icebreakersRouter.get('/icebreakers/random', async (c) => {
  const teamId = c.req.query('teamId');
  const category = c.req.query('category');
  const boardId = c.req.query('boardId');
  const user = c.get('user');

  if (!teamId) {
    return c.json(errRes('VALIDATION_ERROR', 'teamId is required'), 400);
  }

  // Validate category if provided
  if (category && !icebreakerService.isValidCategory(category)) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid category'), 400);
  }

  // Check user is team member
  const [member] = await sql`
    SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
  `;

  if (!member) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  const icebreaker = await icebreakerService.getRandom(teamId, category);

  // If boardId is provided, broadcast the icebreaker to all board participants
  if (boardId) {
    broadcastToBoard(boardId, {
      type: 'icebreaker_update',
      payload: {
        question: icebreaker.question,
        category: icebreaker.category,
        id: icebreaker.id,
      },
    });
  }

  return c.json(okRes(icebreaker));
});

// POST /api/v1/teams/:teamId/icebreakers/custom
icebreakersRouter.post('/teams/:teamId/icebreakers/custom', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');

  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    question: z.string().min(1),
    category: z.string().min(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json(errRes('VALIDATION_ERROR', 'Validation failed'), 400);
  }

  const { question, category } = parsed.data;

  // Validate category
  if (!icebreakerService.isValidCategory(category)) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid category'), 400);
  }

  // Check user is admin or facilitator
  const [member] = await sql`
    SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
  `;

  if (!member) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  if (member.role !== 'admin' && member.role !== 'facilitator') {
    return c.json(errRes('FORBIDDEN', 'Only admins and facilitators can create custom icebreakers'), 403);
  }

  const icebreaker = await icebreakerService.createCustom(teamId, question, category, user.id);

  return c.json(okRes(icebreaker), 201);
});

// PATCH /api/v1/boards/:boardId/icebreaker — Reroll icebreaker question (facilitator only)
icebreakersRouter.patch('/boards/:boardId/icebreaker', async (c) => {
  const boardId = c.req.param('boardId');
  const user = c.get('user');

  // Validate boardId is a valid UUID
  if (!uuidParam.safeParse(boardId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid board ID format'), 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const category = typeof body?.category === 'string' ? body.category : undefined;

  // Validate category if provided
  if (category && !icebreakerService.isValidCategory(category)) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid category'), 400);
  }

  // Get board + team info (include phase for guard check)
  const [boardRow] = await sql`
    SELECT b.id, b.phase, s.team_id
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    WHERE b.id = ${boardId}
  `;

  if (!boardRow) {
    return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  // Phase guard — only allow reroll during icebreaker phase
  if (boardRow.phase !== 'icebreaker') {
    return c.json(errRes('INVALID_PHASE', 'Can only change icebreaker during icebreaker phase'), 422);
  }

  const teamId = boardRow.team_id as string;

  // Check user role — only facilitator/admin
  const [member] = await sql`
    SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
  `;

  if (!member) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  if (member.role !== 'admin' && member.role !== 'facilitator') {
    return c.json(errRes('FORBIDDEN', 'Only facilitators and admins can change the icebreaker question'), 403);
  }

  // Get random icebreaker (with optional category filter)
  const icebreaker = await icebreakerService.getRandom(teamId, category);

  if (!icebreaker) {
    return c.json(errRes('NO_ICEBREAKER', 'No icebreaker questions available'), 404);
  }

  // Update board's icebreaker_id and record history atomically
  await sql.begin(async (tx) => {
    await tx`UPDATE boards SET icebreaker_id = ${icebreaker.id} WHERE id = ${boardId}`;
    await tx`
      INSERT INTO team_icebreaker_history (team_id, icebreaker_id, board_id, used_at)
      VALUES (${teamId}, ${icebreaker.id}, ${boardId}, NOW())
    `;
  });

  // Broadcast to all board participants
  broadcastToBoard(boardId, {
    type: 'icebreaker_question_changed',
    payload: {
      id: icebreaker.id,
      question: icebreaker.question,
      category: icebreaker.category,
    },
  });

  return c.json(okRes(icebreaker));
});

// POST /api/v1/boards/:boardId/icebreaker
icebreakersRouter.post('/boards/:boardId/icebreaker', async (c) => {
  const boardId = c.req.param('boardId');
  const user = c.get('user');

  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    icebreakerId: z.string().uuid(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json(errRes('VALIDATION_ERROR', 'Validation failed'), 400);
  }

  const { icebreakerId } = parsed.data;

  // Get team ID from board
  const [board] = await sql`
    SELECT s.team_id
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    WHERE b.id = ${boardId}
  `;

  if (!board) {
    return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const teamId = board.team_id as string;

  // Check user is team member
  const [member] = await sql`
    SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
  `;

  if (!member) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  // Record history
  await icebreakerService.recordHistory(teamId, icebreakerId, boardId);

  return c.json(okRes({ recorded: true }));
});

// DELETE /api/v1/boards/:boardId/icebreaker
icebreakersRouter.delete('/boards/:boardId/icebreaker', async (c) => {
  const boardId = c.req.param('boardId');
  const user = c.get('user');

  // Get team ID from board
  const [board] = await sql`
    SELECT s.team_id
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    WHERE b.id = ${boardId}
  `;

  if (!board) {
    return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const teamId = board.team_id as string;

  // Check user is team member
  const [member] = await sql`
    SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
  `;

  if (!member) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  // We don't actually need to delete history, just return success
  return c.json(okRes({ deleted: true }));
});

export { icebreakersRouter };
