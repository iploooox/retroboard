# Retro Board — UI State Specification

## State Management: Zustand

The board UI uses Zustand for global state. Each board session creates a single store instance that manages all board data, WebSocket sync, and optimistic updates.

---

## Store Shape

```typescript
// stores/boardStore.ts

interface BoardState {
  // --- Board Data ---
  board: Board | null;
  columns: Column[];
  cards: Record<string, Card>;        // keyed by card.id for O(1) lookups
  groups: Record<string, CardGroup>;   // keyed by group.id

  // --- User Context ---
  userVotesCast: number;               // total votes by current user on this board
  userVotesRemaining: number;          // max_votes_per_user - userVotesCast
  userCardVotes: Record<string, number>; // card_id -> number of votes by current user

  // --- UI State ---
  phase: BoardPhase;
  focusItemId: string | null;
  focusItemType: 'card' | 'group' | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;                // WebSocket connection status
  isReconnecting: boolean;

  // --- Optimistic Update Tracking ---
  pendingOperations: Map<string, PendingOperation>;

  // --- Actions ---

  // Data fetching
  fetchBoard: (sprintId: string) => Promise<void>;

  // Card actions
  addCard: (columnId: string, content: string) => Promise<void>;
  updateCard: (cardId: string, updates: Partial<Card>) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;

  // Vote actions
  voteOnCard: (cardId: string) => Promise<void>;
  removeVoteFromCard: (cardId: string) => Promise<void>;

  // Group actions
  createGroup: (title: string, cardIds: string[]) => Promise<void>;
  updateGroup: (groupId: string, updates: GroupUpdate) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;

  // Board actions
  setPhase: (phase: BoardPhase) => Promise<void>;
  setFocus: (itemId: string | null, itemType: 'card' | 'group' | null) => Promise<void>;
  updateSettings: (settings: BoardSettingsUpdate) => Promise<void>;

  // WebSocket sync
  handleWsEvent: (event: BoardWsEvent) => void;

  // Connection management
  connect: (boardId: string) => void;
  disconnect: () => void;

  // Internal
  _applyOptimistic: (opId: string, apply: () => void, rollback: () => void) => void;
  _confirmOptimistic: (opId: string) => void;
  _rollbackOptimistic: (opId: string) => void;
}
```

### Supporting Types

```typescript
type BoardPhase = 'write' | 'group' | 'vote' | 'discuss' | 'action';

interface Board {
  id: string;
  sprintId: string;
  templateId: string;
  phase: BoardPhase;
  anonymousMode: boolean;
  maxVotesPerUser: number;
  maxVotesPerCard: number;
  focusItemId: string | null;
  focusItemType: 'card' | 'group' | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Column {
  id: string;
  boardId: string;
  name: string;
  color: string;
  position: number;
}

interface Card {
  id: string;
  columnId: string;
  boardId: string;
  content: string;
  authorId: string | null;
  authorName: string | null;
  position: number;
  voteCount: number;
  userVotes: number;
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CardGroup {
  id: string;
  boardId: string;
  title: string;
  position: number;
  cardIds: string[];
  totalVotes: number;
  createdAt: string;
}

interface BoardSettingsUpdate {
  anonymousMode?: boolean;
  maxVotesPerUser?: number;
  maxVotesPerCard?: number;
}

interface GroupUpdate {
  title?: string;
  addCardIds?: string[];
  removeCardIds?: string[];
  position?: number;
}

interface PendingOperation {
  id: string;
  type: string;
  rollback: () => void;
  timestamp: number;
}

type BoardWsEvent =
  | { type: 'card:created'; cardId: string; columnId: string; position: number }
  | { type: 'card:updated'; cardId: string; columnId: string }
  | { type: 'card:deleted'; cardId: string; columnId: string }
  | { type: 'vote:added'; cardId: string; voteCount: number }
  | { type: 'vote:removed'; cardId: string; voteCount: number }
  | { type: 'group:created'; groupId: string; cardIds: string[] }
  | { type: 'group:updated'; groupId: string }
  | { type: 'group:deleted'; groupId: string; ungroupedCardIds: string[] }
  | { type: 'phase:changed'; phase: BoardPhase; previousPhase: BoardPhase }
  | { type: 'focus:changed'; focusItemId: string | null; focusItemType: 'card' | 'group' | null }
  | { type: 'board:updated'; anonymousMode: boolean; maxVotesPerUser: number; maxVotesPerCard: number };
```

---

## Derived State (Selectors)

Zustand selectors compute derived data without storing it redundantly.

```typescript
// Selectors
const useCardsByColumn = (columnId: string) =>
  useBoardStore((state) =>
    Object.values(state.cards)
      .filter((c) => c.columnId === columnId)
      .sort((a, b) => a.position - b.position)
  );

const useGroupCards = (groupId: string) =>
  useBoardStore((state) => {
    const group = state.groups[groupId];
    if (!group) return [];
    return group.cardIds
      .map((id) => state.cards[id])
      .filter(Boolean);
  });

const useCanVote = () =>
  useBoardStore((state) =>
    state.phase === 'vote' && state.userVotesRemaining > 0
  );

const useCanVoteOnCard = (cardId: string) =>
  useBoardStore((state) => {
    if (state.phase !== 'vote') return false;
    if (state.userVotesRemaining <= 0) return false;
    const cardVotes = state.userCardVotes[cardId] ?? 0;
    return cardVotes < (state.board?.maxVotesPerCard ?? 0);
  });

const useIsFocused = (itemId: string) =>
  useBoardStore((state) => state.focusItemId === itemId);

const useIsOwnCard = (cardId: string, userId: string) =>
  useBoardStore((state) => state.cards[cardId]?.authorId === userId);

const useSortedGroups = () =>
  useBoardStore((state) =>
    Object.values(state.groups).sort((a, b) => a.position - b.position)
  );

const useSortedColumns = () =>
  useBoardStore((state) =>
    [...state.columns].sort((a, b) => a.position - b.position)
  );
```

---

## WebSocket Sync Strategy

### Connection Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                     Page Mount                           │
│                         │                                │
│                         ▼                                │
│               fetchBoard(sprintId)                       │
│                    │         │                            │
│                    ▼         ▼                            │
│             Load board    Connect WS                     │
│             from API      to board:{boardId}             │
│                    │         │                            │
│                    ▼         ▼                            │
│             Store data    Listen for events               │
│             in Zustand    on WS channel                  │
│                    │         │                            │
│                    ▼         ▼                            │
│              ┌── READY ──────────────┐                   │
│              │  Board rendered       │                   │
│              │  WS events update     │                   │
│              │  store in real-time   │                   │
│              └───────────────────────┘                   │
│                         │                                │
│                   Page Unmount                            │
│                         │                                │
│                         ▼                                │
│                  disconnect()                            │
│                  Close WS connection                     │
│                  Clear store                             │
└─────────────────────────────────────────────────────────┘
```

### Reconnection Strategy

1. WebSocket disconnects unexpectedly.
2. Set `isReconnecting = true`, show yellow banner.
3. Attempt reconnect with exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max).
4. On reconnect success:
   a. Refetch full board state from API (to catch events missed during disconnect).
   b. Replace entire store data with fresh API response.
   c. Set `isConnected = true`, `isReconnecting = false`.
   d. Show brief green "Connected" banner.
5. After 5 failed attempts, show error banner with manual "Retry" button.

### Event Handling

When a WebSocket event arrives, the store determines if it was caused by the current user (from an optimistic update) or by another user.

```typescript
handleWsEvent: (event: BoardWsEvent) => {
  switch (event.type) {
    case 'card:created':
      // If we have a pending optimistic card with a temp ID,
      // replace the temp ID with the real ID from the server.
      // If not (event from another user), fetch the card data
      // from the full board response or a targeted GET.
      break;

    case 'card:updated':
      // Fetch updated card data. If we have an optimistic update
      // pending for this card, confirm it.
      break;

    case 'card:deleted':
      // Remove card from store. Confirm any pending delete.
      break;

    case 'vote:added':
    case 'vote:removed':
      // Update vote count on the card. If from current user,
      // confirm optimistic update. If from another user, just
      // update the count.
      break;

    case 'phase:changed':
      // Update phase immediately. This is authoritative.
      break;

    case 'focus:changed':
      // Update focus immediately. This is authoritative.
      break;

    case 'board:updated':
      // Update settings. This is authoritative.
      break;

    // Groups handled similarly to cards.
  }
};
```

---

## Optimistic Updates Approach

Optimistic updates provide instant UI feedback before the server confirms the operation. If the server rejects the operation, the UI rolls back.

### Strategy Per Action

| Action | Optimistic? | Approach |
|--------|-------------|----------|
| Add card | Yes | Insert card with temp ID, replace with real ID on server confirm |
| Edit card | Yes | Update content immediately, rollback on error |
| Delete card | Yes | Remove card from store immediately, restore on error |
| Vote | Yes | Increment counts immediately, rollback on VOTE_LIMIT_REACHED |
| Unvote | Yes | Decrement counts immediately, rollback on error |
| Create group | Yes | Insert group with temp ID, replace on confirm |
| Update group | Yes | Update title/members immediately, rollback on error |
| Delete group | Yes | Remove group, ungroup cards, rollback on error |
| Set phase | No | Wait for server confirmation (phase is authoritative) |
| Set focus | No | Wait for server confirmation (focus is authoritative) |
| Update settings | No | Wait for server confirmation (settings are authoritative) |

### Optimistic Update Flow

```
User clicks "+1 Vote"
       │
       ▼
┌─────────────────────────────────┐
│ 1. Save rollback snapshot       │
│    (current vote counts)        │
│ 2. Apply optimistic update:     │
│    - voteCount++                │
│    - userVotes++                │
│    - userVotesCast++            │
│    - userVotesRemaining--       │
│ 3. Track as pending operation   │
│ 4. Send POST to API            │
└──────────────┬──────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
   API Success     API Error
       │               │
       ▼               ▼
   Confirm:        Rollback:
   Remove from     Restore snapshot,
   pending ops     show toast error
```

### Handling Conflicts

When an optimistic update is pending and a WebSocket event arrives for the same entity:

1. **Same user, same operation**: The WS event confirms the optimistic update. Remove from pending.
2. **Different user, same entity**: Apply the server state. If it conflicts with the optimistic update, the WS event takes priority (server is authoritative). Rollback the optimistic update and apply the server state.
3. **Stale data after reconnect**: Full board refetch replaces all local state, clearing any pending operations.

### Temporary IDs

For newly created cards and groups, the client generates a temporary UUID prefixed with `temp-`. When the server response arrives, all references to the temp ID are replaced with the real server-assigned ID.

```typescript
const tempId = `temp-${crypto.randomUUID()}`;
```

---

## Store Initialization

```typescript
import { create } from 'zustand';

export const useBoardStore = create<BoardState>((set, get) => ({
  // Initial state
  board: null,
  columns: [],
  cards: {},
  groups: {},
  userVotesCast: 0,
  userVotesRemaining: 0,
  userCardVotes: {},
  phase: 'write',
  focusItemId: null,
  focusItemType: null,
  isLoading: true,
  error: null,
  isConnected: false,
  isReconnecting: false,
  pendingOperations: new Map(),

  fetchBoard: async (sprintId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/api/v1/sprints/${sprintId}/board`);
      const data = response.data;

      // Normalize cards into a Record<id, Card>
      const cards: Record<string, Card> = {};
      for (const col of data.columns) {
        for (const card of col.cards) {
          cards[card.id] = card;
        }
      }

      // Normalize groups
      const groups: Record<string, CardGroup> = {};
      for (const group of data.groups) {
        groups[group.id] = group;
      }

      // Build userCardVotes from cards
      const userCardVotes: Record<string, number> = {};
      for (const card of Object.values(cards)) {
        if (card.userVotes > 0) {
          userCardVotes[card.id] = card.userVotes;
        }
      }

      set({
        board: data,
        columns: data.columns.map(({ cards: _, ...col }) => col),
        cards,
        groups,
        phase: data.phase,
        focusItemId: data.focus_item_id,
        focusItemType: data.focus_item_type,
        userVotesCast: data.user_total_votes_cast,
        userVotesRemaining: data.user_votes_remaining,
        userCardVotes,
        isLoading: false,
      });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // ... actions implemented following the optimistic update pattern above
}));
```

---

## Performance Considerations

1. **Cards as Record**: Using `Record<string, Card>` instead of an array provides O(1) lookups by ID, critical for WebSocket event handling.
2. **Selectors with shallow comparison**: Zustand's `useStore(selector)` with shallow equality prevents unnecessary re-renders when unrelated state changes.
3. **Memoized derived state**: Computed values like "cards in column X" are derived via selectors, not stored. This avoids synchronization bugs.
4. **Batch WebSocket events**: If multiple WS events arrive within a 16ms window (one frame), batch them into a single store update to avoid multiple renders.
5. **Minimal re-renders**: Each Card component subscribes only to its own data via `useBoardStore(state => state.cards[cardId])`, so only the affected card re-renders on updates.
