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

// ---- Icebreaker Response Wall (S-003) ----

// In-memory rate limiter: userId -> lastSubmitTimestamp
const responseRateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 2000; // 1 response per 2 seconds

// POST /api/v1/boards/:boardId/icebreaker/responses — Submit anonymous response
icebreakersRouter.post('/boards/:boardId/icebreaker/responses', async (c) => {
  const boardId = c.req.param('boardId');
  const user = c.get('user');

  // Validate boardId
  if (!uuidParam.safeParse(boardId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid board ID format'), 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    content: z.string().min(1, 'Response cannot be empty').max(280, 'Response must be 280 characters or fewer'),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? 'Validation failed';
    return c.json(errRes('VALIDATION_ERROR', firstError), 400);
  }

  const content = parsed.data.content.trim();

  // Reject whitespace-only after trim
  if (content.length === 0) {
    return c.json(errRes('VALIDATION_ERROR', 'Response cannot be empty'), 400);
  }

  // Re-check max length after trim
  if (content.length > 280) {
    return c.json(errRes('VALIDATION_ERROR', 'Response must be 280 characters or fewer'), 400);
  }

  // Get board + team info + icebreaker_id
  const [boardRow] = await sql`
    SELECT b.id, b.phase, b.icebreaker_id, s.team_id
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    WHERE b.id = ${boardId}
  `;

  if (!boardRow) {
    return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  // Phase guard
  if (boardRow.phase !== 'icebreaker') {
    return c.json(errRes('INVALID_PHASE', 'Can only submit responses during icebreaker phase'), 422);
  }

  if (!boardRow.icebreaker_id) {
    return c.json(errRes('NO_ICEBREAKER', 'No icebreaker question set for this board'), 422);
  }

  const teamId = boardRow.team_id as string;

  // Check user is team member
  const [member] = await sql`
    SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
  `;

  if (!member) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  // Rate limiting (in-memory)
  const now = Date.now();
  const lastSubmit = responseRateLimit.get(user.id);
  if (lastSubmit && now - lastSubmit < RATE_LIMIT_MS) {
    return c.json(errRes('RATE_LIMITED', 'Please wait before submitting another response'), 429);
  }
  responseRateLimit.set(user.id, now);

  // Insert response
  const [response] = await sql`
    INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content)
    VALUES (${boardId}, ${boardRow.icebreaker_id}, ${user.id}, ${content})
    RETURNING id, content, created_at
  `;

  // Broadcast to all participants (no author info!)
  broadcastToBoard(boardId, {
    type: 'icebreaker_response_added',
    payload: {
      id: response.id as string,
      content: response.content as string,
      created_at: (response.created_at as Date).toISOString(),
    },
  });

  return c.json(okRes({
    id: response.id,
    content: response.content,
    created_at: (response.created_at as Date).toISOString(),
  }), 201);
});

// GET /api/v1/boards/:boardId/icebreaker/responses — Get all responses
icebreakersRouter.get('/boards/:boardId/icebreaker/responses', async (c) => {
  const boardId = c.req.param('boardId');
  const user = c.get('user');

  // Validate boardId
  if (!uuidParam.safeParse(boardId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid board ID format'), 400);
  }

  // Get board + team + icebreaker_id
  const [boardRow] = await sql`
    SELECT b.id, b.icebreaker_id, s.team_id
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    WHERE b.id = ${boardId}
  `;

  if (!boardRow) {
    return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const teamId = boardRow.team_id as string;

  // Check user is team member
  const [member] = await sql`
    SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
  `;

  if (!member) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  if (!boardRow.icebreaker_id) {
    return c.json(okRes({ responses: [], count: 0 }));
  }

  // Get non-deleted responses for current icebreaker, ordered by created_at ASC
  // NEVER include author_id
  const responses = await sql`
    SELECT id, content, created_at
    FROM icebreaker_responses
    WHERE board_id = ${boardId}
      AND icebreaker_id = ${boardRow.icebreaker_id}
      AND deleted_at IS NULL
    ORDER BY created_at ASC
  `;

  const formatted = responses.map((r) => ({
    id: r.id as string,
    content: r.content as string,
    created_at: (r.created_at as Date).toISOString(),
  }));

  return c.json(okRes({ responses: formatted, count: formatted.length }));
});

// DELETE /api/v1/boards/:boardId/icebreaker/responses/:responseId — Facilitator soft-delete
icebreakersRouter.delete('/boards/:boardId/icebreaker/responses/:responseId', async (c) => {
  const boardId = c.req.param('boardId');
  const responseId = c.req.param('responseId');
  const user = c.get('user');

  // Validate IDs
  if (!uuidParam.safeParse(boardId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid board ID format'), 400);
  }
  if (!uuidParam.safeParse(responseId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid response ID format'), 400);
  }

  // Get board + team
  const [boardRow] = await sql`
    SELECT b.id, s.team_id
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    WHERE b.id = ${boardId}
  `;

  if (!boardRow) {
    return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const teamId = boardRow.team_id as string;

  // Check user role — only facilitator/admin can delete
  const [member] = await sql`
    SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
  `;

  if (!member) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  if (member.role !== 'admin' && member.role !== 'facilitator') {
    return c.json(errRes('FORBIDDEN', 'Only facilitators and admins can delete responses'), 403);
  }

  // Soft-delete the response
  const [deleted] = await sql`
    UPDATE icebreaker_responses
    SET deleted_at = NOW()
    WHERE id = ${responseId} AND board_id = ${boardId} AND deleted_at IS NULL
    RETURNING id
  `;

  if (!deleted) {
    return c.json(errRes('NOT_FOUND', 'Response not found'), 404);
  }

  // Broadcast removal to all participants
  broadcastToBoard(boardId, {
    type: 'icebreaker_response_removed',
    payload: {
      id: responseId,
    },
  });

  return c.json(okRes({ id: responseId, deleted: true }));
});

// Export for testing: clear rate limit map
export function clearResponseRateLimit() {
  responseRateLimit.clear();
}

export { icebreakersRouter };
