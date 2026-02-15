-- Migration: 010_create_board_tables
-- Description: Create retro board tables (boards, columns, cards, card_votes, card_groups, card_group_members)
-- Created: 2026-02-15

-- Create enum types
CREATE TYPE board_phase AS ENUM ('write', 'group', 'vote', 'discuss', 'action');
CREATE TYPE focus_item_type AS ENUM ('card', 'group');

-- Create boards table
CREATE TABLE boards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id       UUID NOT NULL UNIQUE,
  template_id     UUID NOT NULL,
  phase           board_phase NOT NULL DEFAULT 'write',
  anonymous_mode  BOOLEAN NOT NULL DEFAULT false,
  max_votes_per_user INTEGER NOT NULL DEFAULT 5,
  max_votes_per_card INTEGER NOT NULL DEFAULT 3,
  focus_item_id   UUID,
  focus_item_type focus_item_type,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_boards_sprint
    FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
  CONSTRAINT fk_boards_template
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE RESTRICT,
  CONSTRAINT fk_boards_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_boards_max_votes_per_user
    CHECK (max_votes_per_user BETWEEN 1 AND 99),
  CONSTRAINT chk_boards_max_votes_per_card
    CHECK (max_votes_per_card BETWEEN 1 AND 99),
  CONSTRAINT chk_boards_focus_consistency
    CHECK (
      (focus_item_id IS NULL AND focus_item_type IS NULL) OR
      (focus_item_id IS NOT NULL AND focus_item_type IS NOT NULL)
    )
);

-- Create columns table
CREATE TABLE columns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(7) NOT NULL DEFAULT '#6b7280',
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_columns_board
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  CONSTRAINT chk_columns_color_hex
    CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT uq_columns_board_position
    UNIQUE (board_id, position) DEFERRABLE INITIALLY DEFERRED
);

-- Create cards table
CREATE TABLE cards (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id  UUID NOT NULL,
  board_id   UUID NOT NULL,
  content    TEXT NOT NULL,
  author_id  UUID NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_cards_column
    FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE,
  CONSTRAINT fk_cards_board
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  CONSTRAINT fk_cards_author
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_cards_content_not_empty
    CHECK (length(trim(content)) > 0),
  CONSTRAINT chk_cards_content_max_length
    CHECK (length(content) <= 2000)
);

-- Create card_votes table
CREATE TABLE card_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID NOT NULL,
  user_id     UUID NOT NULL,
  vote_number INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_card_votes_card
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_card_votes_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_card_votes_card_user_number
    UNIQUE (card_id, user_id, vote_number),
  CONSTRAINT chk_card_votes_vote_number_positive
    CHECK (vote_number >= 1)
);

-- Create card_groups table
CREATE TABLE card_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL,
  title      VARCHAR(200) NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_card_groups_board
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  CONSTRAINT chk_card_groups_title_not_empty
    CHECK (length(trim(title)) > 0)
);

-- Create card_group_members table
CREATE TABLE card_group_members (
  group_id UUID NOT NULL,
  card_id  UUID NOT NULL,

  CONSTRAINT pk_card_group_members
    PRIMARY KEY (group_id, card_id),
  CONSTRAINT fk_card_group_members_group
    FOREIGN KEY (group_id) REFERENCES card_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_card_group_members_card
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT uq_card_group_members_card
    UNIQUE (card_id)
);

-- Create indexes
CREATE INDEX idx_boards_sprint_id ON boards(sprint_id);
CREATE INDEX idx_boards_created_by ON boards(created_by);
CREATE INDEX idx_boards_template_id ON boards(template_id);

CREATE INDEX idx_columns_board_id ON columns(board_id);
CREATE INDEX idx_columns_board_position ON columns(board_id, position);

CREATE INDEX idx_cards_column_id ON cards(column_id);
CREATE INDEX idx_cards_board_id ON cards(board_id);
CREATE INDEX idx_cards_author_id ON cards(author_id);
CREATE INDEX idx_cards_board_column_position ON cards(board_id, column_id, position);

CREATE INDEX idx_card_votes_card_id ON card_votes(card_id);
CREATE INDEX idx_card_votes_user_id ON card_votes(user_id);
CREATE INDEX idx_card_votes_card_user ON card_votes(card_id, user_id);

CREATE INDEX idx_card_groups_board_id ON card_groups(board_id);
CREATE INDEX idx_card_groups_board_position ON card_groups(board_id, position);

CREATE INDEX idx_card_group_members_card_id ON card_group_members(card_id);
CREATE INDEX idx_card_group_members_group_id ON card_group_members(group_id);

-- Create updated_at trigger function (if not already exists)
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER set_boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- Create NOTIFY trigger function
CREATE OR REPLACE FUNCTION notify_board_change()
RETURNS TRIGGER AS $$
DECLARE
  board_uuid UUID;
  payload TEXT;
BEGIN
  IF TG_TABLE_NAME = 'boards' THEN
    board_uuid := COALESCE(NEW.id, OLD.id);
    payload := json_build_object(
      'event', TG_ARGV[0],
      'board_id', board_uuid
    )::TEXT;
  ELSIF TG_TABLE_NAME = 'cards' THEN
    board_uuid := COALESCE(NEW.board_id, OLD.board_id);
    payload := json_build_object(
      'event', TG_ARGV[0],
      'board_id', board_uuid,
      'card_id', COALESCE(NEW.id, OLD.id),
      'column_id', COALESCE(NEW.column_id, OLD.column_id)
    )::TEXT;
  ELSIF TG_TABLE_NAME = 'card_votes' THEN
    SELECT c.board_id INTO board_uuid
    FROM cards c
    WHERE c.id = COALESCE(NEW.card_id, OLD.card_id);
    payload := json_build_object(
      'event', TG_ARGV[0],
      'board_id', board_uuid,
      'card_id', COALESCE(NEW.card_id, OLD.card_id)
    )::TEXT;
  ELSIF TG_TABLE_NAME = 'card_groups' THEN
    board_uuid := COALESCE(NEW.board_id, OLD.board_id);
    payload := json_build_object(
      'event', TG_ARGV[0],
      'board_id', board_uuid,
      'group_id', COALESCE(NEW.id, OLD.id)
    )::TEXT;
  END IF;

  PERFORM pg_notify('board_changes', payload);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply NOTIFY triggers
CREATE TRIGGER notify_board_updated
  AFTER UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION notify_board_change('board:updated');

CREATE TRIGGER notify_card_created
  AFTER INSERT ON cards
  FOR EACH ROW EXECUTE FUNCTION notify_board_change('card:created');

CREATE TRIGGER notify_card_updated
  AFTER UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION notify_board_change('card:updated');

CREATE TRIGGER notify_card_deleted
  AFTER DELETE ON cards
  FOR EACH ROW EXECUTE FUNCTION notify_board_change('card:deleted');

CREATE TRIGGER notify_vote_added
  AFTER INSERT ON card_votes
  FOR EACH ROW EXECUTE FUNCTION notify_board_change('vote:added');

CREATE TRIGGER notify_vote_removed
  AFTER DELETE ON card_votes
  FOR EACH ROW EXECUTE FUNCTION notify_board_change('vote:removed');

CREATE TRIGGER notify_group_created
  AFTER INSERT ON card_groups
  FOR EACH ROW EXECUTE FUNCTION notify_board_change('group:created');

CREATE TRIGGER notify_group_updated
  AFTER UPDATE ON card_groups
  FOR EACH ROW EXECUTE FUNCTION notify_board_change('group:updated');

CREATE TRIGGER notify_group_deleted
  AFTER DELETE ON card_groups
  FOR EACH ROW EXECUTE FUNCTION notify_board_change('group:deleted');
