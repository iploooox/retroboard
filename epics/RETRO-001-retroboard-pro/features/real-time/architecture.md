# Real-Time Collaboration Architecture

## Overview

Real-time collaboration is the backbone of RetroBoard Pro's live retro experience. Every board action -- card creation, voting, grouping, phase changes -- must propagate to all connected clients within 100ms (NFR-02). The architecture uses the `ws` library for WebSocket connections, PostgreSQL LISTEN/NOTIFY for cross-connection event distribution, and an event log table for reconnection recovery.

## Design Principles

1. **PostgreSQL is the source of truth** -- all mutations go through the database first, then propagate via NOTIFY
2. **Events are lightweight** -- NOTIFY payloads carry event metadata only (event type + IDs), clients fetch full data via REST or receive it in the WebSocket message
3. **Rooms isolate traffic** -- each board is a room; users only receive events for boards they are viewing
4. **Reconnection is seamless** -- clients track their last received event ID and request missed events on reconnect
5. **No Redis** -- PostgreSQL LISTEN/NOTIFY replaces Redis pub/sub entirely (ADR-001)

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    WebSocket Client                          │    │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │    │
│  │  │ Connect  │  │  Message     │  │  Reconnection         │  │    │
│  │  │ Manager  │  │  Dispatcher  │  │  Manager              │  │    │
│  │  │          │  │              │  │  (last_event_id track) │  │    │
│  │  └────┬─────┘  └──────┬──────┘  └──────────┬────────────┘  │    │
│  │       │               │                     │               │    │
│  │  ┌────┴───────────────┴─────────────────────┴────────────┐  │    │
│  │  │              Zustand Store (board state)              │  │    │
│  │  │  cards[], votes[], groups[], presence[], phase        │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                    WebSocket │ ws://host/ws?token=JWT&boardId=UUID   │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                    Hono Server (Node.js)                             │
│                              │                                      │
│  ┌───────────────────────────┴──────────────────────────────────┐   │
│  │                  HTTP Server (Node http module)               │   │
│  │                                                               │   │
│  │  ┌────────────────────┐    ┌──────────────────────────────┐  │   │
│  │  │  Hono App          │    │  ws.Server                    │  │   │
│  │  │  (REST API routes) │    │  (handleUpgrade on /ws path)  │  │   │
│  │  └────────┬───────────┘    └──────────┬───────────────────┘  │   │
│  │           │                           │                       │   │
│  └───────────┼───────────────────────────┼───────────────────────┘   │
│              │                           │                           │
│  ┌───────────┴──────────┐    ┌───────────┴───────────────────────┐  │
│  │  Service Layer       │    │  WebSocket Manager                 │  │
│  │  (business logic)    │    │                                    │  │
│  │  - CardService       │    │  ┌─────────────────────────────┐  │  │
│  │  - VoteService       │    │  │  RoomManager                │  │  │
│  │  - GroupService      │    │  │  Map<boardId, Set<client>>  │  │  │
│  │  - PhaseService      │    │  └─────────────────────────────┘  │  │
│  │  - TimerService      │    │                                    │  │
│  └───────────┬──────────┘    │  ┌─────────────────────────────┐  │  │
│              │               │  │  PresenceTracker             │  │  │
│              │               │  │  Map<boardId, Set<userId>>   │  │  │
│              │               │  └─────────────────────────────┘  │  │
│              │               │                                    │  │
│              │               │  ┌─────────────────────────────┐  │  │
│              │               │  │  MessageRouter               │  │  │
│              │               │  │  - authenticate()            │  │  │
│              │               │  │  - handleMessage()           │  │  │
│              │               │  │  - broadcastToRoom()         │  │  │
│              │               │  └─────────────────────────────┘  │  │
│              │               └───────────────┬───────────────────┘  │
│              │                               │                      │
│  ┌───────────┴───────────────────────────────┴──────────────────┐   │
│  │                    Database Layer                              │   │
│  │                                                               │   │
│  │  ┌─────────────────────┐    ┌─────────────────────────────┐  │   │
│  │  │  Connection Pool    │    │  Listener Connection         │  │   │
│  │  │  (postgres driver)  │    │  (dedicated, non-pooled)     │  │   │
│  │  │  - queries          │    │  - LISTEN board:*            │  │   │
│  │  │  - transactions     │    │  - on('notification', ...)   │  │   │
│  │  └─────────┬───────────┘    └──────────┬──────────────────┘  │   │
│  │            │                            │                     │   │
│  └────────────┼────────────────────────────┼─────────────────────┘   │
│               │                            │                         │
└───────────────┼────────────────────────────┼─────────────────────────┘
                │                            │
         ┌──────┴────────────────────────────┴──────┐
         │              PostgreSQL 15+               │
         │                                           │
         │  ┌──────────────────────────────────────┐ │
         │  │  Tables                               │ │
         │  │  - cards, votes, groups, boards       │ │
         │  │  - board_events (event log)           │ │
         │  │  - board_presence (optional)          │ │
         │  └──────────────────────────────────────┘ │
         │                                           │
         │  ┌──────────────────────────────────────┐ │
         │  │  Triggers                             │ │
         │  │  - after_card_insert -> NOTIFY        │ │
         │  │  - after_card_update -> NOTIFY        │ │
         │  │  - after_card_delete -> NOTIFY        │ │
         │  │  - after_vote_change -> NOTIFY        │ │
         │  │  - after_group_change -> NOTIFY       │ │
         │  │  - after_phase_change -> NOTIFY       │ │
         │  └──────────────────────────────────────┘ │
         │                                           │
         │  ┌──────────────────────────────────────┐ │
         │  │  Channels                             │ │
         │  │  - board:{boardId}                    │ │
         │  └──────────────────────────────────────┘ │
         └───────────────────────────────────────────┘
```

## WebSocket Server Setup

The WebSocket server runs on the same HTTP port as Hono by intercepting the `upgrade` event on the underlying Node.js HTTP server.

```
┌──────────────────────────────────────────────────────────────────┐
│                     Server Startup Sequence                       │
│                                                                  │
│  1. Create Node http.Server                                      │
│  2. Mount Hono app as request handler                            │
│  3. Create ws.WebSocketServer({ noServer: true })                │
│  4. Listen for 'upgrade' event on http.Server                    │
│  5. On upgrade:                                                  │
│     a. Parse URL -- only handle /ws path                         │
│     b. Extract token & boardId from query params                 │
│     c. Verify JWT token (reject with 401 if invalid)             │
│     d. Check user has access to board (reject with 403)          │
│     e. Call wss.handleUpgrade(req, socket, head, callback)       │
│     f. On connection: register client in room, send presence     │
│  6. Start dedicated LISTEN connection to PostgreSQL              │
│  7. Subscribe to notification channels dynamically               │
└──────────────────────────────────────────────────────────────────┘
```

### Connection Authentication Flow

```
  Client                          Server                         PostgreSQL
    │                               │                               │
    │  GET /ws?token=JWT&boardId=X  │                               │
    │  Upgrade: websocket           │                               │
    │ ─────────────────────────────>│                               │
    │                               │                               │
    │                               │  Verify JWT signature         │
    │                               │  Extract userId from token    │
    │                               │                               │
    │                               │  SELECT membership            │
    │                               │ ─────────────────────────────>│
    │                               │                               │
    │                               │  { role: 'member' }           │
    │                               │ <─────────────────────────────│
    │                               │                               │
    │                               │  Check board access           │
    │                               │  (user is team member)        │
    │                               │                               │
    │  101 Switching Protocols      │                               │
    │ <─────────────────────────────│                               │
    │                               │                               │
    │  WS Connected                 │                               │
    │ <════════════════════════════>│                               │
    │                               │                               │
    │                               │  Add to room: board:{boardId} │
    │                               │  Add to presence tracker      │
    │                               │                               │
    │  { type: "user_joined",       │                               │
    │    payload: { userId, name,   │  Broadcast to room            │
    │    avatar }}                   │                               │
    │ <─────────────────────────────│                               │
    │                               │                               │
    │  { type: "presence_state",    │                               │
    │    payload: { users: [...] }} │  Send current presence        │
    │ <─────────────────────────────│                               │
    │                               │                               │
```

## Room Management

Each board maps to exactly one room. The `RoomManager` maintains an in-memory map of board IDs to connected WebSocket clients.

```
RoomManager (in-memory)
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  rooms: Map<boardId, Map<clientId, ClientConnection>>        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  board:abc-123                                       │     │
│  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │     │
│  │  │ client-001   │ │ client-002   │ │ client-003  │ │     │
│  │  │ userId: u1   │ │ userId: u2   │ │ userId: u3  │ │     │
│  │  │ ws: <socket> │ │ ws: <socket> │ │ ws: <socket>│ │     │
│  │  │ joinedAt: .. │ │ joinedAt: .. │ │ joinedAt: ..│ │     │
│  │  └──────────────┘ └──────────────┘ └─────────────┘ │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  board:def-456                                       │     │
│  │  ┌──────────────┐ ┌──────────────┐                  │     │
│  │  │ client-004   │ │ client-005   │                  │     │
│  │  │ userId: u4   │ │ userId: u1   │  (user u1 is    │     │
│  │  │ ws: <socket> │ │ ws: <socket> │  in 2 rooms)    │     │
│  │  └──────────────┘ └──────────────┘                  │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  Methods:                                                    │
│  - join(boardId, clientId, ws, userId) -> void               │
│  - leave(boardId, clientId) -> void                          │
│  - getClients(boardId) -> Map<clientId, ClientConnection>    │
│  - getUserBoards(userId) -> Set<boardId>                     │
│  - broadcast(boardId, message, excludeClientId?) -> void     │
│  - unicast(clientId, message) -> void                        │
│  - getRoomSize(boardId) -> number                            │
│  - removeClient(clientId) -> void  // remove from all rooms  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### ClientConnection Interface

```typescript
interface ClientConnection {
  clientId: string;        // unique per connection (UUID)
  userId: string;          // from JWT
  userName: string;        // display name
  userAvatar: string;      // avatar URL
  boardId: string;         // currently joined board
  ws: WebSocket;           // ws library socket instance
  joinedAt: Date;
  lastEventId: string;     // last event the client confirmed receiving
  lastPingAt: Date;        // for heartbeat tracking
}
```

## PostgreSQL LISTEN/NOTIFY Integration

### Channel Naming Convention

The server listens on one channel per active board:

```
Channel format:  board:{boardId}

Examples:
  board:550e8400-e29b-41d4-a716-446655440000
  board:7c9e6679-7425-40de-944b-e07fc1f90ae7
```

### Dynamic Channel Subscription

The server maintains a dedicated PostgreSQL connection (outside the pool) for LISTEN/NOTIFY. Channels are subscribed/unsubscribed dynamically as rooms open and close.

```
                    Server                          PostgreSQL
                      │                                │
   First client       │                                │
   joins board X      │  LISTEN "board:X"              │
   ──────────────────>│ ──────────────────────────────>│
                      │                                │
   More clients       │  (already listening)           │
   join board X       │                                │
   ──────────────────>│                                │
                      │                                │
   Last client        │  UNLISTEN "board:X"            │
   leaves board X     │ ──────────────────────────────>│
   ──────────────────>│                                │
```

### NOTIFY Trigger Design

Database triggers fire NOTIFY after mutations on cards, votes, groups, and board state changes. The payload is a compact JSON object kept under PostgreSQL's 8KB NOTIFY limit.

```sql
-- Example trigger function for card changes
CREATE OR REPLACE FUNCTION notify_card_change()
RETURNS TRIGGER AS $$
DECLARE
  event_type TEXT;
  payload JSON;
  new_event_id UUID;
BEGIN
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type := 'card_created';
  ELSIF TG_OP = 'UPDATE' THEN
    event_type := 'card_updated';
  ELSIF TG_OP = 'DELETE' THEN
    event_type := 'card_deleted';
  END IF;

  -- Generate event ID
  new_event_id := gen_random_uuid();

  -- Log event for reconnection recovery
  INSERT INTO board_events (id, board_id, event_type, entity_type, entity_id, actor_id, created_at)
  VALUES (
    new_event_id,
    COALESCE(NEW.board_id, OLD.board_id),
    event_type,
    'card',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.updated_by, NEW.created_by, OLD.created_by),
    NOW()
  );

  -- Build compact payload (under 8KB limit)
  payload := json_build_object(
    'eventId', new_event_id,
    'type', event_type,
    'entityId', COALESCE(NEW.id, OLD.id),
    'actorId', COALESCE(NEW.updated_by, NEW.created_by, OLD.created_by),
    'ts', extract(epoch from now())
  );

  -- Notify on board channel
  PERFORM pg_notify(
    'board:' || COALESCE(NEW.board_id, OLD.board_id),
    payload::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach to cards table
CREATE TRIGGER trg_card_notify
  AFTER INSERT OR UPDATE OR DELETE ON cards
  FOR EACH ROW EXECUTE FUNCTION notify_card_change();
```

### Notification Flow (End-to-End)

```
  Client A              Server               PostgreSQL            Client B
    │                     │                      │                    │
    │  POST /api/v1/      │                      │                    │
    │  boards/X/cards     │                      │                    │
    │  { text: "..." }    │                      │                    │
    │ ───────────────────>│                      │                    │
    │                     │  INSERT INTO cards   │                    │
    │                     │ ────────────────────>│                    │
    │                     │                      │                    │
    │                     │                      │  Trigger fires     │
    │                     │                      │  INSERT INTO       │
    │                     │                      │  board_events      │
    │                     │                      │                    │
    │                     │                      │  pg_notify(        │
    │                     │                      │    'board:X',      │
    │                     │                      │    payload          │
    │                     │                      │  )                 │
    │                     │                      │                    │
    │                     │  NOTIFY received     │                    │
    │                     │ <────────────────────│                    │
    │                     │                      │                    │
    │  201 Created        │                      │                    │
    │ <───────────────────│                      │                    │
    │                     │                      │                    │
    │                     │  Fetch full card     │                    │
    │                     │  data from DB        │                    │
    │                     │ ────────────────────>│                    │
    │                     │ <────────────────────│                    │
    │                     │                      │                    │
    │                     │  Broadcast to room   │                    │
    │  WS: card_created   │  (all clients        │                    │
    │ <───────────────────│   in board:X)        │  WS: card_created  │
    │                     │ ────────────────────────────────────────>│
    │                     │                      │                    │
```

## Message Types

### Server-to-Client Events

| Event Type | Description | Trigger |
|-----------|-------------|---------|
| `card_created` | New card added to board | Card INSERT |
| `card_updated` | Card text or position changed | Card UPDATE |
| `card_deleted` | Card removed from board | Card DELETE |
| `vote_added` | User voted on a card | Vote INSERT |
| `vote_removed` | User removed vote from a card | Vote DELETE |
| `group_created` | New card group created | Group INSERT |
| `group_updated` | Group title or cards changed | Group UPDATE |
| `phase_changed` | Board phase advanced | Board UPDATE (phase column) |
| `focus_changed` | Facilitator set discussion focus | Board UPDATE (focus columns) |
| `user_joined` | User connected to board | WS connection opened |
| `user_left` | User disconnected from board | WS connection closed |
| `cursor_move` | User moved their cursor | Client message relayed |
| `presence_state` | Full list of connected users | Sent on join |
| `timer_started` | Phase timer started | Timer INSERT/UPDATE |
| `timer_paused` | Phase timer paused | Timer UPDATE |
| `timer_resumed` | Phase timer resumed | Timer UPDATE |
| `timer_stopped` | Phase timer stopped/expired | Timer DELETE/UPDATE |
| `timer_tick` | Timer countdown update | Server interval |
| `board_locked` | Board locked by facilitator | Board UPDATE |
| `board_unlocked` | Board unlocked by facilitator | Board UPDATE |
| `cards_revealed` | Anonymous cards revealed | Board UPDATE |
| `error` | Error message to client | Various |

### Client-to-Server Messages

| Message Type | Description | Response |
|-------------|-------------|----------|
| `ping` | Heartbeat keepalive | `pong` |
| `cursor_move` | Cursor position update | Broadcast to room |
| `join_board` | Join a board room | `presence_state` + broadcast `user_joined` |
| `leave_board` | Leave a board room | Broadcast `user_left` |

## Presence Tracking

Presence is tracked in-memory on the server. The `PresenceTracker` maintains which users are connected to each board.

```
PresenceTracker
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  boardPresence: Map<boardId, Map<userId, PresenceInfo>>     │
│                                                             │
│  PresenceInfo:                                              │
│    - userId: string                                         │
│    - userName: string                                       │
│    - userAvatar: string                                     │
│    - connectedAt: Date                                      │
│    - cursorPosition: { x: number, y: number } | null        │
│    - connectionCount: number  // same user, multiple tabs   │
│                                                             │
│  Methods:                                                   │
│    - addUser(boardId, userId, userInfo) -> boolean           │
│      (returns true if user is new to board)                 │
│    - removeUser(boardId, userId) -> boolean                  │
│      (returns true if user fully disconnected)              │
│    - getUsers(boardId) -> PresenceInfo[]                     │
│    - updateCursor(boardId, userId, position) -> void         │
│    - isUserOnline(boardId, userId) -> boolean                │
│                                                             │
│  Multi-tab handling:                                         │
│    - connectionCount increments on each new WS connection   │
│    - user_joined only broadcast when count goes 0 -> 1      │
│    - user_left only broadcast when count goes 1 -> 0        │
│    - cursor_move uses latest position from any tab           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Presence Broadcast Sequence

```
  Client (User A)          Server                    Other Clients
       │                     │                            │
       │  WS Connect         │                            │
       │ ───────────────────>│                            │
       │                     │                            │
       │                     │  PresenceTracker            │
       │                     │  .addUser(boardId, userA)   │
       │                     │  returns true (new user)    │
       │                     │                            │
       │  { type:            │                            │
       │    "presence_state", │  Send full presence list   │
       │    payload: {       │  to joining user only      │
       │      users: [       │                            │
       │        { id: "b",   │                            │
       │          name: ".." │                            │
       │        },           │                            │
       │        { id: "c",   │                            │
       │          name: ".." │                            │
       │        }            │                            │
       │      ]              │                            │
       │    }                │                            │
       │  }                  │                            │
       │ <───────────────────│                            │
       │                     │                            │
       │                     │  Broadcast user_joined     │
       │                     │  to all OTHER clients      │
       │                     │ ──────────────────────────>│
       │                     │                            │
       │                     │  { type: "user_joined",    │
       │                     │    payload: {              │
       │                     │      userId: "a",          │
       │                     │      name: "User A",       │
       │                     │      avatar: "..."         │
       │                     │    }                       │
       │                     │  }                         │
       │                     │                            │
```

## Reconnection and Event Recovery

### Event Log Table

```sql
CREATE TABLE board_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  entity_type TEXT NOT NULL,       -- 'card', 'vote', 'group', 'board'
  entity_id   UUID NOT NULL,
  actor_id    UUID REFERENCES users(id),
  payload     JSONB,              -- optional: denormalized data snapshot
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_board_events_board_created
  ON board_events (board_id, created_at);

CREATE INDEX idx_board_events_board_id
  ON board_events (board_id, id);

-- Cleanup: keep events for 24 hours only
-- Run via pg_cron or application-level scheduled task
DELETE FROM board_events WHERE created_at < NOW() - INTERVAL '24 hours';
```

### Reconnection Flow

```
  Client                        Server                        PostgreSQL
    │                             │                               │
    │  Connection lost            │                               │
    │  ×────────────×             │                               │
    │                             │                               │
    │  (client waits,             │  Detect disconnect            │
    │   exponential backoff:      │  Remove from room             │
    │   1s, 2s, 4s, 8s, 16s,     │  Broadcast user_left          │
    │   max 30s)                  │  (only if connectionCount=0)  │
    │                             │                               │
    │  Reconnect attempt          │                               │
    │  /ws?token=JWT              │                               │
    │  &boardId=X                 │                               │
    │  &lastEventId=evt-042       │                               │
    │ ───────────────────────────>│                               │
    │                             │                               │
    │                             │  Verify JWT (may be expired   │
    │                             │  -- reject if so, client must │
    │                             │  refresh token first)         │
    │                             │                               │
    │                             │  SELECT * FROM board_events   │
    │                             │  WHERE board_id = X           │
    │                             │  AND id > 'evt-042'           │
    │                             │  ORDER BY created_at ASC      │
    │                             │ ─────────────────────────────>│
    │                             │                               │
    │                             │  [evt-043, evt-044, evt-045]  │
    │                             │ <─────────────────────────────│
    │                             │                               │
    │  101 Switching Protocols    │                               │
    │ <───────────────────────────│                               │
    │                             │                               │
    │  { type: "event_replay",    │  Send missed events           │
    │    payload: {               │                               │
    │      events: [              │                               │
    │        { eventId: "043",    │                               │
    │          type: "card_...",  │                               │
    │          ... },             │                               │
    │        { eventId: "044",    │                               │
    │          ... },             │                               │
    │        { eventId: "045",    │                               │
    │          ... }              │                               │
    │      ]                      │                               │
    │    }                        │                               │
    │  }                          │                               │
    │ <───────────────────────────│                               │
    │                             │                               │
    │  { type: "presence_state",  │  Send current presence        │
    │    payload: { users: [...]} │                               │
    │  }                          │                               │
    │ <───────────────────────────│                               │
    │                             │                               │
    │  Normal real-time flow      │                               │
    │ <══════════════════════════>│                               │
    │                             │                               │
```

### Client-Side Reconnection Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                  Client Reconnection State Machine               │
│                                                                  │
│  ┌───────────┐     connection     ┌────────────┐                │
│  │           │     opened         │            │                │
│  │ CONNECTED ├────────────────────┤ CONNECTING │                │
│  │           │<───────────────────┤            │                │
│  └─────┬─────┘                    └─────┬──────┘                │
│        │                                │                       │
│        │ connection lost                │ timeout / error        │
│        │                                │                       │
│  ┌─────┴──────────┐              ┌──────┴──────────┐            │
│  │                │   backoff    │                  │            │
│  │ RECONNECTING   ├─────────────>│  WAITING         │            │
│  │                │<─────────────┤  (1s,2s,4s...30s)│            │
│  └─────┬──────────┘   timer      └──────────────────┘            │
│        │                                                        │
│        │ max retries exceeded (10) or token expired             │
│        │                                                        │
│  ┌─────┴──────────┐                                             │
│  │                │                                             │
│  │ DISCONNECTED   │  Show "connection lost" banner to user      │
│  │                │  Offer manual reconnect button              │
│  └────────────────┘                                             │
│                                                                  │
│  States:                                                         │
│  - CONNECTING: initial connection or reconnection in progress   │
│  - CONNECTED: WebSocket open, receiving events                  │
│  - RECONNECTING: connection lost, will retry                    │
│  - WAITING: waiting for backoff timer                           │
│  - DISCONNECTED: gave up or token expired                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Heartbeat / Keep-Alive

WebSocket connections can silently die (NAT timeout, mobile sleep). The server uses a ping/pong mechanism to detect dead connections.

```
  Client                          Server
    │                               │
    │                               │  Every 30 seconds:
    │                               │  Check all connections
    │                               │
    │                               │  If lastPingAt > 45s ago:
    │                               │    -> terminate connection
    │                               │
    │  { type: "ping" }             │
    │ ─────────────────────────────>│
    │                               │  Update lastPingAt
    │  { type: "pong" }             │
    │ <─────────────────────────────│
    │                               │

  Timing:
  - Client sends ping every 25 seconds
  - Server checks for stale connections every 30 seconds
  - Connection considered dead if no ping for 45 seconds
  - Dead connections are terminated and cleaned up
```

## Cursor Sharing

Cursor positions are high-frequency, low-value data. They bypass the database entirely and relay through the server in-memory only.

```
  Client A                    Server                     Client B
    │                           │                           │
    │  { type: "cursor_move",   │                           │
    │    payload: {             │                           │
    │      x: 450,             │                           │
    │      y: 230              │                           │
    │    }                      │                           │
    │  }                        │                           │
    │ ─────────────────────────>│                           │
    │                           │                           │
    │                           │  Throttle: max 1 relay    │
    │                           │  per 50ms per user        │
    │                           │                           │
    │                           │  Broadcast to room        │
    │                           │  (exclude sender)         │
    │                           │                           │
    │                           │  { type: "cursor_move",   │
    │                           │    payload: {             │
    │                           │      userId: "user-a",    │
    │                           │      userName: "Alice",   │
    │                           │      x: 450,             │
    │                           │      y: 230              │
    │                           │    }                      │
    │                           │  }                        │
    │                           │ ─────────────────────────>│
    │                           │                           │
```

Key decisions for cursor sharing:
- No database persistence -- cursors are ephemeral
- Server-side throttle of 50ms per user to avoid flooding
- Cursor positions are relative to the board canvas, not viewport
- Cursors disappear automatically after 5 seconds of no movement (client-side)

## Error Handling

| Scenario | Server Behavior | Client Behavior |
|----------|----------------|-----------------|
| Invalid JWT on connect | Reject upgrade with 401 | Redirect to login |
| Expired JWT on connect | Reject upgrade with 401 | Refresh token, retry |
| No board access | Reject upgrade with 403 | Show access denied |
| Board not found | Reject upgrade with 404 | Show not found |
| Invalid message format | Send error event | Log and ignore |
| DB connection lost | Close all WS, emit error | Reconnect loop |
| Client sends too fast | Rate limit (100 msg/s) | Backoff |
| NOTIFY payload > 8KB | Truncate, send event ID only | Fetch full data via REST |

## Performance Considerations

1. **Connection limits**: Node.js can handle ~10K concurrent WebSocket connections per process. For our scale (50+ users per board), this is more than sufficient.

2. **LISTEN connection**: One dedicated PostgreSQL connection is used for all LISTEN/NOTIFY channels. This connection is outside the pool and never used for queries.

3. **Message batching**: When multiple NOTIFY events arrive within 10ms, they are batched into a single WebSocket frame to reduce overhead.

4. **Cursor throttling**: Server-side throttle limits cursor relay to 20 updates per second per user, preventing network saturation.

5. **Event log cleanup**: The `board_events` table is pruned every hour, keeping only the last 24 hours. This prevents unbounded growth while allowing reconnection recovery.

6. **Memory footprint**: Each ClientConnection is approximately 1KB in memory. 1000 concurrent connections would use ~1MB, well within acceptable limits.

## Module Structure

```
src/ws/
  index.ts              -- WebSocket server setup & upgrade handler
  room-manager.ts       -- Room management (join/leave/broadcast)
  presence-tracker.ts   -- User presence tracking per board
  message-router.ts     -- Incoming message handling & routing
  message-types.ts      -- Type definitions for all WS messages
  notify-listener.ts    -- PostgreSQL LISTEN/NOTIFY integration
  heartbeat.ts          -- Ping/pong heartbeat manager
  event-replay.ts       -- Reconnection event recovery
  throttle.ts           -- Rate limiting for cursor moves
```

## Dependencies

| Dependency | Purpose | Version |
|-----------|---------|---------|
| `ws` | WebSocket server | ^8.x |
| `postgres` (porsager) | LISTEN/NOTIFY connection | ^3.x |
| `jose` | JWT verification during upgrade | ^5.x |

## Related Documents

- [ADR-001: PostgreSQL for Everything](../../decisions/ADR-001-postgresql-for-everything.md)
- [ADR-002: Single Server Monolith](../../decisions/ADR-002-single-server-monolith.md)
- [ADR-003: Tech Stack Selection](../../decisions/ADR-003-tech-stack-selection.md)
- [WebSocket Protocol Spec](specs/api.md)
- [Real-Time Test Plan](specs/tests.md)
