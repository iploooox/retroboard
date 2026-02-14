# Analytics & Insights Architecture

## Overview

Analytics provide teams with data-driven insights into their retrospective health over time. The system calculates sprint health scores, sentiment analysis on card text, participation metrics, and word frequency data -- all using PostgreSQL-native capabilities. No external AI APIs are used (constraint from REQUIREMENTS.md). Expensive queries are pre-computed using materialized views refreshed after board completion.

## Design Principles

1. **PostgreSQL-native** -- all computation done in SQL: sentiment scoring via a lexicon table, aggregations via materialized views, text processing via built-in functions
2. **No external APIs** -- sentiment analysis uses a custom `sentiment_lexicon` table, not OpenAI/Claude/etc. (project constraint)
3. **Pre-computed for speed** -- materialized views cache expensive aggregations, refreshed when a board is marked complete
4. **Historical preservation** -- analytics data is never deleted, only appended, so trends remain accurate even if boards/cards are later deleted
5. **Privacy-aware** -- participation metrics show aggregate counts, not individual card content

## Analytics Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Analytics Architecture                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Data Sources                           │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │  cards    │  │  votes   │  │  action_  │  │ boards  │ │   │
│  │  │          │  │          │  │  items    │  │         │ │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │   │
│  │       │              │              │              │      │   │
│  └───────┼──────────────┼──────────────┼──────────────┼──────┘   │
│          │              │              │              │           │
│  ┌───────┴──────────────┴──────────────┴──────────────┴──────┐   │
│  │                  Processing Layer                          │   │
│  │                                                            │   │
│  │  ┌──────────────────────┐  ┌────────────────────────────┐ │   │
│  │  │  Sentiment Scoring    │  │  Participation Counting     │ │   │
│  │  │                      │  │                            │ │   │
│  │  │  card.text            │  │  COUNT(cards) per user     │ │   │
│  │  │    -> tokenize        │  │  COUNT(votes) per user     │ │   │
│  │  │    -> lookup lexicon   │  │  COUNT(action_items) done  │ │   │
│  │  │    -> average scores   │  │                            │ │   │
│  │  └──────────┬───────────┘  └──────────┬─────────────────┘ │   │
│  │             │                          │                   │   │
│  │  ┌──────────┴───────────┐  ┌──────────┴─────────────────┐ │   │
│  │  │  Health Score Calc    │  │  Word Frequency Count       │ │   │
│  │  │                      │  │                            │ │   │
│  │  │  sentiment_avg * 0.4  │  │  regexp_split_to_table     │ │   │
│  │  │  + vote_dist * 0.3   │  │  -> lower()                │ │   │
│  │  │  + participation * 0.3│  │  -> filter stop words      │ │   │
│  │  │                      │  │  -> count per word          │ │   │
│  │  └──────────┬───────────┘  └──────────┬─────────────────┘ │   │
│  │             │                          │                   │   │
│  └─────────────┼──────────────────────────┼───────────────────┘   │
│                │                          │                       │
│  ┌─────────────┴──────────────────────────┴───────────────────┐   │
│  │              Materialized Views                             │   │
│  │                                                            │   │
│  │  mv_sprint_health     — health scores per sprint           │   │
│  │  mv_participation_stats — per-member metrics per sprint    │   │
│  │  mv_word_frequency     — word counts per sprint            │   │
│  │                                                            │   │
│  │  Refreshed: on board completion (phase = 'action' + done)  │   │
│  │  Strategy: REFRESH MATERIALIZED VIEW CONCURRENTLY          │   │
│  │                                                            │   │
│  └────────────────────────┬───────────────────────────────────┘   │
│                           │                                       │
│  ┌────────────────────────┴───────────────────────────────────┐   │
│  │                    API Layer                                │   │
│  │                                                            │   │
│  │  GET /teams/:id/analytics/health                           │   │
│  │  GET /teams/:id/analytics/participation                    │   │
│  │  GET /teams/:id/analytics/sentiment                        │   │
│  │  GET /teams/:id/analytics/word-cloud                       │   │
│  │  GET /sprints/:id/analytics                                │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Sentiment Analysis

### Approach: Lexicon-Based Scoring

Each word in the English language is assigned a sentiment score from -5 (very negative) to +5 (very positive). The `sentiment_lexicon` table is seeded with ~2500 common words. A card's sentiment score is the average of all matched word scores.

```
Card text: "Great team collaboration but deploy was terrible"

Tokenize:  ["great", "team", "collaboration", "but", "deploy", "was", "terrible"]

Lookup:    great = +3, collaboration = +2, terrible = -3
           (team, but, deploy, was = not in lexicon, ignored)

Score:     (+3 + 2 + (-3)) / 3 = +0.67 (slightly positive)
```

### Sentiment Calculation Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                  Sentiment Calculation Pipeline                    │
│                                                                  │
│  Input: card.text = "Great team collaboration but deploy broken" │
│                                                                  │
│  Step 1: Tokenize                                                │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  regexp_split_to_table(lower(text), '\s+')               │    │
│  │  -> ["great", "team", "collaboration", "but",            │    │
│  │      "deploy", "broken"]                                  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                           │                                      │
│  Step 2: Lookup in lexicon                                       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  JOIN sentiment_lexicon ON word = token                   │    │
│  │  great -> +3                                              │    │
│  │  collaboration -> +2                                      │    │
│  │  broken -> -2                                             │    │
│  │  (team, but, deploy: no match, skipped)                   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                           │                                      │
│  Step 3: Calculate average                                       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  AVG(score) = (3 + 2 + (-2)) / 3 = +1.0                  │    │
│  │                                                          │    │
│  │  Normalize to 0-100 scale:                               │    │
│  │  normalized = ((1.0 + 5) / 10) * 100 = 60               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                           │                                      │
│  Output: { rawScore: 1.0, normalizedScore: 60 }                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Sentiment SQL Function

```sql
CREATE OR REPLACE FUNCTION calculate_card_sentiment(card_text TEXT)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    AVG(sl.score),
    0
  )
  FROM regexp_split_to_table(lower(card_text), '[^a-zA-Z]+') AS word
  JOIN sentiment_lexicon sl ON sl.word = word
  WHERE length(word) > 2;  -- skip very short tokens
$$ LANGUAGE SQL STABLE;
```

### Sprint-Level Sentiment

```sql
CREATE OR REPLACE FUNCTION calculate_sprint_sentiment(p_sprint_id UUID)
RETURNS TABLE (
  avg_sentiment NUMERIC,
  positive_count BIGINT,
  negative_count BIGINT,
  neutral_count BIGINT
) AS $$
  SELECT
    AVG(calculate_card_sentiment(c.text)),
    COUNT(*) FILTER (WHERE calculate_card_sentiment(c.text) > 0.5),
    COUNT(*) FILTER (WHERE calculate_card_sentiment(c.text) < -0.5),
    COUNT(*) FILTER (WHERE calculate_card_sentiment(c.text) BETWEEN -0.5 AND 0.5)
  FROM cards c
  JOIN boards b ON c.board_id = b.id
  WHERE b.sprint_id = p_sprint_id;
$$ LANGUAGE SQL STABLE;
```

## Sprint Health Score

The health score is a composite metric (0-100) calculated from three components:

```
Health Score = (Sentiment Score * 0.4) + (Vote Distribution Score * 0.3) + (Participation Score * 0.3)
```

### Component Breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│                    Health Score Components                        │
│                                                                  │
│  1. Sentiment Score (40%)                                        │
│     ┌────────────────────────────────────────────────────────┐   │
│     │  Average sentiment across all cards in the sprint       │   │
│     │  Normalized to 0-100                                   │   │
│     │  Formula: ((avg_sentiment + 5) / 10) * 100             │   │
│     └────────────────────────────────────────────────────────┘   │
│                                                                  │
│  2. Vote Distribution Score (30%)                                │
│     ┌────────────────────────────────────────────────────────┐   │
│     │  Measures how evenly votes are distributed across cards│   │
│     │  High score = votes spread evenly (good discussion)    │   │
│     │  Low score = all votes on 1-2 cards (narrow focus)     │   │
│     │  Formula: (1 - Gini coefficient of vote counts) * 100 │   │
│     │  If no votes: default to 50                            │   │
│     └────────────────────────────────────────────────────────┘   │
│                                                                  │
│  3. Participation Score (30%)                                    │
│     ┌────────────────────────────────────────────────────────┐   │
│     │  % of team members who contributed at least 1 card     │   │
│     │  AND cast at least 1 vote                              │   │
│     │  Formula: (active_members / total_members) * 100       │   │
│     │  Active = submitted >= 1 card AND cast >= 1 vote       │   │
│     └────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Final Score:                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  health = sentiment_normalized * 0.4                       │  │
│  │         + vote_distribution * 0.3                          │  │
│  │         + participation_pct * 0.3                          │  │
│  │                                                            │  │
│  │  Example: 60 * 0.4 + 75 * 0.3 + 80 * 0.3                  │  │
│  │         = 24 + 22.5 + 24 = 70.5                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Participation Metrics

Per-member metrics tracked per sprint:

| Metric | Source | Calculation |
|--------|--------|-------------|
| Cards submitted | cards table | COUNT where created_by = user |
| Votes cast | votes table | COUNT where user_id = user |
| Action items owned | action_items | COUNT where assignee_id = user |
| Action items completed | action_items | COUNT where assignee_id = user AND status = 'done' |
| Completion rate | action_items | completed / owned * 100 |

## Word Cloud Data

Word frequency analysis across all cards in a sprint, useful for identifying recurring themes.

### Word Frequency Pipeline

```sql
-- Extract words, filter stop words, count frequency
SELECT
  word,
  COUNT(*) AS frequency
FROM (
  SELECT regexp_split_to_table(lower(c.text), '[^a-zA-Z]+') AS word
  FROM cards c
  JOIN boards b ON c.board_id = b.id
  WHERE b.sprint_id = $1
) words
WHERE length(word) > 3
  AND word NOT IN (SELECT word FROM stop_words)
GROUP BY word
ORDER BY frequency DESC
LIMIT 100;
```

Stop words table includes common English words that add no analytical value:

```sql
CREATE TABLE stop_words (
  word TEXT PRIMARY KEY
);

-- Seed with ~150 common stop words
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
  -- ... (full list in seed migration)
  ;
```

## Materialized Views

### mv_sprint_health

Pre-computed health scores per sprint. Refreshed when a board is marked complete.

```sql
CREATE MATERIALIZED VIEW mv_sprint_health AS
WITH sprint_sentiment AS (
  SELECT
    b.sprint_id,
    AVG(calculate_card_sentiment(c.text)) AS avg_sentiment,
    COUNT(*) AS card_count
  FROM cards c
  JOIN boards b ON c.board_id = b.id
  GROUP BY b.sprint_id
),
sprint_vote_distribution AS (
  SELECT
    b.sprint_id,
    CASE
      WHEN COUNT(DISTINCT c.id) = 0 THEN 50
      ELSE (1.0 - (
        -- Simplified Gini coefficient
        SUM(ABS(v.vote_count - avg_votes)) / NULLIF(2.0 * COUNT(*) * AVG(v.vote_count), 0)
      )) * 100
    END AS vote_distribution_score
  FROM boards b
  JOIN cards c ON c.board_id = b.id
  LEFT JOIN (
    SELECT card_id, COUNT(*) AS vote_count
    FROM votes
    GROUP BY card_id
  ) v ON v.card_id = c.id
  CROSS JOIN LATERAL (
    SELECT AVG(COALESCE(v2.vote_count, 0)) AS avg_votes
    FROM cards c2
    LEFT JOIN (SELECT card_id, COUNT(*) AS vote_count FROM votes GROUP BY card_id) v2 ON v2.card_id = c2.id
    WHERE c2.board_id = b.id
  ) avg_calc
  GROUP BY b.sprint_id
),
sprint_participation AS (
  SELECT
    s.id AS sprint_id,
    COUNT(DISTINCT tm.user_id) AS total_members,
    COUNT(DISTINCT CASE
      WHEN card_counts.cnt > 0 AND vote_counts.cnt > 0 THEN tm.user_id
    END) AS active_members
  FROM sprints s
  JOIN team_members tm ON tm.team_id = s.team_id
  LEFT JOIN (
    SELECT c.created_by, b.sprint_id, COUNT(*) AS cnt
    FROM cards c JOIN boards b ON c.board_id = b.id
    GROUP BY c.created_by, b.sprint_id
  ) card_counts ON card_counts.created_by = tm.user_id AND card_counts.sprint_id = s.id
  LEFT JOIN (
    SELECT v.user_id, b.sprint_id, COUNT(*) AS cnt
    FROM votes v JOIN cards c ON v.card_id = c.id JOIN boards b ON c.board_id = b.id
    GROUP BY v.user_id, b.sprint_id
  ) vote_counts ON vote_counts.user_id = tm.user_id AND vote_counts.sprint_id = s.id
  GROUP BY s.id
)
SELECT
  s.id AS sprint_id,
  s.name AS sprint_name,
  s.team_id,
  s.start_date,
  s.end_date,
  COALESCE(((ss.avg_sentiment + 5) / 10) * 100, 50) AS sentiment_score,
  COALESCE(svd.vote_distribution_score, 50) AS vote_distribution_score,
  CASE
    WHEN sp.total_members = 0 THEN 0
    ELSE (sp.active_members::NUMERIC / sp.total_members) * 100
  END AS participation_score,
  (
    COALESCE(((ss.avg_sentiment + 5) / 10) * 100, 50) * 0.4 +
    COALESCE(svd.vote_distribution_score, 50) * 0.3 +
    CASE WHEN sp.total_members = 0 THEN 0 ELSE (sp.active_members::NUMERIC / sp.total_members) * 100 END * 0.3
  ) AS health_score,
  ss.card_count,
  sp.total_members,
  sp.active_members
FROM sprints s
LEFT JOIN sprint_sentiment ss ON ss.sprint_id = s.id
LEFT JOIN sprint_vote_distribution svd ON svd.sprint_id = s.id
LEFT JOIN sprint_participation sp ON sp.sprint_id = s.id;

CREATE UNIQUE INDEX ON mv_sprint_health (sprint_id);
```

### mv_participation_stats

Per-member participation metrics per sprint.

```sql
CREATE MATERIALIZED VIEW mv_participation_stats AS
SELECT
  s.team_id,
  s.id AS sprint_id,
  s.name AS sprint_name,
  u.id AS user_id,
  u.name AS user_name,
  COUNT(DISTINCT c.id) AS cards_submitted,
  COUNT(DISTINCT v.id) AS votes_cast,
  COUNT(DISTINCT ai.id) FILTER (WHERE ai.assignee_id = u.id) AS action_items_owned,
  COUNT(DISTINCT ai.id) FILTER (WHERE ai.assignee_id = u.id AND ai.status = 'done') AS action_items_completed
FROM sprints s
JOIN team_members tm ON tm.team_id = s.team_id
JOIN users u ON u.id = tm.user_id
LEFT JOIN boards b ON b.sprint_id = s.id
LEFT JOIN cards c ON c.board_id = b.id AND c.created_by = u.id
LEFT JOIN votes v ON v.user_id = u.id AND v.card_id IN (SELECT id FROM cards WHERE board_id = b.id)
LEFT JOIN action_items ai ON ai.board_id = b.id
GROUP BY s.team_id, s.id, s.name, u.id, u.name;

CREATE UNIQUE INDEX ON mv_participation_stats (sprint_id, user_id);
```

### mv_word_frequency

Word frequency data per sprint for word cloud visualization.

```sql
CREATE MATERIALIZED VIEW mv_word_frequency AS
SELECT
  b.sprint_id,
  word,
  COUNT(*) AS frequency
FROM cards c
JOIN boards b ON c.board_id = b.id
CROSS JOIN LATERAL regexp_split_to_table(lower(c.text), '[^a-zA-Z]+') AS word
WHERE length(word) > 3
  AND word NOT IN (SELECT w FROM stop_words w)
GROUP BY b.sprint_id, word
HAVING COUNT(*) >= 2;

CREATE UNIQUE INDEX ON mv_word_frequency (sprint_id, word);
```

## Materialized View Refresh Strategy

```
┌──────────────────────────────────────────────────────────────┐
│               Materialized View Refresh Strategy              │
│                                                              │
│  Trigger: Board completion (facilitator ends retro)          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  When board.phase = 'action' AND facilitator clicks    │  │
│  │  "Complete Retro":                                     │  │
│  │                                                        │  │
│  │  1. UPDATE boards SET status = 'completed'             │  │
│  │  2. REFRESH MATERIALIZED VIEW CONCURRENTLY             │  │
│  │     mv_sprint_health;                                  │  │
│  │  3. REFRESH MATERIALIZED VIEW CONCURRENTLY             │  │
│  │     mv_participation_stats;                            │  │
│  │  4. REFRESH MATERIALIZED VIEW CONCURRENTLY             │  │
│  │     mv_word_frequency;                                 │  │
│  │                                                        │  │
│  │  CONCURRENTLY: does not lock the view during refresh,  │  │
│  │  allowing reads while refresh runs. Requires UNIQUE    │  │
│  │  INDEX on the view.                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Fallback: Scheduled refresh every 6 hours via application   │
│  timer (not pg_cron, since we can't guarantee pg_cron is     │
│  available). Uses setInterval in Node.js.                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Module Structure

```
src/services/
  analytics-service.ts       -- Health, participation, sentiment calculations
  sentiment-service.ts       -- Sentiment scoring (wraps the SQL function)

src/routes/
  analytics-routes.ts        -- REST API endpoints

src/repositories/
  analytics-repository.ts    -- Queries against materialized views
  sentiment-repository.ts    -- Sentiment lexicon queries
```

## Client-Side State (Zustand)

```typescript
interface AnalyticsState {
  // Team health over sprints
  healthTrend: SprintHealth[];
  isLoadingHealth: boolean;
  fetchHealthTrend: (teamId: string) => Promise<void>;

  // Participation metrics
  participation: ParticipationStats[];
  isLoadingParticipation: boolean;
  fetchParticipation: (teamId: string) => Promise<void>;

  // Sentiment
  sentimentTrend: SentimentData[];
  isLoadingSentiment: boolean;
  fetchSentimentTrend: (teamId: string) => Promise<void>;

  // Word cloud
  wordCloudData: WordFrequency[];
  isLoadingWordCloud: boolean;
  fetchWordCloud: (teamId: string) => Promise<void>;

  // Single sprint summary
  sprintSummary: SprintSummary | null;
  fetchSprintSummary: (sprintId: string) => Promise<void>;
}
```

## Performance Considerations

1. **Materialized views** prevent expensive recalculation on every request. Typical analytics query reads from a materialized view in < 50ms.
2. **CONCURRENTLY refresh** allows reads during refresh, avoiding downtime.
3. **Sentiment function** is marked `STABLE` so PostgreSQL can cache results within a transaction.
4. **Word frequency** uses `HAVING COUNT(*) >= 2` to filter out single-occurrence words, reducing result set.
5. **Stop words** table is small (~150 rows) and will be cached in PostgreSQL shared buffers.

## Related Documents

- [Analytics API Spec](specs/api.md)
- [Analytics Database Spec](specs/database.md)
- [Analytics Test Plan](specs/tests.md)
- [ADR-001: PostgreSQL for Everything](../../decisions/ADR-001-postgresql-for-everything.md)
