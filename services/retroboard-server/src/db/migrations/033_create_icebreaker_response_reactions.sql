-- Migration: 033_create_icebreaker_response_reactions
-- Description: Create icebreaker_response_reactions table for emoji reactions on wall responses (S-005)
-- Created: 2026-02-17

CREATE TABLE IF NOT EXISTS icebreaker_response_reactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id   UUID NOT NULL REFERENCES icebreaker_responses(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji         VARCHAR(10) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_response_reaction UNIQUE (response_id, user_id, emoji),
  CONSTRAINT chk_valid_emoji CHECK (emoji IN ('laugh', 'fire', 'heart', 'bullseye', 'clap', 'skull'))
);

CREATE INDEX IF NOT EXISTS idx_response_reactions_response ON icebreaker_response_reactions(response_id);
