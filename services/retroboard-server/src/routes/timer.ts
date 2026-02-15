import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { formatErrorResponse } from '../utils/errors.js';
import * as boardRepo from '../repositories/board.repository.js';
import * as timerRepo from '../repositories/timer.repository.js';
import { TimerService } from '../services/timer-service.js';
import { broadcastToBoard } from '../ws/index.js';

const repo = {
  create: timerRepo.create,
  findByBoardId: timerRepo.findByBoardId,
  update: timerRepo.update,
  delete: timerRepo.remove,
};

const broadcast = (boardId: string, event: Record<string, unknown>) => {
  broadcastToBoard(boardId, event as { type: string; payload: Record<string, unknown> });
};

export const timerService = new TimerService(repo, broadcast);

const timerRouter = new Hono();
timerRouter.use('*', requireAuth);

// POST /boards/:id/timer — Start timer (facilitator/admin only)
timerRouter.post('/boards/:id/timer', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  const board = await boardRepo.findById(boardId);
  if (!board) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'Not a team member'), 403);
  }
  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(formatErrorResponse('FORBIDDEN', 'Only facilitators can manage timers'), 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const { durationSeconds } = body;

  const state = await timerService.start(boardId, board.phase, durationSeconds, user.id);
  return c.json(state, 201);
});

// PUT /boards/:id/timer — Pause/Resume (facilitator/admin only)
timerRouter.put('/boards/:id/timer', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'Not a team member'), 403);
  }
  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(formatErrorResponse('FORBIDDEN', 'Only facilitators can manage timers'), 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'pause') {
    const state = await timerService.pause(boardId, user.id);
    return c.json(state);
  } else if (action === 'resume') {
    const state = await timerService.resume(boardId, user.id);
    return c.json(state);
  }

  return c.json(formatErrorResponse('VALIDATION_ERROR', 'Action must be "pause" or "resume"'), 400);
});

// DELETE /boards/:id/timer — Stop timer (facilitator/admin only)
timerRouter.delete('/boards/:id/timer', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'Not a team member'), 403);
  }
  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(formatErrorResponse('FORBIDDEN', 'Only facilitators can manage timers'), 403);
  }

  await timerService.stop(boardId, 'manual');
  return c.json({ reason: 'manual' });
});

// GET /boards/:id/timer — Get timer state (any team member)
timerRouter.get('/boards/:id/timer', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(formatErrorResponse('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(formatErrorResponse('FORBIDDEN', 'Not a team member'), 403);
  }

  const state = timerService.getState(boardId);
  if (!state) {
    return c.json({ data: null });
  }
  return c.json(state);
});

export { timerRouter };
