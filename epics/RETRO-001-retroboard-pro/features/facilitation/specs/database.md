# Facilitation Database Specification

## Tables

### boards table additions

The following columns are added to the existing `boards` table to support facilitation features.

```sql
-- Phase management
ALTER TABLE boards ADD COLUMN phase TEXT NOT NULL DEFAULT 'write'
  CHECK (phase IN ('write', 'group', 'vote', 'discuss', 'action'));

-- Board lock
ALTER TABLE boards ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false;

-- Card reveal (anonymous mode)
ALTER TABLE boards ADD COLUMN cards_revealed BOOLEAN NOT NULL DEFAULT false;

-- Discussion focus
ALTER TABLE boards ADD COLUMN focus_type TEXT
  CHECK (focus_type IN ('card', 'group') OR focus_type IS NULL);
ALTER TABLE boards ADD COLUMN focus_id UUID;

-- Configurable phase durations (seconds)
ALTER TABLE boards ADD COLUMN phase_durations JSONB NOT NULL DEFAULT '{
  "write": 300,
  "group": 300,
  "vote": 180,
  "discuss": 120,
  "action": 300
}'::jsonb;
```

#### Updated boards columns summary

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `phase` | TEXT | NOT NULL | `'write'` | Current board phase |
| `is_locked` | BOOLEAN | NOT NULL | `false` | Whether the board is locked |
| `cards_revealed` | BOOLEAN | NOT NULL | `false` | Whether anonymous cards have been revealed |
| `focus_type` | TEXT | NULL | `NULL` | Type of focused item: `card`, `group`, or NULL |
| `focus_id` | UUID | NULL | `NULL` | ID of the focused card or group |
| `phase_durations` | JSONB | NOT NULL | `{...}` | Configurable timer durations per phase in seconds |

#### Constraints

```sql
-- Phase must be a valid value
ALTER TABLE boards ADD CONSTRAINT chk_boards_phase
  CHECK (phase IN ('write', 'group', 'vote', 'discuss', 'action'));

-- Focus type must be valid or null
ALTER TABLE boards ADD CONSTRAINT chk_boards_focus_type
  CHECK (focus_type IN ('card', 'group') OR focus_type IS NULL);

-- If focus_type is set, focus_id must also be set; if null, both null
ALTER TABLE boards ADD CONSTRAINT chk_boards_focus_consistency
  CHECK (
    (focus_type IS NULL AND focus_id IS NULL) OR
    (focus_type IS NOT NULL AND focus_id IS NOT NULL)
  );
```

### board_timers table

Stores the active or most recent timer for each board. Only one timer can exist per board at a time (enforced by PRIMARY KEY on `board_id`).

```sql
CREATE TABLE board_timers (
  board_id           UUID PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
  phase              TEXT NOT NULL,
  duration_seconds   INTEGER NOT NULL,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at          TIMESTAMPTZ,
  remaining_seconds  INTEGER NOT NULL,
  started_by         UUID NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_timer_phase
    CHECK (phase IN ('write', 'group', 'vote', 'discuss', 'action')),

  CONSTRAINT chk_timer_duration
    CHECK (duration_seconds > 0 AND duration_seconds <= 3600),

  CONSTRAINT chk_timer_remaining
    CHECK (remaining_seconds >= 0 AND remaining_seconds <= duration_seconds),

  CONSTRAINT chk_timer_paused_consistency
    CHECK (
      (paused_at IS NULL) OR
      (paused_at IS NOT NULL AND paused_at >= started_at)
    )
);
```

#### Column details

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `board_id` | UUID | NOT NULL | - | FK to boards. Also the PK -- one timer per board |
| `phase` | TEXT | NOT NULL | - | Phase this timer is associated with |
| `duration_seconds` | INTEGER | NOT NULL | - | Original timer duration (1-3600) |
| `started_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | When the timer was started |
| `paused_at` | TIMESTAMPTZ | NULL | `NULL` | When the timer was paused. NULL if running or stopped |
| `remaining_seconds` | INTEGER | NOT NULL | - | Seconds remaining. Updated on pause and stop |
| `started_by` | UUID | NOT NULL | - | FK to users. The facilitator who started the timer |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Row creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Last modification timestamp |

#### Indexes

```sql
-- Primary key already indexes board_id
-- Additional index for startup recovery query (find active timers)
CREATE INDEX idx_board_timers_active
  ON board_timers (remaining_seconds)
  WHERE remaining_seconds > 0 AND paused_at IS NULL;
```

## Triggers

### Phase change trigger

Fires a NOTIFY event when the board phase changes.

```sql
CREATE OR REPLACE FUNCTION notify_phase_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
  new_event_id UUID;
BEGIN
  IF OLD.phase IS DISTINCT FROM NEW.phase THEN
    new_event_id := gen_random_uuid();

    INSERT INTO board_events (id, board_id, event_type, entity_type, entity_id, payload, created_at)
    VALUES (
      new_event_id,
      NEW.id,
      'phase_changed',
      'board',
      NEW.id,
      json_build_object(
        'previousPhase', OLD.phase,
        'currentPhase', NEW.phase
      ),
      NOW()
    );

    payload := json_build_object(
      'eventId', new_event_id,
      'type', 'phase_changed',
      'entityId', NEW.id,
      'previousPhase', OLD.phase,
      'currentPhase', NEW.phase,
      'ts', extract(epoch from now())
    );

    PERFORM pg_notify('board:' || NEW.id, payload::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_board_phase_change
  AFTER UPDATE OF phase ON boards
  FOR EACH ROW EXECUTE FUNCTION notify_phase_change();
```

### Lock/unlock trigger

```sql
CREATE OR REPLACE FUNCTION notify_lock_change()
RETURNS TRIGGER AS $$
DECLARE
  event_type TEXT;
  payload JSON;
  new_event_id UUID;
BEGIN
  IF OLD.is_locked IS DISTINCT FROM NEW.is_locked THEN
    new_event_id := gen_random_uuid();

    IF NEW.is_locked THEN
      event_type := 'board_locked';
    ELSE
      event_type := 'board_unlocked';
    END IF;

    INSERT INTO board_events (id, board_id, event_type, entity_type, entity_id, created_at)
    VALUES (new_event_id, NEW.id, event_type, 'board', NEW.id, NOW());

    payload := json_build_object(
      'eventId', new_event_id,
      'type', event_type,
      'entityId', NEW.id,
      'ts', extract(epoch from now())
    );

    PERFORM pg_notify('board:' || NEW.id, payload::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_board_lock_change
  AFTER UPDATE OF is_locked ON boards
  FOR EACH ROW EXECUTE FUNCTION notify_lock_change();
```

### Cards revealed trigger

```sql
CREATE OR REPLACE FUNCTION notify_cards_revealed()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
  new_event_id UUID;
BEGIN
  IF OLD.cards_revealed = false AND NEW.cards_revealed = true THEN
    new_event_id := gen_random_uuid();

    INSERT INTO board_events (id, board_id, event_type, entity_type, entity_id, created_at)
    VALUES (new_event_id, NEW.id, 'cards_revealed', 'board', NEW.id, NOW());

    payload := json_build_object(
      'eventId', new_event_id,
      'type', 'cards_revealed',
      'entityId', NEW.id,
      'ts', extract(epoch from now())
    );

    PERFORM pg_notify('board:' || NEW.id, payload::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_board_cards_revealed
  AFTER UPDATE OF cards_revealed ON boards
  FOR EACH ROW EXECUTE FUNCTION notify_cards_revealed();
```

### Focus change trigger

```sql
CREATE OR REPLACE FUNCTION notify_focus_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
  new_event_id UUID;
BEGIN
  IF OLD.focus_type IS DISTINCT FROM NEW.focus_type
     OR OLD.focus_id IS DISTINCT FROM NEW.focus_id THEN

    new_event_id := gen_random_uuid();

    INSERT INTO board_events (id, board_id, event_type, entity_type, entity_id, payload, created_at)
    VALUES (
      new_event_id,
      NEW.id,
      'focus_changed',
      'board',
      NEW.id,
      json_build_object(
        'focusType', NEW.focus_type,
        'focusId', NEW.focus_id
      ),
      NOW()
    );

    payload := json_build_object(
      'eventId', new_event_id,
      'type', 'focus_changed',
      'entityId', NEW.id,
      'focusType', NEW.focus_type,
      'focusId', NEW.focus_id,
      'ts', extract(epoch from now())
    );

    PERFORM pg_notify('board:' || NEW.id, payload::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_board_focus_change
  AFTER UPDATE OF focus_type, focus_id ON boards
  FOR EACH ROW EXECUTE FUNCTION notify_focus_change();
```

## Queries

### Start timer

```sql
INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
VALUES ($1, $2, $3, $3, $4)
ON CONFLICT (board_id)
DO UPDATE SET
  phase = EXCLUDED.phase,
  duration_seconds = EXCLUDED.duration_seconds,
  remaining_seconds = EXCLUDED.remaining_seconds,
  started_at = NOW(),
  paused_at = NULL,
  started_by = EXCLUDED.started_by,
  updated_at = NOW();
```

### Pause timer

```sql
UPDATE board_timers
SET
  paused_at = NOW(),
  remaining_seconds = $2,
  updated_at = NOW()
WHERE board_id = $1
  AND paused_at IS NULL
  AND remaining_seconds > 0
RETURNING *;
```

### Resume timer

```sql
UPDATE board_timers
SET
  paused_at = NULL,
  updated_at = NOW()
WHERE board_id = $1
  AND paused_at IS NOT NULL
RETURNING *;
```

### Stop timer

```sql
DELETE FROM board_timers
WHERE board_id = $1
RETURNING *;
```

### Get active timers on startup

```sql
SELECT
  bt.*,
  CASE
    WHEN bt.paused_at IS NOT NULL THEN bt.remaining_seconds
    ELSE GREATEST(
      0,
      bt.remaining_seconds - EXTRACT(EPOCH FROM (NOW() - bt.started_at - COALESCE(
        (SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(bt2.updated_at, NOW()) - bt2.paused_at)))
         FROM board_timers bt2 WHERE bt2.board_id = bt.board_id AND bt2.paused_at IS NOT NULL),
        0
      )))::INTEGER
    )
  END AS computed_remaining
FROM board_timers bt
WHERE bt.remaining_seconds > 0;
```

### Change phase

```sql
UPDATE boards
SET
  phase = $2,
  updated_at = NOW()
WHERE id = $1
RETURNING id, phase;
```

### Lock/unlock board

```sql
UPDATE boards
SET
  is_locked = $2,
  updated_at = NOW()
WHERE id = $1
RETURNING id, is_locked;
```

### Reveal cards

```sql
UPDATE boards
SET
  cards_revealed = true,
  updated_at = NOW()
WHERE id = $1
  AND is_anonymous = true
  AND cards_revealed = false
RETURNING id, cards_revealed;
```

### Set focus

```sql
UPDATE boards
SET
  focus_type = $2,
  focus_id = $3,
  updated_at = NOW()
WHERE id = $1
RETURNING id, focus_type, focus_id;
```

## Migration

```sql
-- Migration: 006_add_facilitation_columns.sql

BEGIN;

-- Add phase column to boards
ALTER TABLE boards ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'write'
  CHECK (phase IN ('write', 'group', 'vote', 'discuss', 'action'));

-- Add lock column
ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

-- Add reveal column
ALTER TABLE boards ADD COLUMN IF NOT EXISTS cards_revealed BOOLEAN NOT NULL DEFAULT false;

-- Add focus columns
ALTER TABLE boards ADD COLUMN IF NOT EXISTS focus_type TEXT
  CHECK (focus_type IN ('card', 'group') OR focus_type IS NULL);
ALTER TABLE boards ADD COLUMN IF NOT EXISTS focus_id UUID;

-- Add phase durations
ALTER TABLE boards ADD COLUMN IF NOT EXISTS phase_durations JSONB NOT NULL DEFAULT '{
  "write": 300,
  "group": 300,
  "vote": 180,
  "discuss": 120,
  "action": 300
}'::jsonb;

-- Add focus consistency constraint
ALTER TABLE boards ADD CONSTRAINT chk_boards_focus_consistency
  CHECK (
    (focus_type IS NULL AND focus_id IS NULL) OR
    (focus_type IS NOT NULL AND focus_id IS NOT NULL)
  );

-- Create board_timers table
CREATE TABLE IF NOT EXISTS board_timers (
  board_id           UUID PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
  phase              TEXT NOT NULL CHECK (phase IN ('write', 'group', 'vote', 'discuss', 'action')),
  duration_seconds   INTEGER NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 3600),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at          TIMESTAMPTZ,
  remaining_seconds  INTEGER NOT NULL CHECK (remaining_seconds >= 0),
  started_by         UUID NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_timer_remaining_within_duration
    CHECK (remaining_seconds <= duration_seconds),
  CONSTRAINT chk_timer_paused_after_start
    CHECK (paused_at IS NULL OR paused_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_board_timers_active
  ON board_timers (remaining_seconds)
  WHERE remaining_seconds > 0 AND paused_at IS NULL;

-- Create triggers
-- (trigger functions defined above)

COMMIT;
```
