import { Hono, type Context } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import * as boardRepo from '../repositories/board.repository.js';
import * as cardRepo from '../repositories/card.repository.js';
import * as voteRepo from '../repositories/vote.repository.js';
import * as groupRepo from '../repositories/card-group.repository.js';
import { addCardSchema, updateCardSchema, createGroupSchema, updateGroupSchema } from '../validation/cards.js';
import { uuidParam } from '../validation/boards.js';
import { reactionService } from '../services/reaction-service.js';
import { sql } from '../db/connection.js';

function okRes(data: unknown) {
  return { ok: true, data };
}

function errRes(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

const cardsRouter = new Hono();
cardsRouter.use('*', requireAuth);

// ---------- Cards ----------

// GET /api/v1/cards/:cardId — Get card detail with reactions
cardsRouter.get('/cards/:cardId', async (c) => {
  const cardId = c.req.param('cardId');
  const user = c.get('user');

  if (!uuidParam.safeParse(cardId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid card ID'), 422);
  }

  const card = await cardRepo.findById(cardId);
  if (!card) {
    return c.json(errRes('CARD_NOT_FOUND', 'Card not found'), 404);
  }

  const boardId = card.board_id;
  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);
  }

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) {
    return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);
  }

  // Get author name
  const [author] = await sql`SELECT display_name FROM users WHERE id = ${card.author_id}`;

  // Get reactions
  const reactions = await reactionService.getSummaryByCard(cardId, user.id);

  // Get vote counts
  const voteCount = await voteRepo.getCardVoteCount(cardId);
  const userVotes = await voteRepo.getUserVotesForCard(cardId, user.id);

  return c.json(okRes({
    ...card,
    author_name: author?.display_name || null,
    vote_count: voteCount,
    user_votes: userVotes,
    group_id: card.group_id || null,
    reactions,
  }));
});

// POST /boards/:id/cards — Add card
cardsRouter.post('/boards/:id/cards', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid board ID'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);

  // Check if board is locked (facilitators can still act)
  if (board.is_locked && role !== 'admin' && role !== 'facilitator') {
    return c.json(errRes('FORBIDDEN', 'Board is locked'), 403);
  }

  if (board.phase !== 'write') {
    return c.json(errRes('INVALID_PHASE', 'Cards can only be added during write phase'), 422);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = addCardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(errRes('VALIDATION_ERROR', 'Validation failed'), 422);
  }

  // Validate column belongs to this board
  const columnValid = await boardRepo.columnExistsOnBoard(parsed.data.column_id, boardId);
  if (!columnValid) {
    return c.json(errRes('VALIDATION_ERROR', 'Column does not belong to this board'), 422);
  }

  const card = await cardRepo.create(boardId, parsed.data.column_id, user.id, parsed.data.content);

  return c.json(okRes({
    ...card,
    vote_count: 0,
    user_votes: 0,
    group_id: null,
  }), 201);
});

// PUT/PATCH /boards/:id/cards/:cardId — Edit card
const updateCardHandler = async (c: Context) => {
  const boardId = c.req.param('id');
  const cardId = c.req.param('cardId');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success || !uuidParam.safeParse(cardId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid ID format'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);

  if (board.phase !== 'write' && board.phase !== 'group') {
    return c.json(errRes('INVALID_PHASE', 'Cards can only be edited during write or group phase'), 422);
  }

  const card = await cardRepo.findById(cardId);
  if (!card || card.board_id !== boardId) {
    return c.json(errRes('CARD_NOT_FOUND', 'Card not found'), 404);
  }

  if (card.author_id !== user.id && role !== 'admin' && role !== 'facilitator') {
    return c.json(errRes('FORBIDDEN', 'You can only edit your own cards'), 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateCardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(errRes('VALIDATION_ERROR', 'Validation failed'), 422);
  }

  // Validate column belongs to this board (if changing column)
  if (parsed.data.column_id) {
    const columnValid = await boardRepo.columnExistsOnBoard(parsed.data.column_id, boardId);
    if (!columnValid) {
      return c.json(errRes('VALIDATION_ERROR', 'Column does not belong to this board'), 422);
    }
  }

  const updated = await cardRepo.update(cardId, parsed.data);
  return c.json(okRes(updated));
};
cardsRouter.put('/boards/:id/cards/:cardId', updateCardHandler);
cardsRouter.patch('/boards/:id/cards/:cardId', updateCardHandler);

// DELETE /boards/:id/cards/:cardId — Delete card
cardsRouter.delete('/boards/:id/cards/:cardId', async (c) => {
  const boardId = c.req.param('id');
  const cardId = c.req.param('cardId');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success || !uuidParam.safeParse(cardId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid ID format'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);

  if (board.phase !== 'write' && board.phase !== 'group') {
    return c.json(errRes('INVALID_PHASE', 'Cards can only be deleted during write or group phase'), 422);
  }

  const card = await cardRepo.findById(cardId);
  if (!card || card.board_id !== boardId) {
    return c.json(errRes('CARD_NOT_FOUND', 'Card not found'), 404);
  }

  if (card.author_id !== user.id && role !== 'admin' && role !== 'facilitator') {
    return c.json(errRes('FORBIDDEN', 'You can only delete your own cards'), 403);
  }

  await cardRepo.remove(cardId);
  return c.json(okRes({ id: cardId, deleted: true }));
});

// ---------- Votes ----------

// POST /boards/:id/cards/:cardId/vote(s) — Cast vote
const castVoteHandler = async (c: Context) => {
  const boardId = c.req.param('id');
  const cardId = c.req.param('cardId');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success || !uuidParam.safeParse(cardId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid ID format'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);

  if (board.phase !== 'vote') {
    return c.json(errRes('INVALID_PHASE', 'Votes can only be cast during vote phase'), 422);
  }

  // Verify card exists on this board
  const card = await cardRepo.findById(cardId);
  if (!card || card.board_id !== boardId) {
    return c.json(errRes('CARD_NOT_FOUND', 'Card not found'), 404);
  }

  const result = await voteRepo.castVote(cardId, user.id, boardId);
  if (!result.ok) {
    return c.json(errRes(result.code, result.message), 422);
  }

  return c.json(okRes(result.data), 201);
};
cardsRouter.post('/boards/:id/cards/:cardId/vote', castVoteHandler);
cardsRouter.post('/boards/:id/cards/:cardId/votes', castVoteHandler);

// DELETE /boards/:id/cards/:cardId/vote(s) — Remove vote
const removeVoteHandler = async (c: Context) => {
  const boardId = c.req.param('id');
  const cardId = c.req.param('cardId');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success || !uuidParam.safeParse(cardId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid ID format'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);

  if (board.phase !== 'vote') {
    return c.json(errRes('INVALID_PHASE', 'Votes can only be removed during vote phase'), 422);
  }

  const result = await voteRepo.removeVote(cardId, user.id, boardId);
  if (!result.ok) {
    return c.json(errRes(result.code, result.message), 422);
  }

  return c.json(okRes(result.data));
};
cardsRouter.delete('/boards/:id/cards/:cardId/vote', removeVoteHandler);
cardsRouter.delete('/boards/:id/cards/:cardId/votes', removeVoteHandler);

// ---------- Groups ----------

// POST /boards/:id/groups — Create group
cardsRouter.post('/boards/:id/groups', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid board ID'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);

  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(errRes('FORBIDDEN', 'Only admins and facilitators can create groups'), 403);
  }

  if (board.phase !== 'group') {
    return c.json(errRes('INVALID_PHASE', 'Groups can only be created during group phase'), 422);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(errRes('VALIDATION_ERROR', 'Validation failed'), 422);
  }

  // Validate card_ids belong to this board
  for (const cardId of parsed.data.card_ids) {
    const exists = await boardRepo.cardExistsOnBoard(cardId, boardId);
    if (!exists) {
      return c.json(errRes('VALIDATION_ERROR', 'Card does not belong to this board'), 422);
    }
  }

  const group = await groupRepo.create(boardId, parsed.data.title, parsed.data.card_ids);
  return c.json(okRes(group), 201);
});

// PUT /boards/:id/groups/:groupId — Update group
cardsRouter.put('/boards/:id/groups/:groupId', async (c) => {
  const boardId = c.req.param('id');
  const groupId = c.req.param('groupId');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success || !uuidParam.safeParse(groupId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid ID format'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);

  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(errRes('FORBIDDEN', 'Only admins and facilitators can update groups'), 403);
  }

  if (board.phase !== 'group') {
    return c.json(errRes('INVALID_PHASE', 'Groups can only be updated during group phase'), 422);
  }

  const group = await groupRepo.findById(groupId);
  if (!group || group.board_id !== boardId) {
    return c.json(errRes('GROUP_NOT_FOUND', 'Group not found'), 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(errRes('VALIDATION_ERROR', 'Validation failed'), 422);
  }

  const updated = await groupRepo.update(groupId, parsed.data);
  if (!updated) {
    return c.json(errRes('GROUP_NOT_FOUND', 'Group not found'), 404);
  }

  return c.json(okRes(updated));
});

// DELETE /boards/:id/groups/:groupId — Delete group
cardsRouter.delete('/boards/:id/groups/:groupId', async (c) => {
  const boardId = c.req.param('id');
  const groupId = c.req.param('groupId');
  const user = c.get('user');

  if (!uuidParam.safeParse(boardId).success || !uuidParam.safeParse(groupId).success) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid ID format'), 422);
  }

  const board = await boardRepo.findById(boardId);
  if (!board) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const teamId = await boardRepo.getTeamIdForBoard(boardId);
  if (!teamId) return c.json(errRes('BOARD_NOT_FOUND', 'Board not found'), 404);

  const role = await boardRepo.getUserTeamRole(teamId, user.id);
  if (!role) return c.json(errRes('FORBIDDEN', 'Not a team member'), 403);

  if (role !== 'admin' && role !== 'facilitator') {
    return c.json(errRes('FORBIDDEN', 'Only admins and facilitators can delete groups'), 403);
  }

  if (board.phase !== 'group') {
    return c.json(errRes('INVALID_PHASE', 'Groups can only be deleted during group phase'), 422);
  }

  const group = await groupRepo.findById(groupId);
  if (!group || group.board_id !== boardId) {
    return c.json(errRes('GROUP_NOT_FOUND', 'Group not found'), 404);
  }

  const result = await groupRepo.remove(groupId);
  if (!result) {
    return c.json(errRes('GROUP_NOT_FOUND', 'Group not found'), 404);
  }

  return c.json(okRes({ id: groupId, deleted: true, ungrouped_card_ids: result.ungrouped_card_ids }));
});

export { cardsRouter };
