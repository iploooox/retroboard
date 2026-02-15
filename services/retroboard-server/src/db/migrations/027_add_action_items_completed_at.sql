-- Migration: 027_add_action_items_completed_at
-- Description: Add completed_at timestamp tracking for action items
-- Created: 2026-02-15

-- Add completed_at column
ALTER TABLE action_items
  ADD COLUMN completed_at TIMESTAMPTZ;

-- Backfill completed_at for existing 'done' items using updated_at as proxy
UPDATE action_items
SET completed_at = updated_at
WHERE status = 'done' AND completed_at IS NULL;

-- Create trigger to automatically set/clear completed_at on status change
CREATE OR REPLACE FUNCTION update_action_item_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'done', set completed_at
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.completed_at = NOW();
  -- If status changed from 'done' to something else, clear completed_at
  ELSIF NEW.status != 'done' AND OLD.status = 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_action_items_completed_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_action_item_completed_at();

-- Add index for querying recently completed items
CREATE INDEX IF NOT EXISTS idx_action_items_completed_at
  ON action_items (completed_at DESC)
  WHERE completed_at IS NOT NULL;
