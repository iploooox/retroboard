import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBoardStore } from '@/stores/board';
import { boardApi, type BoardData, type BoardCard, type VoteResult } from '@/lib/board-api';

vi.mock('@/lib/board-api', () => ({
  boardApi: {
    getBoard: vi.fn(),
    addCard: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
    vote: vi.fn(),
    removeVote: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    setPhase: vi.fn(),
    setFocus: vi.fn(),
    updateBoard: vi.fn(),
    getActionItems: vi.fn(),
    createActionItem: vi.fn(),
    updateActionItem: vi.fn(),
    deleteActionItem: vi.fn(),
    carryOverActionItems: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockBoardData: BoardData = {
  id: 'board-1',
  sprint_id: 'sprint-1',
  template_id: 'tpl-1',
  phase: 'write',
  anonymous_mode: false,
  max_votes_per_user: 5,
  max_votes_per_card: 3,
  focus_item_id: null,
  focus_item_type: null,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  columns: [
    {
      id: 'col-1',
      board_id: 'board-1',
      name: 'What Went Well',
      color: '#22c55e',
      position: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      cards: [
        {
          id: 'card-1',
          column_id: 'col-1',
          board_id: 'board-1',
          content: 'Good teamwork',
          author_id: 'user-1',
          author_name: 'Alice',
          position: 0,
          vote_count: 2,
          user_votes: 1,
          group_id: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'col-2',
      board_id: 'board-1',
      name: 'Improvements',
      color: '#ef4444',
      position: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      cards: [],
    },
  ],
  groups: [],
  user_votes_remaining: 4,
  user_total_votes_cast: 1,
};

describe('useBoardStore', () => {
  beforeEach(() => {
    useBoardStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('fetchBoard', () => {
    it('loads board data into store', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);

      await useBoardStore.getState().fetchBoard('sprint-1');

      const state = useBoardStore.getState();
      expect(state.board).toBeTruthy();
      expect(state.board?.id).toBe('board-1');
      expect(state.columns).toHaveLength(2);
      expect(state.cards['card-1']).toBeTruthy();
      expect(state.cards['card-1']?.content).toBe('Good teamwork');
      expect(state.userVotesCast).toBe(1);
      expect(state.userVotesRemaining).toBe(4);
      expect(state.userCardVotes['card-1']).toBe(1);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      vi.mocked(boardApi.getBoard).mockRejectedValue(new Error('Network error'));

      await expect(useBoardStore.getState().fetchBoard('sprint-1')).rejects.toThrow('Network error');

      const state = useBoardStore.getState();
      expect(state.error).toBe('Failed to load board');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('addCard', () => {
    it('adds a card to the store', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      const newCard: BoardCard = {
        id: 'card-2',
        column_id: 'col-1',
        board_id: 'board-1',
        content: 'New card',
        author_id: 'user-1',
        author_name: 'Alice',
        position: 1,
        vote_count: 0,
        user_votes: 0,
        group_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      vi.mocked(boardApi.addCard).mockResolvedValue(newCard);

      await useBoardStore.getState().addCard('col-1', 'New card');

      expect(useBoardStore.getState().cards['card-2']).toBeTruthy();
      expect(useBoardStore.getState().cards['card-2']?.content).toBe('New card');
    });
  });

  describe('updateCard', () => {
    it('optimistically updates card content', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      const updatedCard: BoardCard = {
        ...mockBoardData.columns[0]!.cards[0]!,
        content: 'Updated content',
      };
      vi.mocked(boardApi.updateCard).mockResolvedValue(updatedCard);

      await useBoardStore.getState().updateCard('card-1', 'Updated content');

      expect(useBoardStore.getState().cards['card-1']?.content).toBe('Updated content');
    });

    it('rolls back on failure', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      vi.mocked(boardApi.updateCard).mockRejectedValue(new Error('fail'));

      await expect(useBoardStore.getState().updateCard('card-1', 'Updated content')).rejects.toThrow('fail');

      // Content should be rolled back
      expect(useBoardStore.getState().cards['card-1']?.content).toBe('Good teamwork');
    });
  });

  describe('deleteCard', () => {
    it('optimistically removes the card', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      vi.mocked(boardApi.deleteCard).mockResolvedValue({ id: 'card-1', deleted: true });

      await useBoardStore.getState().deleteCard('card-1');

      expect(useBoardStore.getState().cards['card-1']).toBeUndefined();
    });

    it('rolls back on failure', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      vi.mocked(boardApi.deleteCard).mockRejectedValue(new Error('fail'));

      await expect(useBoardStore.getState().deleteCard('card-1')).rejects.toThrow('fail');

      expect(useBoardStore.getState().cards['card-1']).toBeTruthy();
    });
  });

  describe('voteOnCard', () => {
    it('optimistically increments votes then confirms with server', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      const voteResult: VoteResult = {
        card_id: 'card-1',
        vote_count: 3,
        user_votes: 2,
        user_votes_remaining: 3,
        user_total_votes_cast: 2,
      };
      vi.mocked(boardApi.vote).mockResolvedValue(voteResult);

      await useBoardStore.getState().voteOnCard('card-1');

      const state = useBoardStore.getState();
      expect(state.cards['card-1']?.vote_count).toBe(3);
      expect(state.cards['card-1']?.user_votes).toBe(2);
      expect(state.userVotesCast).toBe(2);
      expect(state.userVotesRemaining).toBe(3);
    });

    it('rolls back on failure', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      vi.mocked(boardApi.vote).mockRejectedValue(new Error('Vote limit reached'));

      await expect(useBoardStore.getState().voteOnCard('card-1')).rejects.toThrow('Vote limit reached');

      const state = useBoardStore.getState();
      expect(state.cards['card-1']?.vote_count).toBe(2); // Original value
      expect(state.userVotesCast).toBe(1); // Original value
      expect(state.userVotesRemaining).toBe(4); // Original value
    });
  });

  describe('removeVoteFromCard', () => {
    it('optimistically decrements votes', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      const voteResult: VoteResult = {
        card_id: 'card-1',
        vote_count: 1,
        user_votes: 0,
        user_votes_remaining: 5,
        user_total_votes_cast: 0,
      };
      vi.mocked(boardApi.removeVote).mockResolvedValue(voteResult);

      await useBoardStore.getState().removeVoteFromCard('card-1');

      const state = useBoardStore.getState();
      expect(state.cards['card-1']?.vote_count).toBe(1);
      expect(state.userVotesRemaining).toBe(5);
    });
  });

  describe('setPhase', () => {
    it('updates board phase', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      vi.mocked(boardApi.setPhase).mockResolvedValue({
        id: 'board-1',
        phase: 'group',
        previous_phase: 'write',
        updated_at: '2026-01-01T01:00:00.000Z',
      });

      await useBoardStore.getState().setPhase('group');

      expect(useBoardStore.getState().board?.phase).toBe('group');
    });
  });

  describe('setFocus', () => {
    it('updates focus item', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      vi.mocked(boardApi.setFocus).mockResolvedValue({
        id: 'board-1',
        focus_item_id: 'card-1',
        focus_item_type: 'card',
        updated_at: '2026-01-01T01:00:00.000Z',
      });

      await useBoardStore.getState().setFocus('card-1', 'card');

      expect(useBoardStore.getState().board?.focus_item_id).toBe('card-1');
      expect(useBoardStore.getState().board?.focus_item_type).toBe('card');
    });
  });

  describe('groups', () => {
    it('creates a group and updates card group_ids', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      vi.mocked(boardApi.createGroup).mockResolvedValue({
        id: 'group-1',
        board_id: 'board-1',
        title: 'Test Group',
        position: 0,
        card_ids: ['card-1'],
        total_votes: 2,
        created_at: '2026-01-01T00:00:00.000Z',
      });

      await useBoardStore.getState().createGroup('Test Group', ['card-1']);

      const state = useBoardStore.getState();
      expect(state.groups['group-1']).toBeTruthy();
      expect(state.groups['group-1']?.title).toBe('Test Group');
      expect(state.cards['card-1']?.group_id).toBe('group-1');
    });

    it('deletes a group and ungroups cards', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      // First create a group
      vi.mocked(boardApi.createGroup).mockResolvedValue({
        id: 'group-1',
        board_id: 'board-1',
        title: 'Test',
        position: 0,
        card_ids: ['card-1'],
        total_votes: 2,
        created_at: '2026-01-01T00:00:00.000Z',
      });
      await useBoardStore.getState().createGroup('Test', ['card-1']);

      // Now delete it
      vi.mocked(boardApi.deleteGroup).mockResolvedValue({
        id: 'group-1',
        deleted: true,
        ungrouped_card_ids: ['card-1'],
      });

      await useBoardStore.getState().deleteGroup('group-1');

      const state = useBoardStore.getState();
      expect(state.groups['group-1']).toBeUndefined();
      expect(state.cards['card-1']?.group_id).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets to initial state', async () => {
      vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);
      await useBoardStore.getState().fetchBoard('sprint-1');

      expect(useBoardStore.getState().board).toBeTruthy();

      useBoardStore.getState().reset();

      const state = useBoardStore.getState();
      expect(state.board).toBeNull();
      expect(state.columns).toHaveLength(0);
      expect(Object.keys(state.cards)).toHaveLength(0);
      expect(state.isLoading).toBe(true);
    });
  });
});
