import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import * as actionItemRepo from '../repositories/action-item.repository.js';
import {
  createActionItemSchema,
  updateActionItemSchema,
  listActionItemsSchema,
  teamActionItemsSchema,
} from '../validation/action-items.js';

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const actionItemsRouter = new Hono();
actionItemsRouter.use('*', requireAuth);

// ─── Board-scoped: carry-over (must be before generic /boards/:id/action-items) ───

actionItemsRouter.post('/boards/:id/action-items/carry-over', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  const teamId = await actionItemRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  const isMember = await actionItemRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  const result = await actionItemRepo.carryOver(boardId, user.id);
  if (!result) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  if ('noPreviousSprint' in result) {
    return c.json({ error: 'NO_PREVIOUS_SPRINT' }, 404);
  }

  return c.json(result);
});

// ─── Board-scoped: create action item ───────────────

actionItemsRouter.post('/boards/:id/action-items', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  const teamId = await actionItemRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  const isMember = await actionItemRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = createActionItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'VALIDATION_ERROR' }, 400);
  }

  const { title, description, cardId, assigneeId, dueDate } = parsed.data;

  // Validate date format separately (returns INVALID_DATE, not VALIDATION_ERROR)
  if (dueDate) {
    if (!isValidDate(dueDate)) {
      return c.json({ error: 'INVALID_DATE' }, 400);
    }
  }

  // Validate card belongs to this board
  if (cardId) {
    const cardOk = await actionItemRepo.cardBelongsToBoard(cardId, boardId);
    if (!cardOk) {
      return c.json({ error: 'INVALID_CARD' }, 400);
    }
  }

  // Validate assignee is a team member
  if (assigneeId) {
    const assigneeOk = await actionItemRepo.isTeamMember(teamId, assigneeId);
    if (!assigneeOk) {
      return c.json({ error: 'INVALID_ASSIGNEE' }, 400);
    }
  }

  const result = await actionItemRepo.create({
    boardId,
    cardId: cardId ?? null,
    title,
    description: description ?? null,
    assigneeId: assigneeId ?? null,
    dueDate: dueDate ?? null,
    createdBy: user.id,
  });

  return c.json(result, 201);
});

// ─── Board-scoped: list action items ────────────────

actionItemsRouter.get('/boards/:id/action-items', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  const teamId = await actionItemRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  const isMember = await actionItemRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  const query: Record<string, string> = {};
  for (const key of ['status', 'assigneeId', 'sort', 'order', 'limit', 'offset']) {
    const val = c.req.query(key);
    if (val !== undefined) query[key] = val;
  }

  const parsed = listActionItemsSchema.safeParse(query);
  if (!parsed.success) {
    return c.json({ error: 'VALIDATION_ERROR' }, 400);
  }

  const result = await actionItemRepo.findByBoardId(boardId, parsed.data);

  return c.json({
    items: result.items,
    total: result.total,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });
});

// ─── Action item-scoped: update ─────────────────────

actionItemsRouter.put('/action-items/:id', async (c) => {
  const actionItemId = c.req.param('id');
  const user = c.get('user');

  const itemInfo = await actionItemRepo.getTeamIdForActionItem(actionItemId);
  if (!itemInfo) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  const isMember = await actionItemRepo.isTeamMember(itemInfo.teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));

  // Validate status value separately (returns INVALID_STATUS, not VALIDATION_ERROR)
  if ('status' in body && body.status !== undefined) {
    const validStatuses = ['open', 'in_progress', 'done'];
    if (!validStatuses.includes(body.status)) {
      return c.json({ error: 'INVALID_STATUS' }, 400);
    }
  }

  const parsed = updateActionItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'VALIDATION_ERROR' }, 400);
  }

  // Validate assignee is team member (if setting to non-null)
  if ('assigneeId' in body && body.assigneeId !== null && body.assigneeId !== undefined) {
    const assigneeOk = await actionItemRepo.isTeamMember(itemInfo.teamId, body.assigneeId);
    if (!assigneeOk) {
      return c.json({ error: 'INVALID_ASSIGNEE' }, 400);
    }
  }

  const result = await actionItemRepo.update(
    actionItemId,
    parsed.data,
    {
      hasDescription: 'description' in body,
      hasAssigneeId: 'assigneeId' in body,
      hasDueDate: 'dueDate' in body,
    },
  );

  if (!result) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  return c.json(result);
});

// ─── Action item-scoped: delete ─────────────────────

actionItemsRouter.delete('/action-items/:id', async (c) => {
  const actionItemId = c.req.param('id');
  const user = c.get('user');

  const itemInfo = await actionItemRepo.getTeamIdForActionItem(actionItemId);
  if (!itemInfo) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  const isMember = await actionItemRepo.isTeamMember(itemInfo.teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  await actionItemRepo.remove(actionItemId);
  return c.body(null, 204);
});

// ─── Team-scoped: list action items ─────────────────

actionItemsRouter.get('/teams/:teamId/action-items', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');

  const exists = await actionItemRepo.teamExists(teamId);
  if (!exists) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  const isMember = await actionItemRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  const query: Record<string, string> = {};
  for (const key of ['status', 'sprintId', 'assigneeId', 'sort', 'order', 'limit', 'offset']) {
    const val = c.req.query(key);
    if (val !== undefined) query[key] = val;
  }

  const parsed = teamActionItemsSchema.safeParse(query);
  if (!parsed.success) {
    return c.json({ error: 'VALIDATION_ERROR' }, 400);
  }

  const result = await actionItemRepo.findByTeam(teamId, parsed.data);

  return c.json({
    items: result.items,
    total: result.total,
    summary: result.summary,
  });
});

export { actionItemsRouter };
