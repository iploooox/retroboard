-- Migration: 025_fix_vote_sync_payload
-- Description: Fix vote_added/vote_removed WebSocket payload to include cardId for real-time sync
-- Created: 2026-02-15

-- Update the card votes trigger to store cardId in board_events.payload
-- This allows the WebSocket enrichment layer to send complete vote data to clients

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

  -- Store cardId in payload so enrichment layer can build complete WS message
  INSERT INTO board_events (board_id, event_type, entity_type, entity_id, actor_id, payload)
  VALUES (v_board_id, v_event_type, 'vote', v_entity_id, v_actor_id, json_build_object('cardId', v_card_id)::jsonb)
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
