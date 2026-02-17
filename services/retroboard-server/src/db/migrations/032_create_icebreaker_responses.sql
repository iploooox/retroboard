-- Migration: 032_create_icebreaker_responses
-- Description: Create icebreaker_responses table for anonymous response wall (S-003)
-- Created: 2026-02-17

CREATE TABLE IF NOT EXISTS icebreaker_responses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id      UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  icebreaker_id UUID NOT NULL REFERENCES icebreakers(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_icebreaker_responses_board
  ON icebreaker_responses(board_id, icebreaker_id);
