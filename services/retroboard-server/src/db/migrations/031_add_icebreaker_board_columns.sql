-- Migration: 031_add_icebreaker_board_columns
-- Description: Add icebreaker columns to boards and update default phase to 'icebreaker'
-- Depends on: 030_add_icebreaker_board_phase (enum value must be committed first)
-- Created: 2026-02-17

-- Add icebreaker-related columns to boards table
ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS icebreaker_id     UUID          REFERENCES icebreakers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS icebreaker_active  BOOLEAN       NOT NULL DEFAULT true;

-- Update the default phase for new boards from 'write' to 'icebreaker'
ALTER TABLE boards ALTER COLUMN phase SET DEFAULT 'icebreaker';

-- Index for icebreaker FK lookups
CREATE INDEX IF NOT EXISTS idx_boards_icebreaker_id ON boards(icebreaker_id) WHERE icebreaker_id IS NOT NULL;
