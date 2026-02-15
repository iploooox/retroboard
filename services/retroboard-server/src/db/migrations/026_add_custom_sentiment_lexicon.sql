-- Migration: 026_add_custom_sentiment_lexicon
-- Description: Add team-specific custom sentiment words support
-- Created: 2026-02-15

-- Add columns for team-scoped custom words
ALTER TABLE sentiment_lexicon
  ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  ADD COLUMN is_custom BOOLEAN DEFAULT false NOT NULL;

-- Update existing words to mark as system words (not custom)
UPDATE sentiment_lexicon SET is_custom = false WHERE is_custom IS NULL;

-- Drop existing primary key and create new unique constraint
-- System words have team_id = NULL, custom words have team_id set
ALTER TABLE sentiment_lexicon DROP CONSTRAINT sentiment_lexicon_pkey;

-- Create unique index for system words (word only)
CREATE UNIQUE INDEX idx_sentiment_lexicon_system_word
  ON sentiment_lexicon (word)
  WHERE team_id IS NULL;

-- Create unique index for team-specific custom words (word + team_id)
CREATE UNIQUE INDEX idx_sentiment_lexicon_custom_word
  ON sentiment_lexicon (word, team_id)
  WHERE team_id IS NOT NULL;

-- Add index for efficient team lookups
CREATE INDEX idx_sentiment_lexicon_team
  ON sentiment_lexicon (team_id)
  WHERE team_id IS NOT NULL;

-- Update calculate_card_sentiment function to include team-specific words
-- This version accepts an optional team_id parameter
CREATE OR REPLACE FUNCTION calculate_card_sentiment(card_text TEXT, p_team_id UUID DEFAULT NULL)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    AVG(sl.score),
    0
  )
  FROM regexp_split_to_table(
    regexp_replace(lower(card_text), '[^a-z\s]', '', 'g'),
    '\s+'
  ) AS t(word)
  JOIN sentiment_lexicon sl ON sl.word = t.word
  WHERE length(t.word) > 2
    AND (
      sl.team_id IS NULL  -- System words
      OR sl.team_id = p_team_id  -- Team-specific custom words
    );
$$ LANGUAGE SQL STABLE;

-- Note: The single-parameter version is preserved for backward compatibility
-- Existing queries calling calculate_card_sentiment(text) will use NULL for team_id
