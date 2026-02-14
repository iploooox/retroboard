# Analytics Database Specification

## Tables

### sentiment_lexicon

Maps English words to sentiment scores. Seeded with ~2500 common words. Used by the `calculate_card_sentiment()` function.

```sql
CREATE TABLE sentiment_lexicon (
  word   TEXT PRIMARY KEY,
  score  NUMERIC(3, 1) NOT NULL,

  CONSTRAINT chk_sentiment_score
    CHECK (score >= -5.0 AND score <= 5.0)
);
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `word` | TEXT | NOT NULL | English word (lowercase, no punctuation) |
| `score` | NUMERIC(3,1) | NOT NULL | Sentiment score: -5.0 (very negative) to +5.0 (very positive) |

#### Seed Data (representative sample)

```sql
INSERT INTO sentiment_lexicon (word, score) VALUES
  -- Strongly positive (+4 to +5)
  ('excellent', 4.5),
  ('outstanding', 4.5),
  ('amazing', 4.0),
  ('fantastic', 4.0),
  ('wonderful', 4.0),
  ('brilliant', 4.0),
  ('superb', 4.0),
  ('exceptional', 4.0),

  -- Positive (+2 to +3.9)
  ('great', 3.0),
  ('awesome', 3.0),
  ('love', 3.0),
  ('perfect', 3.5),
  ('improved', 2.5),
  ('collaboration', 2.0),
  ('helpful', 2.0),
  ('smooth', 2.0),
  ('efficient', 2.5),
  ('productive', 2.5),
  ('successful', 3.0),
  ('progress', 2.0),
  ('reliable', 2.0),
  ('clear', 2.0),
  ('fast', 2.0),
  ('solved', 2.5),
  ('achieved', 2.5),
  ('delivered', 2.0),
  ('teamwork', 2.5),
  ('supportive', 2.5),

  -- Mildly positive (+0.5 to +1.9)
  ('good', 1.5),
  ('nice', 1.5),
  ('okay', 0.5),
  ('fine', 1.0),
  ('decent', 1.0),
  ('stable', 1.0),
  ('consistent', 1.0),
  ('adequate', 0.5),
  ('reasonable', 1.0),
  ('functional', 1.0),

  -- Neutral (0)
  ('normal', 0.0),
  ('average', 0.0),
  ('usual', 0.0),
  ('standard', 0.0),

  -- Mildly negative (-0.5 to -1.9)
  ('slow', -1.5),
  ('confusing', -1.5),
  ('unclear', -1.5),
  ('difficult', -1.0),
  ('challenging', -0.5),
  ('complex', -0.5),
  ('delayed', -1.5),
  ('missed', -1.5),
  ('lacking', -1.5),
  ('inconsistent', -1.0),

  -- Negative (-2 to -3.9)
  ('bad', -2.5),
  ('broken', -2.5),
  ('failed', -3.0),
  ('frustrating', -2.5),
  ('confusing', -2.0),
  ('blocked', -2.5),
  ('unstable', -2.0),
  ('buggy', -2.5),
  ('crashed', -3.0),
  ('painful', -2.5),
  ('overwhelming', -2.0),
  ('chaotic', -2.5),
  ('disorganized', -2.0),
  ('stressful', -2.5),
  ('terrible', -3.5),
  ('awful', -3.5),
  ('horrible', -3.5),
  ('wasteful', -2.0),
  ('regressed', -2.5),
  ('poor', -2.0),

  -- Strongly negative (-4 to -5)
  ('catastrophic', -4.5),
  ('disaster', -4.0),
  ('nightmare', -4.0),
  ('unacceptable', -4.0),
  ('impossible', -3.5),
  ('devastating', -4.0)

  -- Full seed file contains ~2500 entries
  -- See: src/db/seeds/sentiment_lexicon.sql
;
```

### stop_words

Common English words excluded from word frequency analysis.

```sql
CREATE TABLE stop_words (
  word TEXT PRIMARY KEY
);

INSERT INTO stop_words (word) VALUES
  ('the'), ('and'), ('that'), ('this'), ('with'), ('from'),
  ('have'), ('been'), ('were'), ('they'), ('their'), ('what'),
  ('when'), ('would'), ('could'), ('should'), ('about'), ('also'),
  ('some'), ('more'), ('very'), ('just'), ('like'), ('into'),
  ('than'), ('them'), ('then'), ('only'), ('over'), ('such'),
  ('make'), ('made'), ('much'), ('well'), ('back'), ('being'),
  ('many'), ('each'), ('will'), ('does'), ('done'), ('good'),
  ('need'), ('want'), ('work'), ('think'), ('know'), ('time'),
  ('really'), ('things'), ('going'), ('still'), ('keep'),
  ('there'), ('here'), ('where'), ('which'), ('while'),
  ('after'), ('before'), ('during'), ('between'), ('through'),
  ('these'), ('those'), ('other'), ('because'), ('since'),
  ('even'), ('same'), ('different'), ('every'), ('most'),
  ('another'), ('around'), ('under'), ('again'), ('never'),
  ('always'), ('often'), ('sometimes'), ('usually'), ('might'),
  ('however'), ('although'), ('though'), ('enough'), ('already'),
  ('actually'), ('probably'), ('perhaps'), ('rather'), ('quite'),
  ('something'), ('anything'), ('everything'), ('nothing'),
  ('someone'), ('anyone'), ('everyone'), ('able'), ('using'),
  ('used'), ('uses'), ('start'), ('started'), ('stop'),
  ('stopped'), ('getting'), ('doing'), ('having')
  -- ~150 total entries
;
```

## Functions

### calculate_card_sentiment

Calculates the sentiment score for a given card text by tokenizing, matching against the lexicon, and averaging.

```sql
CREATE OR REPLACE FUNCTION calculate_card_sentiment(card_text TEXT)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    AVG(sl.score),
    0
  )
  FROM regexp_split_to_table(
    regexp_replace(lower(card_text), '[^a-z\s]', '', 'g'),
    '\s+'
  ) AS word
  JOIN sentiment_lexicon sl ON sl.word = word
  WHERE length(word) > 2;
$$ LANGUAGE SQL STABLE;
```

### calculate_sprint_health

Calculates the composite health score for a sprint.

```sql
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
    AVG(calculate_card_sentiment(c.text)) AS avg_raw,
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
    SELECT card_id, COUNT(*) AS cnt FROM votes GROUP BY card_id
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
        WHERE b2.sprint_id = p_sprint_id AND c2.created_by = tm.user_id
      ) AND EXISTS (
        SELECT 1 FROM votes v2
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
```

## Materialized Views

### mv_sprint_health

Pre-computed health scores per sprint.

```sql
CREATE MATERIALIZED VIEW mv_sprint_health AS
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

CREATE UNIQUE INDEX idx_mv_sprint_health_sprint_id
  ON mv_sprint_health (sprint_id);

CREATE INDEX idx_mv_sprint_health_team_id
  ON mv_sprint_health (team_id, start_date DESC);
```

### mv_participation_stats

Per-member participation metrics per sprint.

```sql
CREATE MATERIALIZED VIEW mv_participation_stats AS
SELECT
  s.team_id,
  s.id AS sprint_id,
  s.name AS sprint_name,
  s.start_date,
  u.id AS user_id,
  u.name AS user_name,
  (SELECT COUNT(*) FROM cards c
   JOIN boards b ON c.board_id = b.id
   WHERE b.sprint_id = s.id AND c.created_by = u.id
  ) AS cards_submitted,
  (SELECT COUNT(*) FROM votes v
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

CREATE UNIQUE INDEX idx_mv_participation_sprint_user
  ON mv_participation_stats (sprint_id, user_id);

CREATE INDEX idx_mv_participation_team
  ON mv_participation_stats (team_id, start_date DESC);
```

### mv_word_frequency

Word frequency data per sprint for word cloud visualizations.

```sql
CREATE MATERIALIZED VIEW mv_word_frequency AS
SELECT
  b.sprint_id,
  word,
  COUNT(*) AS frequency,
  COALESCE(sl.score, 0) AS sentiment
FROM cards c
JOIN boards b ON c.board_id = b.id
CROSS JOIN LATERAL regexp_split_to_table(
  regexp_replace(lower(c.text), '[^a-z\s]', '', 'g'),
  '\s+'
) AS word
LEFT JOIN sentiment_lexicon sl ON sl.word = word
WHERE length(word) > 3
  AND word NOT IN (SELECT sw.word FROM stop_words sw)
GROUP BY b.sprint_id, word, sl.score
HAVING COUNT(*) >= 2;

CREATE UNIQUE INDEX idx_mv_word_freq_sprint_word
  ON mv_word_frequency (sprint_id, word);

CREATE INDEX idx_mv_word_freq_sprint_freq
  ON mv_word_frequency (sprint_id, frequency DESC);
```

## Queries

### Get health trend for team

```sql
SELECT
  sprint_id,
  sprint_name,
  start_date,
  end_date,
  health_score,
  sentiment_score,
  vote_distribution_score,
  participation_score,
  card_count,
  total_members,
  active_members
FROM mv_sprint_health
WHERE team_id = $1
ORDER BY start_date DESC
LIMIT $2 OFFSET $3;
```

### Get participation for team

```sql
SELECT
  user_id,
  user_name,
  sprint_id,
  sprint_name,
  start_date,
  cards_submitted,
  votes_cast,
  action_items_owned,
  action_items_completed
FROM mv_participation_stats
WHERE team_id = $1
  AND ($2::uuid IS NULL OR sprint_id = $2)
ORDER BY start_date DESC, user_name ASC;
```

### Get participation totals per member

```sql
SELECT
  user_id,
  user_name,
  SUM(cards_submitted) AS total_cards,
  SUM(votes_cast) AS total_votes,
  SUM(action_items_owned) AS total_owned,
  SUM(action_items_completed) AS total_completed,
  CASE
    WHEN SUM(action_items_owned) = 0 THEN 0
    ELSE (SUM(action_items_completed)::NUMERIC / SUM(action_items_owned)) * 100
  END AS completion_rate
FROM mv_participation_stats
WHERE team_id = $1
GROUP BY user_id, user_name
ORDER BY total_cards DESC;
```

### Get sentiment trend for team

```sql
SELECT
  sprint_id,
  sprint_name,
  start_date,
  sentiment_score,
  card_count
FROM mv_sprint_health
WHERE team_id = $1
ORDER BY start_date DESC
LIMIT $2 OFFSET $3;
```

### Get sentiment detail for sprint (with per-column breakdown)

```sql
-- Per-column sentiment
SELECT
  col.id AS column_id,
  col.name AS column_name,
  AVG(calculate_card_sentiment(c.text)) AS avg_sentiment,
  COUNT(*) AS card_count,
  COUNT(*) FILTER (WHERE calculate_card_sentiment(c.text) > 0.5) AS positive,
  COUNT(*) FILTER (WHERE calculate_card_sentiment(c.text) < -0.5) AS negative,
  COUNT(*) FILTER (WHERE calculate_card_sentiment(c.text) BETWEEN -0.5 AND 0.5) AS neutral
FROM cards c
JOIN columns col ON c.column_id = col.id
JOIN boards b ON c.board_id = b.id
WHERE b.sprint_id = $1
GROUP BY col.id, col.name
ORDER BY col.position;
```

### Get word cloud data for sprint

```sql
SELECT
  word,
  frequency,
  sentiment
FROM mv_word_frequency
WHERE sprint_id = $1
ORDER BY frequency DESC
LIMIT $2;
```

### Get word cloud data aggregated across sprints

```sql
SELECT
  word,
  SUM(frequency) AS frequency,
  AVG(sentiment) AS sentiment
FROM mv_word_frequency
WHERE sprint_id IN (
  SELECT id FROM sprints WHERE team_id = $1
  ORDER BY start_date DESC
  LIMIT $2
)
GROUP BY word
ORDER BY frequency DESC
LIMIT $3;
```

### Refresh materialized views

```sql
-- Called when a board is marked as completed
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sprint_health;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_participation_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_word_frequency;
```

### Top positive/negative cards for sprint

```sql
-- Top positive
SELECT
  c.id AS card_id,
  c.text,
  calculate_card_sentiment(c.text) AS sentiment,
  COUNT(v.id) AS vote_count
FROM cards c
JOIN boards b ON c.board_id = b.id
LEFT JOIN votes v ON v.card_id = c.id
WHERE b.sprint_id = $1
GROUP BY c.id, c.text
ORDER BY calculate_card_sentiment(c.text) DESC
LIMIT 5;

-- Top negative
SELECT
  c.id AS card_id,
  c.text,
  calculate_card_sentiment(c.text) AS sentiment,
  COUNT(v.id) AS vote_count
FROM cards c
JOIN boards b ON c.board_id = b.id
LEFT JOIN votes v ON v.card_id = c.id
WHERE b.sprint_id = $1
GROUP BY c.id, c.text
ORDER BY calculate_card_sentiment(c.text) ASC
LIMIT 5;
```

## Migration

```sql
-- Migration: 009_create_analytics.sql

BEGIN;

-- Sentiment lexicon table
CREATE TABLE IF NOT EXISTS sentiment_lexicon (
  word   TEXT PRIMARY KEY,
  score  NUMERIC(3, 1) NOT NULL,
  CONSTRAINT chk_sentiment_score CHECK (score >= -5.0 AND score <= 5.0)
);

-- Stop words table
CREATE TABLE IF NOT EXISTS stop_words (
  word TEXT PRIMARY KEY
);

-- Sentiment calculation function
CREATE OR REPLACE FUNCTION calculate_card_sentiment(card_text TEXT)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    AVG(sl.score),
    0
  )
  FROM regexp_split_to_table(
    regexp_replace(lower(card_text), '[^a-z\s]', '', 'g'),
    '\s+'
  ) AS word
  JOIN sentiment_lexicon sl ON sl.word = word
  WHERE length(word) > 2;
$$ LANGUAGE SQL STABLE;

-- Health calculation function
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
  -- (full implementation as shown above)
  SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::BIGINT, 0::BIGINT, 0::BIGINT;
$$ LANGUAGE SQL STABLE;

-- Materialized views
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sprint_health AS
SELECT
  s.id AS sprint_id,
  s.name AS sprint_name,
  s.team_id,
  s.start_date,
  s.end_date,
  0::NUMERIC AS health_score,
  0::NUMERIC AS sentiment_score,
  0::NUMERIC AS vote_distribution_score,
  0::NUMERIC AS participation_score,
  0::BIGINT AS card_count,
  0::BIGINT AS total_members,
  0::BIGINT AS active_members
FROM sprints s
WHERE false; -- Empty initially, populated on first refresh

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sprint_health_sprint_id
  ON mv_sprint_health (sprint_id);
CREATE INDEX IF NOT EXISTS idx_mv_sprint_health_team_id
  ON mv_sprint_health (team_id, start_date DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_participation_stats AS
SELECT
  ''::UUID AS team_id,
  ''::UUID AS sprint_id,
  '' AS sprint_name,
  CURRENT_DATE AS start_date,
  ''::UUID AS user_id,
  '' AS user_name,
  0::BIGINT AS cards_submitted,
  0::BIGINT AS votes_cast,
  0::BIGINT AS action_items_owned,
  0::BIGINT AS action_items_completed
WHERE false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_participation_sprint_user
  ON mv_participation_stats (sprint_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mv_participation_team
  ON mv_participation_stats (team_id, start_date DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_word_frequency AS
SELECT
  ''::UUID AS sprint_id,
  '' AS word,
  0::BIGINT AS frequency,
  0::NUMERIC AS sentiment
WHERE false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_word_freq_sprint_word
  ON mv_word_frequency (sprint_id, word);
CREATE INDEX IF NOT EXISTS idx_mv_word_freq_sprint_freq
  ON mv_word_frequency (sprint_id, frequency DESC);

COMMIT;
```

Note: The actual materialized view definitions (replacing the placeholder `WHERE false` versions) and the full `calculate_sprint_health` function body are applied in a separate migration step after all dependent tables exist. The seed data for `sentiment_lexicon` and `stop_words` is in `src/db/seeds/`.
