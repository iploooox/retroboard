# API Reference

All endpoints are prefixed with `/api/v1`. Authentication uses `Authorization: Bearer <access_token>` unless noted otherwise.

## Authentication

### Register

```
POST /auth/register
```

Create a new user account.

**Body:**
```json
{
  "email": "alice@example.com",
  "password": "securePassword123",
  "displayName": "Alice"
}
```

**Response** `201`:
```json
{
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "displayName": "Alice",
    "avatarUrl": null,
    "createdAt": "2026-02-18T10:00:00Z"
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### Login

```
POST /auth/login
```

**Body:**
```json
{
  "email": "alice@example.com",
  "password": "securePassword123"
}
```

**Response** `200`: Same shape as register response.

Rate limited: 30/min per IP, 5/15min per email.

### Refresh Token

```
POST /auth/refresh
```

**Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response** `200`:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

The old refresh token is revoked. If a revoked token is reused, all user sessions are invalidated (theft detection).

### Logout

```
POST /auth/logout
```

**Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response** `200`

### Get Profile

```
GET /auth/me
```

**Response** `200`:
```json
{
  "id": "uuid",
  "email": "alice@example.com",
  "displayName": "Alice",
  "avatarUrl": null,
  "createdAt": "2026-02-18T10:00:00Z"
}
```

### Update Profile

```
PUT /auth/me
```

**Body:**
```json
{
  "displayName": "Alice W.",
  "avatarUrl": "https://example.com/avatar.png"
}
```

---

## Teams

### Create Team

```
POST /teams
```

**Body:**
```json
{
  "name": "Engineering Squad",
  "description": "Backend team retros"
}
```

**Response** `201`: Team object with your membership as `admin`.

### List Teams

```
GET /teams
```

**Response** `200`: Array of teams the authenticated user belongs to.

### Get Team

```
GET /teams/:teamId
```

**Response** `200`: Team details including member count.

### Update Team

```
PUT /teams/:teamId
```

Requires `admin` role.

**Body** (all fields optional):
```json
{
  "name": "New Name",
  "description": "Updated description",
  "theme": "ocean"
}
```

Available themes: `default`, `ocean`, `sunset`, `forest`, `midnight`, `lavender`, `coral`, `monochrome`.

### Create Invitation

```
POST /teams/:teamId/invitations
```

Requires `admin` role. Generates a single-use invite code (expires in 7 days).

**Response** `201`:
```json
{
  "code": "abc123",
  "expiresAt": "2026-02-25T10:00:00Z"
}
```

### Join Team

```
POST /teams/:teamId/join
```

**Body:**
```json
{
  "code": "abc123"
}
```

**Response** `200`: Team membership created as `member`.

### Change Member Role

```
PATCH /teams/:teamId/members/:userId
```

Requires `admin` role.

**Body:**
```json
{
  "role": "facilitator"
}
```

Roles: `admin`, `facilitator`, `member`.

### Remove Member

```
DELETE /teams/:teamId/members/:userId
```

Requires `admin` role. Cannot remove yourself.

---

## Sprints

### Create Sprint

```
POST /teams/:teamId/sprints
```

**Body:**
```json
{
  "goal": "Improve CI pipeline speed",
  "status": "active",
  "startDate": "2026-02-10",
  "endDate": "2026-02-24"
}
```

Status: `upcoming`, `active`, `completed`.

### List Sprints

```
GET /teams/:teamId/sprints
```

**Query params:** `status` (optional filter), `page`, `limit`.

### Get Sprint

```
GET /teams/:teamId/sprints/:sprintId
```

### Update Sprint

```
PATCH /teams/:teamId/sprints/:sprintId
```

---

## Boards

### Create Board

```
POST /sprints/:sprintId/board
```

**Body:**
```json
{
  "templateId": "00000000-0000-4000-8000-000000000002"
}
```

Creates a board with columns from the chosen template. One board per sprint.

### Get Board

```
GET /boards/:boardId
```

**Response** `200`: Full board state including columns, cards (with vote counts), groups, and board settings.

### Update Board Phase

```
PATCH /boards/:boardId/phase
```

Requires `facilitator` or `admin` role.

**Body:**
```json
{
  "phase": "vote"
}
```

Phases in order: `icebreaker`, `write`, `group`, `vote`, `discuss`, `action`.

### Set Focus Item

```
PATCH /boards/:boardId/focus
```

**Body:**
```json
{
  "focusItemId": "card-or-group-uuid",
  "focusItemType": "card"
}
```

Type: `card` or `group`. Set `focusItemId` to `null` to clear focus.

---

## Cards

### Create Card

```
POST /boards/:boardId/cards
```

**Body:**
```json
{
  "columnId": "column-uuid",
  "content": "Deploy pipeline took 45 minutes"
}
```

### Update Card

```
PATCH /boards/:boardId/cards/:cardId
```

Only the card author or a facilitator can edit.

**Body:**
```json
{
  "content": "Updated card text"
}
```

### Delete Card

```
DELETE /boards/:boardId/cards/:cardId
```

Only the card author or a facilitator can delete.

### Vote on Card

```
POST /boards/:boardId/cards/:cardId/vote
```

No body required. Respects the board's `maxVotesPerUser` setting.

### Remove Vote

```
DELETE /boards/:boardId/cards/:cardId/vote
```

### Add Reaction

```
POST /cards/:cardId/reactions
```

**Body:**
```json
{
  "emoji": "thumbsup"
}
```

Supported emojis: `thumbsup`, `heart`, `fire`, `party`, `thinking`, `eyes`, `rocket`, `clap`. Calling again with the same emoji removes it (toggle).

---

## Card Groups

### Create Group

```
POST /boards/:boardId/groups
```

**Body:**
```json
{
  "title": "CI/CD Issues",
  "cardIds": ["card-uuid-1", "card-uuid-2"]
}
```

### Update Group

```
PUT /boards/:boardId/groups/:groupId
```

**Body:**
```json
{
  "title": "Renamed Group"
}
```

### Delete Group

```
DELETE /boards/:boardId/groups/:groupId
```

Cards are ungrouped, not deleted.

### Add Card to Group

```
POST /boards/:boardId/groups/:groupId/cards
```

**Body:**
```json
{
  "cardId": "card-uuid"
}
```

### Remove Card from Group

```
DELETE /boards/:boardId/groups/:groupId/cards/:cardId
```

---

## Timer

All timer endpoints require `facilitator` or `admin` role.

### Start Timer

```
POST /boards/:boardId/timer/start
```

**Body:**
```json
{
  "duration": 300
}
```

Duration in seconds. Broadcasts `timer_started` via WebSocket.

### Pause Timer

```
POST /boards/:boardId/timer/pause
```

### Resume Timer

```
POST /boards/:boardId/timer/resume
```

### Stop Timer

```
POST /boards/:boardId/timer/stop
```

---

## Action Items

### Create Action Item

```
POST /boards/:boardId/action-items
```

**Body:**
```json
{
  "title": "Set up parallel CI jobs",
  "assigneeId": "user-uuid",
  "dueDate": "2026-03-01"
}
```

### List Action Items

```
GET /boards/:boardId/action-items
```

### Update Action Item

```
PATCH /action-items/:actionItemId
```

**Body** (all optional):
```json
{
  "title": "Updated title",
  "assigneeId": "user-uuid",
  "dueDate": "2026-03-15",
  "status": "in_progress"
}
```

Status: `open`, `in_progress`, `done`.

### Delete Action Item

```
DELETE /action-items/:actionItemId
```

### Carry Over Action Items

```
POST /boards/:boardId/action-items/carry-over
```

Copies all unresolved action items from the previous sprint's board into this board. Items keep their title, assignee, and due date.

---

## Analytics

### Health Trend

```
GET /teams/:teamId/analytics/health
```

Returns sentiment-based health scores per sprint (materialized view).

### Participation

```
GET /teams/:teamId/analytics/participation
```

Returns per-member contribution metrics (cards written, votes cast).

---

## Export

### Export Board

```
GET /boards/:boardId/export?format=json
```

Formats: `json`, `markdown`, `html`.

Returns the full board state in the requested format — columns, cards (sorted by votes), groups, action items.

---

## Icebreakers

### Get Random Icebreaker

```
GET /icebreakers/random?teamId=uuid
```

**Query params:**
- `teamId` (required) — avoids repeating recently used questions
- `category` (optional) — filter by category
- `boardId` (optional) — associates question with a board

Categories: `fun`, `team-building`, `reflective`, `creative`, `quick`.

---

## WebSocket

### Connection

```
ws://host:port/ws?token=JWT&boardId=UUID
```

Optional: `&lastEventId=UUID` for event replay on reconnect.

### Client → Server Messages

| Type | Payload | Description |
|------|---------|-------------|
| `ping` | — | Heartbeat (server responds with `pong`) |
| `cursor_move` | `{ x, y }` | Cursor position update |

### Server → Client Events

| Event | Description |
|-------|-------------|
| `presence_state` | Initial list of connected users (sent on join) |
| `user_joined` / `user_left` | Presence changes |
| `cursor_move` | Another user's cursor position |
| `card_created` / `card_updated` / `card_deleted` | Card changes |
| `vote_added` / `vote_removed` | Vote changes |
| `group_created` / `group_updated` / `group_deleted` | Group changes |
| `card_grouped` / `card_ungrouped` | Card-group membership |
| `phase_changed` | Board phase transition |
| `board_locked` / `board_unlocked` | Lock state |
| `cards_revealed` | Anonymous cards revealed |
| `focus_changed` | Discussion focus item |
| `timer_started` / `timer_paused` / `timer_resumed` / `timer_stopped` | Timer lifecycle |
| `action_item_created` / `action_item_updated` / `action_item_deleted` | Action items |
| `event_replay` | Batch of missed events (reconnection) |
| `error` | Error message |
