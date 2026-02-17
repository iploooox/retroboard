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

// GET /api/v1/teams/:teamId/icebreakers/custom — List custom questions for team
icebreakersRouter.get('/teams/:teamId/icebreakers/custom', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');

  // Check user is team member
  const [member] = await sql`
    SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
  `;

  if (!member) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  // Check team exists and not deleted
  const [team] = await sql`
    SELECT id FROM teams WHERE id = ${teamId} AND deleted_at IS NULL
  `;

  if (!team) {
    return c.json(errRes('NOT_FOUND', 'Team not found'), 404);
  }

  const questions = await sql`
    SELECT i.id, i.question, i.category, i.created_by, i.created_at,
           u.display_name AS created_by_name
    FROM icebreakers i
    LEFT JOIN users u ON u.id = i.created_by
    WHERE i.team_id = ${teamId} AND i.is_system = false
    ORDER BY i.created_at DESC
  `;

  const formatted = questions.map((q) => ({
    id: q.id as string,
    question: q.question as string,
    category: q.category as string,
    created_by: q.created_by as string,
    created_by_name: (q.created_by_name as string) ?? null,
    created_at: (q.created_at as Date).toISOString(),
  }));

  return c.json(okRes({ questions: formatted, count: formatted.length }));
});

// DELETE /api/v1/teams/:teamId/icebreakers/:icebreakerId — Delete custom question (admin-only)
icebreakersRouter.delete('/teams/:teamId/icebreakers/:icebreakerId', async (c) => {
  const teamId = c.req.param('teamId');
  const icebreakerId = c.req.param('icebreakerId');
  const user = c.get('user');

  // Check user is admin
  const [member] = await sql`
    SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
  `;

  if (!member) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  if (member.role !== 'admin') {
    return c.json(errRes('FORBIDDEN', 'Only admins can delete custom icebreakers'), 403);
  }

  // Check icebreaker exists, belongs to team, and is not system
  const [icebreaker] = await sql`
    SELECT id, is_system, team_id FROM icebreakers WHERE id = ${icebreakerId}
  `;

  if (!icebreaker) {
    return c.json(errRes('NOT_FOUND', 'Icebreaker not found'), 404);
  }

  if (icebreaker.is_system) {
    return c.json(errRes('FORBIDDEN', 'Cannot delete system icebreakers'), 403);
  }

  if (icebreaker.team_id !== teamId) {
    return c.json(errRes('FORBIDDEN', 'Icebreaker does not belong to this team'), 403);
  }

  await sql`DELETE FROM icebreakers WHERE id = ${icebreakerId}`;

  return c.json(okRes({ id: icebreakerId, deleted: true }));
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

// ---- Icebreaker Response Reactions (S-005) ----

const VALID_EMOJIS = ['laugh', 'fire', 'heart', 'bullseye', 'clap', 'skull'] as const;
type ValidEmoji = typeof VALID_EMOJIS[number];

function isValidEmoji(emoji: string): emoji is ValidEmoji {
  return (VALID_EMOJIS as readonly string[]).includes(emoji);
}

// POST /api/v1/boards/:boardId/icebreaker/responses/:responseId/reactions — Toggle reaction
icebreakersRouter.post('/boards/:boardId/icebreaker/responses/:responseId/reactions', async (c) => {
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

  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    emoji: z.string().min(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json(errRes('VALIDATION_ERROR', 'Validation failed'), 400);
  }

  const { emoji } = parsed.data;

  // Validate emoji value
  if (!isValidEmoji(emoji)) {
    return c.json(errRes('VALIDATION_ERROR', `Invalid emoji. Must be one of: ${VALID_EMOJIS.join(', ')}`), 400);
  }

  // Get board + team info
  const [boardRow] = await sql`
    SELECT b.id, b.phase, s.team_id
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    WHERE b.id = ${boardId}
  `;

  if (!boardRow) {
    return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  // Phase guard
  if (boardRow.phase !== 'icebreaker') {
    return c.json(errRes('INVALID_PHASE', 'Can only react during icebreaker phase'), 422);
  }

  const teamId = boardRow.team_id as string;

  // Check user is team member
  const [member] = await sql`
    SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
  `;

  if (!member) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  // Verify response exists and is not deleted
  const [responseRow] = await sql`
    SELECT id FROM icebreaker_responses
    WHERE id = ${responseId} AND board_id = ${boardId} AND deleted_at IS NULL
  `;

  if (!responseRow) {
    return c.json(errRes('NOT_FOUND', 'Response not found'), 404);
  }

  // Toggle: check if reaction already exists
  const [existing] = await sql`
    SELECT id FROM icebreaker_response_reactions
    WHERE response_id = ${responseId} AND user_id = ${user.id} AND emoji = ${emoji}
  `;

  let action: 'added' | 'removed';

  if (existing) {
    // Remove existing reaction
    await sql`
      DELETE FROM icebreaker_response_reactions
      WHERE id = ${existing.id}
    `;
    action = 'removed';
  } else {
    // Add new reaction
    await sql`
      INSERT INTO icebreaker_response_reactions (response_id, user_id, emoji)
      VALUES (${responseId}, ${user.id}, ${emoji})
    `;
    action = 'added';
  }

  // Get updated count for this emoji on this response
  const [countRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM icebreaker_response_reactions
    WHERE response_id = ${responseId} AND emoji = ${emoji}
  `;

  const count = (countRow?.count as number) ?? 0;

  // Broadcast to all board participants
  broadcastToBoard(boardId, {
    type: 'icebreaker_reaction_updated',
    payload: {
      responseId,
      emoji,
      count,
    },
  });

  return c.json(okRes({ action, emoji, count }));
});

// ---- Icebreaker Response Wall (S-003) ----

// In-memory rate limiter: userId -> lastSubmitTimestamp
const responseRateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 2000; // 1 response per 2 seconds
const RATE_LIMIT_CLEANUP_THRESHOLD = 10_000;

function cleanupRateLimit() {
  if (responseRateLimit.size <= RATE_LIMIT_CLEANUP_THRESHOLD) return;
  const cutoff = Date.now() - RATE_LIMIT_MS;
  for (const [key, ts] of responseRateLimit) {
    if (ts < cutoff) responseRateLimit.delete(key);
  }
}

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
  cleanupRateLimit();
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

  if (responses.length === 0) {
    return c.json(okRes({ responses: [], count: 0 }));
  }

  const responseIds = responses.map((r) => r.id as string);

  // Get aggregated reaction counts per response per emoji (single query, no N+1)
  const reactionCounts = await sql`
    SELECT response_id, emoji, COUNT(*)::int AS count
    FROM icebreaker_response_reactions
    WHERE response_id = ANY(${responseIds})
    GROUP BY response_id, emoji
  `;

  // Get current user's reactions (single query)
  const myReactions = await sql`
    SELECT response_id, emoji
    FROM icebreaker_response_reactions
    WHERE response_id = ANY(${responseIds})
      AND user_id = ${user.id}
  `;

  // Build lookup maps
  const reactionsMap = new Map<string, Record<string, number>>();
  for (const row of reactionCounts) {
    const rid = row.response_id as string;
    if (!reactionsMap.has(rid)) {
      reactionsMap.set(rid, {});
    }
    reactionsMap.get(rid)![row.emoji as string] = row.count as number;
  }

  const myReactionsMap = new Map<string, string[]>();
  for (const row of myReactions) {
    const rid = row.response_id as string;
    if (!myReactionsMap.has(rid)) {
      myReactionsMap.set(rid, []);
    }
    myReactionsMap.get(rid)!.push(row.emoji as string);
  }

  const formatted = responses.map((r) => ({
    id: r.id as string,
    content: r.content as string,
    created_at: (r.created_at as Date).toISOString(),
    reactions: reactionsMap.get(r.id as string) ?? {},
    myReactions: myReactionsMap.get(r.id as string) ?? [],
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

// ---- Icebreaker Summary (S-007) ----

// GET /api/v1/boards/:boardId/icebreaker/summary — Aggregated stats for energy recap
icebreakersRouter.get('/boards/:boardId/icebreaker/summary', async (c) => {
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

  const icebreakerId = boardRow.icebreaker_id as string | null;

  // If no icebreaker, return zero stats
  if (!icebreakerId) {
    return c.json(okRes({
      responseCount: 0,
      reactionCount: 0,
      topEmoji: null,
      participantCount: 0,
    }));
  }

  // Count non-deleted responses for this board + icebreaker
  const [responseCountRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM icebreaker_responses
    WHERE board_id = ${boardId}
      AND icebreaker_id = ${icebreakerId}
      AND deleted_at IS NULL
  `;
  const responseCount = (responseCountRow?.count as number) ?? 0;

  // Count distinct authors (participants)
  const [participantCountRow] = await sql`
    SELECT COUNT(DISTINCT author_id)::int AS count
    FROM icebreaker_responses
    WHERE board_id = ${boardId}
      AND icebreaker_id = ${icebreakerId}
      AND deleted_at IS NULL
  `;
  const participantCount = (participantCountRow?.count as number) ?? 0;

  // Count all response reactions for non-deleted responses on this board + icebreaker
  const [reactionCountRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM icebreaker_response_reactions rr
    JOIN icebreaker_responses r ON r.id = rr.response_id
    WHERE r.board_id = ${boardId}
      AND r.icebreaker_id = ${icebreakerId}
      AND r.deleted_at IS NULL
  `;
  const reactionCount = (reactionCountRow?.count as number) ?? 0;

  // Find top emoji (most reacted)
  const [topEmojiRow] = await sql`
    SELECT rr.emoji, COUNT(*)::int AS count
    FROM icebreaker_response_reactions rr
    JOIN icebreaker_responses r ON r.id = rr.response_id
    WHERE r.board_id = ${boardId}
      AND r.icebreaker_id = ${icebreakerId}
      AND r.deleted_at IS NULL
    GROUP BY rr.emoji
    ORDER BY count DESC
    LIMIT 1
  `;
  const topEmoji = (topEmojiRow?.emoji as string) ?? null;

  return c.json(okRes({
    responseCount,
    reactionCount,
    topEmoji,
    participantCount,
  }));
});

// Export for testing: clear rate limit map
export function clearResponseRateLimit() {
  responseRateLimit.clear();
}

export { icebreakersRouter };
