# Sprints Feature Architecture

**Feature:** sprints
**Service:** retroboard-server
**Depends on:** teams
**Phase:** 1
**Status:** planning

---

## 1. Overview

The sprints feature provides sprint lifecycle management for teams. A sprint is a time-boxed iteration that serves as the container for retro boards. Each sprint belongs to a team and tracks a name, goal, date range, and status. Only one sprint can be active per team at any time. Sprint history is queryable with pagination, enabling teams to look back at past retrospectives across their sprint history.

## 2. Current State

Nothing exists. The teams feature (teams, team_members tables) is a prerequisite. No sprints table exists.

## 3. Target State

| Capability | Detail |
|-----------|--------|
| Sprint creation | Admin or facilitator creates a sprint with name, goal, start/end dates. Status starts as `planning`. |
| Sprint status | Three statuses: `planning` (not yet started), `active` (in progress), `completed` (finished). |
| Status transitions | `planning` -> `active` -> `completed`. No backward transitions. |
| Active sprint constraint | Only one sprint per team can have status `active` at any time. Enforced at DB level. |
| Sprint completion | Completing a sprint sets status to `completed`. Cannot be undone. |
| Sprint listing | Paginated list filtered by team and optionally by status. Sorted by start_date descending. |
| Sprint deletion | Admin can delete a sprint. Cascades to retro boards (Phase 2). |
| Team scoping | All sprint operations require team membership. Sprints are always accessed via `/teams/:teamId/sprints/...`. |

## 4. Design Decisions

### 4.1 Sprint Status as PostgreSQL Enum

```
planning  ──>  active  ──>  completed
```

Status is stored as a PostgreSQL enum `sprint_status` with values `('planning', 'active', 'completed')`. State transitions are enforced in the service layer, not via database constraints. The service layer validates:
- Can only move from `planning` to `active`.
- Can only move from `active` to `completed`.
- No backward transitions.

### 4.2 One Active Sprint Per Team

A partial unique index ensures only one active sprint exists per team:

```sql
CREATE UNIQUE INDEX sprints_team_active_idx
    ON sprints (team_id) WHERE status = 'active';
```

This is a PostgreSQL partial unique index. It only applies the uniqueness constraint to rows where `status = 'active'`. Multiple `planning` or `completed` sprints per team are allowed.

If a user tries to activate a sprint while another is already active, the unique index violation triggers a clear error: "Another sprint is already active. Complete or delete it first."

### 4.3 Date Range Semantics

- `start_date` and `end_date` are `DATE` type (no time component).
- `start_date` is required. `end_date` is optional (some teams do not pre-commit to end dates).
- Dates are informational -- they do not automatically trigger status changes. The facilitator manually starts and completes sprints.
- No overlap validation is enforced at the DB level. Teams can have overlapping date ranges (this is common in practice when sprints run in parallel sub-teams).

### 4.4 Sprint as Retro Board Container

In Phase 2, retro boards will be created within sprints. The relationship is:

```
Team → Sprint → Retro Board → Columns → Cards
```

For Phase 1, the sprints table is created with the FK structure ready, but no boards table exists yet. The sprint acts as a future parent for boards.

### 4.5 Role Requirements

| Operation | Required role |
|-----------|-------------|
| Create sprint | admin, facilitator |
| List sprints | admin, facilitator, member |
| Get sprint details | admin, facilitator, member |
| Update sprint (name, goal, dates) | admin, facilitator |
| Activate sprint (planning -> active) | admin, facilitator |
| Complete sprint (active -> completed) | admin, facilitator |
| Delete sprint | admin |

## 5. Architecture Layers

```
Request Flow:

  Client
    |
    | Authorization: Bearer <token>
    v
┌──────────────────────────────────────────────────┐
│  Auth Middleware                                   │
│  Extracts user → c.set('user', { id, email })    │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│  RBAC Middleware                                   │
│  Checks user membership in :teamId                │
│  Sets c.set('teamRole', role)                     │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│  Route Handler                                    │
│  (e.g., POST /api/v1/teams/:teamId/sprints)      │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│  Sprints Service                                  │
│  - createSprint(teamId, userId, data)             │
│  - listSprints(teamId, filters, pagination)       │
│  - getSprint(teamId, sprintId)                    │
│  - updateSprint(teamId, sprintId, data)           │
│  - activateSprint(teamId, sprintId)               │
│  - completeSprint(teamId, sprintId)               │
│  - deleteSprint(teamId, sprintId)                 │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│  Sprints Repository                               │
│  SQL queries for sprints table                    │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│  PostgreSQL                                       │
│  Table: sprints                                   │
│  Partial unique index: one active per team        │
└──────────────────────────────────────────────────┘
```

## 6. File Structure

```
src/
  routes/
    sprints.ts               # Hono router for /api/v1/teams/:teamId/sprints/*
  services/
    sprints.service.ts       # Business logic for sprint lifecycle
  repositories/
    sprints.repository.ts    # SQL queries for sprints table
  types/
    sprints.ts               # TypeScript interfaces: Sprint, SprintStatus, etc.
  db/
    migrations/
      006_create_sprints.sql
```

## 7. Sprint Lifecycle Flow

```
                    ┌──────────────────┐
  Create Sprint ──> │    planning      │
                    │                  │
                    │  Edit name/goal/ │
                    │  dates freely    │
                    └────────┬─────────┘
                             │
                    PUT /:id (status transition)
                    or PUT /:id/activate (dedicated endpoint)
                             │
                             v
                    ┌──────────────────┐
                    │     active       │
                    │                  │
                    │  Retro boards    │
                    │  can be created  │
                    │  (Phase 2)       │
                    │                  │
                    │  Edit name/goal  │
                    │  (dates locked)  │
                    └────────┬─────────┘
                             │
                    PUT /:id/complete
                             │
                             v
                    ┌──────────────────┐
                    │    completed     │
                    │                  │
                    │  Read-only       │
                    │  Historical      │
                    │  record          │
                    └──────────────────┘
```

### Status Transition Rules

| Current | Target | Allowed? | Notes |
|---------|--------|----------|-------|
| planning | active | Yes | Only if no other sprint is active for this team |
| planning | completed | No | Must go through active first |
| active | completed | Yes | Always allowed |
| active | planning | No | No backward transitions |
| completed | planning | No | Completed is terminal |
| completed | active | No | Completed is terminal |

### Editability by Status

| Field | planning | active | completed |
|-------|---------|--------|-----------|
| name | Editable | Editable | Read-only |
| goal | Editable | Editable | Read-only |
| start_date | Editable | Read-only | Read-only |
| end_date | Editable | Read-only | Read-only |

## 8. Sprint Activation Flow

```
  Client                         Server                            PostgreSQL
    |                              |                                   |
    |  PUT /teams/:tid/            |                                   |
    |    sprints/:sid/activate     |                                   |
    |----------------------------->|                                   |
    |                              |  Check sprint exists              |
    |                              |  and belongs to team              |
    |                              |---------------------------------->|
    |                              |  sprint row (status=planning)     |
    |                              |<----------------------------------|
    |                              |                                   |
    |                              |  Validate: status == 'planning'   |
    |                              |                                   |
    |                              |  UPDATE sprints                   |
    |                              |  SET status = 'active'            |
    |                              |  WHERE id = $1                    |
    |                              |  AND team_id = $2                 |
    |                              |---------------------------------->|
    |                              |                                   |
    |                              |  If unique index violation:       |
    |                              |    ROLLBACK                       |
    |                              |    Return 409: another sprint     |
    |                              |    is already active              |
    |                              |                                   |
    |                              |  If success:                      |
    |                              |    sprint row (status=active)     |
    |                              |<----------------------------------|
    |                              |                                   |
    |  200 OK                      |                                   |
    |  { sprint }                  |                                   |
    |<-----------------------------|                                   |
```

## 9. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Cross-team access | All sprint queries include `team_id` in WHERE clause. RBAC middleware verifies team membership. |
| Unauthorized sprint management | Only admin/facilitator can create, update, activate, complete. Only admin can delete. |
| Data integrity | Partial unique index prevents multiple active sprints. Status transitions enforced in service layer. |
| Sprint deletion cascade | In Phase 2, deleting a sprint will cascade to retro boards, cards, votes. FK constraints handle this. |

## 10. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SPRINT_NOT_FOUND` | 404 | Sprint does not exist or does not belong to this team |
| `SPRINT_INVALID_TRANSITION` | 400 | Invalid status transition (e.g., planning -> completed) |
| `SPRINT_ALREADY_ACTIVE` | 409 | Another sprint is already active for this team |
| `SPRINT_NOT_EDITABLE` | 400 | Sprint is completed and cannot be modified |
| `SPRINT_DATE_INVALID` | 400 | end_date is before start_date |
| `VALIDATION_ERROR` | 400 | Request body fails validation |
| `TEAM_NOT_FOUND` | 404 | Parent team does not exist |
| `TEAM_NOT_MEMBER` | 403 | User is not a member of the team |
| `TEAM_INSUFFICIENT_ROLE` | 403 | User's role lacks required permission |

## 11. Future Considerations (Not in Phase 1)

- **Sprint velocity tracking**: Calculate story points completed per sprint (requires integration with external tools or manual input).
- **Automatic sprint transitions**: Use `start_date`/`end_date` to auto-activate and auto-complete sprints. Currently manual only.
- **Sprint templates**: Pre-fill sprint goals, board templates, and action item carry-over from previous sprint.
- **Sprint comparison**: Side-by-side comparison of two sprints' retro outcomes.
- **Sprint archival**: Soft-delete for sprints instead of hard delete. Move to an "archived" status.
