# Analytics Feature Test Plan

## Test Framework

- **Unit tests**: Vitest
- **Integration tests**: Vitest + Supertest
- **Database**: Test PostgreSQL database with seeded sentiment_lexicon and stop_words

---

## Unit Tests

### Sentiment Scoring

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Single positive word | "excellent" | Score = 4.5 |
| 2 | Single negative word | "terrible" | Score = -3.5 |
| 3 | Mixed sentiment | "great collaboration but terrible deploy" | Average of matched words |
| 4 | No lexicon matches | "the and from" | Score = 0 (default) |
| 5 | Empty string | "" | Score = 0 |
| 6 | NULL input | NULL | Score = 0 |
| 7 | All positive words | "excellent amazing wonderful" | Score > 3.0 |
| 8 | All negative words | "terrible awful horrible" | Score < -3.0 |
| 9 | Neutral text | "normal standard average" | Score near 0 |
| 10 | Case insensitive | "GREAT AMAZING" | Same as "great amazing" |
| 11 | Punctuation stripped | "great! amazing..." | Same as "great amazing" |
| 12 | Short words ignored | "a I an" | Score = 0 (words < 3 chars skipped) |
| 13 | Repeated word | "great great great" | Score = 3.0 (average of three +3 scores) |
| 14 | Very long text | 1000 word paragraph | Returns valid score without timeout |
| 15 | Unicode text | "great collab" | Scores English words, ignores rest |

### Normalized Score

| # | Test Case | Input (raw) | Expected (normalized) |
|---|-----------|-------------|----------------------|
| 1 | Maximum positive | 5.0 | 100 |
| 2 | Maximum negative | -5.0 | 0 |
| 3 | Neutral | 0.0 | 50 |
| 4 | Mildly positive | 1.0 | 60 |
| 5 | Mildly negative | -1.0 | 40 |

### Health Score Calculation

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Perfect score | sentiment=100, votes=100, participation=100 | health = 100 |
| 2 | Zero score | sentiment=0, votes=0, participation=0 | health = 0 |
| 3 | Balanced inputs | sentiment=60, votes=70, participation=80 | health = 60*0.4 + 70*0.3 + 80*0.3 = 69 |
| 4 | No cards | Sprint with no cards | sentiment defaults to 50 |
| 5 | No votes | Sprint with no votes | vote_distribution defaults to 50 |
| 6 | No members | Empty team | participation = 0 |
| 7 | All members active | 5/5 participated | participation = 100 |
| 8 | Half members active | 3/6 participated | participation = 50 |
| 9 | Participation requires cards AND votes | User added cards but didn't vote | Not counted as active |

### Vote Distribution Score

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Even distribution | 5 cards, each with 3 votes | High score (near 100) |
| 2 | All votes on one card | 5 cards, one has 15 votes, rest 0 | Low score |
| 3 | No votes at all | 5 cards, 0 votes | Default 50 |
| 4 | No cards | Empty board | Default 50 |
| 5 | Single card | 1 card with 10 votes | Score 100 (no distribution possible) |
| 6 | Two cards equal | 2 cards, 5 votes each | High score |
| 7 | Two cards unequal | 2 cards: 9 votes and 1 vote | Low score |

### Word Frequency

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Basic word counting | 3 cards with "deployment" | frequency = 3 |
| 2 | Stop words excluded | Card with "the deployment is good" | "the" and "is" not in results |
| 3 | Short words excluded | Card with "a big win" | "a" not in results |
| 4 | Case insensitive | "Deploy" and "deploy" | Counted as same word |
| 5 | Minimum frequency filter | Word appears once with minFrequency=2 | Not included |
| 6 | Sentiment included | Word "deployment" | Includes sentiment score from lexicon |
| 7 | Unknown word sentiment | Word not in lexicon | sentiment = 0 |
| 8 | Punctuation stripped | "deployment!" | Counted as "deployment" |
| 9 | Limit respected | 200 unique words, limit=100 | Returns top 100 by frequency |
| 10 | Empty sprint | No cards | Returns empty array |

### AnalyticsService

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Health trend returns sorted sprints | Team with 5 sprints | Sorted by start_date DESC |
| 2 | Trend direction: up | Last 3 sprints higher than previous 3 | direction = "up" |
| 3 | Trend direction: down | Last 3 sprints lower than previous 3 | direction = "down" |
| 4 | Trend direction: stable | No significant change | direction = "stable" |
| 5 | Change percent calculated | Previous avg 60, current avg 72 | changePercent = 20 |
| 6 | Best/worst sprint identified | Sprints with varied scores | Correct sprints identified |
| 7 | Participation totals aggregated | Member across 5 sprints | Sum of per-sprint counts |
| 8 | Completion rate calculated | 3 done out of 4 total | completionRate = 75 |
| 9 | Overdue count correct | 2 items past due, still open | overdue = 2 |
| 10 | Single sprint summary complete | Valid sprintId | All sections populated |

---

## Integration Tests

### GET /api/v1/teams/:teamId/analytics/health

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Returns health scores | Seed 5 sprints with cards/votes, GET health | 200, 5 sprint entries |
| 2 | Scores are 0-100 | Check all scores | All healthScore, sentimentScore, etc. between 0 and 100 |
| 3 | Trend calculated | 6+ sprints | trend.direction is up/down/stable |
| 4 | Pagination works | limit=2, offset=2 | Returns 2 sprints, total shows all |
| 5 | Team not found | Invalid teamId | 404 |
| 6 | Not team member | Authenticated as non-member | 403 |
| 7 | Unauthenticated | No token | 401 |
| 8 | No sprints | New team, no sprints | 200, empty sprints array |
| 9 | Response < 200ms | 20 sprints seeded | Response time < 200ms (from materialized view) |

### GET /api/v1/teams/:teamId/analytics/participation

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Returns per-member stats | 3 members, 2 sprints | 200, 3 member entries |
| 2 | Per-sprint breakdown | Member with activity in 3 sprints | perSprint has 3 entries |
| 3 | Totals aggregated | Multiple sprints | totals sum correctly |
| 4 | Completion rate correct | 3/4 action items done | completionRate = 75.0 |
| 5 | Team averages correct | 3 members, varied activity | Averages calculated correctly |
| 6 | Filter by sprint | ?sprintId=sprint-1 | Only sprint-1 data |
| 7 | Member with no activity | Member who didn't participate | All counts = 0 |
| 8 | Team not found | Invalid teamId | 404 |
| 9 | Not team member | Non-member | 403 |

### GET /api/v1/teams/:teamId/analytics/sentiment

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Returns sentiment per sprint | 3 sprints with cards | 200, 3 sprint entries |
| 2 | Positive/negative/neutral counts | Cards with known sentiments | Counts match expectations |
| 3 | Per-column breakdown | Board with 3 columns | sentimentByColumn has 3 entries |
| 4 | Column sentiment makes sense | "Went Well" column | Higher sentiment than "To Improve" |
| 5 | Overall trend calculated | 6+ sprints | direction is up/down/stable |
| 6 | Raw and normalized scores | Any sprint | averageSentiment in [-5,5], normalizedScore in [0,100] |
| 7 | Team not found | Invalid teamId | 404 |
| 8 | Not team member | Non-member | 403 |
| 9 | Sprint with no cards | Empty sprint | Neutral defaults |

### GET /api/v1/teams/:teamId/analytics/word-cloud

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Returns word frequencies | Sprint with 10 cards | 200, words array populated |
| 2 | Sorted by frequency | Multiple words | First word has highest frequency |
| 3 | Stop words excluded | Cards with "the" and "and" | Not in results |
| 4 | Short words excluded | Cards with "a" and "is" | Not in results |
| 5 | Sentiment included | Known words | sentiment values from lexicon |
| 6 | Limit respected | 200+ unique words, limit=50 | Returns 50 words |
| 7 | Min frequency filter | ?minFrequency=3 | Only words with 3+ occurrences |
| 8 | Filter by sprint | ?sprintId=sprint-1 | Only words from that sprint |
| 9 | Aggregate across sprints | No sprintId filter | Words from recent sprints |
| 10 | Team not found | Invalid teamId | 404 |

### GET /api/v1/sprints/:sprintId/analytics

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Returns complete summary | Sprint with cards, votes, action items | 200, all sections populated |
| 2 | Health section present | Valid sprint | health.healthScore is 0-100 |
| 3 | Cards section present | Sprint with 20 cards | cards.total = 20, byColumn populated |
| 4 | Sentiment section present | Cards with mixed sentiment | positive/negative/neutral counts |
| 5 | Top positive cards | Cards with positive text | topPositiveCards ordered by sentiment DESC |
| 6 | Top negative cards | Cards with negative text | topNegativeCards ordered by sentiment ASC |
| 7 | Participation section | 5 team members | members array has 5 entries |
| 8 | Action items section | 8 action items | Correct open/inProgress/done counts |
| 9 | Word cloud section | Cards with text | wordCloud array populated |
| 10 | Previous sprint comparison | Sprint after another | health.previousSprintHealthScore populated |
| 11 | First sprint (no previous) | First sprint for team | previousSprintHealthScore = null |
| 12 | Sprint not found | Invalid sprintId | 404 |
| 13 | Not team member | Non-member | 403 |

---

## Database Tests

### sentiment_lexicon

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Score constraint min | INSERT word with score=-5.1 | Constraint violation |
| 2 | Score constraint max | INSERT word with score=5.1 | Constraint violation |
| 3 | Score boundary min | INSERT word with score=-5.0 | Success |
| 4 | Score boundary max | INSERT word with score=5.0 | Success |
| 5 | Duplicate word | INSERT same word twice | Primary key violation |
| 6 | Seed data loaded | Check COUNT(*) | ~2500 entries |

### calculate_card_sentiment function

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Known positive text | SELECT calculate_card_sentiment('excellent amazing') | Score > 3 |
| 2 | Known negative text | SELECT calculate_card_sentiment('terrible awful') | Score < -3 |
| 3 | Empty text | SELECT calculate_card_sentiment('') | Score = 0 |
| 4 | Only stop words | SELECT calculate_card_sentiment('the and from') | Score = 0 |
| 5 | Mixed text | SELECT calculate_card_sentiment('great but terrible') | Score near 0 |
| 6 | Function is STABLE | EXPLAIN ANALYZE shows caching | No repeated lexicon scans in same transaction |

### Materialized views

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | mv_sprint_health populated after refresh | Insert data, REFRESH | Rows present |
| 2 | mv_sprint_health unique index | REFRESH CONCURRENTLY | No errors |
| 3 | mv_participation_stats populated | Insert data, REFRESH | Rows present |
| 4 | mv_word_frequency populated | Insert cards with text, REFRESH | Words counted |
| 5 | Concurrent refresh doesn't lock | Parallel read + refresh | Both succeed |
| 6 | Empty state | REFRESH with no data | Empty views, no errors |
| 7 | Index used for team_id query | EXPLAIN for team filter | Index scan on team_id |

---

## End-to-End Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Full analytics pipeline | Create team, 3 sprints with cards/votes/action items, complete boards, query analytics | All metrics populated correctly |
| 2 | Health trend over time | 5 sprints with improving sentiment | Trend direction = "up" |
| 3 | Word cloud reflects topics | Cards about "deployment" in sprint | "deployment" appears in word cloud |
| 4 | Participation tracks all members | 5 members, varied activity | Per-member stats accurate |
| 5 | Materialized views refresh on completion | Complete a board | Materialized views updated within 5s |
| 6 | Sentiment by column | "Went Well" positive, "To Improve" negative | Column sentiments match expectations |
| 7 | Sprint summary complete | Full sprint lifecycle | GET /sprints/:id/analytics returns all sections |

---

## Performance Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Health trend query from materialized view | 50 sprints, GET health | Response < 100ms |
| 2 | Participation query from materialized view | 10 members, 50 sprints | Response < 200ms |
| 3 | Word cloud from materialized view | Sprint with 100 cards | Response < 100ms |
| 4 | Sprint summary (live queries) | Sprint with 50 cards, 200 votes | Response < 500ms |
| 5 | Materialized view refresh time | 50 sprints, 1000 cards | Refresh < 5s |
| 6 | Sentiment function on large text | Card with 500 words | < 10ms |
| 7 | Concurrent analytics requests | 10 simultaneous requests | All complete < 300ms |

---

## Data Accuracy Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Sentiment matches manual calculation | Card with known words | calculate_card_sentiment matches manual average |
| 2 | Health score components sum correctly | Sprint with known inputs | health = sentiment*0.4 + votes*0.3 + participation*0.3 |
| 3 | Participation counts match raw data | COUNT cards/votes manually vs API | Exact match |
| 4 | Word frequency matches manual count | Count "deployment" in cards manually | Matches API result |
| 5 | Overdue items correct | 2 items past due_date, 1 done | overdue = 1 (done items excluded) |
