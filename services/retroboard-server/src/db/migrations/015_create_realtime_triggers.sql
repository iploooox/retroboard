-- Migration: 015_create_realtime_triggers
-- Description: Replace basic NOTIFY triggers with board_events-backed real-time triggers
-- Created: 2026-02-15

-- =============================================================================
-- 1. Drop existing basic NOTIFY triggers from migration 010
-- =============================================================================

DROP TRIGGER IF EXISTS notify_board_updated ON boards;
DROP TRIGGER IF EXISTS notify_card_created ON cards;
DROP TRIGGER IF EXISTS notify_card_updated ON cards;
DROP TRIGGER IF EXISTS notify_card_deleted ON cards;
DROP TRIGGER IF EXISTS notify_vote_added ON card_votes;
DROP TRIGGER IF EXISTS notify_vote_removed ON card_votes;
DROP TRIGGER IF EXISTS notify_group_created ON card_groups;
DROP TRIGGER IF EXISTS notify_group_updated ON card_groups;
DROP TRIGGER IF EXISTS notify_group_deleted ON card_groups;

DROP FUNCTION IF EXISTS notify_board_change();

-- =============================================================================
-- 2. Cards triggers (INSERT, UPDATE, DELETE)
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_cards_realtime()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_entity_id UUID;
  v_board_id UUID;
  v_actor_id UUID;
  v_event_id UUID;
  v_payload TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'card_created';
    v_entity_id := NEW.id;
    v_board_id := NEW.board_id;
    v_actor_id := NEW.author_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'card_updated';
    v_entity_id := NEW.id;
    v_board_id := NEW.board_id;
    v_actor_id := NEW.author_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'card_deleted';
    v_entity_id := OLD.id;
    v_board_id := OLD.board_id;
    v_actor_id := OLD.author_id;
  END IF;

  INSERT INTO board_events (board_id, event_type, entity_type, entity_id, actor_id, payload)
  VALUES (v_board_id, v_event_type, 'card', v_entity_id, v_actor_id, NULL)
  RETURNING id INTO v_event_id;

  v_payload := json_build_object(
    'eventId', v_event_id,
    'type', v_event_type,
    'entityId', v_entity_id,
    'actorId', v_actor_id,
    'ts', extract(epoch from now())::bigint
  )::text;

  PERFORM pg_notify('board:' || v_board_id::text, v_payload);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cards_realtime_insert
  AFTER INSERT ON cards
  FOR EACH ROW EXECUTE FUNCTION trg_cards_realtime();

CREATE TRIGGER trg_cards_realtime_update
  AFTER UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION trg_cards_realtime();

CREATE TRIGGER trg_cards_realtime_delete
  AFTER DELETE ON cards
  FOR EACH ROW EXECUTE FUNCTION trg_cards_realtime();

-- =============================================================================
-- 3. Card votes triggers (INSERT, DELETE)
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_card_votes_realtime()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_entity_id UUID;
  v_card_id UUID;
  v_board_id UUID;
  v_actor_id UUID;
  v_event_id UUID;
  v_payload TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'vote_added';
    v_entity_id := NEW.id;
    v_card_id := NEW.card_id;
    v_actor_id := NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'vote_removed';
    v_entity_id := OLD.id;
    v_card_id := OLD.card_id;
    v_actor_id := OLD.user_id;
  END IF;

  SELECT c.board_id INTO v_board_id
  FROM cards c
  WHERE c.id = v_card_id;

  -- Skip if parent card was deleted (CASCADE delete)
  IF v_board_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO board_events (board_id, event_type, entity_type, entity_id, actor_id, payload)
  VALUES (v_board_id, v_event_type, 'vote', v_entity_id, v_actor_id, NULL)
  RETURNING id INTO v_event_id;

  v_payload := json_build_object(
    'eventId', v_event_id,
    'type', v_event_type,
    'entityId', v_entity_id,
    'actorId', v_actor_id,
    'ts', extract(epoch from now())::bigint
  )::text;

  PERFORM pg_notify('board:' || v_board_id::text, v_payload);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_card_votes_realtime_insert
  AFTER INSERT ON card_votes
  FOR EACH ROW EXECUTE FUNCTION trg_card_votes_realtime();

CREATE TRIGGER trg_card_votes_realtime_delete
  AFTER DELETE ON card_votes
  FOR EACH ROW EXECUTE FUNCTION trg_card_votes_realtime();

-- =============================================================================
-- 4. Card groups triggers (INSERT, UPDATE, DELETE)
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_card_groups_realtime()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_entity_id UUID;
  v_board_id UUID;
  v_event_id UUID;
  v_payload TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'group_created';
    v_entity_id := NEW.id;
    v_board_id := NEW.board_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'group_updated';
    v_entity_id := NEW.id;
    v_board_id := NEW.board_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'group_deleted';
    v_entity_id := OLD.id;
    v_board_id := OLD.board_id;
  END IF;

  INSERT INTO board_events (board_id, event_type, entity_type, entity_id, actor_id, payload)
  VALUES (v_board_id, v_event_type, 'group', v_entity_id, NULL, NULL)
  RETURNING id INTO v_event_id;

  v_payload := json_build_object(
    'eventId', v_event_id,
    'type', v_event_type,
    'entityId', v_entity_id,
    'actorId', NULL,
    'ts', extract(epoch from now())::bigint
  )::text;

  PERFORM pg_notify('board:' || v_board_id::text, v_payload);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_card_groups_realtime_insert
  AFTER INSERT ON card_groups
  FOR EACH ROW EXECUTE FUNCTION trg_card_groups_realtime();

CREATE TRIGGER trg_card_groups_realtime_update
  AFTER UPDATE ON card_groups
  FOR EACH ROW EXECUTE FUNCTION trg_card_groups_realtime();

CREATE TRIGGER trg_card_groups_realtime_delete
  AFTER DELETE ON card_groups
  FOR EACH ROW EXECUTE FUNCTION trg_card_groups_realtime();

-- =============================================================================
-- 5. Card group members triggers (INSERT, DELETE)
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_card_group_members_realtime()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_card_id UUID;
  v_group_id UUID;
  v_board_id UUID;
  v_event_id UUID;
  v_payload TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'card_grouped';
    v_card_id := NEW.card_id;
    v_group_id := NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'card_ungrouped';
    v_card_id := OLD.card_id;
    v_group_id := OLD.group_id;
  END IF;

  SELECT cg.board_id INTO v_board_id
  FROM card_groups cg
  WHERE cg.id = v_group_id;

  -- Skip if parent group was deleted (CASCADE delete)
  IF v_board_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO board_events (board_id, event_type, entity_type, entity_id, actor_id, payload)
  VALUES (v_board_id, v_event_type, 'group', v_card_id, NULL, json_build_object('groupId', v_group_id)::jsonb)
  RETURNING id INTO v_event_id;

  v_payload := json_build_object(
    'eventId', v_event_id,
    'type', v_event_type,
    'entityId', v_card_id,
    'actorId', NULL,
    'ts', extract(epoch from now())::bigint
  )::text;

  PERFORM pg_notify('board:' || v_board_id::text, v_payload);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_card_group_members_realtime_insert
  AFTER INSERT ON card_group_members
  FOR EACH ROW EXECUTE FUNCTION trg_card_group_members_realtime();

CREATE TRIGGER trg_card_group_members_realtime_delete
  AFTER DELETE ON card_group_members
  FOR EACH ROW EXECUTE FUNCTION trg_card_group_members_realtime();

-- =============================================================================
-- 6. Boards triggers (UPDATE on phase, is_locked, cards_revealed, focus_item_id)
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_boards_realtime()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_entity_id UUID;
  v_event_id UUID;
  v_payload TEXT;
BEGIN
  v_entity_id := NEW.id;

  -- Phase changed
  IF OLD.phase IS DISTINCT FROM NEW.phase THEN
    INSERT INTO board_events (board_id, event_type, entity_type, entity_id, actor_id, payload)
    VALUES (NEW.id, 'phase_changed', 'board', NEW.id, NULL, json_build_object('from', OLD.phase::text, 'to', NEW.phase::text)::jsonb)
    RETURNING id INTO v_event_id;

    v_payload := json_build_object(
      'eventId', v_event_id,
      'type', 'phase_changed',
      'entityId', v_entity_id,
      'actorId', NULL,
      'ts', extract(epoch from now())::bigint
    )::text;

    PERFORM pg_notify('board:' || NEW.id::text, v_payload);
  END IF;

  -- Board locked / unlocked
  IF OLD.is_locked IS DISTINCT FROM NEW.is_locked THEN
    IF NEW.is_locked THEN
      v_event_type := 'board_locked';
    ELSE
      v_event_type := 'board_unlocked';
    END IF;

    INSERT INTO board_events (board_id, event_type, entity_type, entity_id, actor_id, payload)
    VALUES (NEW.id, v_event_type, 'board', NEW.id, NULL, NULL)
    RETURNING id INTO v_event_id;

    v_payload := json_build_object(
      'eventId', v_event_id,
      'type', v_event_type,
      'entityId', v_entity_id,
      'actorId', NULL,
      'ts', extract(epoch from now())::bigint
    )::text;

    PERFORM pg_notify('board:' || NEW.id::text, v_payload);
  END IF;

  -- Cards revealed
  IF OLD.cards_revealed IS DISTINCT FROM NEW.cards_revealed AND NEW.cards_revealed = true THEN
    INSERT INTO board_events (board_id, event_type, entity_type, entity_id, actor_id, payload)
    VALUES (NEW.id, 'cards_revealed', 'board', NEW.id, NULL, NULL)
    RETURNING id INTO v_event_id;

    v_payload := json_build_object(
      'eventId', v_event_id,
      'type', 'cards_revealed',
      'entityId', v_entity_id,
      'actorId', NULL,
      'ts', extract(epoch from now())::bigint
    )::text;

    PERFORM pg_notify('board:' || NEW.id::text, v_payload);
  END IF;

  -- Focus changed
  IF OLD.focus_item_id IS DISTINCT FROM NEW.focus_item_id THEN
    INSERT INTO board_events (board_id, event_type, entity_type, entity_id, actor_id, payload)
    VALUES (NEW.id, 'focus_changed', 'board', NEW.id, NULL,
      json_build_object('focusItemId', NEW.focus_item_id, 'focusItemType', NEW.focus_item_type::text)::jsonb)
    RETURNING id INTO v_event_id;

    v_payload := json_build_object(
      'eventId', v_event_id,
      'type', 'focus_changed',
      'entityId', v_entity_id,
      'actorId', NULL,
      'ts', extract(epoch from now())::bigint
    )::text;

    PERFORM pg_notify('board:' || NEW.id::text, v_payload);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_boards_realtime
  AFTER UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION trg_boards_realtime();

-- =============================================================================
-- 7. Action items triggers (INSERT, UPDATE, DELETE)
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_action_items_realtime()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_entity_id UUID;
  v_board_id UUID;
  v_actor_id UUID;
  v_event_id UUID;
  v_payload TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'action_item_created';
    v_entity_id := NEW.id;
    v_board_id := NEW.board_id;
    v_actor_id := NEW.created_by;
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'action_item_updated';
    v_entity_id := NEW.id;
    v_board_id := NEW.board_id;
    v_actor_id := NEW.created_by;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'action_item_deleted';
    v_entity_id := OLD.id;
    v_board_id := OLD.board_id;
    v_actor_id := OLD.created_by;
  END IF;

  INSERT INTO board_events (board_id, event_type, entity_type, entity_id, actor_id, payload)
  VALUES (v_board_id, v_event_type, 'action_item', v_entity_id, v_actor_id, NULL)
  RETURNING id INTO v_event_id;

  v_payload := json_build_object(
    'eventId', v_event_id,
    'type', v_event_type,
    'entityId', v_entity_id,
    'actorId', v_actor_id,
    'ts', extract(epoch from now())::bigint
  )::text;

  PERFORM pg_notify('board:' || v_board_id::text, v_payload);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_action_items_realtime_insert
  AFTER INSERT ON action_items
  FOR EACH ROW EXECUTE FUNCTION trg_action_items_realtime();

CREATE TRIGGER trg_action_items_realtime_update
  AFTER UPDATE ON action_items
  FOR EACH ROW EXECUTE FUNCTION trg_action_items_realtime();

CREATE TRIGGER trg_action_items_realtime_delete
  AFTER DELETE ON action_items
  FOR EACH ROW EXECUTE FUNCTION trg_action_items_realtime();
