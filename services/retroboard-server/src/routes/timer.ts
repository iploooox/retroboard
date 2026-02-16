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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const timerService = new TimerService(repo as any, broadcast);

const timerRouter = new Hono();
timerRouter.use('*', requireAuth);

// POST /boards/:id/timer/start — Start timer (facilitator/admin only)
timerRouter.post('/boards/:id/timer/start', async (c) => {
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

// POST /boards/:id/timer/pause — Pause timer (facilitator/admin only)
timerRouter.post('/boards/:id/timer/pause', async (c) => {
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

  const state = await timerService.pause(boardId, user.id);
  return c.json(state);
});

// POST /boards/:id/timer/resume — Resume timer (facilitator/admin only)
timerRouter.post('/boards/:id/timer/resume', async (c) => {
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

  const state = await timerService.resume(boardId, user.id);
  return c.json(state);
});

// POST /boards/:id/timer/reset — Reset/stop timer (facilitator/admin only)
timerRouter.post('/boards/:id/timer/reset', async (c) => {
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
