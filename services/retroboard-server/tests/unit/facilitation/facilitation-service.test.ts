import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FacilitationService } from '../../../src/services/facilitation-service.js';

// Mock the database connection module
vi.mock('../../../src/db/connection.js', () => {
  const mockSql = vi.fn();
  return {
    sql: mockSql,
    closeDatabase: vi.fn()
  };
});

import { sql } from '../../../src/db/connection.js';

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

describe('FacilitationService', () => {
  let service: InstanceType<typeof FacilitationService>;

  const boardId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = '660e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FacilitationService();
  });

  // ─── Phase Management ──────────────────────────────────────────────

  describe('Phase Management', () => {
    it('3.1.1: Set valid phase', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, phase: 'write' }]); // find board
      mockSql.mockResolvedValueOnce([{ id: boardId, phase: 'group' }]); // update

      const result = await service.setPhase(boardId, 'group', userId);
      expect(result.phase).toBe('group');
    });

    it('3.1.2: Set same phase (idempotent)', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, phase: 'write' }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, phase: 'write' }]);

      const result = await service.setPhase(boardId, 'write', userId);
      expect(result.phase).toBe('write');
    });

    it('3.1.3: Set invalid phase value', async () => {
      await expect(
        service.setPhase(boardId, 'invalid' as never, userId),
      ).rejects.toThrow(/INVALID_PHASE/);
    });

    it('3.1.4: Set phase stops running timer', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, phase: 'write' }]); // find board
      mockSql.mockResolvedValueOnce([{ board_id: boardId, remaining_seconds: 120 }]); // find timer
      mockSql.mockResolvedValueOnce([]); // stop timer
      mockSql.mockResolvedValueOnce([{ id: boardId, phase: 'group' }]); // update phase

      const result = await service.setPhase(boardId, 'group', userId);
      expect(result.phase).toBe('group');
      expect(result.timerStopped).toBe(true);
    });

    it('3.1.5: Set phase when no timer running', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, phase: 'write' }]); // find board
      mockSql.mockResolvedValueOnce([]); // no timer

      const result = await service.setPhase(boardId, 'vote', userId);
      expect(result.timerStopped).toBe(false);
    });

    it('3.1.6: Board not found', async () => {
      mockSql.mockResolvedValueOnce([]); // no board

      await expect(
        service.setPhase('nonexistent-id', 'group', userId),
      ).rejects.toThrow(/NOT_FOUND/);
    });

    it('3.1.7: Skip phases forward allowed', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, phase: 'write' }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, phase: 'vote' }]);

      const result = await service.setPhase(boardId, 'vote', userId);
      expect(result.phase).toBe('vote');
    });

    it('3.1.8: Go backward allowed', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, phase: 'discuss' }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, phase: 'write' }]);

      const result = await service.setPhase(boardId, 'write', userId);
      expect(result.phase).toBe('write');
    });
  });

  // ─── Lock Management ───────────────────────────────────────────────

  describe('Lock Management', () => {
    it('3.1.9: Lock board', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, is_locked: false }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, is_locked: true }]);

      const result = await service.setLock(boardId, true, userId);
      expect(result.isLocked).toBe(true);
    });

    it('3.1.10: Unlock board', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, is_locked: true }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, is_locked: false }]);

      const result = await service.setLock(boardId, false, userId);
      expect(result.isLocked).toBe(false);
    });

    it('3.1.11: Lock already locked board (idempotent)', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, is_locked: true }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, is_locked: true }]);

      const result = await service.setLock(boardId, true, userId);
      expect(result.isLocked).toBe(true);
    });

    it('3.1.12: Unlock already unlocked board (idempotent)', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, is_locked: false }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, is_locked: false }]);

      const result = await service.setLock(boardId, false, userId);
      expect(result.isLocked).toBe(false);
    });
  });

  // ─── Card Reveal ───────────────────────────────────────────────────

  describe('Card Reveal', () => {
    it('3.1.13: Reveal cards on anonymous board', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, anonymous_mode: true, cards_revealed: false }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, cards_revealed: true }]);
      mockSql.mockResolvedValueOnce([
        { id: 'card-1', author_id: 'user-2', display_name: 'Bob' },
      ]);

      const result = await service.revealCards(boardId, userId);
      expect(result.cardsRevealed).toBe(true);
    });

    it('3.1.14: Reveal on non-anonymous board', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, anonymous_mode: false, cards_revealed: false }]);

      await expect(
        service.revealCards(boardId, userId),
      ).rejects.toThrow(/NOT_ANONYMOUS/);
    });

    it('3.1.15: Reveal already revealed', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, anonymous_mode: true, cards_revealed: true }]);

      await expect(
        service.revealCards(boardId, userId),
      ).rejects.toThrow(/ALREADY_REVEALED/);
    });

    it('3.1.16: Reveal returns card-author mapping', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, anonymous_mode: true, cards_revealed: false }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, cards_revealed: true }]);
      mockSql.mockResolvedValueOnce([
        { id: 'card-1', author_id: 'user-2', display_name: 'Bob Martinez' },
        { id: 'card-2', author_id: 'user-3', display_name: 'Charlie Kim' },
      ]);

      const result = await service.revealCards(boardId, userId);
      expect(result.revealedCards).toHaveLength(2);
      expect(result.revealedCards[0]).toEqual({
        cardId: 'card-1',
        authorId: 'user-2',
        authorName: 'Bob Martinez',
      });
    });
  });

  // ─── Discussion Focus ──────────────────────────────────────────────

  describe('Discussion Focus', () => {
    it('3.1.17: Set focus on card', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId }]); // find board
      mockSql.mockResolvedValueOnce([{ id: 'card-1', board_id: boardId }]); // find card
      mockSql.mockResolvedValueOnce([{ id: boardId, focus_item_type: 'card', focus_item_id: 'card-1' }]);

      const result = await service.setFocus(boardId, 'card', 'card-1', userId);
      expect(result.focusType).toBe('card');
      expect(result.focusId).toBe('card-1');
    });

    it('3.1.18: Set focus on group', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId }]);
      mockSql.mockResolvedValueOnce([{ id: 'group-1', board_id: boardId }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, focus_item_type: 'group', focus_item_id: 'group-1' }]);

      const result = await service.setFocus(boardId, 'group', 'group-1', userId);
      expect(result.focusType).toBe('group');
      expect(result.focusId).toBe('group-1');
    });

    it('3.1.19: Clear focus', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, focus_item_type: null, focus_item_id: null }]);

      const result = await service.setFocus(boardId, null, null, userId);
      expect(result.focusType).toBeNull();
      expect(result.focusId).toBeNull();
    });

    it('3.1.20: Focus on non-existent card', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId }]); // find board
      mockSql.mockResolvedValueOnce([]); // card not found

      await expect(
        service.setFocus(boardId, 'card', 'nonexistent', userId),
      ).rejects.toThrow(/FOCUS_TARGET_NOT_FOUND/);
    });

    it('3.1.21: Focus on card from different board', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId }]); // find board
      mockSql.mockResolvedValueOnce([{ id: 'card-1', board_id: 'other-board-id' }]); // card on different board

      await expect(
        service.setFocus(boardId, 'card', 'card-1', userId),
      ).rejects.toThrow(/FOCUS_TARGET_NOT_FOUND/);
    });

    it('3.1.22: Change focus from one card to another', async () => {
      mockSql.mockResolvedValueOnce([{ id: boardId, focus_item_id: 'card-1', focus_item_type: 'card' }]);
      mockSql.mockResolvedValueOnce([{ id: 'card-2', board_id: boardId }]);
      mockSql.mockResolvedValueOnce([{ id: boardId, focus_item_type: 'card', focus_item_id: 'card-2' }]);

      const result = await service.setFocus(boardId, 'card', 'card-2', userId);
      expect(result.focusId).toBe('card-2');
    });
  });
});
