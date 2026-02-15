-- Migration: 012_create_board_events
-- Description: Create board_events table for real-time event sourcing
-- Created: 2026-02-15

CREATE TABLE board_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  actor_id    UUID REFERENCES users(id),
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_board_events_board_created ON board_events (board_id, created_at);
CREATE INDEX idx_board_events_board_id ON board_events (board_id, id);
