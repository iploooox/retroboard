import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { formatErrorResponse } from '../utils/errors.js';
import * as boardRepo from '../repositories/board.repository.js';
import {
  createBoardSchema,
  updateBoardSchema,
  setFocusSchema,
  uuidParam,
  BOARD_PHASES,
} from '../validation/boards.js';
import { FacilitationService } from '../services/facilitation-service.js';
import { timerService } from './timer.js';
import { sql } from '../db/connection.js';
import { icebreakerService } from '../services/icebreaker-service.js';

const facilitationService = new FacilitationService(timerService);

function formatValidationError(error: { issues: Array<{ path: (string | number)[]; message: string }> }) {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    },
  };
}

// Board routes mounted at /api/v1
const boardsRouter = new Hono();
boardsRouter.use('*', requireAuth);

// ----- Sprint-scoped routes -----

// POST /api/v1/sprints/:sprintId/board — Create board
boardsRouter.post('/sprints/:sprintId/board', async (c) => {
  const sprintId = c.req.param('sprintId');
  const user = c.get('user');

  // Validate UUID
  if (!uuidParam.safeParse(sprintId).success) {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'Invalid sprint ID format'), 422);
  }

  // Check sprint exists
  const sprint = await boardRepo.sprintExists(sprintId);
  if (!sprint.exists || !sprint.team_id) {
    return c.json(formatErrorResponse('SPRINT_NOT_FOUND', 'Sprint not found'), 404);
  }

  // Check user is team member with admin/facilitator role
  const role = await boardRepo.getUserTeamRole(sprint.team_id, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'You are not a member of this team'), 403);
  }
  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(formatErrorResponse('FORBIDDEN', 'Only admins and facilitators can create boards'), 403);
  }

  // Parse body
  const body = await c.req.json().catch(() => ({}));
  const parsed = createBoardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(formatValidationError(parsed.error), 422);
  }

  // Check template exists
  const templateOk = await boardRepo.templateExists(parsed.data.template_id);
  if (!templateOk) {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'Template not found'), 422);
  }

  // Check if board already exists for this sprint
  const existing = await boardRepo.findBySprintId(sprintId);
  if (existing) {
    return c.json(formatErrorResponse('BOARD_ALREADY_EXISTS', 'Sprint already has a board'), 409);
  }

  const { board, columns } = await boardRepo.createBoard({
    sprint_id: sprintId,
    template_id: parsed.data.template_id,
    anonymous_mode: parsed.data.anonymous_mode,
    max_votes_per_user: parsed.data.max_votes_per_user,
    max_votes_per_card: parsed.data.max_votes_per_card,
    created_by: user.id,
  });

  return c.json({ ok: true, data: { ...board, columns } }, 201);
});

// GET /api/v1/sprints/:sprintId/board — Get board
boardsRouter.get('/sprints/:sprintId/board', async (c) => {
  const sprintId = c.req.param('sprintId');
  const user = c.get('user');

  if (!uuidParam.safeParse(sprintId).success) {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'Invalid sprint ID format'), 422);
  }

  // Check sprint exists
  const sprint = await boardRepo.sprintExists(sprintId);
  if (!sprint.exists || !sprint.team_id) {
    return c.json(formatErrorResponse('SPRINT_NOT_FOUND', 'Sprint not found'), 404);
  }

  // Check user is team member
  const role = await boardRepo.getUserTeamRole(sprint.team_id, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'You are not a member of this team'), 403);
  }

  const result = await boardRepo.getFullBoard(sprintId, user.id);
  if (!result) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found for this sprint'), 404);
  }

  // Apply anonymous mode filtering (skip if cards have been revealed)
  if (result.board.anonymous_mode && !result.board.cards_revealed && role !== 'admin' && role !== 'facilitator') {
    for (const col of result.columns) {
      for (const card of col.cards as Array<Record<string, unknown>>) {
        // Card creators can see their own author_id
        if (card.author_id !== user.id) {
          card.author_id = null;
          card.author_name = null;
        }
      }
    }
  }

  return c.json({
    ok: true,
    data: {
      ...result.board,
      columns: result.columns,
      groups: result.groups,
      user_votes_remaining: result.user_votes_remaining,
      user_total_votes_cast: result.user_total_votes_cast,
    },
  });
});

// ----- Board-scoped routes -----

// PUT /api/v1/boards/:id — Update board settings
boardsRouter.put('/boards/:id', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success) {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'Invalid board ID format'), 422);
  }

  // Get board
  const board = await boardRepo.findById(boardId);
  if (!board) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  // Auth check
  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'You are not a member of this team'), 403);
  }
  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(formatErrorResponse('FORBIDDEN', 'Only admins and facilitators can update board settings'), 403);
  }

  // Parse body
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateBoardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(formatValidationError(parsed.error), 422);
  }

  // Phase restrictions
  if (parsed.data.anonymous_mode !== undefined && board.phase !== 'write') {
    return c.json(
      formatErrorResponse('INVALID_PHASE', 'Anonymous mode can only be changed during write phase'),
      422,
    );
  }

  if (
    (parsed.data.max_votes_per_user !== undefined || parsed.data.max_votes_per_card !== undefined) &&
    board.phase !== 'write' &&
    board.phase !== 'group'
  ) {
    return c.json(
      formatErrorResponse('INVALID_PHASE', 'Vote limits can only be changed during write or group phase'),
      422,
    );
  }

  // Prevent lowering vote limits below current usage
  if (parsed.data.max_votes_per_user !== undefined || parsed.data.max_votes_per_card !== undefined) {
    const usage = await boardRepo.getVoteUsage(boardId);
    if (parsed.data.max_votes_per_user !== undefined && usage.maxPerUser > parsed.data.max_votes_per_user) {
      return c.json(
        formatErrorResponse(
          'VALIDATION_ERROR',
          `Cannot lower max_votes_per_user to ${parsed.data.max_votes_per_user} — a user has already cast ${usage.maxPerUser} votes`,
        ),
        422,
      );
    }
    if (parsed.data.max_votes_per_card !== undefined && usage.maxPerCard > parsed.data.max_votes_per_card) {
      return c.json(
        formatErrorResponse(
          'VALIDATION_ERROR',
          `Cannot lower max_votes_per_card to ${parsed.data.max_votes_per_card} — a card already has ${usage.maxPerCard} votes`,
        ),
        422,
      );
    }
  }

  const updated = await boardRepo.updateSettings(boardId, parsed.data);
  if (!updated) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  return c.json({ ok: true, data: updated });
});

// PATCH /api/v1/boards/:id — Update board settings (alias for PUT)
boardsRouter.patch('/boards/:id', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success) {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'Invalid board ID format'), 422);
  }

  // Get board
  const board = await boardRepo.findById(boardId);
  if (!board) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  // Auth check
  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'You are not a member of this team'), 403);
  }
  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(formatErrorResponse('FORBIDDEN', 'Only admins and facilitators can update board settings'), 403);
  }

  // Parse body
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateBoardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(formatValidationError(parsed.error), 422);
  }

  // Phase restrictions
  if (parsed.data.anonymous_mode !== undefined && board.phase !== 'write') {
    return c.json(
      formatErrorResponse('INVALID_PHASE', 'Anonymous mode can only be changed during write phase'),
      422,
    );
  }

  if (
    (parsed.data.max_votes_per_user !== undefined || parsed.data.max_votes_per_card !== undefined) &&
    board.phase !== 'write' &&
    board.phase !== 'group'
  ) {
    return c.json(
      formatErrorResponse('INVALID_PHASE', 'Vote limits can only be changed during write or group phase'),
      422,
    );
  }

  // Prevent lowering vote limits below current usage
  if (parsed.data.max_votes_per_user !== undefined || parsed.data.max_votes_per_card !== undefined) {
    const usage = await boardRepo.getVoteUsage(boardId);
    if (parsed.data.max_votes_per_user !== undefined && usage.maxPerUser > parsed.data.max_votes_per_user) {
      return c.json(
        formatErrorResponse(
          'VALIDATION_ERROR',
          `Cannot lower max_votes_per_user to ${parsed.data.max_votes_per_user} — a user has already cast ${usage.maxPerUser} votes`,
        ),
        422,
      );
    }
    if (parsed.data.max_votes_per_card !== undefined && usage.maxPerCard > parsed.data.max_votes_per_card) {
      return c.json(
        formatErrorResponse(
          'VALIDATION_ERROR',
          `Cannot lower max_votes_per_card to ${parsed.data.max_votes_per_card} — a card already has ${usage.maxPerCard} votes`,
        ),
        422,
      );
    }
  }

  const updated = await boardRepo.updateSettings(boardId, parsed.data);
  if (!updated) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  return c.json({ ok: true, data: updated });
});

// PUT /api/v1/boards/:id/phase — Set phase (facilitation-enhanced: free set, auto-stop timer)
boardsRouter.put('/boards/:id/phase', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success) {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'Invalid board ID format'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  // Auth check
  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'You are not a member of this team'), 403);
  }
  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(formatErrorResponse('FORBIDDEN', 'Only admins and facilitators can change the phase'), 403);
  }

  // Parse body
  const body = await c.req.json().catch(() => ({}));
  const phase = body?.phase;

  // Validate phase value
  if (!phase || !BOARD_PHASES.includes(phase)) {
    return c.json(
      formatErrorResponse('INVALID_PHASE', `Invalid phase. Must be one of: ${BOARD_PHASES.join(', ')}`),
      400,
    );
  }

  // Use facilitation service for phase change (handles timer auto-stop)
  try {
    const result = await facilitationService.setPhase(boardId, phase, user.id);
    return c.json({
      ok: true,
      data: {
        phase: result.phase,
        previous_phase: result.previous_phase,
        timerStopped: result.timerStopped,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'NOT_FOUND') {
      return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
    }
    if (message === 'INVALID_PHASE') {
      return c.json(formatErrorResponse('INVALID_PHASE', 'Invalid phase'), 400);
    }
    if (message === 'INVALID_TRANSITION') {
      return c.json(formatErrorResponse('INVALID_TRANSITION', 'Phase transition not allowed'), 422);
    }
    throw err;
  }
});

// PUT /api/v1/boards/:id/focus — Set focus (facilitation-enhanced)
boardsRouter.put('/boards/:id/focus', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success) {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'Invalid board ID format'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  // Phase check
  if (board.phase !== 'discuss') {
    return c.json(
      formatErrorResponse('INVALID_PHASE', 'Focus can only be set during discuss phase'),
      422,
    );
  }

  // Auth check
  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'You are not a member of this team'), 403);
  }
  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(formatErrorResponse('FORBIDDEN', 'Only admins and facilitators can set focus'), 403);
  }

  // Parse body
  const body = await c.req.json().catch(() => ({}));
  const parsed = setFocusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(formatValidationError(parsed.error), 422);
  }

  const { focus_item_id, focus_item_type } = parsed.data;

  // Validate focus item exists on this board
  if (focus_item_id !== null && focus_item_type !== null) {
    if (focus_item_type === 'card') {
      const exists = await boardRepo.cardExistsOnBoard(focus_item_id, boardId);
      if (!exists) {
        return c.json(
          formatErrorResponse('FOCUS_TARGET_NOT_FOUND', 'Card not found on this board'),
          404,
        );
      }
    } else if (focus_item_type === 'group') {
      const exists = await boardRepo.groupExistsOnBoard(focus_item_id, boardId);
      if (!exists) {
        return c.json(
          formatErrorResponse('FOCUS_TARGET_NOT_FOUND', 'Group not found on this board'),
          404,
        );
      }
    }
  }

  const updated = await boardRepo.setFocus(boardId, focus_item_id, focus_item_type);
  if (!updated) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  return c.json({
    ok: true,
    data: {
      id: updated.id,
      focus_item_id: updated.focus_item_id,
      focus_item_type: updated.focus_item_type,
      updated_at: updated.updated_at,
    },
  });
});

// PUT /api/v1/boards/:id/lock — Lock/unlock board (facilitator only)
boardsRouter.put('/boards/:id/lock', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success) {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'Invalid board ID format'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  // Auth check
  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'You are not a member of this team'), 403);
  }
  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(formatErrorResponse('FORBIDDEN', 'Only admins and facilitators can lock/unlock boards'), 403);
  }

  // Parse body
  const body = await c.req.json().catch(() => ({}));
  const isLocked = body?.isLocked;
  if (typeof isLocked !== 'boolean') {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'isLocked must be a boolean'), 422);
  }

  // Update lock state
  const [updated] = await sql`
    UPDATE boards SET is_locked = ${isLocked} WHERE id = ${boardId} RETURNING *
  `;

  return c.json({
    ok: true,
    data: {
      id: updated.id as string,
      is_locked: updated.is_locked as boolean,
    },
  });
});

// PUT /api/v1/boards/:id/reveal — Reveal anonymous cards (facilitator only, one-way)
boardsRouter.put('/boards/:id/reveal', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success) {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'Invalid board ID format'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  // Auth check
  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'You are not a member of this team'), 403);
  }
  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(formatErrorResponse('FORBIDDEN', 'Only admins and facilitators can reveal cards'), 403);
  }

  // Check board is anonymous
  if (!board.anonymous_mode) {
    return c.json(formatErrorResponse('NOT_ANONYMOUS', 'Board is not in anonymous mode'), 400);
  }

  // Check not already revealed
  if (board.cards_revealed) {
    return c.json(formatErrorResponse('ALREADY_REVEALED', 'Cards have already been revealed'), 400);
  }

  // Reveal cards
  await sql`UPDATE boards SET cards_revealed = true WHERE id = ${boardId}`;

  // Get card-author mapping
  const cards = await sql`
    SELECT c.id, c.author_id, u.display_name
    FROM cards c
    JOIN users u ON u.id = c.author_id
    WHERE c.board_id = ${boardId}
  `;

  const revealedCards = cards.map((c: Record<string, unknown>) => ({
    cardId: c.id as string,
    authorId: c.author_id as string,
    authorName: c.display_name as string,
  }));

  return c.json({
    ok: true,
    data: {
      cards_revealed: true,
      revealedCards,
    },
  });
});

// GET /api/v1/boards/:id — Get board by ID
boardsRouter.get('/boards/:id', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success) {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'Invalid board ID format'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  // Auth check
  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'You are not a member of this team'), 403);
  }

  // Get columns
  const columns = await boardRepo.getColumns(boardId);

  // Get cards with author info
  const cardsRows = await sql`
    SELECT c.*, u.display_name AS author_name
    FROM cards c
    JOIN users u ON u.id = c.author_id
    WHERE c.board_id = ${boardId}
    ORDER BY c.column_id, c.position
  `;

  const cards = cardsRows.map((c: Record<string, unknown>) => ({
    id: c.id as string,
    column_id: c.column_id as string,
    board_id: c.board_id as string,
    content: c.content as string,
    author_id: c.author_id as string,
    author_name: c.author_name as string,
    position: Number(c.position),
    created_at: (c.created_at as Date).toISOString(),
    updated_at: (c.updated_at as Date).toISOString(),
  }));

  // Apply anonymous mode filtering (skip if cards have been revealed)
  if (board.anonymous_mode && !board.cards_revealed && role !== 'admin' && role !== 'facilitator') {
    for (const card of cards) {
      if (card.author_id !== user.id) {
        (card as Record<string, unknown>).author_id = null;
        (card as Record<string, unknown>).author_name = null;
      }
    }
  }

  // Get team data with theme
  const [teamData] = await sql`
    SELECT t.id, t.name, t.theme
    FROM teams t
    WHERE t.id = ${teamId}
  `;

  // Fetch full icebreaker object if board has one
  let icebreaker: { id: string; question: string; category: string } | null = null;
  if (board.icebreaker_id) {
    icebreaker = await icebreakerService.getById(board.icebreaker_id);
  }

  return c.json({
    ok: true,
    data: {
      ...board,
      icebreaker,
      columns,
      cards,
      team: teamData ? {
        id: teamData.id as string,
        name: teamData.name as string,
        theme: (teamData.theme as string) || 'default',
      } : undefined,
    },
  });
});

export { boardsRouter };
