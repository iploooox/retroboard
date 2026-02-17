import { useEffect } from 'react';
import { getWSClient } from '@/lib/ws-client';
import { useBoardStore } from '@/stores/board';
import { useAuthStore } from '@/stores/auth';
import { usePresenceStore } from '@/stores/presence';
import type { BoardCard, BoardGroup, BoardPhase } from '@/lib/board-api';

/**
 * Hook that integrates WebSocket real-time events into the board Zustand store.
 * Handles:
 * - card_created/updated/deleted
 * - vote_added/removed
 * - group_created/updated
 * - phase_changed
 * - focus_changed
 * - presence events (user_joined/left, cursor_move)
 * - timer events
 * - board_locked/unlocked
 * - cards_revealed
 */
export function useBoardSync(boardId: string | null, enabled: boolean) {
  const board = useBoardStore((s) => s.board);

  useEffect(() => {
    if (!enabled || !boardId || !board) return;

    const ws = getWSClient();
    const seenEventIds = new Set<string>();

    // Card events
    const handleCardCreated = (msg: { payload: { card: BoardCard }; eventId: string }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      const card = msg.payload.card;
      useBoardStore.setState((state) => ({
        cards: { ...state.cards, [card.id]: card },
      }));
    };

    const handleCardUpdated = (msg: { payload: { card: BoardCard }; eventId: string }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      const card = msg.payload.card;
      useBoardStore.setState((state) => ({
        cards: { ...state.cards, [card.id]: card },
      }));
    };

    const handleCardDeleted = (msg: { payload: { id: string }; eventId: string }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      const cardId = msg.payload.id;
      useBoardStore.setState((state) => {
        const { [cardId]: _removed, ...rest } = state.cards;
        return { cards: rest };
      });
    };

    // Vote events
    const handleVoteAdded = (msg: {
      payload: { cardId: string; userId: string; voteCount: number; userRemainingVotes: number };
      eventId: string;
    }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      const { cardId, userId, voteCount, userRemainingVotes } = msg.payload;
      const currentUserId = useAuthStore.getState().user?.id;

      useBoardStore.setState((state) => {
        const card = state.cards[cardId];
        if (!card) return state;

        const updates: Partial<typeof state> = {
          cards: { ...state.cards, [cardId]: { ...card, vote_count: voteCount } },
        };

        // Only update user-specific vote tracking if the current user is the voter
        if (userId === currentUserId) {
          updates.userVotesRemaining = userRemainingVotes;
          updates.userCardVotes = { ...state.userCardVotes, [cardId]: (state.userCardVotes[cardId] ?? 0) + 1 };
          updates.userVotesCast = state.userVotesCast + 1;
        }

        return updates as typeof state;
      });
    };

    const handleVoteRemoved = (msg: {
      payload: { cardId: string; userId: string; voteCount: number; userRemainingVotes: number };
      eventId: string;
    }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      const { cardId, userId, voteCount, userRemainingVotes } = msg.payload;
      const currentUserId = useAuthStore.getState().user?.id;

      useBoardStore.setState((state) => {
        const card = state.cards[cardId];
        if (!card) return state;

        const updates: Partial<typeof state> = {
          cards: { ...state.cards, [cardId]: { ...card, vote_count: voteCount } },
        };

        // Only update user-specific vote tracking if the current user is the voter
        if (userId === currentUserId) {
          updates.userVotesRemaining = userRemainingVotes;
          updates.userCardVotes = { ...state.userCardVotes, [cardId]: Math.max(0, (state.userCardVotes[cardId] ?? 0) - 1) };
          updates.userVotesCast = Math.max(0, state.userVotesCast - 1);
        }

        return updates as typeof state;
      });
    };

    // Group events
    const handleGroupCreated = (msg: { payload: { group: BoardGroup }; eventId: string }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      const group = msg.payload.group;
      useBoardStore.setState((state) => {
        const updatedCards = { ...state.cards };
        for (const cardId of group.card_ids) {
          const card = updatedCards[cardId];
          if (card) {
            updatedCards[cardId] = { ...card, group_id: group.id };
          }
        }

        return {
          groups: { ...state.groups, [group.id]: group },
          cards: updatedCards,
        };
      });
    };

    const handleGroupUpdated = (msg: { payload: { group: BoardGroup }; eventId: string }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      const group = msg.payload.group;
      useBoardStore.setState((state) => {
        const updatedCards = { ...state.cards };

        // Update all cards in the group
        for (const cardId of group.card_ids) {
          const card = updatedCards[cardId];
          if (card) {
            updatedCards[cardId] = { ...card, group_id: group.id };
          }
        }

        // Remove group_id from cards no longer in group
        const oldGroup = state.groups[group.id];
        if (oldGroup) {
          for (const cardId of oldGroup.card_ids) {
            if (!group.card_ids.includes(cardId)) {
              const card = updatedCards[cardId];
              if (card) {
                updatedCards[cardId] = { ...card, group_id: null };
              }
            }
          }
        }

        return {
          groups: { ...state.groups, [group.id]: group },
          cards: updatedCards,
        };
      });
    };

    // Phase events
    const handlePhaseChanged = (msg: {
      payload: { boardId: string; currentPhase: BoardPhase; previousPhase: BoardPhase };
      eventId: string;
    }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      const { currentPhase } = msg.payload;
      useBoardStore.setState((state) => ({
        board: state.board ? { ...state.board, phase: currentPhase } : null,
      }));
    };

    // Focus events
    const handleFocusChanged = (msg: {
      payload: { focusType: 'card' | 'group' | null; focusId: string | null };
      eventId: string;
    }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      const { focusType, focusId } = msg.payload;
      useBoardStore.setState((state) => ({
        board: state.board
          ? { ...state.board, focus_item_type: focusType, focus_item_id: focusId }
          : null,
      }));
    };

    // Presence events
    const handlePresenceState = (msg: { payload: { users: Array<unknown> } }) => {
      const users = msg.payload.users as Array<{
        userId: string;
        userName: string;
        userAvatar: string;
        connectedAt: string;
        cursorPosition: { x: number; y: number } | null;
      }>;
      usePresenceStore.getState().setUsers(users);
    };

    const handleUserJoined = (msg: {
      payload: { userId: string; userName: string; userAvatar: string; connectedAt: string };
    }) => {
      usePresenceStore.getState().addUser({
        ...msg.payload,
        cursorPosition: null,
      });
    };

    const handleUserLeft = (msg: { payload: { userId: string } }) => {
      usePresenceStore.getState().removeUser(msg.payload.userId);
    };

    const handleCursorMove = (msg: { payload: { userId: string; x: number; y: number } }) => {
      const { userId, x, y } = msg.payload;
      usePresenceStore.getState().updateCursor(userId, { x, y });
    };

    // Board events
    const handleBoardLocked = (isLocked: boolean) => (msg: { payload: { boardId: string }; eventId: string }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      // Store locked state on board (inferred from event type)
      useBoardStore.setState((state) => ({
        board: state.board ? { ...state.board, is_locked: isLocked } : null,
        isLocked,
      }));
    };

    const handleCardsRevealed = (msg: {
      payload: {
        cards: Array<{ cardId: string; authorId: string; authorName: string }>;
      };
      eventId: string;
    }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      const cardAuthors = msg.payload.cards;
      useBoardStore.setState((state) => {
        const updatedCards = { ...state.cards };
        for (const { cardId, authorId, authorName } of cardAuthors) {
          const card = updatedCards[cardId];
          if (card) {
            updatedCards[cardId] = { ...card, author_id: authorId, author_name: authorName };
          }
        }

        return {
          cards: updatedCards,
          board: state.board ? { ...state.board, cards_revealed: true } : null,
        };
      });
    };

    // Icebreaker events
    const handleIcebreakerChanged = (msg: {
      payload: { id: string; question: string; category: string };
      eventId: string;
    }) => {
      if (msg.eventId && seenEventIds.has(msg.eventId)) return;
      if (msg.eventId) seenEventIds.add(msg.eventId);

      const { id, question, category } = msg.payload;
      useBoardStore.setState((state) => ({
        board: state.board
          ? {
              ...state.board,
              icebreaker_id: id,
              icebreaker: { id, question, category },
            }
          : null,
      }));
    };

    // Register all handlers
    ws.on('card_created', handleCardCreated as never);
    ws.on('card_updated', handleCardUpdated as never);
    ws.on('card_deleted', handleCardDeleted as never);
    ws.on('vote_added', handleVoteAdded as never);
    ws.on('vote_removed', handleVoteRemoved as never);
    ws.on('group_created', handleGroupCreated as never);
    ws.on('group_updated', handleGroupUpdated as never);
    ws.on('phase_changed', handlePhaseChanged as never);
    ws.on('focus_changed', handleFocusChanged as never);
    ws.on('presence_state', handlePresenceState as never);
    ws.on('user_joined', handleUserJoined as never);
    ws.on('user_left', handleUserLeft as never);
    ws.on('cursor_move', handleCursorMove as never);
    ws.on('board_locked', handleBoardLocked(true) as never);
    ws.on('board_unlocked', handleBoardLocked(false) as never);
    ws.on('cards_revealed', handleCardsRevealed as never);
    ws.on('icebreaker_question_changed', handleIcebreakerChanged as never);

    // Cleanup
    return () => {
      ws.off('card_created', handleCardCreated as never);
      ws.off('card_updated', handleCardUpdated as never);
      ws.off('card_deleted', handleCardDeleted as never);
      ws.off('vote_added', handleVoteAdded as never);
      ws.off('vote_removed', handleVoteRemoved as never);
      ws.off('group_created', handleGroupCreated as never);
      ws.off('group_updated', handleGroupUpdated as never);
      ws.off('phase_changed', handlePhaseChanged as never);
      ws.off('focus_changed', handleFocusChanged as never);
      ws.off('presence_state', handlePresenceState as never);
      ws.off('user_joined', handleUserJoined as never);
      ws.off('user_left', handleUserLeft as never);
      ws.off('cursor_move', handleCursorMove as never);
      ws.off('board_locked', handleBoardLocked(true) as never);
      ws.off('board_unlocked', handleBoardLocked(false) as never);
      ws.off('cards_revealed', handleCardsRevealed as never);
      ws.off('icebreaker_question_changed', handleIcebreakerChanged as never);
    };
  }, [enabled, boardId, board]);
}
