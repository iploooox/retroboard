# Facilitation Tools Architecture

## Overview

Facilitation tools give the facilitator (or admin) full control over the retro ceremony flow. This includes managing board phases, running countdown timers, locking the board to prevent edits, revealing anonymous cards, and setting discussion focus. All state is persisted in PostgreSQL and broadcast to connected clients via the real-time WebSocket system.

## Design Principles

1. **Facilitator authority** -- only users with `facilitator` or `admin` role on the team can use facilitation controls
2. **Server-managed timer** -- the countdown runs on the server to prevent client-side drift and ensure consistency across all connected users
3. **Phase progression is enforced** -- phases must follow the defined order; skipping phases is allowed, going backward is allowed (facilitator's discretion)
4. **All state in PostgreSQL** -- phase, timer, lock status, and reveal status are persisted so that a page refresh or reconnect shows current state
5. **Real-time propagation** -- every facilitation action triggers a NOTIFY event that propagates to all connected clients via WebSocket

## Board Phases

The retro ceremony follows five sequential phases. Each phase controls what actions participants can perform.

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│          │    │          │    │          │    │          │    │          │
│  WRITE   │───>│  GROUP   │───>│  VOTE    │───>│ DISCUSS  │───>│ ACTION   │
│          │    │          │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     │               │               │               │               │
     v               v               v               v               v
 Add cards       Drag cards      Vote on        Facilitator     Create action
 to columns      into groups     cards/groups   leads            items from
 (anonymous       Rename         (limited        discussion,     discussed
  or named)      groups          votes per       set focus       cards
                                  user)          on card/group
```

### Phase Permissions Matrix

| Action | Write | Group | Vote | Discuss | Action |
|--------|-------|-------|------|---------|--------|
| Add card | YES | NO | NO | NO | NO |
| Edit own card | YES | YES | NO | NO | NO |
| Delete own card | YES | YES | NO | NO | NO |
| Move card to group | NO | YES | NO | NO | NO |
| Create group | NO | YES | NO | NO | NO |
| Rename group | NO | YES | YES | YES | YES |
| Vote on card | NO | NO | YES | NO | NO |
| Remove own vote | NO | NO | YES | NO | NO |
| Set focus | NO | NO | NO | YES | YES |
| Create action item | NO | NO | NO | YES | YES |
| Edit action item | NO | NO | NO | YES | YES |

The facilitator can override phase restrictions (e.g., allow adding a card during discuss phase) by unlocking the board temporarily.

### Phase Stored in Database

```sql
-- In the boards table
ALTER TABLE boards ADD COLUMN phase TEXT NOT NULL DEFAULT 'write'
  CHECK (phase IN ('write', 'group', 'vote', 'discuss', 'action'));
```

## Timer System

### Architecture

The timer is fully server-managed. The server stores timer state in PostgreSQL and uses a Node.js `setInterval` to broadcast countdown ticks every second to connected clients.

```
┌───────────────────────────────────────────────────────────────────┐
│                       Timer Architecture                          │
│                                                                   │
│  ┌───────────────┐                                                │
│  │  Facilitator   │                                                │
│  │  (Client)      │                                                │
│  └───────┬───────┘                                                │
│          │  POST /api/v1/boards/:id/timer                         │
│          │  { phase: "write", durationSeconds: 300 }              │
│          │                                                        │
│  ┌───────┴──────────────────────────────────────────────────────┐ │
│  │                         Server                                │ │
│  │                                                               │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │  TimerService                                            │  │ │
│  │  │                                                          │  │ │
│  │  │  activeTimers: Map<boardId, {                             │  │ │
│  │  │    intervalId: NodeJS.Timeout,                            │  │ │
│  │  │    boardId: string,                                      │  │ │
│  │  │    phase: string,                                        │  │ │
│  │  │    durationSeconds: number,                              │  │ │
│  │  │    remainingSeconds: number,                             │  │ │
│  │  │    startedAt: Date,                                      │  │ │
│  │  │    pausedAt: Date | null,                                │  │ │
│  │  │    isPaused: boolean                                     │  │ │
│  │  │  }>                                                      │  │ │
│  │  │                                                          │  │ │
│  │  │  Methods:                                                │  │ │
│  │  │  - start(boardId, phase, durationSeconds): void          │  │ │
│  │  │  - pause(boardId): void                                  │  │ │
│  │  │  - resume(boardId): void                                 │  │ │
│  │  │  - stop(boardId, reason): void                           │  │ │
│  │  │  - getState(boardId): TimerState | null                  │  │ │
│  │  │  - tick(boardId): void  // called every 1 second         │  │ │
│  │  │                                                          │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │            │                              │                    │ │
│  │            │ setInterval(1s)              │ NOTIFY             │ │
│  │            v                              v                    │ │
│  │   ┌─────────────────┐         ┌──────────────────────┐       │ │
│  │   │  Broadcast       │         │  PostgreSQL           │       │ │
│  │   │  timer_tick       │         │  board_timers table   │       │ │
│  │   │  to all clients  │         │  (persist state)      │       │ │
│  │   │  via WS           │         │                      │       │ │
│  │   └─────────────────┘         └──────────────────────┘       │ │
│  │                                                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐         │
│  │  Client A      │  │  Client B      │  │  Client C      │         │
│  │  timer_tick:   │  │  timer_tick:   │  │  timer_tick:   │         │
│  │  remaining=245 │  │  remaining=245 │  │  remaining=245 │         │
│  └───────────────┘  └───────────────┘  └───────────────┘         │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Timer Lifecycle

```
                          ┌──────────┐
                          │  IDLE    │
                          │ (no      │
                          │  timer)  │
                          └────┬─────┘
                               │
                    POST /timer│(start)
                               │
                          ┌────┴─────┐
                ┌────────>│ RUNNING  │<────────┐
                │         │          │         │
                │         └────┬─────┘         │
                │              │               │
         PUT /timer│     PUT /timer       DELETE /timer
         (resume)  │     (pause)         (stop)
                │              │               │
                │         ┌────┴─────┐    ┌────┴─────┐
                │         │ PAUSED   │    │ STOPPED  │
                └─────────┤          │    │          │
                          └──────────┘    └──────────┘

  Also transitions to STOPPED:
  - Timer reaches 0 (expired)
  - Phase changed (auto-stop)
  - Board deleted
```

### Timer Tick Sequence

```
  Server (TimerService)                    All Connected Clients
        │                                         │
        │  setInterval fires (every 1000ms)       │
        │                                         │
        │  remainingSeconds--                     │
        │                                         │
        │  if remainingSeconds > 0:               │
        │    broadcast timer_tick                  │
        │ ───────────────────────────────────────>│
        │    { remainingSeconds: 244 }             │
        │                                         │
        │  if remainingSeconds <= 0:              │
        │    clearInterval                        │
        │    broadcast timer_stopped              │
        │    { reason: "expired" }                │
        │ ───────────────────────────────────────>│
        │                                         │
        │    UPDATE board_timers SET              │
        │    remaining_seconds = 0                │
        │                                         │
        │    (optionally auto-advance phase)      │
        │                                         │
```

### Server Restart Recovery

When the server restarts, it must recover active timers from the database:

```
Server Startup
      │
      │  SELECT * FROM board_timers
      │  WHERE remaining_seconds > 0
      │  AND paused_at IS NULL
      │
      │  For each active timer:
      │    elapsed = NOW() - started_at
      │    remaining = duration_seconds - elapsed
      │    if remaining > 0:
      │      Start setInterval for this timer
      │      (clients will get timer_tick on reconnect)
      │    else:
      │      Timer expired during downtime
      │      Mark as stopped, notify on first client reconnect
      │
```

## Facilitator Controls

### Lock Board

When the board is locked, participants cannot add, edit, or delete cards or votes. The facilitator and admin can still make changes.

```
Lock Flow:
  Facilitator ──> PUT /api/v1/boards/:id/lock { isLocked: true }
       │
       ├── UPDATE boards SET is_locked = true WHERE id = :id
       │
       ├── NOTIFY board:{boardId} -> board_locked event
       │
       └── All clients disable input controls
           (facilitator controls remain active)

Unlock Flow:
  Facilitator ──> PUT /api/v1/boards/:id/lock { isLocked: false }
       │
       ├── UPDATE boards SET is_locked = false WHERE id = :id
       │
       ├── NOTIFY board:{boardId} -> board_unlocked event
       │
       └── All clients re-enable input controls
```

### Card Reveal

In anonymous mode, card authors are hidden during the write phase. The facilitator can reveal all cards at once (typically after the write phase ends).

```
Reveal Flow:
  Facilitator ──> PUT /api/v1/boards/:id/reveal
       │
       ├── UPDATE boards SET cards_revealed = true WHERE id = :id
       │
       ├── SELECT cards with author info for this board
       │
       ├── NOTIFY board:{boardId} -> cards_revealed event
       │   (includes card-to-author mapping)
       │
       └── All clients show author names on cards
```

Rules:
- Reveal is one-way: once revealed, cannot be un-revealed
- Author can always see their own cards, even before reveal
- Reveal event includes the full card-to-author mapping so clients don't need additional API calls
- Reveal is only meaningful when `boards.is_anonymous = true`

### Discussion Focus

During the discuss and action phases, the facilitator can highlight a specific card or group for the team to discuss together.

```
Focus Flow:
  Facilitator ──> PUT /api/v1/boards/:id/focus
       │           { focusType: "card", focusId: "card-001" }
       │
       ├── UPDATE boards SET
       │     focus_type = 'card',
       │     focus_id = 'card-001'
       │   WHERE id = :id
       │
       ├── NOTIFY board:{boardId} -> focus_changed event
       │
       └── All clients:
           - Scroll focused item into view
           - Highlight with visual indicator (glow/border)
           - Dim other cards

Clear Focus:
  Facilitator ──> PUT /api/v1/boards/:id/focus
       │           { focusType: null, focusId: null }
       │
       ├── UPDATE boards SET focus_type = NULL, focus_id = NULL
       │
       ├── NOTIFY board:{boardId} -> focus_changed event
       │
       └── All clients remove focus highlighting
```

## Phase Transition Logic

```
  Facilitator                    Server                      PostgreSQL
       │                           │                              │
       │  PUT /boards/:id/phase    │                              │
       │  { phase: "group" }       │                              │
       │ ─────────────────────────>│                              │
       │                           │                              │
       │                           │  Validate:                   │
       │                           │  1. User is facilitator/admin│
       │                           │  2. Board exists             │
       │                           │  3. Phase value is valid     │
       │                           │                              │
       │                           │  BEGIN TRANSACTION            │
       │                           │                              │
       │                           │  UPDATE boards               │
       │                           │  SET phase = 'group'         │
       │                           │ ─────────────────────────────>│
       │                           │                              │
       │                           │  If timer running:           │
       │                           │    Stop timer                │
       │                           │    (reason: phase_change)    │
       │                           │                              │
       │                           │  Log to board_events         │
       │                           │ ─────────────────────────────>│
       │                           │                              │
       │                           │  COMMIT                      │
       │                           │                              │
       │                           │  Trigger fires:              │
       │                           │  NOTIFY board:{boardId}      │
       │                           │                              │
       │  200 OK                   │                              │
       │  { phase: "group" }       │                              │
       │ <─────────────────────────│                              │
       │                           │                              │
       │                           │  Broadcast phase_changed     │
       │                           │  and timer_stopped (if any)  │
       │                           │  to all clients              │
       │                           │                              │
```

## Default Phase Durations

Each phase has a suggested default timer duration. The facilitator can customize these per board.

| Phase | Default Duration | Description |
|-------|-----------------|-------------|
| Write | 5 minutes (300s) | Time for participants to write cards |
| Group | 5 minutes (300s) | Time to group related cards |
| Vote | 3 minutes (180s) | Time to cast votes |
| Discuss | 2 minutes per card/group (120s) | Time to discuss each focused item |
| Action | 5 minutes (300s) | Time to create action items |

Default durations are stored in the board templates and can be overridden per board:

```sql
-- In boards table or a separate config
ALTER TABLE boards ADD COLUMN phase_durations JSONB DEFAULT '{
  "write": 300,
  "group": 300,
  "vote": 180,
  "discuss": 120,
  "action": 300
}'::jsonb;
```

## Database Schema Additions

### boards table additions

```sql
ALTER TABLE boards ADD COLUMN phase TEXT NOT NULL DEFAULT 'write'
  CHECK (phase IN ('write', 'group', 'vote', 'discuss', 'action'));

ALTER TABLE boards ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE boards ADD COLUMN cards_revealed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE boards ADD COLUMN focus_type TEXT
  CHECK (focus_type IN ('card', 'group') OR focus_type IS NULL);

ALTER TABLE boards ADD COLUMN focus_id UUID;

ALTER TABLE boards ADD COLUMN phase_durations JSONB DEFAULT '{
  "write": 300,
  "group": 300,
  "vote": 180,
  "discuss": 120,
  "action": 300
}'::jsonb;
```

### board_timers table

```sql
CREATE TABLE board_timers (
  board_id           UUID PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
  phase              TEXT NOT NULL CHECK (phase IN ('write', 'group', 'vote', 'discuss', 'action')),
  duration_seconds   INTEGER NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 3600),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at          TIMESTAMPTZ,
  remaining_seconds  INTEGER NOT NULL CHECK (remaining_seconds >= 0),
  started_by         UUID NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active timer per board (PRIMARY KEY on board_id ensures this)
```

## Module Structure

```
src/services/
  facilitation-service.ts    -- Phase management, lock, reveal, focus
  timer-service.ts           -- Timer start/pause/resume/stop/tick

src/routes/
  facilitation-routes.ts     -- REST API endpoints for facilitation

src/middleware/
  facilitator-guard.ts       -- Middleware to check facilitator/admin role
  phase-guard.ts             -- Middleware to check allowed actions per phase
```

## Client-Side State (Zustand)

```typescript
interface FacilitationState {
  // Phase
  currentPhase: BoardPhase;
  setPhase: (phase: BoardPhase) => void;

  // Timer
  timer: {
    isRunning: boolean;
    isPaused: boolean;
    durationSeconds: number;
    remainingSeconds: number;
    phase: BoardPhase;
  } | null;
  setTimer: (timer: TimerState | null) => void;
  updateTimerTick: (remainingSeconds: number) => void;

  // Lock
  isLocked: boolean;
  setLocked: (locked: boolean) => void;

  // Reveal
  cardsRevealed: boolean;
  setCardsRevealed: (revealed: boolean) => void;

  // Focus
  focus: {
    type: 'card' | 'group';
    id: string;
    title: string;
  } | null;
  setFocus: (focus: FocusState | null) => void;

  // Derived
  canAddCard: () => boolean;
  canVote: () => boolean;
  canGroup: () => boolean;
  isUserFacilitator: () => boolean;
}
```

## Error Handling

| Scenario | HTTP Status | Error Code | Message |
|----------|-------------|-----------|---------|
| Non-facilitator tries to change phase | 403 | FORBIDDEN | Only facilitators can change the board phase |
| Invalid phase value | 400 | INVALID_PHASE | Phase must be one of: write, group, vote, discuss, action |
| Start timer when one is running | 409 | TIMER_CONFLICT | A timer is already running. Stop it first. |
| Pause timer when not running | 400 | TIMER_NOT_RUNNING | No timer is currently running |
| Resume timer when not paused | 400 | TIMER_NOT_PAUSED | Timer is not paused |
| Stop timer when none exists | 404 | TIMER_NOT_FOUND | No timer exists for this board |
| Timer duration out of range | 400 | INVALID_DURATION | Duration must be between 1 and 3600 seconds |
| Reveal on non-anonymous board | 400 | NOT_ANONYMOUS | Board is not in anonymous mode |
| Reveal already revealed | 400 | ALREADY_REVEALED | Cards have already been revealed |
| Focus on non-existent card/group | 404 | FOCUS_TARGET_NOT_FOUND | Card or group not found |

## Related Documents

- [Real-Time Architecture](../real-time/architecture.md)
- [Facilitation API Spec](specs/api.md)
- [Facilitation Database Spec](specs/database.md)
- [Facilitation Test Plan](specs/tests.md)
