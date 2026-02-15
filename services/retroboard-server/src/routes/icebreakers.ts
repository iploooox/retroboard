import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { icebreakerService } from '../services/icebreaker-service.js';
import { sql } from '../db/connection.js';
import { z } from 'zod';
import { broadcastToBoard } from '../ws/index.js';

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
