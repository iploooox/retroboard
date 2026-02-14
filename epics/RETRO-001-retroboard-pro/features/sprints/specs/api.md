---
changed: 2026-02-14 — Spec Review Gate
---

# Sprints API Specification

**Feature:** sprints
**Base path:** `/api/v1/teams/:teamId/sprints`
**Authentication:** All endpoints require a valid access token.
**Authorization:** All endpoints require team membership. Specific role requirements noted per endpoint.

---

## Table of Contents

1. [POST /api/v1/teams/:teamId/sprints](#1-post-apiv1teamsteamidsprints)
2. [GET /api/v1/teams/:teamId/sprints](#2-get-apiv1teamsteamidsprints)
3. [GET /api/v1/teams/:teamId/sprints/:id](#3-get-apiv1teamsteamidsprintsid)
4. [PUT /api/v1/teams/:teamId/sprints/:id](#4-put-apiv1teamsteamidsprintsid)
5. [PUT /api/v1/teams/:teamId/sprints/:id/activate](#5-put-apiv1teamsteamidsprintsidactivate)
6. [PUT /api/v1/teams/:teamId/sprints/:id/complete](#6-put-apiv1teamsteamidsprintsidcomplete)
7. [DELETE /api/v1/teams/:teamId/sprints/:id](#7-delete-apiv1teamsteamidsprintsid)
8. [Common Error Responses](#8-common-error-responses)
9. [Data Types](#9-data-types)

---

## 1. POST /api/v1/teams/:teamId/sprints

Create a new sprint for the team. The sprint starts in `planning` status.

**Required role:** admin or facilitator

### Request

```
POST /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901/sprints
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "name": "Sprint 42",
  "goal": "Ship the auth feature and start on teams",
  "start_date": "2026-02-17",
  "end_date": "2026-02-28"
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | Yes | Min 1 character. Max 100 characters. Trimmed. |
| goal | string | No | Max 500 characters. Defaults to `null`. |
| start_date | string | Yes | ISO 8601 date format (`YYYY-MM-DD`). |
| end_date | string | No | ISO 8601 date format (`YYYY-MM-DD`). Must be on or after `start_date`. Defaults to `null`. |

### Response: 201 Created

```json
{
  "sprint": {
    "id": "d4e5f6a7-b8c9-0123-def0-345678901234",
    "team_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "Sprint 42",
    "goal": "Ship the auth feature and start on teams",
    "sprint_number": 42,
    "start_date": "2026-02-17",
    "end_date": "2026-02-28",
    "status": "planning",
    "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:30:00.000Z",
    "updated_at": "2026-02-14T10:30:00.000Z"
  }
}
```

**Note:** `sprint_number` is auto-assigned by the server (next available number for the team). It is not provided in the request body.

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing or invalid fields |
| 400 | `SPRINT_DATE_INVALID` | end_date is before start_date |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_NOT_MEMBER` | User is not a team member |
| 403 | `TEAM_INSUFFICIENT_ROLE` | User is not admin or facilitator |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |

---

## 2. GET /api/v1/teams/:teamId/sprints

List sprints for a team with pagination and optional status filtering.

**Required role:** member, facilitator, or admin (any team member)

### Request

```
GET /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901/sprints?status=active&page=1&per_page=10
Authorization: Bearer <token>
```

### Query Parameters

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| status | string | No | -- | Filter by status: `planning`, `active`, `completed`. Omit for all. |
| page | number | No | 1 | Page number (1-based) |
| per_page | number | No | 20 | Items per page (max 100) |

### Response: 200 OK

```json
{
  "sprints": [
    {
      "id": "d4e5f6a7-b8c9-0123-def0-345678901234",
      "team_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "name": "Sprint 42",
      "goal": "Ship the auth feature and start on teams",
      "sprint_number": 42,
      "start_date": "2026-02-17",
      "end_date": "2026-02-28",
      "status": "active",
      "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "created_at": "2026-02-14T10:30:00.000Z",
      "updated_at": "2026-02-15T09:00:00.000Z"
    },
    {
      "id": "e5f6a7b8-c9d0-1234-ef01-456789012345",
      "team_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "name": "Sprint 41",
      "goal": "Set up project infrastructure",
      "sprint_number": 41,
      "start_date": "2026-02-03",
      "end_date": "2026-02-14",
      "status": "completed",
      "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "created_at": "2026-02-01T10:00:00.000Z",
      "updated_at": "2026-02-14T17:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 2,
    "total_pages": 1
  }
}
```

Sprints are sorted by `start_date` descending (most recent first). When `start_date` is equal, secondary sort is by `created_at` descending.

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid status filter value |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_NOT_MEMBER` | User is not a team member |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |

---

## 3. GET /api/v1/teams/:teamId/sprints/:id

Get detailed information about a specific sprint.

**Required role:** member, facilitator, or admin (any team member)

### Request

```
GET /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901/sprints/d4e5f6a7-b8c9-0123-def0-345678901234
Authorization: Bearer <token>
```

### Response: 200 OK

```json
{
  "sprint": {
    "id": "d4e5f6a7-b8c9-0123-def0-345678901234",
    "team_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "Sprint 42",
    "goal": "Ship the auth feature and start on teams",
    "sprint_number": 42,
    "start_date": "2026-02-17",
    "end_date": "2026-02-28",
    "status": "active",
    "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:30:00.000Z",
    "updated_at": "2026-02-15T09:00:00.000Z"
  }
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_NOT_MEMBER` | User is not a team member |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |
| 404 | `SPRINT_NOT_FOUND` | Sprint does not exist or does not belong to this team |

---

## 4. PUT /api/v1/teams/:teamId/sprints/:id

Update sprint details. What can be updated depends on the sprint's current status.

**Required role:** admin or facilitator

### Request

```
PUT /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901/sprints/d4e5f6a7-b8c9-0123-def0-345678901234
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "name": "Sprint 42 - Extended",
  "goal": "Ship auth and teams features",
  "start_date": "2026-02-17",
  "end_date": "2026-03-07"
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | No | Min 1 character. Max 100 characters. Trimmed. |
| goal | string \| null | No | Max 500 characters. `null` to clear. |
| start_date | string | No | ISO 8601 date (`YYYY-MM-DD`). Only editable when status is `planning`. |
| end_date | string \| null | No | ISO 8601 date. Must be >= start_date. `null` to clear. Only editable when status is `planning`. |

At least one field must be provided. Unknown fields are ignored.

### Editability by Status

| Field | planning | active | completed |
|-------|---------|--------|-----------|
| name | Yes | Yes | No |
| goal | Yes | Yes | No |
| start_date | Yes | No | No |
| end_date | Yes | No | No |

If a client sends `start_date` or `end_date` for an `active` sprint, those fields are silently ignored (not an error). If the sprint is `completed`, any update returns `SPRINT_NOT_EDITABLE`.

### Response: 200 OK

```json
{
  "sprint": {
    "id": "d4e5f6a7-b8c9-0123-def0-345678901234",
    "team_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "Sprint 42 - Extended",
    "goal": "Ship auth and teams features",
    "sprint_number": 42,
    "start_date": "2026-02-17",
    "end_date": "2026-03-07",
    "status": "planning",
    "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:30:00.000Z",
    "updated_at": "2026-02-14T16:00:00.000Z"
  }
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | No valid fields provided or invalid values |
| 400 | `SPRINT_NOT_EDITABLE` | Sprint is completed |
| 400 | `SPRINT_DATE_INVALID` | end_date is before start_date |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_NOT_MEMBER` | User is not a team member |
| 403 | `TEAM_INSUFFICIENT_ROLE` | User is not admin or facilitator |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |
| 404 | `SPRINT_NOT_FOUND` | Sprint not found in this team |

---

## 5. PUT /api/v1/teams/:teamId/sprints/:id/activate

Transition a sprint from `planning` to `active`. Only one sprint per team can be active.

**Required role:** admin or facilitator

### Request

```
PUT /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901/sprints/d4e5f6a7-b8c9-0123-def0-345678901234/activate
Authorization: Bearer <token>
```

No request body required.

### Response: 200 OK

```json
{
  "sprint": {
    "id": "d4e5f6a7-b8c9-0123-def0-345678901234",
    "team_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "Sprint 42",
    "goal": "Ship the auth feature and start on teams",
    "sprint_number": 42,
    "start_date": "2026-02-17",
    "end_date": "2026-02-28",
    "status": "active",
    "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:30:00.000Z",
    "updated_at": "2026-02-17T09:00:00.000Z"
  }
}
```

### Behavior

1. Fetch the sprint. Verify it exists and belongs to the team.
2. Verify the sprint's current status is `planning`.
3. Attempt to UPDATE status to `active`.
4. If the partial unique index (`sprints_team_active_idx`) is violated, return 409 with `SPRINT_ALREADY_ACTIVE`.
5. On success, return the updated sprint.

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `SPRINT_INVALID_TRANSITION` | Sprint is not in `planning` status |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_NOT_MEMBER` | User is not a team member |
| 403 | `TEAM_INSUFFICIENT_ROLE` | User is not admin or facilitator |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |
| 404 | `SPRINT_NOT_FOUND` | Sprint not found in this team |
| 409 | `SPRINT_ALREADY_ACTIVE` | Another sprint is already active for this team |

**409 Example:**

```json
{
  "error": {
    "code": "SPRINT_ALREADY_ACTIVE",
    "message": "Another sprint is already active for this team. Complete or delete it first.",
    "details": {
      "active_sprint_id": "e5f6a7b8-c9d0-1234-ef01-456789012345",
      "active_sprint_name": "Sprint 41"
    }
  }
}
```

---

## 6. PUT /api/v1/teams/:teamId/sprints/:id/complete

Transition a sprint from `active` to `completed`.

**Required role:** admin or facilitator

### Request

```
PUT /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901/sprints/d4e5f6a7-b8c9-0123-def0-345678901234/complete
Authorization: Bearer <token>
```

No request body required.

### Response: 200 OK

```json
{
  "sprint": {
    "id": "d4e5f6a7-b8c9-0123-def0-345678901234",
    "team_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "Sprint 42",
    "goal": "Ship the auth feature and start on teams",
    "sprint_number": 42,
    "start_date": "2026-02-17",
    "end_date": "2026-02-28",
    "status": "completed",
    "created_by": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-02-14T10:30:00.000Z",
    "updated_at": "2026-02-28T17:00:00.000Z"
  }
}
```

### Behavior

1. Fetch the sprint. Verify it exists and belongs to the team.
2. Verify the sprint's current status is `active`.
3. UPDATE status to `completed`.
4. Return the updated sprint.

This action is irreversible. Once completed, a sprint cannot be reopened.

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `SPRINT_INVALID_TRANSITION` | Sprint is not in `active` status |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_NOT_MEMBER` | User is not a team member |
| 403 | `TEAM_INSUFFICIENT_ROLE` | User is not admin or facilitator |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |
| 404 | `SPRINT_NOT_FOUND` | Sprint not found in this team |

---

## 7. DELETE /api/v1/teams/:teamId/sprints/:id

Delete a sprint and all associated data (retro boards, cards, etc. in future phases).

**Required role:** admin

### Request

```
DELETE /api/v1/teams/b2c3d4e5-f6a7-8901-bcde-f12345678901/sprints/d4e5f6a7-b8c9-0123-def0-345678901234
Authorization: Bearer <token>
```

### Response: 200 OK

```json
{
  "message": "Sprint deleted successfully"
}
```

### Behavior

Sprints in any status can be deleted by an admin. The deletion cascades to all related data via foreign key constraints.

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |
| 403 | `TEAM_NOT_MEMBER` | User is not a team member |
| 403 | `TEAM_INSUFFICIENT_ROLE` | User is not an admin |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |
| 404 | `SPRINT_NOT_FOUND` | Sprint not found in this team |

---

## 8. Common Error Responses

All error responses follow the standard shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

### Sprint-Specific Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request validation failed |
| 400 | `SPRINT_INVALID_TRANSITION` | Status transition not allowed |
| 400 | `SPRINT_NOT_EDITABLE` | Sprint is completed, cannot modify |
| 400 | `SPRINT_DATE_INVALID` | end_date before start_date |
| 404 | `SPRINT_NOT_FOUND` | Sprint does not exist in this team |
| 409 | `SPRINT_ALREADY_ACTIVE` | Team already has an active sprint |

---

## 9. Data Types

### Sprint Object

```typescript
interface SprintResponse {
  id: string;              // UUID
  team_id: string;         // UUID
  name: string;
  goal: string | null;
  sprint_number: number;   // Auto-incremented per team
  start_date: string;      // ISO 8601 date (YYYY-MM-DD)
  end_date: string | null;  // ISO 8601 date (YYYY-MM-DD)
  status: 'planning' | 'active' | 'completed';
  created_by: string;      // UUID of creating user
  created_at: string;      // ISO 8601 datetime
  updated_at: string;      // ISO 8601 datetime
}
```

### Sprint Status Enum

```typescript
type SprintStatus = 'planning' | 'active' | 'completed';
```

### Pagination Object

```typescript
interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}
```

### Create Sprint Input

```typescript
interface CreateSprintInput {
  name: string;
  goal?: string;
  start_date: string;    // YYYY-MM-DD
  end_date?: string;     // YYYY-MM-DD
}
```

### Update Sprint Input

```typescript
interface UpdateSprintInput {
  name?: string;
  goal?: string | null;
  start_date?: string;   // YYYY-MM-DD, only when planning
  end_date?: string | null;  // YYYY-MM-DD, only when planning
}
```
