# Real-Time WebSocket Protocol Specification

## Connection

### Endpoint

```
ws://host/ws?token=<JWT>&boardId=<UUID>&lastEventId=<UUID?>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `token` | Yes | Valid JWT access token |
| `boardId` | Yes | UUID of the board to join |
| `lastEventId` | No | Last received event ID for reconnection recovery |

### Upgrade Request

```http
GET /ws?token=eyJhbGciOiJIUzI1NiIs...&boardId=550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Host: localhost:3000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Version: 13
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
```

### Upgrade Response (Success)

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

### Upgrade Response (Errors)

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 401 | Missing/invalid/expired JWT | `{ "error": "unauthorized", "message": "Invalid or expired token" }` |
| 403 | User not a member of the board's team | `{ "error": "forbidden", "message": "Access denied to this board" }` |
| 404 | Board does not exist | `{ "error": "not_found", "message": "Board not found" }` |
| 400 | Missing boardId parameter | `{ "error": "bad_request", "message": "boardId is required" }` |

## Message Format

All messages (both directions) use JSON with this envelope:

```typescript
interface WebSocketMessage {
  type: string;             // message type identifier
  payload: object;          // type-specific data
  timestamp: string;        // ISO 8601 timestamp (server time)
  eventId: string;          // unique event ID (UUID), used for reconnection
}
```

Example:

```json
{
  "type": "card_created",
  "payload": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "columnId": "col-001",
    "text": "Great team collaboration this sprint",
    "authorId": "user-123",
    "authorName": "Alice",
    "isAnonymous": false,
    "position": 3,
    "createdAt": "2026-02-14T10:30:00.000Z"
  },
  "timestamp": "2026-02-14T10:30:00.123Z",
  "eventId": "evt-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

## Client-to-Server Messages

### `ping`

Heartbeat keepalive. Client must send at least once every 25 seconds.

```json
{
  "type": "ping"
}
```

Server responds with:

```json
{
  "type": "pong",
  "timestamp": "2026-02-14T10:30:00.000Z",
  "eventId": ""
}
```

### `join_board`

Join a board room. Sent automatically on connection, but can also be used to switch boards without reconnecting.

```json
{
  "type": "join_board",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "lastEventId": "evt-042"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `payload.boardId` | UUID | Yes | Board to join |
| `payload.lastEventId` | UUID | No | Last received event ID for recovery |

Server response: `presence_state` to joining client, `user_joined` broadcast to other clients. If `lastEventId` is provided, server sends `event_replay` before `presence_state`.

### `leave_board`

Leave the current board room without disconnecting.

```json
{
  "type": "leave_board",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `payload.boardId` | UUID | Yes | Board to leave |

Server broadcasts `user_left` to remaining clients.

### `cursor_move`

Update the client's cursor position on the board canvas.

```json
{
  "type": "cursor_move",
  "payload": {
    "x": 450,
    "y": 230
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `payload.x` | number | Yes | X coordinate (relative to board canvas origin) |
| `payload.y` | number | Yes | Y coordinate (relative to board canvas origin) |

Server relays to other clients in the room with added user info. Throttled to max 20 relays per second per user.

---

## Server-to-Client Messages

### `presence_state`

Full list of currently connected users. Sent once on join/reconnect.

```json
{
  "type": "presence_state",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "users": [
      {
        "userId": "user-001",
        "userName": "Alice Chen",
        "userAvatar": "https://example.com/avatars/alice.jpg",
        "connectedAt": "2026-02-14T10:15:00.000Z",
        "cursorPosition": { "x": 120, "y": 340 }
      },
      {
        "userId": "user-002",
        "userName": "Bob Martinez",
        "userAvatar": "https://example.com/avatars/bob.jpg",
        "connectedAt": "2026-02-14T10:20:00.000Z",
        "cursorPosition": null
      }
    ]
  },
  "timestamp": "2026-02-14T10:30:00.000Z",
  "eventId": ""
}
```

### `user_joined`

A new user connected to the board.

```json
{
  "type": "user_joined",
  "payload": {
    "userId": "user-003",
    "userName": "Charlie Kim",
    "userAvatar": "https://example.com/avatars/charlie.jpg",
    "connectedAt": "2026-02-14T10:30:00.000Z"
  },
  "timestamp": "2026-02-14T10:30:00.000Z",
  "eventId": "evt-join-003"
}
```

### `user_left`

A user disconnected from the board.

```json
{
  "type": "user_left",
  "payload": {
    "userId": "user-003",
    "userName": "Charlie Kim"
  },
  "timestamp": "2026-02-14T10:45:00.000Z",
  "eventId": "evt-leave-003"
}
```

### `card_created`

A new card was added to the board.

```json
{
  "type": "card_created",
  "payload": {
    "id": "card-001",
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "columnId": "col-went-well",
    "text": "Great team collaboration this sprint",
    "authorId": "user-001",
    "authorName": "Alice Chen",
    "isAnonymous": false,
    "position": 3,
    "groupId": null,
    "voteCount": 0,
    "createdAt": "2026-02-14T10:30:00.000Z"
  },
  "timestamp": "2026-02-14T10:30:00.123Z",
  "eventId": "evt-c001"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Card ID |
| `boardId` | UUID | Board this card belongs to |
| `columnId` | UUID | Column the card is in |
| `text` | string | Card text content |
| `authorId` | UUID | Author user ID (null if anonymous and not revealed) |
| `authorName` | string | Author display name (null if anonymous and not revealed) |
| `isAnonymous` | boolean | Whether the card was submitted anonymously |
| `position` | number | Sort position within column |
| `groupId` | UUID or null | Group this card belongs to |
| `voteCount` | number | Number of votes |
| `createdAt` | ISO 8601 | Creation timestamp |

Note: When `isAnonymous` is true and cards are not yet revealed, `authorId` and `authorName` are `null` in the payload for all users except the author themselves.

### `card_updated`

A card was modified (text, position, group assignment).

```json
{
  "type": "card_updated",
  "payload": {
    "id": "card-001",
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "columnId": "col-went-well",
    "text": "Great team collaboration and communication this sprint",
    "position": 2,
    "groupId": "group-001",
    "updatedBy": "user-001",
    "updatedAt": "2026-02-14T10:35:00.000Z"
  },
  "timestamp": "2026-02-14T10:35:00.123Z",
  "eventId": "evt-c002"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Card ID |
| `boardId` | UUID | Board this card belongs to |
| `columnId` | UUID | Column (may have changed if moved) |
| `text` | string | Updated text |
| `position` | number | Updated sort position |
| `groupId` | UUID or null | Updated group assignment |
| `updatedBy` | UUID | User who made the change |
| `updatedAt` | ISO 8601 | Update timestamp |

### `card_deleted`

A card was removed from the board.

```json
{
  "type": "card_deleted",
  "payload": {
    "id": "card-001",
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "columnId": "col-went-well",
    "deletedBy": "user-001"
  },
  "timestamp": "2026-02-14T10:40:00.000Z",
  "eventId": "evt-c003"
}
```

### `vote_added`

A user voted on a card.

```json
{
  "type": "vote_added",
  "payload": {
    "cardId": "card-001",
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-002",
    "voteCount": 4,
    "userRemainingVotes": 2
  },
  "timestamp": "2026-02-14T10:42:00.000Z",
  "eventId": "evt-v001"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `cardId` | UUID | Card that was voted on |
| `boardId` | UUID | Board ID |
| `userId` | UUID | User who voted |
| `voteCount` | number | New total vote count for this card |
| `userRemainingVotes` | number | Remaining votes for the voting user |

### `vote_removed`

A user removed their vote from a card.

```json
{
  "type": "vote_removed",
  "payload": {
    "cardId": "card-001",
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-002",
    "voteCount": 3,
    "userRemainingVotes": 3
  },
  "timestamp": "2026-02-14T10:43:00.000Z",
  "eventId": "evt-v002"
}
```

### `group_created`

A new card group was created.

```json
{
  "type": "group_created",
  "payload": {
    "id": "group-001",
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "columnId": "col-went-well",
    "title": "Communication Wins",
    "cardIds": ["card-001", "card-005"],
    "position": 1,
    "createdBy": "user-001",
    "createdAt": "2026-02-14T10:50:00.000Z"
  },
  "timestamp": "2026-02-14T10:50:00.123Z",
  "eventId": "evt-g001"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Group ID |
| `boardId` | UUID | Board ID |
| `columnId` | UUID | Column the group belongs to |
| `title` | string | Group title |
| `cardIds` | UUID[] | Cards in this group |
| `position` | number | Sort position within column |
| `createdBy` | UUID | User who created the group |
| `createdAt` | ISO 8601 | Creation timestamp |

### `group_updated`

A group was modified (title changed, cards added/removed).

```json
{
  "type": "group_updated",
  "payload": {
    "id": "group-001",
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Communication & Collaboration Wins",
    "cardIds": ["card-001", "card-005", "card-008"],
    "position": 1,
    "updatedBy": "user-001",
    "updatedAt": "2026-02-14T10:55:00.000Z"
  },
  "timestamp": "2026-02-14T10:55:00.123Z",
  "eventId": "evt-g002"
}
```

### `phase_changed`

The board phase was advanced by the facilitator.

```json
{
  "type": "phase_changed",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "previousPhase": "write",
    "currentPhase": "group",
    "changedBy": "user-001",
    "changedAt": "2026-02-14T11:00:00.000Z"
  },
  "timestamp": "2026-02-14T11:00:00.123Z",
  "eventId": "evt-p001"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `boardId` | UUID | Board ID |
| `previousPhase` | enum | Phase before change: `write`, `group`, `vote`, `discuss`, `action` |
| `currentPhase` | enum | New active phase |
| `changedBy` | UUID | Facilitator who changed phase |
| `changedAt` | ISO 8601 | Timestamp of change |

### `focus_changed`

The facilitator set or cleared the discussion focus.

```json
{
  "type": "focus_changed",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "focusType": "card",
    "focusId": "card-001",
    "focusTitle": "Great team collaboration this sprint",
    "changedBy": "user-001"
  },
  "timestamp": "2026-02-14T11:05:00.000Z",
  "eventId": "evt-f001"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `boardId` | UUID | Board ID |
| `focusType` | enum | `card`, `group`, or `null` (clear focus) |
| `focusId` | UUID or null | ID of focused card/group, null to clear |
| `focusTitle` | string or null | Display title of focused item |
| `changedBy` | UUID | Facilitator who set focus |

### `cursor_move`

Another user's cursor position. High frequency, no eventId.

```json
{
  "type": "cursor_move",
  "payload": {
    "userId": "user-002",
    "userName": "Bob Martinez",
    "x": 450,
    "y": 230
  },
  "timestamp": "2026-02-14T10:30:00.050Z",
  "eventId": ""
}
```

### `timer_started`

The facilitator started a countdown timer.

```json
{
  "type": "timer_started",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "phase": "write",
    "durationSeconds": 300,
    "remainingSeconds": 300,
    "startedAt": "2026-02-14T10:30:00.000Z",
    "startedBy": "user-001"
  },
  "timestamp": "2026-02-14T10:30:00.123Z",
  "eventId": "evt-t001"
}
```

### `timer_paused`

The timer was paused.

```json
{
  "type": "timer_paused",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "remainingSeconds": 187,
    "pausedAt": "2026-02-14T10:31:53.000Z",
    "pausedBy": "user-001"
  },
  "timestamp": "2026-02-14T10:31:53.123Z",
  "eventId": "evt-t002"
}
```

### `timer_resumed`

The timer was resumed after a pause.

```json
{
  "type": "timer_resumed",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "remainingSeconds": 187,
    "resumedAt": "2026-02-14T10:33:00.000Z",
    "resumedBy": "user-001"
  },
  "timestamp": "2026-02-14T10:33:00.123Z",
  "eventId": "evt-t003"
}
```

### `timer_stopped`

The timer was stopped or expired.

```json
{
  "type": "timer_stopped",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "reason": "expired",
    "stoppedAt": "2026-02-14T10:35:00.000Z"
  },
  "timestamp": "2026-02-14T10:35:00.123Z",
  "eventId": "evt-t004"
}
```

| `reason` values | Description |
|-----------------|-------------|
| `expired` | Timer reached zero |
| `manual` | Facilitator stopped the timer |
| `phase_change` | Phase changed, timer auto-stopped |

### `timer_tick`

Periodic timer countdown update. Sent every 1 second while timer is running.

```json
{
  "type": "timer_tick",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "remainingSeconds": 245
  },
  "timestamp": "2026-02-14T10:30:55.000Z",
  "eventId": ""
}
```

### `board_locked`

The board was locked by the facilitator.

```json
{
  "type": "board_locked",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "lockedBy": "user-001",
    "lockedAt": "2026-02-14T11:00:00.000Z"
  },
  "timestamp": "2026-02-14T11:00:00.123Z",
  "eventId": "evt-l001"
}
```

### `board_unlocked`

The board was unlocked by the facilitator.

```json
{
  "type": "board_unlocked",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "unlockedBy": "user-001",
    "unlockedAt": "2026-02-14T11:10:00.000Z"
  },
  "timestamp": "2026-02-14T11:10:00.123Z",
  "eventId": "evt-l002"
}
```

### `cards_revealed`

Anonymous cards were revealed by the facilitator.

```json
{
  "type": "cards_revealed",
  "payload": {
    "boardId": "550e8400-e29b-41d4-a716-446655440000",
    "revealedBy": "user-001",
    "revealedAt": "2026-02-14T11:05:00.000Z",
    "cards": [
      {
        "cardId": "card-001",
        "authorId": "user-002",
        "authorName": "Bob Martinez"
      },
      {
        "cardId": "card-003",
        "authorId": "user-003",
        "authorName": "Charlie Kim"
      }
    ]
  },
  "timestamp": "2026-02-14T11:05:00.123Z",
  "eventId": "evt-r001"
}
```

### `event_replay`

Missed events sent on reconnection. Contains an array of events that occurred while the client was disconnected.

```json
{
  "type": "event_replay",
  "payload": {
    "fromEventId": "evt-042",
    "events": [
      {
        "type": "card_created",
        "payload": { "..." : "..." },
        "timestamp": "2026-02-14T10:31:00.000Z",
        "eventId": "evt-043"
      },
      {
        "type": "vote_added",
        "payload": { "..." : "..." },
        "timestamp": "2026-02-14T10:31:05.000Z",
        "eventId": "evt-044"
      }
    ],
    "hasMore": false
  },
  "timestamp": "2026-02-14T10:35:00.000Z",
  "eventId": ""
}
```

| Field | Type | Description |
|-------|------|-------------|
| `fromEventId` | UUID | The lastEventId the client provided |
| `events` | array | Ordered list of missed events |
| `hasMore` | boolean | If true, more events exist (paginate with next lastEventId) |

Maximum of 100 events per replay message. If more exist, `hasMore` is true and the client should use the last event's `eventId` as `lastEventId` in a subsequent `join_board`.

### `error`

Error message from the server.

```json
{
  "type": "error",
  "payload": {
    "code": "RATE_LIMITED",
    "message": "Too many messages, slow down",
    "retryAfterMs": 1000
  },
  "timestamp": "2026-02-14T10:30:00.000Z",
  "eventId": ""
}
```

| Error Code | Description |
|-----------|-------------|
| `RATE_LIMITED` | Client sending messages too fast |
| `INVALID_MESSAGE` | Message format is invalid |
| `UNAUTHORIZED` | Token expired mid-session |
| `FORBIDDEN` | Action not allowed (e.g., board locked) |
| `NOT_FOUND` | Referenced entity not found |
| `INTERNAL_ERROR` | Server error |

---

## Rate Limits

| Message Type | Limit |
|-------------|-------|
| `cursor_move` | 20 per second |
| `ping` | 1 per 10 seconds |
| All other messages | 100 per minute |
| Total messages | 200 per minute |

Exceeding limits results in an `error` message with code `RATE_LIMITED`. Repeated violations (3 within 1 minute) result in connection termination.

---

## Connection Lifecycle

```
1. Client opens WebSocket connection
   GET /ws?token=JWT&boardId=UUID

2. Server authenticates and upgrades
   101 Switching Protocols

3. If lastEventId provided:
   Server sends: event_replay

4. Server sends: presence_state (current users)
   Server broadcasts: user_joined (to other clients)

5. Normal operation:
   Client sends: ping (every 25s), cursor_move
   Server sends: board events as they occur

6. On disconnect:
   Server removes client from room
   Server broadcasts: user_left (if last connection for user)

7. On reconnect:
   Client provides lastEventId
   Server sends missed events, then resumes normal flow
```

---

## TypeScript Type Definitions

```typescript
// Message envelope
interface WSMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
  eventId: string;
}

// Client-to-server message types
type ClientMessage =
  | { type: 'ping' }
  | { type: 'join_board'; payload: { boardId: string; lastEventId?: string } }
  | { type: 'leave_board'; payload: { boardId: string } }
  | { type: 'cursor_move'; payload: { x: number; y: number } };

// Server-to-client message types
type ServerMessage =
  | WSMessage<PresenceStatePayload>
  | WSMessage<UserJoinedPayload>
  | WSMessage<UserLeftPayload>
  | WSMessage<CardCreatedPayload>
  | WSMessage<CardUpdatedPayload>
  | WSMessage<CardDeletedPayload>
  | WSMessage<VoteAddedPayload>
  | WSMessage<VoteRemovedPayload>
  | WSMessage<GroupCreatedPayload>
  | WSMessage<GroupUpdatedPayload>
  | WSMessage<PhaseChangedPayload>
  | WSMessage<FocusChangedPayload>
  | WSMessage<CursorMovePayload>
  | WSMessage<TimerStartedPayload>
  | WSMessage<TimerPausedPayload>
  | WSMessage<TimerResumedPayload>
  | WSMessage<TimerStoppedPayload>
  | WSMessage<TimerTickPayload>
  | WSMessage<BoardLockedPayload>
  | WSMessage<BoardUnlockedPayload>
  | WSMessage<CardsRevealedPayload>
  | WSMessage<EventReplayPayload>
  | WSMessage<ErrorPayload>;

// Phase enum
type BoardPhase = 'write' | 'group' | 'vote' | 'discuss' | 'action';

// Timer stop reason
type TimerStopReason = 'expired' | 'manual' | 'phase_change';

// Focus type
type FocusType = 'card' | 'group' | null;

// Error codes
type WSErrorCode =
  | 'RATE_LIMITED'
  | 'INVALID_MESSAGE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';
```
