# Action Items API Specification

## Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <JWT>
```

## Authorization

- Board-scoped endpoints: user must be a member of the team that owns the board
- Team-scoped endpoints: user must be a member of the team
- Any team member can create, update, or delete action items (not restricted to facilitators)

---

## Endpoints

### POST /api/v1/boards/:id/action-items

Create a new action item linked to a board.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID |

**Request Body:**

```json
{
  "title": "Fix CI pipeline",
  "description": "The nightly build has been failing for 3 days. Investigate and fix.",
  "cardId": "card-001",
  "assigneeId": "user-002",
  "dueDate": "2026-03-01"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Action item title. 1-500 characters. |
| `description` | string | No | Detailed description. Max 5000 characters. |
| `cardId` | UUID | No | Source card that inspired this action item |
| `assigneeId` | UUID | No | User to assign this item to. Must be a team member. |
| `dueDate` | string | No | Due date in `YYYY-MM-DD` format |

**Response 201 Created:**

```json
{
  "id": "ai-001",
  "boardId": "550e8400-e29b-41d4-a716-446655440000",
  "cardId": "card-001",
  "cardText": "CI keeps breaking",
  "title": "Fix CI pipeline",
  "description": "The nightly build has been failing for 3 days. Investigate and fix.",
  "assigneeId": "user-002",
  "assigneeName": "Bob Martinez",
  "dueDate": "2026-03-01",
  "status": "open",
  "carriedFromId": null,
  "carriedFromSprintName": null,
  "createdBy": "user-001",
  "createdByName": "Alice Chen",
  "createdAt": "2026-02-14T11:30:00.000Z",
  "updatedAt": "2026-02-14T11:30:00.000Z"
}
```

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Title missing or empty | `{ "error": "VALIDATION_ERROR", "message": "Title is required (1-500 characters)" }` |
| 400 | Title too long | `{ "error": "VALIDATION_ERROR", "message": "Title must be 500 characters or fewer" }` |
| 400 | Description too long | `{ "error": "VALIDATION_ERROR", "message": "Description must be 5000 characters or fewer" }` |
| 400 | Card not on this board | `{ "error": "INVALID_CARD", "message": "Card does not belong to this board" }` |
| 400 | Assignee not team member | `{ "error": "INVALID_ASSIGNEE", "message": "Assignee is not a member of this team" }` |
| 400 | Invalid due date format | `{ "error": "INVALID_DATE", "message": "Due date must be in YYYY-MM-DD format" }` |
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not a team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Board not found | `{ "error": "NOT_FOUND", "message": "Board not found" }` |

---

### GET /api/v1/boards/:id/action-items

List all action items for a board.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status: `open`, `in_progress`, `done` |
| `assigneeId` | UUID | - | Filter by assignee |
| `sort` | string | `created_at` | Sort field: `created_at`, `due_date`, `status`, `title` |
| `order` | string | `asc` | Sort order: `asc`, `desc` |
| `limit` | integer | 50 | Max results (1-100) |
| `offset` | integer | 0 | Pagination offset |

**Response 200 OK:**

```json
{
  "items": [
    {
      "id": "ai-001",
      "boardId": "550e8400-e29b-41d4-a716-446655440000",
      "cardId": "card-001",
      "cardText": "CI keeps breaking",
      "title": "Fix CI pipeline",
      "description": "The nightly build has been failing for 3 days.",
      "assigneeId": "user-002",
      "assigneeName": "Bob Martinez",
      "dueDate": "2026-03-01",
      "status": "open",
      "carriedFromId": null,
      "carriedFromSprintName": null,
      "createdBy": "user-001",
      "createdByName": "Alice Chen",
      "createdAt": "2026-02-14T11:30:00.000Z",
      "updatedAt": "2026-02-14T11:30:00.000Z"
    },
    {
      "id": "ai-002",
      "boardId": "550e8400-e29b-41d4-a716-446655440000",
      "cardId": null,
      "cardText": null,
      "title": "Set up monitoring dashboard",
      "description": null,
      "assigneeId": "user-003",
      "assigneeName": "Charlie Kim",
      "dueDate": "2026-03-07",
      "status": "open",
      "carriedFromId": "ai-prev-005",
      "carriedFromSprintName": "Sprint 14",
      "createdBy": "user-001",
      "createdByName": "Alice Chen",
      "createdAt": "2026-02-14T11:35:00.000Z",
      "updatedAt": "2026-02-14T11:35:00.000Z"
    }
  ],
  "total": 2,
  "limit": 50,
  "offset": 0
}
```

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not a team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Board not found | `{ "error": "NOT_FOUND", "message": "Board not found" }` |

---

### PUT /api/v1/action-items/:id

Update an action item.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Action item ID |

**Request Body (all fields optional):**

```json
{
  "title": "Fix CI pipeline and add alerts",
  "description": "Updated description with more details.",
  "assigneeId": "user-003",
  "dueDate": "2026-03-05",
  "status": "in_progress"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Updated title. 1-500 characters. |
| `description` | string | No | Updated description. Max 5000 chars. Use `null` to clear. |
| `assigneeId` | UUID or null | No | New assignee. `null` to unassign. Must be team member. |
| `dueDate` | string or null | No | New due date (YYYY-MM-DD). `null` to clear. |
| `status` | string | No | New status: `open`, `in_progress`, `done` |

**Response 200 OK:**

```json
{
  "id": "ai-001",
  "boardId": "550e8400-e29b-41d4-a716-446655440000",
  "cardId": "card-001",
  "cardText": "CI keeps breaking",
  "title": "Fix CI pipeline and add alerts",
  "description": "Updated description with more details.",
  "assigneeId": "user-003",
  "assigneeName": "Charlie Kim",
  "dueDate": "2026-03-05",
  "status": "in_progress",
  "carriedFromId": null,
  "carriedFromSprintName": null,
  "createdBy": "user-001",
  "createdByName": "Alice Chen",
  "createdAt": "2026-02-14T11:30:00.000Z",
  "updatedAt": "2026-02-14T12:00:00.000Z"
}
```

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Invalid status value | `{ "error": "INVALID_STATUS", "message": "Status must be one of: open, in_progress, done" }` |
| 400 | Empty title | `{ "error": "VALIDATION_ERROR", "message": "Title cannot be empty" }` |
| 400 | Assignee not team member | `{ "error": "INVALID_ASSIGNEE", "message": "Assignee is not a member of this team" }` |
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not a team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Action item not found | `{ "error": "NOT_FOUND", "message": "Action item not found" }` |

---

### DELETE /api/v1/action-items/:id

Delete an action item. Hard delete (not soft delete).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Action item ID |

**Response 204 No Content**

No response body.

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not a team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Action item not found | `{ "error": "NOT_FOUND", "message": "Action item not found" }` |

---

### GET /api/v1/teams/:teamId/action-items

List all action items across all sprints for a team. Supports filtering by status, sprint, and assignee.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `teamId` | UUID | Team ID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status: `open`, `in_progress`, `done` |
| `sprintId` | UUID | - | Filter by sprint |
| `assigneeId` | UUID | - | Filter by assignee |
| `sort` | string | `created_at` | Sort: `created_at`, `due_date`, `status`, `sprint` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |
| `limit` | integer | 50 | Max results (1-100) |
| `offset` | integer | 0 | Pagination offset |

**Response 200 OK:**

```json
{
  "items": [
    {
      "id": "ai-005",
      "boardId": "board-sprint-15",
      "sprintId": "sprint-15",
      "sprintName": "Sprint 15",
      "cardId": null,
      "cardText": null,
      "title": "Fix CI pipeline",
      "description": "The nightly build has been failing for 3 days.",
      "assigneeId": "user-002",
      "assigneeName": "Bob Martinez",
      "dueDate": "2026-03-01",
      "status": "open",
      "carriedFromId": "ai-001",
      "carriedFromSprintName": "Sprint 14",
      "createdBy": "user-001",
      "createdByName": "Alice Chen",
      "createdAt": "2026-02-14T11:30:00.000Z",
      "updatedAt": "2026-02-14T11:30:00.000Z"
    }
  ],
  "total": 15,
  "limit": 50,
  "offset": 0,
  "summary": {
    "open": 4,
    "inProgress": 3,
    "done": 8,
    "overdue": 2
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `items` | array | Action items matching filters |
| `total` | integer | Total matching items (for pagination) |
| `summary.open` | integer | Count of items with status `open` |
| `summary.inProgress` | integer | Count with status `in_progress` |
| `summary.done` | integer | Count with status `done` |
| `summary.overdue` | integer | Count of open/in_progress items past due date |

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not a team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Team not found | `{ "error": "NOT_FOUND", "message": "Team not found" }` |

---

### POST /api/v1/boards/:id/action-items/carry-over

Import unresolved action items from the previous sprint into this board.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID (the new/current board to carry items into) |

**Request Body:** None required.

**Response 200 OK:**

```json
{
  "carriedOver": [
    {
      "id": "ai-005",
      "originalId": "ai-001",
      "originalSprintName": "Sprint 14",
      "title": "Fix CI pipeline",
      "description": "The nightly build has been failing for 3 days.",
      "assigneeId": "user-002",
      "assigneeName": "Bob Martinez",
      "dueDate": "2026-03-01",
      "status": "open",
      "originalStatus": "open"
    },
    {
      "id": "ai-006",
      "originalId": "ai-002",
      "originalSprintName": "Sprint 14",
      "title": "Add integration tests",
      "description": null,
      "assigneeId": "user-003",
      "assigneeName": "Charlie Kim",
      "dueDate": "2026-03-05",
      "status": "open",
      "originalStatus": "in_progress"
    }
  ],
  "skipped": [
    {
      "originalId": "ai-003",
      "title": "Deploy staging environment",
      "reason": "already_done"
    }
  ],
  "alreadyCarried": [
    {
      "originalId": "ai-001",
      "existingId": "ai-005",
      "title": "Fix CI pipeline",
      "reason": "already_carried_over"
    }
  ],
  "sourceSprintName": "Sprint 14",
  "totalResolved": 2,
  "totalSkipped": 1,
  "totalAlreadyCarried": 0
}
```

| Field | Type | Description |
|-------|------|-------------|
| `carriedOver` | array | Items that were successfully carried over |
| `skipped` | array | Items skipped because they are already done |
| `alreadyCarried` | array | Items skipped because they were already carried to this board |
| `sourceSprintName` | string | Name of the previous sprint |
| `totalResolved` | integer | Number of items carried over |
| `totalSkipped` | integer | Number skipped (done) |
| `totalAlreadyCarried` | integer | Number already carried over previously |

The endpoint is idempotent. Calling it multiple times will not create duplicate items -- previously carried items appear in the `alreadyCarried` array.

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not a team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Board not found | `{ "error": "NOT_FOUND", "message": "Board not found" }` |
| 404 | No previous sprint | `{ "error": "NO_PREVIOUS_SPRINT", "message": "No previous sprint found for this team" }` |
