# Action Items Database Specification

## Tables

### action_items

Stores all action items created during retro sessions. Each item is linked to a board (and transitively to a sprint and team). Optionally linked to a source card and to an original action item via carry-over.

```sql
CREATE TABLE action_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id         UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  card_id          UUID REFERENCES cards(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  assignee_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date         DATE,
  status           TEXT NOT NULL DEFAULT 'open',
  carried_from_id  UUID REFERENCES action_items(id) ON DELETE SET NULL,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_action_item_status
    CHECK (status IN ('open', 'in_progress', 'done')),

  CONSTRAINT chk_action_item_title_length
    CHECK (char_length(title) >= 1 AND char_length(title) <= 500),

  CONSTRAINT chk_action_item_description_length
    CHECK (description IS NULL OR char_length(description) <= 5000)
);
```

### Column Details

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | Primary key |
| `board_id` | UUID | NOT NULL | - | FK to boards. The board this item was created in. CASCADE on delete. |
| `card_id` | UUID | NULL | `NULL` | FK to cards. The source card that inspired this item. SET NULL on delete. |
| `title` | TEXT | NOT NULL | - | Action item title (1-500 chars) |
| `description` | TEXT | NULL | `NULL` | Detailed description (max 5000 chars) |
| `assignee_id` | UUID | NULL | `NULL` | FK to users. Assigned team member. SET NULL on delete. |
| `due_date` | DATE | NULL | `NULL` | Due date (date only, no time) |
| `status` | TEXT | NOT NULL | `'open'` | Status: `open`, `in_progress`, `done` |
| `carried_from_id` | UUID | NULL | `NULL` | FK to action_items (self-referential). The original item this was carried from. SET NULL on delete. |
| `created_by` | UUID | NOT NULL | - | FK to users. User who created this item. |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Last modification timestamp |

### Indexes

```sql
-- Find action items for a board (most common query)
CREATE INDEX idx_action_items_board_id
  ON action_items (board_id);

-- Find action items by assignee across boards
CREATE INDEX idx_action_items_assignee_id
  ON action_items (assignee_id)
  WHERE assignee_id IS NOT NULL;

-- Find action items by status (for filtering)
CREATE INDEX idx_action_items_status
  ON action_items (status);

-- Find items carried from a specific original (for carry-over dedup)
CREATE INDEX idx_action_items_carried_from
  ON action_items (carried_from_id)
  WHERE carried_from_id IS NOT NULL;

-- Find overdue items
CREATE INDEX idx_action_items_due_date
  ON action_items (due_date)
  WHERE due_date IS NOT NULL AND status != 'done';

-- Composite index for team-wide queries (join through boards -> sprints -> teams)
CREATE INDEX idx_action_items_board_status
  ON action_items (board_id, status);

-- For sorting by creation date
CREATE INDEX idx_action_items_created_at
  ON action_items (created_at DESC);
```

### Foreign Key Relationships

```
action_items.board_id       -> boards.id        (ON DELETE CASCADE)
action_items.card_id        -> cards.id          (ON DELETE SET NULL)
action_items.assignee_id    -> users.id          (ON DELETE SET NULL)
action_items.carried_from_id -> action_items.id  (ON DELETE SET NULL)
action_items.created_by     -> users.id          (NOT NULL, no cascade)
```

Rationale for cascade/set-null choices:
- **board_id CASCADE**: when a board is deleted, its action items are meaningless without context
- **card_id SET NULL**: if the source card is deleted, the action item should persist but lose the link
- **assignee_id SET NULL**: if the user is removed, the item becomes unassigned rather than deleted
- **carried_from_id SET NULL**: if the original item is deleted, the carried item should persist independently
- **created_by**: no cascade -- we never delete user records (soft delete), and the creator reference is informational

## Queries

### Create action item

```sql
INSERT INTO action_items (board_id, card_id, title, description, assignee_id, due_date, status, carried_from_id, created_by)
VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8)
RETURNING *;
```

### Get action items for a board

```sql
SELECT
  ai.*,
  u_assignee.name AS assignee_name,
  u_creator.name AS created_by_name,
  c.text AS card_text,
  carried.title AS carried_from_title,
  carried_sprint.name AS carried_from_sprint_name
FROM action_items ai
LEFT JOIN users u_assignee ON ai.assignee_id = u_assignee.id
LEFT JOIN users u_creator ON ai.created_by = u_creator.id
LEFT JOIN cards c ON ai.card_id = c.id
LEFT JOIN action_items carried ON ai.carried_from_id = carried.id
LEFT JOIN boards carried_board ON carried.board_id = carried_board.id
LEFT JOIN sprints carried_sprint ON carried_board.sprint_id = carried_sprint.id
WHERE ai.board_id = $1
ORDER BY ai.created_at ASC;
```

### Get action items for a team (cross-sprint dashboard)

```sql
SELECT
  ai.*,
  u_assignee.name AS assignee_name,
  u_creator.name AS created_by_name,
  s.id AS sprint_id,
  s.name AS sprint_name,
  c.text AS card_text,
  carried_sprint.name AS carried_from_sprint_name
FROM action_items ai
JOIN boards b ON ai.board_id = b.id
JOIN sprints s ON b.sprint_id = s.id
JOIN teams t ON s.team_id = t.id
LEFT JOIN users u_assignee ON ai.assignee_id = u_assignee.id
LEFT JOIN users u_creator ON ai.created_by = u_creator.id
LEFT JOIN cards c ON ai.card_id = c.id
LEFT JOIN action_items carried ON ai.carried_from_id = carried.id
LEFT JOIN boards carried_board ON carried.board_id = carried_board.id
LEFT JOIN sprints carried_sprint ON carried_board.sprint_id = carried_sprint.id
WHERE t.id = $1
  AND ($2::text IS NULL OR ai.status = $2)
  AND ($3::uuid IS NULL OR s.id = $3)
  AND ($4::uuid IS NULL OR ai.assignee_id = $4)
ORDER BY s.start_date DESC, ai.created_at ASC
LIMIT $5 OFFSET $6;
```

### Count by status for team summary

```sql
SELECT
  COUNT(*) FILTER (WHERE ai.status = 'open') AS open_count,
  COUNT(*) FILTER (WHERE ai.status = 'in_progress') AS in_progress_count,
  COUNT(*) FILTER (WHERE ai.status = 'done') AS done_count,
  COUNT(*) FILTER (
    WHERE ai.status IN ('open', 'in_progress')
    AND ai.due_date IS NOT NULL
    AND ai.due_date < CURRENT_DATE
  ) AS overdue_count
FROM action_items ai
JOIN boards b ON ai.board_id = b.id
JOIN sprints s ON b.sprint_id = s.id
WHERE s.team_id = $1
  AND ($2::text IS NULL OR ai.status = $2)
  AND ($3::uuid IS NULL OR s.id = $3)
  AND ($4::uuid IS NULL OR ai.assignee_id = $4);
```

### Update action item

```sql
UPDATE action_items
SET
  title = COALESCE($2, title),
  description = CASE WHEN $3::boolean THEN $4 ELSE description END,
  assignee_id = CASE WHEN $5::boolean THEN $6::uuid ELSE assignee_id END,
  due_date = CASE WHEN $7::boolean THEN $8::date ELSE due_date END,
  status = COALESCE($9, status),
  updated_at = NOW()
WHERE id = $1
RETURNING *;
```

Note: The boolean flags ($3, $5, $7) indicate whether the corresponding field was explicitly provided in the request (to distinguish between "not provided" and "set to null").

### Delete action item

```sql
DELETE FROM action_items
WHERE id = $1
RETURNING id;
```

### Carry-over: find unresolved items from previous sprint

```sql
-- Step 1: Find the most recent completed sprint for the team
WITH current_board AS (
  SELECT b.id AS board_id, s.team_id, s.id AS sprint_id
  FROM boards b
  JOIN sprints s ON b.sprint_id = s.id
  WHERE b.id = $1
),
previous_sprint AS (
  SELECT s.id AS sprint_id, s.name AS sprint_name
  FROM sprints s
  JOIN current_board cb ON s.team_id = cb.team_id
  WHERE s.id != cb.sprint_id
    AND s.end_date <= (
      SELECT s2.start_date FROM sprints s2 WHERE s2.id = cb.sprint_id
    )
  ORDER BY s.end_date DESC
  LIMIT 1
)
-- Step 2: Get unresolved action items from that sprint
SELECT
  ai.*,
  ps.sprint_name AS source_sprint_name,
  u.name AS assignee_name
FROM action_items ai
JOIN boards b ON ai.board_id = b.id
JOIN previous_sprint ps ON b.sprint_id = ps.sprint_id
LEFT JOIN users u ON ai.assignee_id = u.id
WHERE ai.status IN ('open', 'in_progress');
```

### Carry-over: check for already-carried items

```sql
SELECT carried_from_id
FROM action_items
WHERE board_id = $1
  AND carried_from_id IS NOT NULL;
```

### Carry-over: insert carried items

```sql
INSERT INTO action_items (board_id, title, description, assignee_id, due_date, status, carried_from_id, created_by)
SELECT
  $1,           -- new board_id
  ai.title,
  ai.description,
  ai.assignee_id,
  ai.due_date,
  'open',       -- reset status to open
  ai.id,        -- carried_from_id
  $2            -- created_by (facilitator who triggered carry-over)
FROM action_items ai
WHERE ai.id = ANY($3::uuid[])
RETURNING *;
```

## Triggers

### Updated_at trigger

```sql
CREATE OR REPLACE FUNCTION update_action_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW EXECUTE FUNCTION update_action_items_updated_at();
```

## Migration

```sql
-- Migration: 008_create_action_items.sql

BEGIN;

CREATE TABLE IF NOT EXISTS action_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id         UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  card_id          UUID REFERENCES cards(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  assignee_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date         DATE,
  status           TEXT NOT NULL DEFAULT 'open',
  carried_from_id  UUID REFERENCES action_items(id) ON DELETE SET NULL,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_action_item_status
    CHECK (status IN ('open', 'in_progress', 'done')),

  CONSTRAINT chk_action_item_title_length
    CHECK (char_length(title) >= 1 AND char_length(title) <= 500),

  CONSTRAINT chk_action_item_description_length
    CHECK (description IS NULL OR char_length(description) <= 5000)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_action_items_board_id ON action_items (board_id);
CREATE INDEX IF NOT EXISTS idx_action_items_assignee_id ON action_items (assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items (status);
CREATE INDEX IF NOT EXISTS idx_action_items_carried_from ON action_items (carried_from_id) WHERE carried_from_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_due_date ON action_items (due_date) WHERE due_date IS NOT NULL AND status != 'done';
CREATE INDEX IF NOT EXISTS idx_action_items_board_status ON action_items (board_id, status);
CREATE INDEX IF NOT EXISTS idx_action_items_created_at ON action_items (created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_action_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW EXECUTE FUNCTION update_action_items_updated_at();

COMMIT;
```
