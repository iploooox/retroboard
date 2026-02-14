---
changed: 2026-02-14 — Spec Review Gate
---

# Sprints Database Specification

**Feature:** sprints
**Database:** PostgreSQL 15+
**Driver:** postgres (porsager/postgres)

---

## 1. ER Diagram

```
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│              users                    │     │              teams                    │
│         (from auth feature)          │     │         (from teams feature)          │
├──────────────────────────────────────┤     ├──────────────────────────────────────┤
│ id           UUID        PK          │     │ id           UUID        PK          │
│ ...                                  │     │ ...                                  │
└───────────────┬──────────────────────┘     └───────────────┬──────────────────────┘
                │                                            │
                │ 1:N (created_by)                           │ 1:N (team_id)
                │                                            │
                └──────────────┬─────────────────────────────┘
                               │
                ┌──────────────┴───────────────────────────┐
                │              sprints                      │
                ├──────────────────────────────────────────┤
                │ id           UUID          PK             │
                │ team_id      UUID          FK → teams     │
                │ name         VARCHAR(100)  NOT NULL       │
                │ goal         VARCHAR(500)  NULL           │
                │ start_date   DATE          NOT NULL       │
                │ end_date     DATE          NULL           │
                │ status       sprint_status NOT NULL       │
                │ sprint_number INTEGER      NOT NULL       │
                │ created_by   UUID          FK → users     │
                │ created_at   TIMESTAMPTZ   NOT NULL       │
                │ updated_at   TIMESTAMPTZ   NOT NULL       │
                └──────────────────────────────────────────┘

Constraints:
  - Partial unique index on (team_id) WHERE status = 'active' → Only one active sprint per team
  - UNIQUE(team_id, sprint_number) → Sprint numbers are unique within a team
```

## 2. Enum Type: sprint_status

```sql
CREATE TYPE sprint_status AS ENUM ('planning', 'active', 'completed');
```

Represents the lifecycle stage of a sprint. Status transitions are enforced by the application layer:
- `planning` -> `active` (activate)
- `active` -> `completed` (complete)
- No backward transitions.

## 3. Table: sprints

Stores sprint records. Each sprint belongs to exactly one team.

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | `UUID` | NOT NULL | `gen_random_uuid()` | Primary key |
| team_id | `UUID` | NOT NULL | -- | FK to teams.id (owning team) |
| name | `VARCHAR(100)` | NOT NULL | -- | Sprint name (e.g., "Sprint 42") |
| goal | `VARCHAR(500)` | NULL | `NULL` | Sprint goal description |
| start_date | `DATE` | NOT NULL | -- | Sprint start date (no time component) |
| end_date | `DATE` | NULL | `NULL` | Sprint end date. NULL if open-ended. |
| status | `sprint_status` | NOT NULL | `'planning'` | Current lifecycle status |
| sprint_number | `INTEGER` | NOT NULL | -- | Auto-incremented sprint number within team |
| created_by | `UUID` | NOT NULL | -- | FK to users.id (sprint creator) |
| created_at | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Record creation timestamp |
| updated_at | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Last update timestamp |

### Constraints

| Name | Type | Columns/Condition | Description |
|------|------|-------------------|-------------|
| sprints_pkey | PRIMARY KEY | id | |
| sprints_team_id_fkey | FOREIGN KEY | team_id | References teams(id) ON DELETE CASCADE |
| sprints_created_by_fkey | FOREIGN KEY | created_by | References users(id) ON DELETE RESTRICT |
| sprints_end_date_check | CHECK | end_date | `end_date IS NULL OR end_date >= start_date` |
| sprints_team_sprint_number_key | UNIQUE | (team_id, sprint_number) | Sprint numbers are unique within a team |
| sprints_team_active_idx | UNIQUE (partial) | team_id WHERE status = 'active' | Only one active sprint per team |

### Indexes

| Name | Columns / Condition | Type | Purpose |
|------|-------------------|------|---------|
| sprints_pkey | id | B-tree (PK) | Primary key lookups |
| sprints_team_id_status_idx | (team_id, status) | B-tree | List sprints by team, filter by status |
| sprints_team_id_start_date_idx | (team_id, start_date DESC) | B-tree | Paginated sprint listing sorted by date |
| sprints_team_sprint_number_key | (team_id, sprint_number) | B-tree (UNIQUE) | Enforce unique sprint numbers per team |
| sprints_team_active_idx | team_id WHERE status = 'active' | B-tree (partial UNIQUE) | Enforce one active sprint per team |

### Notes

- `start_date` and `end_date` use `DATE` type (not `TIMESTAMPTZ`). Sprints represent calendar date ranges, not precise timestamps.
- The partial unique index `sprints_team_active_idx` only applies to rows where `status = 'active'`. This means:
  - Multiple `planning` sprints can exist per team.
  - Multiple `completed` sprints can exist per team.
  - Only ONE `active` sprint can exist per team.
- `sprint_number` is auto-incremented per team using a subquery at insert time (not a database sequence). This keeps numbering scoped to each team.
- `ON DELETE CASCADE` on `team_id` ensures deleting a team removes all its sprints.
- `ON DELETE RESTRICT` on `created_by` prevents deleting a user who created sprints.

## 4. Migration SQL

### Migration 006: Create sprints table

```sql
-- Migration: 006_create_sprints
-- Description: Create the sprints table with status enum and one-active-per-team constraint
-- Created: 2026-02-14

CREATE TYPE sprint_status AS ENUM ('planning', 'active', 'completed');

CREATE TABLE IF NOT EXISTS sprints (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID            NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    goal            VARCHAR(500),
    start_date      DATE            NOT NULL,
    end_date        DATE,
    status          sprint_status   NOT NULL DEFAULT 'planning',
    sprint_number   INTEGER         NOT NULL,
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT sprints_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT sprints_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT sprints_end_date_check
        CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT sprints_team_sprint_number_key
        UNIQUE (team_id, sprint_number)
);

-- Composite index for listing sprints by team and filtering by status
CREATE INDEX IF NOT EXISTS sprints_team_id_status_idx
    ON sprints (team_id, status);

-- Index for paginated listing sorted by start_date descending
CREATE INDEX IF NOT EXISTS sprints_team_id_start_date_idx
    ON sprints (team_id, start_date DESC);

-- Partial unique index: only one active sprint per team
CREATE UNIQUE INDEX IF NOT EXISTS sprints_team_active_idx
    ON sprints (team_id) WHERE status = 'active';

COMMENT ON TABLE sprints IS 'Time-boxed iterations that contain retro boards';
COMMENT ON COLUMN sprints.status IS 'Lifecycle: planning -> active -> completed';
COMMENT ON COLUMN sprints.sprint_number IS 'Auto-incremented sprint number within a team (not a DB sequence)';
COMMENT ON COLUMN sprints.start_date IS 'Sprint start date (calendar date, no time)';
COMMENT ON COLUMN sprints.end_date IS 'Sprint end date. NULL for open-ended sprints.';
COMMENT ON INDEX sprints_team_active_idx IS 'Enforces at most one active sprint per team';
```

## 5. Query Patterns

### 5.1 Create sprint

The `sprint_number` is auto-assigned as the next available number for the team:

```sql
INSERT INTO sprints (team_id, name, goal, start_date, end_date, sprint_number, created_by)
VALUES (
  $1, $2, $3, $4, $5,
  (SELECT COALESCE(MAX(sprint_number), 0) + 1 FROM sprints WHERE team_id = $1),
  $6
)
RETURNING *;
```

### 5.2 List sprints for team (paginated, optionally filtered)

```sql
-- Without status filter
SELECT *, COUNT(*) OVER() AS total_count
FROM sprints
WHERE team_id = $1
ORDER BY start_date DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- With status filter
SELECT *, COUNT(*) OVER() AS total_count
FROM sprints
WHERE team_id = $1 AND status = $2
ORDER BY start_date DESC, created_at DESC
LIMIT $3 OFFSET $4;
```

The `COUNT(*) OVER()` window function returns the total matching rows alongside each row, enabling pagination metadata without a separate COUNT query.

### 5.3 Get sprint by ID (scoped to team)

```sql
SELECT * FROM sprints
WHERE id = $1 AND team_id = $2;
```

Always include `team_id` in the WHERE clause to enforce team scoping. This prevents a user from accessing sprints of another team by guessing sprint IDs.

### 5.4 Update sprint fields

```sql
UPDATE sprints
SET name = COALESCE($3, name),
    goal = CASE WHEN $4::boolean THEN $5 ELSE goal END,
    start_date = COALESCE($6, start_date),
    end_date = CASE WHEN $7::boolean THEN $8 ELSE end_date END,
    updated_at = NOW()
WHERE id = $1 AND team_id = $2
RETURNING *;
```

Note: The service layer builds the SET clause dynamically based on which fields are provided and the sprint's current status (dates only editable in planning). The above is conceptual; actual implementation uses tagged template literals.

### 5.5 Activate sprint

```sql
UPDATE sprints
SET status = 'active', updated_at = NOW()
WHERE id = $1 AND team_id = $2 AND status = 'planning'
RETURNING *;
```

If another sprint is active for this team, the `sprints_team_active_idx` partial unique index causes a unique violation error. The service layer catches this and returns `SPRINT_ALREADY_ACTIVE`.

### 5.6 Complete sprint

```sql
UPDATE sprints
SET status = 'completed', updated_at = NOW()
WHERE id = $1 AND team_id = $2 AND status = 'active'
RETURNING *;
```

### 5.7 Get active sprint for team

```sql
SELECT * FROM sprints
WHERE team_id = $1 AND status = 'active';
```

Uses the `sprints_team_active_idx` partial unique index for efficient lookup. Returns at most one row.

### 5.8 Delete sprint

```sql
DELETE FROM sprints
WHERE id = $1 AND team_id = $2
RETURNING id;
```

### 5.9 Count sprints by status (for team dashboard)

```sql
SELECT status, COUNT(*) AS count
FROM sprints
WHERE team_id = $1
GROUP BY status;
```

## 6. Data Volume Estimates

| Metric | Estimate |
|--------|----------|
| Sprints per team | 1-5 active/planning, 10-200+ completed over time |
| Total rows | At 100 teams with 50 sprints each: ~5,000 rows |
| Row size | ~200 bytes per row |
| Index overhead | Minimal -- all indexes on small columns |

Well within PostgreSQL comfortable range. The `sprints_team_id_start_date_idx` index ensures paginated queries over large sprint histories remain fast (< 500ms target per NFR-04).

## 7. Cascade Behavior

| Parent deleted | Cascading effect |
|----------------|------------------|
| Team deleted | All sprints for that team are deleted (CASCADE) |
| Sprint deleted | In Phase 2: retro boards, cards, votes for that sprint will cascade |
| User deleted | RESTRICTED -- cannot delete user who created sprints |

## 8. Migration Dependencies

```
001_create_users              ← required by sprints (created_by FK)
002_create_refresh_tokens
003_create_teams              ← required by sprints (team_id FK)
004_create_team_members
005_create_team_invitations
006_create_sprints            ← this migration
```

## 9. Partial Unique Index Behavior

The key constraint for this feature is the partial unique index:

```sql
CREATE UNIQUE INDEX sprints_team_active_idx
    ON sprints (team_id) WHERE status = 'active';
```

This index:
- Only includes rows where `status = 'active'`.
- Ensures at most one such row per `team_id`.
- Is automatically maintained by PostgreSQL on INSERT and UPDATE.
- Raises a unique violation error (SQLSTATE 23505) when a second active sprint would be created for the same team.

**Handling the violation in code:**

```typescript
try {
  const result = await sql`
    UPDATE sprints
    SET status = 'active', updated_at = NOW()
    WHERE id = ${sprintId} AND team_id = ${teamId} AND status = 'planning'
    RETURNING *
  `;
  return result[0];
} catch (error) {
  if (error.code === '23505' && error.constraint === 'sprints_team_active_idx') {
    throw new AppError('SPRINT_ALREADY_ACTIVE', 409);
  }
  throw error;
}
```
