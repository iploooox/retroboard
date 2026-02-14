---
changed: 2026-02-14 — Spec Review Gate
---

# Templates — API Specification

## Base URL

All endpoints are prefixed with `/api/v1`. All requests require a valid JWT in the `Authorization: Bearer <token>` header.

> **Scope note:** Phase 1 (S-012) includes only read-only access to system templates. Custom template CRUD (create, update, delete) is deferred to Phase 5 (S-025).

## Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `TEMPLATE_NOT_FOUND` | 404 | Template does not exist or not accessible |
| `VALIDATION_ERROR` | 400 | Request body failed validation |

---

## 1. List System Templates

Returns all system templates available in the platform.

**Endpoint:** `GET /api/v1/templates`

**Authorization:** Any authenticated user

**Query Parameters:** None

**Response:** `200 OK`

```json
{
  "templates": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "name": "What Went Well / Delta",
      "description": "Classic two-column format focusing on positives and changes needed. Simple and effective for teams of any size.",
      "is_system": true,
      "team_id": null,
      "created_by": null,
      "column_count": 2,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "00000000-0000-4000-8000-000000000002",
      "name": "Start / Stop / Continue",
      "description": "Three actionable columns for behavioral feedback. Great for identifying concrete changes the team should make.",
      "is_system": true,
      "team_id": null,
      "created_by": null,
      "column_count": 3,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

**Notes:**
- In Phase 1, only system templates are returned. There are no custom templates.
- Templates are sorted by their seeded order.
- The response includes `column_count` for display purposes but not the full column definitions. Use the detail endpoint to get columns.

---

## 2. Get Template Detail

Returns a single template with its full column definitions.

**Endpoint:** `GET /api/v1/templates/:id`

**Authorization:** Any authenticated user

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Template ID |

**Response:** `200 OK`

```json
{
  "template": {
    "id": "00000000-0000-4000-8000-000000000002",
    "name": "Start / Stop / Continue",
    "description": "Three actionable columns for behavioral feedback. Great for identifying concrete changes the team should make.",
    "is_system": true,
    "team_id": null,
    "created_by": null,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z",
    "columns": [
      {
        "id": "00000000-0000-4000-8002-000000000001",
        "name": "Start Doing",
        "color": "#22c55e",
        "prompt_text": "What should the team start doing?",
        "position": 0
      },
      {
        "id": "00000000-0000-4000-8002-000000000002",
        "name": "Stop Doing",
        "color": "#ef4444",
        "prompt_text": "What should the team stop doing?",
        "position": 1
      },
      {
        "id": "00000000-0000-4000-8002-000000000003",
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
- `404 TEMPLATE_NOT_FOUND` — Template does not exist

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
