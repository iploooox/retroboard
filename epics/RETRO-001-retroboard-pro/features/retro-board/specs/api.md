# Retro Board — API Specification

## Base URL

All endpoints are prefixed with `/api/v1`. All requests require a valid JWT in the `Authorization: Bearer <token>` header.

## Common Response Envelope

All responses follow a consistent envelope:

```json
// Success
{
  "ok": true,
  "data": { ... }
}

// Error
{
  "ok": false,
  "error": {
    "code": "BOARD_NOT_FOUND",
    "message": "Board not found for this sprint"
  }
}
```

## Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | User lacks permission for this action |
| `BOARD_NOT_FOUND` | 404 | Board does not exist |
| `CARD_NOT_FOUND` | 404 | Card does not exist |
| `GROUP_NOT_FOUND` | 404 | Group does not exist |
| `SPRINT_NOT_FOUND` | 404 | Sprint does not exist |
| `BOARD_ALREADY_EXISTS` | 409 | Sprint already has a board |
| `INVALID_PHASE` | 422 | Action not allowed in current phase |
| `VOTE_LIMIT_REACHED` | 422 | User has reached max votes per board or per card |
| `VALIDATION_ERROR` | 422 | Request body failed validation |

---

## 1. Create Board

Creates a new retro board for a sprint.

**Endpoint:** `POST /api/v1/sprints/:sprintId/board`

**Authorization:** Team admin or facilitator

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| sprintId | uuid | The sprint to create a board for |

**Request Body:**

```json
{
  "template_id": "uuid",
  "anonymous_mode": false,
  "max_votes_per_user": 5,
  "max_votes_per_card": 3
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| template_id | uuid | Yes | — | Template to use for column configuration |
| anonymous_mode | boolean | No | false | Whether card authors are hidden |
| max_votes_per_user | integer | No | 5 | Max total votes per user on this board |
| max_votes_per_card | integer | No | 3 | Max votes per user on a single card |

**Response:** `201 Created`

```json
{
  "ok": true,
  "data": {
    "id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "sprint_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "template_id": "t1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "phase": "write",
    "anonymous_mode": false,
    "max_votes_per_user": 5,
    "max_votes_per_card": 3,
    "focus_item_id": null,
    "focus_item_type": null,
    "created_by": "u1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:00:00.000Z",
    "updated_at": "2026-02-14T10:00:00.000Z",
    "columns": [
      {
        "id": "c1a2c3d4-e5f6-7890-abcd-ef1234567890",
        "board_id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "What Went Well",
        "color": "#22c55e",
        "position": 0,
        "created_at": "2026-02-14T10:00:00.000Z"
      },
      {
        "id": "c2a2c3d4-e5f6-7890-abcd-ef1234567890",
        "board_id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "What Could Be Improved",
        "color": "#ef4444",
        "position": 1,
        "created_at": "2026-02-14T10:00:00.000Z"
      }
    ]
  }
}
```

**Errors:**
- `409 BOARD_ALREADY_EXISTS` — Sprint already has a board
- `404 SPRINT_NOT_FOUND` — Sprint does not exist
- `403 FORBIDDEN` — User is not admin or facilitator
- `422 VALIDATION_ERROR` — Invalid template_id or settings values

---

## 2. Get Board

Retrieves the full board with all columns, cards, votes, and groups.

**Endpoint:** `GET /api/v1/sprints/:sprintId/board`

**Authorization:** Team member

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| sprintId | uuid | The sprint whose board to retrieve |

**Query Parameters:**

None.

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "sprint_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "template_id": "t1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "phase": "write",
    "anonymous_mode": false,
    "max_votes_per_user": 5,
    "max_votes_per_card": 3,
    "focus_item_id": null,
    "focus_item_type": null,
    "created_by": "u1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:00:00.000Z",
    "updated_at": "2026-02-14T10:00:00.000Z",
    "columns": [
      {
        "id": "c1a2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "What Went Well",
        "color": "#22c55e",
        "position": 0,
        "cards": [
          {
            "id": "card-1",
            "column_id": "c1a2c3d4-e5f6-7890-abcd-ef1234567890",
            "content": "Great team communication this sprint",
            "author_id": "u1a2c3d4-e5f6-7890-abcd-ef1234567890",
            "author_name": "Alice Johnson",
            "position": 0,
            "vote_count": 3,
            "user_votes": 1,
            "group_id": null,
            "created_at": "2026-02-14T10:05:00.000Z",
            "updated_at": "2026-02-14T10:05:00.000Z"
          }
        ]
      },
      {
        "id": "c2a2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "What Could Be Improved",
        "color": "#ef4444",
        "position": 1,
        "cards": []
      }
    ],
    "groups": [
      {
        "id": "g1a2c3d4-e5f6-7890-abcd-ef1234567890",
        "title": "Communication Issues",
        "position": 0,
        "card_ids": ["card-5", "card-8", "card-12"],
        "total_votes": 7,
        "created_at": "2026-02-14T10:30:00.000Z"
      }
    ],
    "user_votes_remaining": 3,
    "user_total_votes_cast": 2
  }
}
```

**Notes:**
- When `anonymous_mode` is `true`, `author_id` and `author_name` are omitted from cards (returned as `null`) for non-admin/non-facilitator users.
- `user_votes` on each card reflects how many times the current authenticated user voted on that specific card.
- `user_votes_remaining` and `user_total_votes_cast` are computed for the authenticated user.
- Cards that belong to a group include `group_id` referencing the group.

**Errors:**
- `404 BOARD_NOT_FOUND` — No board for this sprint
- `404 SPRINT_NOT_FOUND` — Sprint does not exist

---

## 3. Update Board Settings

Updates board-level settings.

**Endpoint:** `PUT /api/v1/boards/:id`

**Authorization:** Team admin or facilitator

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Board ID |

**Request Body:**

```json
{
  "anonymous_mode": true,
  "max_votes_per_user": 8,
  "max_votes_per_card": 3
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| anonymous_mode | boolean | No | Can only change during `write` phase | Toggle anonymous card authors |
| max_votes_per_user | integer | No | 1-99, can only change during `write` or `group` phase | Max votes per user |
| max_votes_per_card | integer | No | 1-99, can only change during `write` or `group` phase | Max votes per user per card |

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "sprint_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "template_id": "t1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "phase": "write",
    "anonymous_mode": true,
    "max_votes_per_user": 8,
    "max_votes_per_card": 3,
    "focus_item_id": null,
    "focus_item_type": null,
    "created_by": "u1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:00:00.000Z",
    "updated_at": "2026-02-14T10:10:00.000Z"
  }
}
```

**Errors:**
- `404 BOARD_NOT_FOUND`
- `403 FORBIDDEN`
- `422 INVALID_PHASE` — Trying to change anonymous_mode outside `write` phase
- `422 VALIDATION_ERROR` — Invalid field values

---

## 4. Add Card

Adds a new card to a column on the board.

**Endpoint:** `POST /api/v1/boards/:id/cards`

**Authorization:** Team member

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Board ID |

**Request Body:**

```json
{
  "column_id": "c1a2c3d4-e5f6-7890-abcd-ef1234567890",
  "content": "We shipped the feature on time!"
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| column_id | uuid | Yes | Must belong to this board | Column to add card to |
| content | string | Yes | 1-2000 chars, trimmed | Card text content |

**Response:** `201 Created`

```json
{
  "ok": true,
  "data": {
    "id": "card-new-1",
    "column_id": "c1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "board_id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "content": "We shipped the feature on time!",
    "author_id": "u1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "author_name": "Alice Johnson",
    "position": 2,
    "vote_count": 0,
    "user_votes": 0,
    "group_id": null,
    "created_at": "2026-02-14T10:15:00.000Z",
    "updated_at": "2026-02-14T10:15:00.000Z"
  }
}
```

**Notes:**
- `author_id` is set from the JWT — users cannot set someone else as author.
- `position` is auto-assigned (appended to end of column).
- When `anonymous_mode` is enabled, the response still includes `author_id` for the card creator (it is their own card). Other users will see `null`.

**Errors:**
- `422 INVALID_PHASE` — Board is not in `write` phase
- `422 VALIDATION_ERROR` — Missing column_id, empty content, content too long
- `404 BOARD_NOT_FOUND`

---

## 5. Edit Card

Updates an existing card's content.

**Endpoint:** `PUT /api/v1/boards/:id/cards/:cardId`

**Authorization:** Card author, team admin, or facilitator

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Board ID |
| cardId | uuid | Card ID |

**Request Body:**

```json
{
  "content": "Updated card text with more detail",
  "column_id": "c2a2c3d4-e5f6-7890-abcd-ef1234567890",
  "position": 0
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| content | string | No | 1-2000 chars, trimmed | New card text |
| column_id | uuid | No | Must belong to this board | Move card to different column |
| position | integer | No | >= 0 | New position within column |

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "card-1",
    "column_id": "c2a2c3d4-e5f6-7890-abcd-ef1234567890",
    "board_id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "content": "Updated card text with more detail",
    "author_id": "u1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "author_name": "Alice Johnson",
    "position": 0,
    "vote_count": 3,
    "user_votes": 1,
    "group_id": null,
    "created_at": "2026-02-14T10:05:00.000Z",
    "updated_at": "2026-02-14T10:20:00.000Z"
  }
}
```

**Errors:**
- `422 INVALID_PHASE` — Board is not in `write` or `group` phase
- `404 CARD_NOT_FOUND`
- `403 FORBIDDEN` — User is not the author, admin, or facilitator

---

## 6. Delete Card

Removes a card from the board.

**Endpoint:** `DELETE /api/v1/boards/:id/cards/:cardId`

**Authorization:** Card author, team admin, or facilitator

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Board ID |
| cardId | uuid | Card ID |

**Request Body:** None

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "card-1",
    "deleted": true
  }
}
```

**Side Effects:**
- All votes on the card are also deleted.
- If the card was in a group, it is removed from the group.
- Vote counts for affected users are recalculated.

**Errors:**
- `422 INVALID_PHASE` — Board is not in `write` or `group` phase
- `404 CARD_NOT_FOUND`
- `403 FORBIDDEN`

---

## 7. Vote on Card

Casts a vote on a card.

**Endpoint:** `POST /api/v1/boards/:id/cards/:cardId/vote`

**Authorization:** Team member

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Board ID |
| cardId | uuid | Card ID |

**Request Body:** None (empty body or `{}`)

**Response:** `201 Created`

```json
{
  "ok": true,
  "data": {
    "card_id": "card-1",
    "vote_count": 4,
    "user_votes": 2,
    "user_votes_remaining": 2,
    "user_total_votes_cast": 3
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| card_id | uuid | The card voted on |
| vote_count | integer | Total votes on this card from all users |
| user_votes | integer | How many times the current user voted on this card |
| user_votes_remaining | integer | How many votes the current user has left on this board |
| user_total_votes_cast | integer | Total votes cast by this user across the board |

**Errors:**
- `422 INVALID_PHASE` — Board is not in `vote` phase
- `422 VOTE_LIMIT_REACHED` — User has hit `max_votes_per_user` or `max_votes_per_card`
- `404 CARD_NOT_FOUND`

**Implementation Notes:**
- The vote is created within a transaction that:
  1. Counts existing votes by this user on this board (must be < `max_votes_per_user`)
  2. Counts existing votes by this user on this card (must be < `max_votes_per_card`)
  3. Determines the next `vote_number` for `(card_id, user_id)` pair
  4. Inserts the vote row
- The transaction uses `SELECT ... FOR UPDATE` on the board row to prevent race conditions.

---

## 8. Remove Vote

Removes the most recent vote by the current user on a card.

**Endpoint:** `DELETE /api/v1/boards/:id/cards/:cardId/vote`

**Authorization:** Team member (can only remove own votes)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Board ID |
| cardId | uuid | Card ID |

**Request Body:** None

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "card_id": "card-1",
    "vote_count": 3,
    "user_votes": 1,
    "user_votes_remaining": 3,
    "user_total_votes_cast": 2
  }
}
```

**Notes:**
- Removes the vote with the highest `vote_number` for this `(card_id, user_id)` pair. This implements a stack-like removal (last-in, first-out).
- If the user has no votes on this card, returns `422 VALIDATION_ERROR`.

**Errors:**
- `422 INVALID_PHASE` — Board is not in `vote` phase
- `422 VALIDATION_ERROR` — User has no votes on this card
- `404 CARD_NOT_FOUND`

---

## 9. Create Card Group

Creates a new group and optionally adds initial cards to it.

**Endpoint:** `POST /api/v1/boards/:id/groups`

**Authorization:** Team admin or facilitator

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Board ID |

**Request Body:**

```json
{
  "title": "Communication Issues",
  "card_ids": ["card-5", "card-8", "card-12"]
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| title | string | Yes | 1-200 chars | Group title |
| card_ids | uuid[] | No | All must belong to this board, max 50 | Initial cards to add to group |

**Response:** `201 Created`

```json
{
  "ok": true,
  "data": {
    "id": "g1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "board_id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Communication Issues",
    "position": 0,
    "card_ids": ["card-5", "card-8", "card-12"],
    "total_votes": 7,
    "created_at": "2026-02-14T10:30:00.000Z"
  }
}
```

**Notes:**
- Cards that are already in another group will be moved to this group (removed from the previous group).
- `position` is auto-assigned (appended after existing groups).

**Errors:**
- `422 INVALID_PHASE` — Board is not in `group` phase
- `422 VALIDATION_ERROR` — Empty title, card not found on this board
- `403 FORBIDDEN`

---

## 10. Update Card Group

Updates a group's title and/or adds/removes cards.

**Endpoint:** `PUT /api/v1/boards/:id/groups/:groupId`

**Authorization:** Team admin or facilitator

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Board ID |
| groupId | uuid | Group ID |

**Request Body:**

```json
{
  "title": "Renamed Group",
  "add_card_ids": ["card-15"],
  "remove_card_ids": ["card-5"],
  "position": 2
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| title | string | No | 1-200 chars | New group title |
| add_card_ids | uuid[] | No | Must belong to this board | Cards to add to group |
| remove_card_ids | uuid[] | No | Must currently be in this group | Cards to remove from group |
| position | integer | No | >= 0 | New position among groups |

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "g1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "board_id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Renamed Group",
    "position": 2,
    "card_ids": ["card-8", "card-12", "card-15"],
    "total_votes": 9,
    "created_at": "2026-02-14T10:30:00.000Z"
  }
}
```

**Errors:**
- `422 INVALID_PHASE` — Board is not in `group` phase
- `404 GROUP_NOT_FOUND`
- `403 FORBIDDEN`
- `422 VALIDATION_ERROR` — Card does not belong to board, or card not in group for removal

---

## 11. Delete Card Group

Deletes a group and ungroups all its cards.

**Endpoint:** `DELETE /api/v1/boards/:id/groups/:groupId`

**Authorization:** Team admin or facilitator

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Board ID |
| groupId | uuid | Group ID |

**Request Body:** None

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "g1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "deleted": true,
    "ungrouped_card_ids": ["card-8", "card-12", "card-15"]
  }
}
```

**Notes:**
- Cards are NOT deleted, only removed from the group.
- Remaining groups are re-positioned to close the gap.

**Errors:**
- `422 INVALID_PHASE` — Board is not in `group` phase
- `404 GROUP_NOT_FOUND`
- `403 FORBIDDEN`

---

## 12. Set Board Phase

Advances or sets the board phase.

**Endpoint:** `PUT /api/v1/boards/:id/phase`

**Authorization:** Team admin or facilitator

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Board ID |

**Request Body:**

```json
{
  "phase": "group"
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| phase | string | Yes | One of: `write`, `group`, `vote`, `discuss`, `action` | Target phase |

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "phase": "group",
    "previous_phase": "write",
    "updated_at": "2026-02-14T10:25:00.000Z"
  }
}
```

**Phase Transition Rules:**
- Forward transitions follow the sequence: `write` -> `group` -> `vote` -> `discuss` -> `action`
- Backward transitions are allowed (facilitator can go back to a previous phase).
- Skipping phases is NOT allowed (cannot jump from `write` to `vote`).

**Allowed Transitions Table:**

| From | Allowed To |
|------|------------|
| write | group |
| group | write, vote |
| vote | group, discuss |
| discuss | vote, action |
| action | discuss |

**Errors:**
- `422 INVALID_PHASE` — Transition not allowed (e.g., `write` -> `vote`)
- `404 BOARD_NOT_FOUND`
- `403 FORBIDDEN`

---

## 13. Set Discussion Focus

Sets the card or group that the facilitator wants the team to discuss.

**Endpoint:** `PUT /api/v1/boards/:id/focus`

**Authorization:** Team admin or facilitator

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Board ID |

**Request Body:**

```json
{
  "focus_item_id": "card-5",
  "focus_item_type": "card"
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| focus_item_id | uuid or null | Yes | Must exist on this board, or null to clear | ID of card or group to focus on |
| focus_item_type | string or null | Conditional | Required if focus_item_id is not null. One of: `card`, `group` | Type of focused item |

**To clear focus:**

```json
{
  "focus_item_id": null,
  "focus_item_type": null
}
```

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    "focus_item_id": "card-5",
    "focus_item_type": "card",
    "updated_at": "2026-02-14T10:35:00.000Z"
  }
}
```

**Errors:**
- `422 INVALID_PHASE` — Board is not in `discuss` phase
- `422 VALIDATION_ERROR` — Referenced card/group does not exist on this board, or type mismatch
- `404 BOARD_NOT_FOUND`
- `403 FORBIDDEN`

---

## Data Type Reference

### Board Object

```typescript
interface Board {
  id: string;                    // uuid
  sprint_id: string;             // uuid
  template_id: string;           // uuid
  phase: 'write' | 'group' | 'vote' | 'discuss' | 'action';
  anonymous_mode: boolean;
  max_votes_per_user: number;    // 1-99
  max_votes_per_card: number;    // 1-99
  focus_item_id: string | null;  // uuid
  focus_item_type: 'card' | 'group' | null;
  created_by: string;            // uuid
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
}
```

### Column Object

```typescript
interface Column {
  id: string;           // uuid
  board_id: string;     // uuid
  name: string;         // 1-100 chars
  color: string;        // hex color, e.g. "#22c55e"
  position: number;     // 0-indexed
  created_at: string;   // ISO 8601
}
```

### Card Object

```typescript
interface Card {
  id: string;                   // uuid
  column_id: string;            // uuid
  board_id: string;             // uuid
  content: string;              // 1-2000 chars
  author_id: string | null;     // uuid, null when anonymous to non-admins
  author_name: string | null;   // display name, null when anonymous
  position: number;             // 0-indexed within column
  vote_count: number;           // total votes from all users
  user_votes: number;           // votes from the current authenticated user
  group_id: string | null;      // uuid of the group this card belongs to
  created_at: string;           // ISO 8601
  updated_at: string;           // ISO 8601
}
```

### CardGroup Object

```typescript
interface CardGroup {
  id: string;           // uuid
  board_id: string;     // uuid
  title: string;        // 1-200 chars
  position: number;     // 0-indexed
  card_ids: string[];   // uuid array of member cards
  total_votes: number;  // sum of votes across all cards in group
  created_at: string;   // ISO 8601
}
```

### VoteResult Object

```typescript
interface VoteResult {
  card_id: string;              // uuid
  vote_count: number;           // total votes on this card
  user_votes: number;           // current user's votes on this card
  user_votes_remaining: number; // remaining votes for current user on board
  user_total_votes_cast: number; // total votes cast by current user on board
}
```

---

## WebSocket Events

When any mutation endpoint succeeds, a corresponding WebSocket event is broadcast to all clients connected to the board. Events are sent on channel `board:{boardId}`.

| API Endpoint | WS Event Type | WS Payload |
|-------------|---------------|------------|
| POST .../cards | `card:created` | `{ cardId, columnId, position }` |
| PUT .../cards/:cardId | `card:updated` | `{ cardId, columnId }` |
| DELETE .../cards/:cardId | `card:deleted` | `{ cardId, columnId }` |
| POST .../cards/:cardId/vote | `vote:added` | `{ cardId, voteCount }` |
| DELETE .../cards/:cardId/vote | `vote:removed` | `{ cardId, voteCount }` |
| POST .../groups | `group:created` | `{ groupId, cardIds }` |
| PUT .../groups/:groupId | `group:updated` | `{ groupId }` |
| DELETE .../groups/:groupId | `group:deleted` | `{ groupId, ungroupedCardIds }` |
| PUT .../phase | `phase:changed` | `{ phase, previousPhase }` |
| PUT .../focus | `focus:changed` | `{ focusItemId, focusItemType }` |
| PUT /boards/:id | `board:updated` | `{ anonymousMode, maxVotesPerUser, maxVotesPerCard }` |

Clients should use these events to trigger optimistic UI updates or refetch relevant data.
