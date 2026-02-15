-- Migration: 013_create_board_timers
-- Description: Create board_timers table for facilitation countdown timers
-- Created: 2026-02-15

CREATE TABLE board_timers (
  board_id           UUID PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
  phase              TEXT NOT NULL CHECK (phase IN ('write', 'group', 'vote', 'discuss', 'action')),
  duration_seconds   INTEGER NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 3600),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at          TIMESTAMPTZ,
  remaining_seconds  INTEGER NOT NULL CHECK (remaining_seconds >= 0),
  started_by         UUID NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated_at trigger
CREATE TRIGGER set_board_timers_updated_at
  BEFORE UPDATE ON board_timers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();
