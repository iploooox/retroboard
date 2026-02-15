-- Migration: 017_create_analytics_materialized_views
-- Description: Create materialized views for analytics: sprint health, participation stats, word frequency
-- Created: 2026-02-15

-- Sprint health metrics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sprint_health AS
SELECT
  s.id AS sprint_id,
  s.name AS sprint_name,
  s.team_id,
  s.start_date,
  s.end_date,
  h.health_score,
  h.sentiment_score,
  h.vote_distribution_score,
  h.participation_score,
  h.card_count,
  h.total_members,
  h.active_members
FROM sprints s
CROSS JOIN LATERAL calculate_sprint_health(s.id) h
WHERE EXISTS (
  SELECT 1 FROM boards b WHERE b.sprint_id = s.id
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sprint_health_sprint_id
  ON mv_sprint_health (sprint_id);

CREATE INDEX IF NOT EXISTS idx_mv_sprint_health_team_id
  ON mv_sprint_health (team_id, start_date DESC);

-- Participation stats per member per sprint materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_participation_stats AS
SELECT
  s.team_id,
  s.id AS sprint_id,
  s.name AS sprint_name,
  s.start_date,
  u.id AS user_id,
  u.display_name AS user_name,
  (SELECT COUNT(*) FROM cards c
   JOIN boards b ON c.board_id = b.id
   WHERE b.sprint_id = s.id AND c.author_id = u.id
  ) AS cards_submitted,
  (SELECT COUNT(*) FROM card_votes v
   JOIN cards c ON v.card_id = c.id
   JOIN boards b ON c.board_id = b.id
   WHERE b.sprint_id = s.id AND v.user_id = u.id
  ) AS votes_cast,
  (SELECT COUNT(*) FROM action_items ai
   JOIN boards b ON ai.board_id = b.id
   WHERE b.sprint_id = s.id AND ai.assignee_id = u.id
  ) AS action_items_owned,
  (SELECT COUNT(*) FROM action_items ai
   JOIN boards b ON ai.board_id = b.id
   WHERE b.sprint_id = s.id AND ai.assignee_id = u.id AND ai.status = 'done'
  ) AS action_items_completed
FROM sprints s
JOIN team_members tm ON tm.team_id = s.team_id
JOIN users u ON u.id = tm.user_id
WHERE EXISTS (
  SELECT 1 FROM boards b WHERE b.sprint_id = s.id
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_participation_sprint_user
  ON mv_participation_stats (sprint_id, user_id);

CREATE INDEX IF NOT EXISTS idx_mv_participation_team
  ON mv_participation_stats (team_id, start_date DESC);

-- Word frequency materialized view for word cloud visualizations
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_word_frequency AS
SELECT
  b.sprint_id,
  t.word,
  COUNT(*) AS frequency,
  COALESCE(sl.score, 0) AS sentiment
FROM cards c
JOIN boards b ON c.board_id = b.id
CROSS JOIN LATERAL regexp_split_to_table(
  regexp_replace(lower(c.content), '[^a-z\s]', '', 'g'),
  '\s+'
) AS t(word)
LEFT JOIN sentiment_lexicon sl ON sl.word = t.word
WHERE length(t.word) > 3
  AND t.word NOT IN (SELECT sw.word FROM stop_words sw)
GROUP BY b.sprint_id, t.word, sl.score
HAVING COUNT(*) >= 2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_word_freq_sprint_word
  ON mv_word_frequency (sprint_id, word);

CREATE INDEX IF NOT EXISTS idx_mv_word_freq_sprint_freq
  ON mv_word_frequency (sprint_id, frequency DESC);
