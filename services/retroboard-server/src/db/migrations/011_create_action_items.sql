-- Migration: 011_create_action_items
-- Description: Create the action_items table for retro board action tracking
-- Created: 2026-02-15

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
