import { describe, it, expect, vi, beforeEach } from 'vitest';
import { boardApi } from '@/lib/board-api';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockOkResponse<T>(data: T, status = 200) {
  return Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve({ ok: true, data }),
  });
}

function mockDirectResponse<T>(data: T, status = 200) {
  return Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve(data),
  });
}

function mock204Response() {
  return Promise.resolve({
    ok: true,
    status: 204,
    json: () => Promise.reject(new Error('No content')),
  });
}

describe('boardApi', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('getBoard', () => {
    it('fetches board data and unwraps the response', async () => {
      const boardData = {
        id: 'board-1',
        sprint_id: 'sprint-1',
        phase: 'write',
        columns: [],
        groups: [],
        user_votes_remaining: 5,
        user_total_votes_cast: 0,
      };

      mockFetch.mockReturnValueOnce(mockOkResponse(boardData));

      const result = await boardApi.getBoard('sprint-1');
      expect(result).toEqual(boardData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/sprints/sprint-1/board',
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('createBoard', () => {
    it('creates a board with template', async () => {
      const boardData = { id: 'board-1', phase: 'write', columns: [] };
      mockFetch.mockReturnValueOnce(mockOkResponse(boardData, 201));

      const result = await boardApi.createBoard('sprint-1', { template_id: 'tpl-1' });
      expect(result).toEqual(boardData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/sprints/sprint-1/board',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ template_id: 'tpl-1' }),
        }),
      );
    });
  });

  describe('addCard', () => {
    it('adds a card and unwraps the response', async () => {
      const card = { id: 'card-1', column_id: 'col-1', content: 'Test card' };
      mockFetch.mockReturnValueOnce(mockOkResponse(card, 201));

      const result = await boardApi.addCard('board-1', { column_id: 'col-1', content: 'Test card' });
      expect(result).toEqual(card);
    });
  });

  describe('vote', () => {
    it('casts a vote and returns vote result', async () => {
      const voteResult = {
        card_id: 'card-1',
        vote_count: 3,
        user_votes: 1,
        user_votes_remaining: 4,
        user_total_votes_cast: 1,
      };
      mockFetch.mockReturnValueOnce(mockOkResponse(voteResult, 201));

      const result = await boardApi.vote('board-1', 'card-1');
      expect(result).toEqual(voteResult);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/boards/board-1/cards/card-1/vote',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('removeVote', () => {
    it('removes a vote', async () => {
      const voteResult = {
        card_id: 'card-1',
        vote_count: 2,
        user_votes: 0,
        user_votes_remaining: 5,
        user_total_votes_cast: 0,
      };
      mockFetch.mockReturnValueOnce(mockOkResponse(voteResult));

      const result = await boardApi.removeVote('board-1', 'card-1');
      expect(result).toEqual(voteResult);
    });
  });

  describe('setPhase', () => {
    it('sets the board phase', async () => {
      const result = { id: 'board-1', phase: 'group', previous_phase: 'write', updated_at: '2026-01-01' };
      mockFetch.mockReturnValueOnce(mockOkResponse(result));

      const response = await boardApi.setPhase('board-1', 'group');
      expect(response).toEqual(result);
    });
  });

  describe('groups', () => {
    it('creates a group', async () => {
      const group = { id: 'group-1', title: 'Test Group', card_ids: ['card-1'], total_votes: 2 };
      mockFetch.mockReturnValueOnce(mockOkResponse(group, 201));

      const result = await boardApi.createGroup('board-1', { title: 'Test Group', card_ids: ['card-1'] });
      expect(result).toEqual(group);
    });

    it('deletes a group', async () => {
      const result = { id: 'group-1', deleted: true, ungrouped_card_ids: ['card-1', 'card-2'] };
      mockFetch.mockReturnValueOnce(mockOkResponse(result));

      const response = await boardApi.deleteGroup('board-1', 'group-1');
      expect(response).toEqual(result);
    });
  });

  describe('action items', () => {
    it('lists action items', async () => {
      const listData = { items: [{ id: 'ai-1', title: 'Fix bug' }], total: 1, limit: 50, offset: 0 };
      mockFetch.mockReturnValueOnce(mockDirectResponse(listData));

      const result = await boardApi.getActionItems('board-1');
      expect(result.items).toHaveLength(1);
    });

    it('creates an action item', async () => {
      const item = { id: 'ai-1', title: 'Fix bug', status: 'open' };
      mockFetch.mockReturnValueOnce(mockDirectResponse(item, 201));

      const result = await boardApi.createActionItem('board-1', { title: 'Fix bug' });
      expect(result.title).toBe('Fix bug');
    });

    it('deletes an action item', async () => {
      mockFetch.mockReturnValueOnce(mock204Response());

      await boardApi.deleteActionItem('ai-1');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/action-items/ai-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
