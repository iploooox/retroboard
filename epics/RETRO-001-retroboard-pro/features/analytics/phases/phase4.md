---
phase: 4
name: "Intelligence"
status: todo
stories: ["S-018", "S-019", "S-020", "S-021", "S-023"]
estimated_duration: "2-3 weeks"
---

# Phase 4: Intelligence -- Analytics, Sentiment, Action Item Tracking Improvements

## Overview

Phase 4 adds data intelligence to RetroBoard Pro. This phase introduces sprint-level analytics dashboards, cross-sprint team health trends, per-member participation metrics, automated sentiment analysis of card content, and action item carry-over between sprints. At the end of this phase, teams have deep visibility into their retrospective patterns and can make data-driven improvements.

## Stories Included

| Story | Title | Priority |
|-------|-------|----------|
| S-018 | Sprint Analytics Dashboard | High |
| S-019 | Team Health Trends Over Sprints | Medium |
| S-020 | Participation Metrics per Member | Medium |
| S-021 | Sentiment Analysis on Cards | Medium |
| S-023 | Action Item Carry-Over Between Sprints | High |

## Dependencies

- Phase 2 completed (boards, cards, votes, action items)
- Phase 3 completed (real-time features for immediate analytics updates)
- S-018 depends on S-006 (sprints), S-008 (cards), S-010 (votes)
- S-019 depends on S-018 (sprint analytics)
- S-020 depends on S-018 (sprint analytics)
- S-021 depends on S-008 (cards), S-018 (analytics)
- S-023 depends on S-022 (action items)

## Tasks

### 1. Sentiment Analysis Infrastructure (S-021)

- [ ] **BE**: Create `sentiment_lexicon` table migration (id, word VARCHAR, score FLOAT [-5 to +5], language VARCHAR DEFAULT 'en', created_at)
- [ ] **BE**: Create seed script for English sentiment lexicon:
  - Source: AFINN-165 word list (3,300+ words with sentiment scores)
  - Map AFINN scores (-5 to +5) to normalized -1 to +1 range
  - Include common retro-specific words (e.g., "blocker" -> negative, "improvement" -> positive)
- [ ] **BE**: Implement sentiment analysis service:
  - Tokenize card text (lowercase, split on whitespace/punctuation, remove stop words)
  - Lookup each token in sentiment_lexicon
  - Compute aggregate score: mean of matched word scores
  - Map to label: score > 0.1 = "positive", score < -0.1 = "negative", else "neutral"
- [ ] **BE**: Add `sentiment_score` (FLOAT nullable) and `sentiment_label` (VARCHAR nullable) columns to cards table (migration)
- [ ] **BE**: Hook sentiment computation into card create and update flows (compute after save, update async)
- [ ] **BE**: Create `GET /api/v1/boards/:boardId/sentiment` endpoint:
  - Response: { overall: { positive: N, neutral: N, negative: N, averageScore: F }, byColumn: { columnId: { positive: N, neutral: N, negative: N } } }
- [ ] **BE**: Implement custom lexicon management:
  - `POST /api/v1/teams/:teamId/sentiment/words` -- add custom word (admin)
  - `GET /api/v1/teams/:teamId/sentiment/words` -- list custom words
  - `DELETE /api/v1/teams/:teamId/sentiment/words/:wordId` -- remove custom word
- [ ] **BE**: Write unit tests for sentiment analysis service (edge cases: empty text, all unknown words, mixed sentiment)
- [ ] **BE**: Write integration tests for sentiment endpoints

### 2. Sprint Analytics (S-018)

- [ ] **BE**: Create analytics aggregation queries:
  - Total cards per column: `SELECT column_id, COUNT(*) FROM cards WHERE board_id = ? GROUP BY column_id`
  - Top voted cards: `SELECT card_id, COUNT(*) as vote_count FROM votes WHERE card_id IN (board cards) GROUP BY card_id ORDER BY vote_count DESC LIMIT 10`
  - Word frequency: tokenize all card content, count occurrences, exclude stop words, return top 50
  - Cards per participant: `SELECT author_id, COUNT(*) FROM cards WHERE board_id = ? GROUP BY author_id`
  - Action item summary: count by status (open, in_progress, completed, carried_over)
- [ ] **BE**: Create materialized view or summary table `sprint_analytics_cache`:
  - Computed on board completion, stored as JSONB
  - Fields: total_cards, total_votes, total_participants, cards_per_column, top_voted_cards, word_frequencies, sentiment_summary, action_item_summary
- [ ] **BE**: Implement analytics computation service (aggregate all data for a sprint's boards)
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/sprints/:sprintId/analytics` endpoint:
  - Return pre-computed or live-computed analytics
  - Cache result for completed boards
- [ ] **BE**: Implement word frequency analysis utility:
  - Tokenize all card text
  - Remove English stop words (the, is, at, which, etc.)
  - Count and sort by frequency
  - Return top 50 words with counts
- [ ] **BE**: Write unit tests for analytics aggregation and word frequency analysis
- [ ] **BE**: Write integration tests for analytics endpoint
- [ ] **FE**: Create sprint analytics dashboard page:
  - Summary cards row: total cards, total votes, total participants, action items status
  - Card distribution bar chart (cards per column, colored by column color)
  - Top voted cards list (card content preview + vote count)
  - Word cloud visualization (sized by frequency)
  - Participation summary (cards per member, bar chart)
  - Action items summary (pie chart: open, in_progress, completed, carried_over)
- [ ] **FE**: Implement bar chart component using recharts or chart.js
- [ ] **FE**: Implement word cloud component (react-wordcloud or custom SVG)
- [ ] **FE**: Implement pie chart component for action item status
- [ ] **FE**: Add sentiment summary section (sentiment pie chart + column breakdown)
- [ ] **FE**: Add sentiment indicator dots to card components
- [ ] **FE**: Add analytics tab/button to sprint detail page navigation
- [ ] **FE**: Implement analytics API client functions
- [ ] **FE**: Add loading skeletons and empty states for analytics dashboard
- [ ] **FE**: Create per-column sentiment breakdown inline visualization

### 3. Team Health Trends (S-019)

- [ ] **BE**: Design health score algorithm:
  - Components: positive_sentiment_ratio (weight: 0.25), participation_rate (0.25), vote_engagement (0.15), action_item_completion_rate (0.20), cards_per_member (0.15)
  - Score: 0-100 scale
  - Each component normalized to 0-1 range before weighting
- [ ] **BE**: Create per-sprint summary computation and storage:
  - Compute on board completion
  - Store in `sprint_analytics_cache` or dedicated `team_health_scores` table
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/analytics/trends` endpoint:
  - Parameters: limit (default 10), from_sprint_number, to_sprint_number
  - Response: [ { sprintId, sprintNumber, sprintName, healthScore, metrics: { ... }, endDate } ]
- [ ] **BE**: Implement recurring theme detection:
  - Extract top keywords per sprint (from word frequency)
  - Find keywords appearing in 3+ sprints
  - Return with frequency count and sprint IDs
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/analytics/health` endpoint (health scores over time)
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/analytics/themes` endpoint (recurring themes)
- [ ] **BE**: Write unit tests for health score algorithm
- [ ] **BE**: Write integration tests for trends endpoints
- [ ] **FE**: Create team health trends dashboard page:
  - Health score trend line chart (x: sprint, y: score 0-100)
  - Metrics breakdown trend lines (separate lines per metric, toggleable)
  - Recurring themes table (theme, frequency, last seen)
  - Sprint comparison tool (select 2 sprints, side-by-side metrics)
- [ ] **FE**: Implement multi-line trend chart with toggleable series
- [ ] **FE**: Implement health score gauge component (semi-circular gauge, 0-100)
- [ ] **FE**: Implement sprint selector for date range filtering (last 5, 10, all)
- [ ] **FE**: Implement sprint comparison side-by-side view
- [ ] **FE**: Add interactive chart tooltips (hover to see sprint details)
- [ ] **FE**: Add click-through from chart data points to sprint analytics
- [ ] **FE**: Add trends navigation link to team overview page
- [ ] **FE**: Implement trends API client functions

### 4. Participation Metrics (S-020)

- [ ] **BE**: Create participation aggregation queries:
  - Per member per sprint: cards_created, votes_cast, action_items_assigned, action_items_completed
  - Across sprints: total_retros_attended (submitted >= 1 card), attendance_rate
  - Engagement score: weighted composite (cards: 0.4, votes: 0.3, action_items: 0.3)
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/analytics/participation` endpoint:
  - Parameters: limit_sprints (default 5), from_date, to_date
  - Response: members[] with { userId, displayName, metrics: { ... }, engagementScore }
  - Access: admin and facilitator only
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/analytics/participation/:userId` endpoint:
  - Detailed per-sprint breakdown for a single member
  - Access: admin/facilitator for any user, member for own data only
- [ ] **BE**: Implement CSV export for participation report:
  - `GET /api/v1/teams/:teamId/analytics/participation/export?format=csv`
  - Headers: Name, Email, Retros Attended, Total Cards, Total Votes, Action Items, Completion Rate, Engagement Score
- [ ] **BE**: Write unit tests for participation metrics calculations
- [ ] **BE**: Write integration tests for participation endpoints and CSV export
- [ ] **FE**: Create participation metrics dashboard page:
  - Member engagement ranking table (sortable columns)
  - Engagement comparison bar chart (members on x-axis, score on y-axis)
  - Per-member drill-down view (sprint-by-sprint metrics table)
- [ ] **FE**: Implement sortable data table component for member metrics
- [ ] **FE**: Implement engagement comparison bar chart
- [ ] **FE**: Add time period selector (last sprint, last 5, last 10, all time)
- [ ] **FE**: Implement CSV download button (trigger API, download blob)
- [ ] **FE**: Show privacy notice banner ("Participation metrics are tracked for team improvement")
- [ ] **FE**: Add participation link to team analytics navigation
- [ ] **FE**: Implement participation API client functions

### 5. Action Item Carry-Over (S-023)

- [ ] **BE**: Add `original_action_item_id` (UUID FK nullable, self-referencing) and `carry_over_count` (INT DEFAULT 0) columns to action_items table (migration)
- [ ] **BE**: Add 'carried_over' value to action item status enum
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/action-items/incomplete` endpoint:
  - Return all incomplete action items across completed sprints for the team
  - Include: title, description, assignee, due_date, original_sprint_name, carry_over_count
- [ ] **BE**: Create `POST /api/v1/boards/:boardId/action-items/carry-over` endpoint:
  - Accept: { actionItemIds: string[] }
  - For each selected item:
    - Create new action item linked to current board/sprint
    - Set original_action_item_id = original item's id (or the original's original if re-carrying)
    - Set carry_over_count = previous count + 1
    - Update original item status to 'carried_over'
  - Return created action items
- [ ] **BE**: Create `GET /api/v1/action-items/:actionItemId/history` endpoint:
  - Follow the chain of original_action_item_id references
  - Return chronological list: [ { actionItemId, sprintName, status, createdAt, completedAt } ]
- [ ] **BE**: Add flag logic for items carried over 3+ times (include `isOverdue` and `isFrequentlyCarried` in response)
- [ ] **BE**: Write unit tests for carry-over service (single carry-over, re-carry-over chain, bulk carry-over)
- [ ] **BE**: Write integration tests for carry-over endpoints
- [ ] **FE**: Create carry-over review dialog:
  - Shown when creating a new board (after template selection)
  - List of incomplete action items from previous sprints
  - Checkboxes for selection, "Select All" button
  - Show carry_over_count badge on each item
  - Highlight items carried over 3+ times with warning
  - "Carry Over Selected" and "Skip" buttons
- [ ] **FE**: Add carry-over count badge to action item cards (e.g., "Carried over x2")
- [ ] **FE**: Style carried-over items distinctly (dashed border or special icon)
- [ ] **FE**: Add attention flag icon for items carried over 3+ times
- [ ] **FE**: Create action item history timeline view (click to expand, show sprint progression)
- [ ] **FE**: Implement carry-over API client functions
- [ ] **FE**: Add "View History" link on carried-over action items

## Exit Criteria

- [ ] Sprint analytics dashboard shows card distribution, top voted, word cloud, participation, and action item summary
- [ ] Sentiment analysis runs on all cards and is visible in analytics and on cards
- [ ] Team health trends show cross-sprint metrics with health scores and recurring themes
- [ ] Participation metrics are available per member with engagement scores
- [ ] Action items can be carried over between sprints with full history tracking
- [ ] CSV export works for participation metrics
- [ ] All analytics load within 2 seconds for typical data volumes
- [ ] Access controls are enforced on participation metrics
- [ ] All endpoints have tests with >80% coverage

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Analytics query performance on large data sets | Materialized views, pre-computation on board completion, query optimization |
| Sentiment analysis accuracy | Start with lexicon-based (transparent); document limitations; allow custom words |
| Privacy concerns with participation tracking | Restrict access to admin/facilitator; show privacy notice; respect anonymous mode |
| Carry-over chain complexity | Limit chain depth display; always reference the original item, not intermediate |
| Word cloud meaningfulness | Robust stop word list; minimum frequency threshold; optional word exclusion by admin |
