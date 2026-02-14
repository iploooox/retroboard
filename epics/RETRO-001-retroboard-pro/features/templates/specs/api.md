# Templates — API Specification

## Base URL

All endpoints are prefixed with `/api/v1`. All requests require a valid JWT in the `Authorization: Bearer <token>` header.

## Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | User lacks permission |
| `TEMPLATE_NOT_FOUND` | 404 | Template does not exist or not accessible |
| `TEAM_NOT_FOUND` | 404 | Team does not exist |
| `TEMPLATE_IN_USE` | 409 | Cannot delete template; boards reference it |
| `TEMPLATE_NAME_TAKEN` | 409 | Template name already exists for this team |
| `SYSTEM_TEMPLATE_IMMUTABLE` | 403 | Cannot modify or delete a system template |
| `VALIDATION_ERROR` | 422 | Request body failed validation |

---

## 1. List Templates

Returns all templates visible to the current user: all system templates plus custom templates belonging to the user's teams.

**Endpoint:** `GET /api/v1/templates`

**Authorization:** Any authenticated user

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| team_id | uuid | No | — | Filter to only show system + this team's custom templates |
| include_system | boolean | No | true | Whether to include system templates in results |

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "t-system-001",
      "name": "What Went Well / Delta",
      "description": "Classic two-column format focusing on positives and changes needed.",
      "is_system": true,
      "team_id": null,
      "created_by": null,
      "column_count": 2,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "t-system-002",
      "name": "Start / Stop / Continue",
      "description": "Three actionable columns for behavioral feedback.",
      "is_system": true,
      "team_id": null,
      "created_by": null,
      "column_count": 3,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "t-system-003",
      "name": "4Ls",
      "description": "Four-column emotional and aspirational reflection: Liked, Learned, Lacked, Longed For.",
      "is_system": true,
      "team_id": null,
      "created_by": null,
      "column_count": 4,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "t-system-004",
      "name": "Mad / Sad / Glad",
      "description": "Emotion-based three-column format for team reflection.",
      "is_system": true,
      "team_id": null,
      "created_by": null,
      "column_count": 3,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "t-system-005",
      "name": "Sailboat",
      "description": "Metaphor-based format: Wind (helps), Anchor (holds back), Rocks (risks), Island (goals).",
      "is_system": true,
      "team_id": null,
      "created_by": null,
      "column_count": 4,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "t-system-006",
      "name": "Starfish",
      "description": "Comprehensive five-column format: Keep, More Of, Less Of, Stop, Start.",
      "is_system": true,
      "team_id": null,
      "created_by": null,
      "column_count": 5,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "t-custom-001",
      "name": "Our Team Retro",
      "description": "Custom format for Team Alpha.",
      "is_system": false,
      "team_id": "team-alpha-id",
      "created_by": "user-admin-id",
      "column_count": 3,
      "created_at": "2026-02-10T09:00:00.000Z",
      "updated_at": "2026-02-10T09:00:00.000Z"
    }
  ]
}
```

**Notes:**
- System templates are always listed first, sorted by their seeded order.
- Custom templates follow, sorted by `created_at` descending.
- The response includes `column_count` for display purposes, but not the full column definitions. Use the detail endpoint to get columns.
- If `team_id` is provided, only system templates and that team's custom templates are returned.
- If `team_id` is not provided, system templates and custom templates from ALL teams the user belongs to are returned.

---

## 2. Get Template Detail

Returns a single template with its full column definitions.

**Endpoint:** `GET /api/v1/templates/:id`

**Authorization:** Any authenticated user (must be member of the template's team for custom templates)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Template ID |

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "t-system-002",
    "name": "Start / Stop / Continue",
    "description": "Three actionable columns for behavioral feedback.",
    "is_system": true,
    "team_id": null,
    "created_by": null,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z",
    "columns": [
      {
        "id": "tc-001",
        "name": "Start Doing",
        "color": "#22c55e",
        "prompt_text": "What should the team start doing?",
        "position": 0
      },
      {
        "id": "tc-002",
        "name": "Stop Doing",
        "color": "#ef4444",
        "prompt_text": "What should the team stop doing?",
        "position": 1
      },
      {
        "id": "tc-003",
        "name": "Continue Doing",
        "color": "#3b82f6",
        "prompt_text": "What should the team continue doing?",
        "position": 2
      }
    ]
  }
}
```

**Errors:**
- `404 TEMPLATE_NOT_FOUND` — Template does not exist or user lacks access to the owning team

---

## 3. Create Custom Template

Creates a new custom template for a team.

**Endpoint:** `POST /api/v1/teams/:teamId/templates`

**Authorization:** Team admin

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| teamId | uuid | Team to create the template for |

**Request Body:**

```json
{
  "name": "Our Team Retro",
  "description": "Custom format designed for our weekly retros.",
  "columns": [
    {
      "name": "Wins",
      "color": "#22c55e",
      "prompt_text": "What were our wins this sprint?",
      "position": 0
    },
    {
      "name": "Challenges",
      "color": "#f59e0b",
      "prompt_text": "What challenges did we face?",
      "position": 1
    },
    {
      "name": "Ideas",
      "color": "#8b5cf6",
      "prompt_text": "What new ideas should we try?",
      "position": 2
    }
  ]
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| name | string | Yes | 1-100 chars, unique within team | Template display name |
| description | string | No | 0-500 chars | Template description |
| columns | array | Yes | 1-10 items | Column definitions |
| columns[].name | string | Yes | 1-100 chars, unique within template | Column name |
| columns[].color | string | Yes | Valid hex (#RRGGBB) | Column header color |
| columns[].prompt_text | string | No | 0-200 chars | Placeholder text for add-card form |
| columns[].position | integer | Yes | 0-indexed, sequential | Column display order |

**Response:** `201 Created`

```json
{
  "ok": true,
  "data": {
    "id": "t-custom-new",
    "name": "Our Team Retro",
    "description": "Custom format designed for our weekly retros.",
    "is_system": false,
    "team_id": "team-alpha-id",
    "created_by": "user-admin-id",
    "created_at": "2026-02-14T10:00:00.000Z",
    "updated_at": "2026-02-14T10:00:00.000Z",
    "columns": [
      {
        "id": "tc-new-1",
        "name": "Wins",
        "color": "#22c55e",
        "prompt_text": "What were our wins this sprint?",
        "position": 0
      },
      {
        "id": "tc-new-2",
        "name": "Challenges",
        "color": "#f59e0b",
        "prompt_text": "What challenges did we face?",
        "position": 1
      },
      {
        "id": "tc-new-3",
        "name": "Ideas",
        "color": "#8b5cf6",
        "prompt_text": "What new ideas should we try?",
        "position": 2
      }
    ]
  }
}
```

**Errors:**
- `404 TEAM_NOT_FOUND` — Team does not exist
- `403 FORBIDDEN` — User is not a team admin
- `409 TEMPLATE_NAME_TAKEN` — Template name already exists for this team
- `422 VALIDATION_ERROR` — Missing fields, too many/few columns, duplicate column names, invalid color, non-sequential positions

---

## 4. Update Custom Template

Updates a custom template's name, description, and/or columns.

**Endpoint:** `PUT /api/v1/teams/:teamId/templates/:id`

**Authorization:** Team admin

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| teamId | uuid | Team that owns the template |
| id | uuid | Template ID |

**Request Body:**

```json
{
  "name": "Updated Team Retro",
  "description": "Revised format with an extra column.",
  "columns": [
    {
      "id": "tc-new-1",
      "name": "Wins",
      "color": "#22c55e",
      "prompt_text": "What were our wins this sprint?",
      "position": 0
    },
    {
      "id": "tc-new-2",
      "name": "Challenges",
      "color": "#f59e0b",
      "prompt_text": "What challenges did we face?",
      "position": 1
    },
    {
      "id": "tc-new-3",
      "name": "Ideas",
      "color": "#8b5cf6",
      "prompt_text": "What new ideas should we try?",
      "position": 2
    },
    {
      "name": "Shoutouts",
      "color": "#ec4899",
      "prompt_text": "Who deserves a shoutout?",
      "position": 3
    }
  ]
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| name | string | No | 1-100 chars, unique within team | Updated template name |
| description | string | No | 0-500 chars | Updated description |
| columns | array | No | 1-10 items | Full replacement of column definitions |

**Column Update Strategy:** When `columns` is provided, it is a **full replacement**:
- Existing columns with matching `id` are updated in place.
- New columns (without `id`) are created.
- Existing columns NOT present in the array are deleted.

This approach avoids complex partial-update logic and is easy to reason about.

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "t-custom-new",
    "name": "Updated Team Retro",
    "description": "Revised format with an extra column.",
    "is_system": false,
    "team_id": "team-alpha-id",
    "created_by": "user-admin-id",
    "created_at": "2026-02-14T10:00:00.000Z",
    "updated_at": "2026-02-14T11:00:00.000Z",
    "columns": [
      {
        "id": "tc-new-1",
        "name": "Wins",
        "color": "#22c55e",
        "prompt_text": "What were our wins this sprint?",
        "position": 0
      },
      {
        "id": "tc-new-2",
        "name": "Challenges",
        "color": "#f59e0b",
        "prompt_text": "What challenges did we face?",
        "position": 1
      },
      {
        "id": "tc-new-3",
        "name": "Ideas",
        "color": "#8b5cf6",
        "prompt_text": "What new ideas should we try?",
        "position": 2
      },
      {
        "id": "tc-new-4",
        "name": "Shoutouts",
        "color": "#ec4899",
        "prompt_text": "Who deserves a shoutout?",
        "position": 3
      }
    ]
  }
}
```

**Errors:**
- `404 TEMPLATE_NOT_FOUND` — Template does not exist or does not belong to this team
- `403 FORBIDDEN` — User is not team admin
- `403 SYSTEM_TEMPLATE_IMMUTABLE` — Cannot modify a system template
- `409 TEMPLATE_NAME_TAKEN` — Updated name conflicts with another template in the team
- `422 VALIDATION_ERROR` — Same as create

**Important Notes:**
- Updating a template does NOT affect boards that were already created from it. Board columns are copies, not references.
- System templates return `403 SYSTEM_TEMPLATE_IMMUTABLE`.

---

## 5. Delete Custom Template

Deletes a custom template and its column definitions.

**Endpoint:** `DELETE /api/v1/teams/:teamId/templates/:id`

**Authorization:** Team admin

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| teamId | uuid | Team that owns the template |
| id | uuid | Template ID |

**Request Body:** None

**Response:** `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "t-custom-001",
    "deleted": true
  }
}
```

**Errors:**
- `404 TEMPLATE_NOT_FOUND` — Template does not exist or does not belong to this team
- `403 FORBIDDEN` — User is not team admin
- `403 SYSTEM_TEMPLATE_IMMUTABLE` — Cannot delete a system template
- `409 TEMPLATE_IN_USE` — Boards reference this template (FK RESTRICT)

**Notes:**
- The `boards.template_id` FK uses ON DELETE RESTRICT, so a template cannot be deleted if any board references it.
- To delete a template that has been used, the boards referencing it must first be deleted or the template_id must be re-pointed (not supported in this version — this is by design to preserve audit trail).
- Deleting a template cascades to its `template_columns` rows (ON DELETE CASCADE).

---

## Data Type Reference

### Template Object (List)

```typescript
interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  team_id: string | null;
  created_by: string | null;
  column_count: number;
  created_at: string;
  updated_at: string;
}
```

### Template Object (Detail)

```typescript
interface Template {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  team_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  columns: TemplateColumn[];
}
```

### TemplateColumn Object

```typescript
interface TemplateColumn {
  id: string;
  name: string;
  color: string;        // hex, e.g. "#22c55e"
  prompt_text: string;   // placeholder text for card creation
  position: number;      // 0-indexed
}
```
