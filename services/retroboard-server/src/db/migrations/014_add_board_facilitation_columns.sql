-- Migration: 014_add_board_facilitation_columns
-- Description: Add facilitation columns (is_locked, cards_revealed, phase_durations) to boards table
-- Created: 2026-02-15

ALTER TABLE boards ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE boards ADD COLUMN cards_revealed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE boards ADD COLUMN phase_durations JSONB NOT NULL DEFAULT '{"write":300,"group":300,"vote":180,"discuss":120,"action":300}'::jsonb;
