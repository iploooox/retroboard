import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { formatErrorResponse } from '../utils/errors.js';
import * as boardRepo from '../repositories/board.repository.js';
import {
  createBoardSchema,
  updateBoardSchema,
  setPhaseSchema,
  setFocusSchema,
  uuidParam,
  ALLOWED_TRANSITIONS,
} from '../validation/boards.js';
import type { BoardPhase } from '../validation/boards.js';

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

  // Apply anonymous mode filtering
  if (result.board.anonymous_mode && role !== 'admin' && role !== 'facilitator') {
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

  const updated = await boardRepo.updateSettings(boardId, parsed.data);
  if (!updated) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  return c.json({ ok: true, data: updated });
});

// PUT /api/v1/boards/:id/phase — Set phase
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
  const parsed = setPhaseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(formatValidationError(parsed.error), 422);
  }

  const targetPhase = parsed.data.phase;
  const currentPhase = board.phase as BoardPhase;

  // Check transition is allowed
  const allowed = ALLOWED_TRANSITIONS[currentPhase];
  if (!allowed.includes(targetPhase)) {
    return c.json(
      formatErrorResponse(
        'INVALID_PHASE',
        `Cannot transition from ${currentPhase} to ${targetPhase}`,
      ),
      422,
    );
  }

  const updated = await boardRepo.setPhase(boardId, targetPhase);
  if (!updated) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  return c.json({
    ok: true,
    data: {
      id: updated.id,
      phase: updated.phase,
      previous_phase: currentPhase,
      updated_at: updated.updated_at,
    },
  });
});

// PUT /api/v1/boards/:id/focus — Set focus
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
          formatErrorResponse('VALIDATION_ERROR', 'Card not found on this board'),
          422,
        );
      }
    } else if (focus_item_type === 'group') {
      const exists = await boardRepo.groupExistsOnBoard(focus_item_id, boardId);
      if (!exists) {
        return c.json(
          formatErrorResponse('VALIDATION_ERROR', 'Group not found on this board'),
          422,
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

export { boardsRouter };
