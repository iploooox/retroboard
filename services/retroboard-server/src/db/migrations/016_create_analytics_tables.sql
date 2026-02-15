-- Migration: 016_create_analytics_tables
-- Description: Create sentiment_lexicon, stop_words tables and analytics functions
-- Created: 2026-02-15

-- Sentiment lexicon table
CREATE TABLE IF NOT EXISTS sentiment_lexicon (
  word   TEXT PRIMARY KEY,
  score  NUMERIC(3, 1) NOT NULL,

  CONSTRAINT chk_sentiment_score
    CHECK (score >= -5.0 AND score <= 5.0)
);

-- Stop words table
CREATE TABLE IF NOT EXISTS stop_words (
  word TEXT PRIMARY KEY
);

-- Sentiment calculation function
-- Tokenizes card text, matches words against lexicon, and returns average sentiment
CREATE OR REPLACE FUNCTION calculate_card_sentiment(card_text TEXT)
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
  WHERE length(t.word) > 2;
$$ LANGUAGE SQL STABLE;

-- Sprint health calculation function
-- Returns composite health metrics for a sprint based on sentiment, voting, and participation
CREATE OR REPLACE FUNCTION calculate_sprint_health(p_sprint_id UUID)
RETURNS TABLE (
  health_score NUMERIC,
  sentiment_score NUMERIC,
  vote_distribution_score NUMERIC,
  participation_score NUMERIC,
  card_count BIGINT,
  total_members BIGINT,
  active_members BIGINT
) AS $$
WITH sentiment AS (
  SELECT
    AVG(calculate_card_sentiment(c.content)) AS avg_raw,
    COUNT(*) AS cnt
  FROM cards c
  JOIN boards b ON c.board_id = b.id
  WHERE b.sprint_id = p_sprint_id
),
vote_dist AS (
  SELECT
    CASE
      WHEN COUNT(DISTINCT c.id) = 0 THEN 50.0
      ELSE GREATEST(0, LEAST(100,
        (1.0 - COALESCE(
          STDDEV(COALESCE(vc.cnt, 0)) / NULLIF(AVG(COALESCE(vc.cnt, 0)), 0),
          0
        )) * 100
      ))
    END AS score
  FROM cards c
  JOIN boards b ON c.board_id = b.id
  LEFT JOIN (
    SELECT card_id, COUNT(*) AS cnt FROM card_votes GROUP BY card_id
  ) vc ON vc.card_id = c.id
  WHERE b.sprint_id = p_sprint_id
),
participation AS (
  SELECT
    COUNT(DISTINCT tm.user_id) AS total,
    COUNT(DISTINCT CASE
      WHEN EXISTS (
        SELECT 1 FROM cards c2
        JOIN boards b2 ON c2.board_id = b2.id
        WHERE b2.sprint_id = p_sprint_id AND c2.author_id = tm.user_id
      ) AND EXISTS (
        SELECT 1 FROM card_votes v2
        JOIN cards c3 ON v2.card_id = c3.id
        JOIN boards b3 ON c3.board_id = b3.id
        WHERE b3.sprint_id = p_sprint_id AND v2.user_id = tm.user_id
      )
      THEN tm.user_id
    END) AS active
  FROM sprints s
  JOIN team_members tm ON tm.team_id = s.team_id
  WHERE s.id = p_sprint_id
)
SELECT
  (
    COALESCE(((sent.avg_raw + 5.0) / 10.0) * 100, 50) * 0.4 +
    vd.score * 0.3 +
    CASE WHEN part.total = 0 THEN 0 ELSE (part.active::NUMERIC / part.total) * 100 END * 0.3
  )::NUMERIC(5,1) AS health_score,
  COALESCE(((sent.avg_raw + 5.0) / 10.0) * 100, 50)::NUMERIC(5,1) AS sentiment_score,
  vd.score::NUMERIC(5,1) AS vote_distribution_score,
  CASE WHEN part.total = 0 THEN 0 ELSE (part.active::NUMERIC / part.total) * 100 END::NUMERIC(5,1) AS participation_score,
  sent.cnt AS card_count,
  part.total AS total_members,
  part.active AS active_members
FROM sentiment sent, vote_dist vd, participation part;
$$ LANGUAGE SQL STABLE;
