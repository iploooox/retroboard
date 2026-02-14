# Facilitation API Specification

## Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <JWT>
```

## Authorization

Facilitation endpoints require `facilitator` or `admin` role on the board's team. The middleware checks:

1. JWT is valid and not expired
2. User is a member of the team that owns the board
3. User's role is `facilitator` or `admin`

---

## Endpoints

### PUT /api/v1/boards/:id/phase

Set the current phase of the board.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID |

**Request Body:**

```json
{
  "phase": "group"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phase` | string | Yes | Target phase. One of: `write`, `group`, `vote`, `discuss`, `action` |

**Response 200 OK:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "phase": "group",
  "previousPhase": "write",
  "changedBy": "user-001",
  "changedAt": "2026-02-14T10:30:00.000Z",
  "timerStopped": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Board ID |
| `phase` | string | New active phase |
| `previousPhase` | string | Previous phase |
| `changedBy` | UUID | User who changed the phase |
| `changedAt` | ISO 8601 | Timestamp of change |
| `timerStopped` | boolean | Whether a running timer was automatically stopped |

**Side Effects:**
- If a timer is running, it is automatically stopped with reason `phase_change`
- WebSocket event `phase_changed` broadcast to all connected clients
- If timer was stopped, `timer_stopped` event also broadcast
- Event logged in `board_events` table

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Invalid phase value | `{ "error": "INVALID_PHASE", "message": "Phase must be one of: write, group, vote, discuss, action" }` |
| 401 | Missing/invalid token | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | User is not facilitator/admin | `{ "error": "FORBIDDEN", "message": "Only facilitators can change the board phase" }` |
| 404 | Board not found | `{ "error": "NOT_FOUND", "message": "Board not found" }` |

---

### POST /api/v1/boards/:id/timer

Start a countdown timer for the current or specified phase.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID |

**Request Body:**

```json
{
  "phase": "write",
  "durationSeconds": 300
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phase` | string | No | Phase this timer is for. Defaults to current board phase. |
| `durationSeconds` | integer | Yes | Timer duration in seconds. Min: 1, Max: 3600 |

**Response 201 Created:**

```json
{
  "boardId": "550e8400-e29b-41d4-a716-446655440000",
  "phase": "write",
  "durationSeconds": 300,
  "remainingSeconds": 300,
  "startedAt": "2026-02-14T10:30:00.000Z",
  "startedBy": "user-001",
  "isPaused": false
}
```

**Side Effects:**
- Timer row created/updated in `board_timers` table
- Server starts `setInterval` for countdown ticks
- WebSocket event `timer_started` broadcast to all connected clients
- `timer_tick` events broadcast every 1 second

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Duration out of range | `{ "error": "INVALID_DURATION", "message": "Duration must be between 1 and 3600 seconds" }` |
| 400 | Invalid phase value | `{ "error": "INVALID_PHASE", "message": "Phase must be one of: write, group, vote, discuss, action" }` |
| 401 | Missing/invalid token | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not facilitator/admin | `{ "error": "FORBIDDEN", "message": "Only facilitators can control the timer" }` |
| 404 | Board not found | `{ "error": "NOT_FOUND", "message": "Board not found" }` |
| 409 | Timer already running | `{ "error": "TIMER_CONFLICT", "message": "A timer is already running. Stop it first." }` |

---

### PUT /api/v1/boards/:id/timer

Pause or resume the active timer.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID |

**Request Body:**

```json
{
  "action": "pause"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | Either `pause` or `resume` |

**Response 200 OK (pause):**

```json
{
  "boardId": "550e8400-e29b-41d4-a716-446655440000",
  "phase": "write",
  "durationSeconds": 300,
  "remainingSeconds": 187,
  "startedAt": "2026-02-14T10:30:00.000Z",
  "pausedAt": "2026-02-14T10:31:53.000Z",
  "isPaused": true,
  "pausedBy": "user-001"
}
```

**Response 200 OK (resume):**

```json
{
  "boardId": "550e8400-e29b-41d4-a716-446655440000",
  "phase": "write",
  "durationSeconds": 300,
  "remainingSeconds": 187,
  "startedAt": "2026-02-14T10:30:00.000Z",
  "pausedAt": null,
  "isPaused": false,
  "resumedAt": "2026-02-14T10:33:00.000Z",
  "resumedBy": "user-001"
}
```

**Side Effects (pause):**
- `paused_at` and `remaining_seconds` updated in `board_timers`
- Server clears the `setInterval` for this timer
- WebSocket event `timer_paused` broadcast

**Side Effects (resume):**
- `paused_at` set to NULL in `board_timers`
- Server restarts `setInterval` with `remaining_seconds`
- WebSocket event `timer_resumed` broadcast

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Invalid action | `{ "error": "INVALID_ACTION", "message": "Action must be 'pause' or 'resume'" }` |
| 400 | Pause when not running | `{ "error": "TIMER_NOT_RUNNING", "message": "No timer is currently running" }` |
| 400 | Resume when not paused | `{ "error": "TIMER_NOT_PAUSED", "message": "Timer is not paused" }` |
| 401 | Missing/invalid token | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not facilitator/admin | `{ "error": "FORBIDDEN", "message": "Only facilitators can control the timer" }` |
| 404 | Board not found | `{ "error": "NOT_FOUND", "message": "Board not found" }` |

---

### DELETE /api/v1/boards/:id/timer

Stop and remove the active timer.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID |

**Response 200 OK:**

```json
{
  "boardId": "550e8400-e29b-41d4-a716-446655440000",
  "stoppedAt": "2026-02-14T10:35:00.000Z",
  "reason": "manual",
  "remainingSeconds": 120
}
```

| Field | Type | Description |
|-------|------|-------------|
| `boardId` | UUID | Board ID |
| `stoppedAt` | ISO 8601 | When the timer was stopped |
| `reason` | string | Always `manual` for this endpoint |
| `remainingSeconds` | integer | How much time was remaining when stopped |

**Side Effects:**
- Timer row deleted from `board_timers` (or remaining set to 0)
- Server clears the `setInterval`
- WebSocket event `timer_stopped` broadcast with reason `manual`

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing/invalid token | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not facilitator/admin | `{ "error": "FORBIDDEN", "message": "Only facilitators can control the timer" }` |
| 404 | Board or timer not found | `{ "error": "TIMER_NOT_FOUND", "message": "No timer exists for this board" }` |

---

### PUT /api/v1/boards/:id/lock

Lock or unlock the board.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID |

**Request Body:**

```json
{
  "isLocked": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `isLocked` | boolean | Yes | `true` to lock, `false` to unlock |

**Response 200 OK:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "isLocked": true,
  "lockedBy": "user-001",
  "lockedAt": "2026-02-14T11:00:00.000Z"
}
```

When unlocking:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "isLocked": false,
  "unlockedBy": "user-001",
  "unlockedAt": "2026-02-14T11:10:00.000Z"
}
```

**Side Effects:**
- `is_locked` updated in `boards` table
- WebSocket event `board_locked` or `board_unlocked` broadcast
- When locked: all non-facilitator write operations return 403

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Missing isLocked field | `{ "error": "INVALID_REQUEST", "message": "isLocked is required" }` |
| 401 | Missing/invalid token | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not facilitator/admin | `{ "error": "FORBIDDEN", "message": "Only facilitators can lock/unlock the board" }` |
| 404 | Board not found | `{ "error": "NOT_FOUND", "message": "Board not found" }` |

---

### PUT /api/v1/boards/:id/reveal

Reveal authors of anonymous cards.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID |

**Request Body:** None required.

**Response 200 OK:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "cardsRevealed": true,
  "revealedBy": "user-001",
  "revealedAt": "2026-02-14T11:05:00.000Z",
  "revealedCards": [
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
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Board ID |
| `cardsRevealed` | boolean | Always `true` after this call |
| `revealedBy` | UUID | User who triggered reveal |
| `revealedAt` | ISO 8601 | Timestamp |
| `revealedCards` | array | List of cards with their now-visible author info |

**Side Effects:**
- `cards_revealed` set to `true` in `boards` table
- WebSocket event `cards_revealed` broadcast with full card-to-author mapping
- Subsequent card API responses include author info

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Board not in anonymous mode | `{ "error": "NOT_ANONYMOUS", "message": "Board is not in anonymous mode" }` |
| 400 | Cards already revealed | `{ "error": "ALREADY_REVEALED", "message": "Cards have already been revealed" }` |
| 401 | Missing/invalid token | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not facilitator/admin | `{ "error": "FORBIDDEN", "message": "Only facilitators can reveal cards" }` |
| 404 | Board not found | `{ "error": "NOT_FOUND", "message": "Board not found" }` |

---

### PUT /api/v1/boards/:id/focus

Set or clear the discussion focus on a card or group.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID |

**Request Body (set focus):**

```json
{
  "focusType": "card",
  "focusId": "card-001"
}
```

**Request Body (clear focus):**

```json
{
  "focusType": null,
  "focusId": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `focusType` | string or null | Yes | `card`, `group`, or `null` to clear |
| `focusId` | UUID or null | Yes | ID of the card or group to focus, `null` to clear |

**Response 200 OK (set):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "focusType": "card",
  "focusId": "card-001",
  "focusTitle": "Great team collaboration this sprint",
  "focusVoteCount": 5,
  "changedBy": "user-001",
  "changedAt": "2026-02-14T11:05:00.000Z"
}
```

**Response 200 OK (clear):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "focusType": null,
  "focusId": null,
  "focusTitle": null,
  "focusVoteCount": null,
  "changedBy": "user-001",
  "changedAt": "2026-02-14T11:10:00.000Z"
}
```

**Side Effects:**
- `focus_type` and `focus_id` updated in `boards` table
- WebSocket event `focus_changed` broadcast to all connected clients
- Clients auto-scroll the focused item into view and highlight it

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | focusType is card but focusId missing | `{ "error": "INVALID_REQUEST", "message": "focusId is required when focusType is set" }` |
| 400 | focusType not card/group/null | `{ "error": "INVALID_FOCUS_TYPE", "message": "focusType must be 'card', 'group', or null" }` |
| 401 | Missing/invalid token | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not facilitator/admin | `{ "error": "FORBIDDEN", "message": "Only facilitators can set discussion focus" }` |
| 404 | Board not found | `{ "error": "NOT_FOUND", "message": "Board not found" }` |
| 404 | Focus target not found | `{ "error": "FOCUS_TARGET_NOT_FOUND", "message": "Card or group not found on this board" }` |

---

### GET /api/v1/boards/:id/timer

Get the current timer state for a board (available to all authenticated team members).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID |

**Response 200 OK (timer active):**

```json
{
  "boardId": "550e8400-e29b-41d4-a716-446655440000",
  "phase": "write",
  "durationSeconds": 300,
  "remainingSeconds": 187,
  "startedAt": "2026-02-14T10:30:00.000Z",
  "pausedAt": null,
  "isPaused": false,
  "startedBy": "user-001"
}
```

**Response 200 OK (no timer):**

```json
{
  "boardId": "550e8400-e29b-41d4-a716-446655440000",
  "timer": null
}
```

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing/invalid token | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not a team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Board not found | `{ "error": "NOT_FOUND", "message": "Board not found" }` |
