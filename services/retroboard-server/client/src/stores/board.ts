import { create } from 'zustand';
import { boardApi, type BoardData, type BoardCard, type BoardGroup, type BoardPhase, type ActionItem, type IcebreakerResponse } from '@/lib/board-api';
import { ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';

interface BoardState {
  // Board data
  board: BoardData | null;
  columns: Array<{ id: string; name: string; color: string; position: number }>;
  cards: Record<string, BoardCard>;
  groups: Record<string, BoardGroup>;
  actionItems: ActionItem[];

  // User vote tracking
  userVotesCast: number;
  userVotesRemaining: number;
  userCardVotes: Record<string, number>;

  // Phase 3 state
  isLocked: boolean;
  cardsRevealed: boolean;

  // Icebreaker responses (S-003)
  icebreakerResponses: IcebreakerResponse[];

  // UI state
  isLoading: boolean;
  error: string | null;
  actionItemsLoading: boolean;

  // Actions
  fetchBoard: (sprintId: string) => Promise<void>;
  addCard: (columnId: string, content: string) => Promise<void>;
  updateCard: (cardId: string, content: string) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  voteOnCard: (cardId: string) => Promise<void>;
  removeVoteFromCard: (cardId: string) => Promise<void>;
  createGroup: (title: string, cardIds: string[]) => Promise<void>;
  updateGroup: (groupId: string, updates: { title?: string; add_card_ids?: string[]; remove_card_ids?: string[] }) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  setPhase: (phase: BoardPhase) => Promise<void>;
  setFocus: (itemId: string | null, itemType: 'card' | 'group' | null) => Promise<void>;
  updateSettings: (settings: { anonymous_mode?: boolean; max_votes_per_user?: number; max_votes_per_card?: number }) => Promise<void>;
  fetchActionItems: () => Promise<void>;
  createActionItem: (body: { title: string; description?: string; cardId?: string; assigneeId?: string; dueDate?: string }) => Promise<void>;
  updateActionItem: (id: string, body: { title?: string; status?: 'open' | 'in_progress' | 'done'; assigneeId?: string | null; dueDate?: string | null }) => Promise<void>;
  deleteActionItem: (id: string) => Promise<void>;
  carryOverActionItems: () => Promise<{ totalResolved: number; totalSkipped: number; totalAlreadyCarried: number }>;
  // Icebreaker response actions (S-003)
  fetchIcebreakerResponses: () => Promise<void>;
  submitIcebreakerResponse: (content: string) => Promise<void>;
  deleteIcebreakerResponse: (responseId: string) => Promise<void>;
  addIcebreakerResponse: (response: IcebreakerResponse) => void;
  removeIcebreakerResponse: (responseId: string) => void;
  setIcebreakerResponses: (responses: IcebreakerResponse[]) => void;
  reset: () => void;
}

function loadBoardData(data: BoardData) {
  const cards: Record<string, BoardCard> = {};
  for (const col of data.columns) {
    for (const card of col.cards) {
      cards[card.id] = card;
    }
  }

  const groups: Record<string, BoardGroup> = {};
  for (const group of data.groups) {
    groups[group.id] = group;
  }

  const userCardVotes: Record<string, number> = {};
  for (const card of Object.values(cards)) {
    if (card.user_votes > 0) {
      userCardVotes[card.id] = card.user_votes;
    }
  }

  return {
    board: data,
    columns: data.columns.map(({ cards: _cards, ...col }) => col),
    cards,
    groups,
    userVotesCast: data.user_total_votes_cast,
    userVotesRemaining: data.user_votes_remaining,
    userCardVotes,
    isLocked: (data as BoardData & { is_locked?: boolean }).is_locked || false,
    cardsRevealed: (data as BoardData & { cards_revealed?: boolean }).cards_revealed || false,
    isLoading: false,
    error: null,
  };
}

const initialState = {
  board: null,
  columns: [],
  cards: {},
  groups: {},
  actionItems: [],
  userVotesCast: 0,
  userVotesRemaining: 0,
  userCardVotes: {},
  isLocked: false,
  cardsRevealed: false,
  icebreakerResponses: [],
  isLoading: true,
  error: null,
  actionItemsLoading: false,
};

export const useBoardStore = create<BoardState>((set, get) => ({
  ...initialState,

  fetchBoard: async (sprintId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await boardApi.getBoard(sprintId);
      set(loadBoardData(data));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load board';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  addCard: async (columnId: string, content: string) => {
    const { board } = get();
    if (!board) return;

    try {
      const card = await boardApi.addCard(board.id, { column_id: columnId, content });
      set((state) => ({
        cards: { ...state.cards, [card.id]: card },
      }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add card');
      throw err;
    }
  },

  updateCard: async (cardId: string, content: string) => {
    const { board, cards } = get();
    if (!board) return;
    const card = cards[cardId];
    if (!card) return;

    // Optimistic update
    const prev = card;
    set((state) => ({
      cards: { ...state.cards, [cardId]: { ...card, content } },
    }));

    try {
      const updated = await boardApi.updateCard(board.id, cardId, { content });
      set((state) => ({
        cards: { ...state.cards, [cardId]: updated },
      }));
    } catch (err) {
      // Rollback
      set((state) => ({
        cards: { ...state.cards, [cardId]: prev },
      }));
      toast.error(err instanceof ApiError ? err.message : 'Failed to update card');
      throw err;
    }
  },

  deleteCard: async (cardId: string) => {
    const { board, cards } = get();
    if (!board) return;
    const card = cards[cardId];
    if (!card) return;

    // Optimistic delete
    set((state) => {
      const { [cardId]: _removed, ...rest } = state.cards;
      return { cards: rest };
    });

    try {
      await boardApi.deleteCard(board.id, cardId);
    } catch (err) {
      // Rollback
      set((state) => ({
        cards: { ...state.cards, [cardId]: card },
      }));
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete card');
      throw err;
    }
  },

  voteOnCard: async (cardId: string) => {
    const { board, cards } = get();
    if (!board) return;
    const card = cards[cardId];
    if (!card) return;

    // Optimistic update
    const prevVotesCast = get().userVotesCast;
    const prevVotesRemaining = get().userVotesRemaining;
    const prevCardVotes = get().userCardVotes[cardId] ?? 0;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: { ...card, vote_count: card.vote_count + 1, user_votes: card.user_votes + 1 },
      },
      userVotesCast: state.userVotesCast + 1,
      userVotesRemaining: state.userVotesRemaining - 1,
      userCardVotes: { ...state.userCardVotes, [cardId]: prevCardVotes + 1 },
    }));

    try {
      const result = await boardApi.vote(board.id, cardId);
      set((state) => ({
        cards: {
          ...state.cards,
          [cardId]: {
            ...state.cards[cardId]!,
            vote_count: result.vote_count,
            user_votes: result.user_votes,
          },
        },
        userVotesCast: result.user_total_votes_cast,
        userVotesRemaining: result.user_votes_remaining,
        userCardVotes: { ...state.userCardVotes, [cardId]: result.user_votes },
      }));
    } catch (err) {
      // Rollback
      set((state) => ({
        cards: {
          ...state.cards,
          [cardId]: { ...card, vote_count: card.vote_count, user_votes: card.user_votes },
        },
        userVotesCast: prevVotesCast,
        userVotesRemaining: prevVotesRemaining,
        userCardVotes: { ...state.userCardVotes, [cardId]: prevCardVotes },
      }));
      toast.error(err instanceof ApiError ? err.message : 'Failed to vote');
      throw err;
    }
  },

  removeVoteFromCard: async (cardId: string) => {
    const { board, cards } = get();
    if (!board) return;
    const card = cards[cardId];
    if (!card) return;

    const prevVotesCast = get().userVotesCast;
    const prevVotesRemaining = get().userVotesRemaining;
    const prevCardVotes = get().userCardVotes[cardId] ?? 0;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: { ...card, vote_count: card.vote_count - 1, user_votes: card.user_votes - 1 },
      },
      userVotesCast: state.userVotesCast - 1,
      userVotesRemaining: state.userVotesRemaining + 1,
      userCardVotes: { ...state.userCardVotes, [cardId]: Math.max(0, prevCardVotes - 1) },
    }));

    try {
      const result = await boardApi.removeVote(board.id, cardId);
      set((state) => ({
        cards: {
          ...state.cards,
          [cardId]: {
            ...state.cards[cardId]!,
            vote_count: result.vote_count,
            user_votes: result.user_votes,
          },
        },
        userVotesCast: result.user_total_votes_cast,
        userVotesRemaining: result.user_votes_remaining,
        userCardVotes: { ...state.userCardVotes, [cardId]: result.user_votes },
      }));
    } catch (err) {
      set((state) => ({
        cards: {
          ...state.cards,
          [cardId]: { ...card, vote_count: card.vote_count, user_votes: card.user_votes },
        },
        userVotesCast: prevVotesCast,
        userVotesRemaining: prevVotesRemaining,
        userCardVotes: { ...state.userCardVotes, [cardId]: prevCardVotes },
      }));
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove vote');
      throw err;
    }
  },

  createGroup: async (title: string, cardIds: string[]) => {
    const { board } = get();
    if (!board) return;

    try {
      const group = await boardApi.createGroup(board.id, { title, card_ids: cardIds });
      set((state) => {
        const updatedCards = { ...state.cards };
        for (const cid of group.card_ids) {
          const c = updatedCards[cid];
          if (c) {
            updatedCards[cid] = { ...c, group_id: group.id };
          }
        }
        return {
          groups: { ...state.groups, [group.id]: group },
          cards: updatedCards,
        };
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create group');
      throw err;
    }
  },

  updateGroup: async (groupId: string, updates) => {
    const { board } = get();
    if (!board) return;

    try {
      const group = await boardApi.updateGroup(board.id, groupId, updates);
      set((state) => {
        const updatedCards = { ...state.cards };
        // Update cards that were added to this group
        for (const cid of group.card_ids) {
          const c = updatedCards[cid];
          if (c) {
            updatedCards[cid] = { ...c, group_id: group.id };
          }
        }
        // Update cards that were removed from this group
        if (updates.remove_card_ids) {
          for (const cid of updates.remove_card_ids) {
            const c = updatedCards[cid];
            if (c) {
              updatedCards[cid] = { ...c, group_id: null };
            }
          }
        }
        return {
          groups: { ...state.groups, [groupId]: group },
          cards: updatedCards,
        };
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update group');
      throw err;
    }
  },

  deleteGroup: async (groupId: string) => {
    const { board } = get();
    if (!board) return;

    try {
      const result = await boardApi.deleteGroup(board.id, groupId);
      set((state) => {
        const { [groupId]: _removed, ...restGroups } = state.groups;
        const updatedCards = { ...state.cards };
        for (const cid of result.ungrouped_card_ids) {
          const c = updatedCards[cid];
          if (c) {
            updatedCards[cid] = { ...c, group_id: null };
          }
        }
        return { groups: restGroups, cards: updatedCards };
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete group');
      throw err;
    }
  },

  setPhase: async (phase: BoardPhase) => {
    const { board } = get();
    if (!board) return;

    try {
      const result = await boardApi.setPhase(board.id, phase);
      set((state) => ({
        board: state.board ? { ...state.board, phase: result.phase } : null,
      }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to change phase');
      throw err;
    }
  },

  setFocus: async (itemId, itemType) => {
    const { board } = get();
    if (!board) return;

    try {
      const result = await boardApi.setFocus(board.id, itemId, itemType);
      set((state) => ({
        board: state.board ? {
          ...state.board,
          focus_item_id: result.focus_item_id,
          focus_item_type: result.focus_item_type,
          updated_at: result.updated_at,
        } : null,
      }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to set focus');
      throw err;
    }
  },

  updateSettings: async (settings) => {
    const { board } = get();
    if (!board) return;

    try {
      const updated = await boardApi.updateBoard(board.id, settings);
      set((state) => ({
        board: state.board ? {
          ...state.board,
          anonymous_mode: updated.anonymous_mode,
          max_votes_per_user: updated.max_votes_per_user,
          max_votes_per_card: updated.max_votes_per_card,
          updated_at: updated.updated_at,
        } : null,
      }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update settings');
      throw err;
    }
  },

  fetchActionItems: async () => {
    const { board } = get();
    if (!board) return;

    set({ actionItemsLoading: true });
    try {
      const result = await boardApi.getActionItems(board.id);
      set({ actionItems: result.items, actionItemsLoading: false });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load action items');
      set({ actionItemsLoading: false });
    }
  },

  createActionItem: async (body) => {
    const { board } = get();
    if (!board) return;

    try {
      const item = await boardApi.createActionItem(board.id, body);
      set((state) => ({ actionItems: [...state.actionItems, item] }));
      toast.success('Action item created');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create action item');
      throw err;
    }
  },

  updateActionItem: async (id, body) => {
    try {
      const updated = await boardApi.updateActionItem(id, body);
      set((state) => ({
        actionItems: state.actionItems.map((item) => item.id === id ? updated : item),
      }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update action item');
      throw err;
    }
  },

  deleteActionItem: async (id) => {
    try {
      await boardApi.deleteActionItem(id);
      set((state) => ({
        actionItems: state.actionItems.filter((item) => item.id !== id),
      }));
      toast.success('Action item deleted');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete action item');
      throw err;
    }
  },

  carryOverActionItems: async () => {
    const { board } = get();
    if (!board) return { totalResolved: 0, totalSkipped: 0, totalAlreadyCarried: 0 };

    try {
      const result = await boardApi.carryOverActionItems(board.id);
      // Refresh action items after carry-over
      await get().fetchActionItems();
      return {
        totalResolved: result.totalResolved,
        totalSkipped: result.totalSkipped,
        totalAlreadyCarried: result.totalAlreadyCarried,
      };
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to carry over action items');
      throw err;
    }
  },

  // Icebreaker response actions (S-003)
  fetchIcebreakerResponses: async () => {
    const { board } = get();
    if (!board) return;

    try {
      const result = await boardApi.getIcebreakerResponses(board.id);
      set({ icebreakerResponses: result.responses });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load responses');
    }
  },

  submitIcebreakerResponse: async (content: string) => {
    const { board } = get();
    if (!board) return;

    try {
      await boardApi.submitIcebreakerResponse(board.id, content);
      // Response will be added via WebSocket broadcast
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to submit response');
      throw err;
    }
  },

  deleteIcebreakerResponse: async (responseId: string) => {
    const { board } = get();
    if (!board) return;

    try {
      await boardApi.deleteIcebreakerResponse(board.id, responseId);
      // Removal will happen via WebSocket broadcast
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete response');
      throw err;
    }
  },

  addIcebreakerResponse: (response: IcebreakerResponse) => {
    set((state) => {
      // Deduplicate by id
      if (state.icebreakerResponses.some((r) => r.id === response.id)) {
        return state;
      }
      return { icebreakerResponses: [...state.icebreakerResponses, response] };
    });
  },

  removeIcebreakerResponse: (responseId: string) => {
    set((state) => ({
      icebreakerResponses: state.icebreakerResponses.filter((r) => r.id !== responseId),
    }));
  },

  setIcebreakerResponses: (responses: IcebreakerResponse[]) => {
    set({ icebreakerResponses: responses });
  },

  reset: () => set(initialState),
}));
