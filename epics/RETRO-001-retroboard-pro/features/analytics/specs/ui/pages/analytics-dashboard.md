# UI Page Spec: Analytics Dashboard

**Feature:** analytics
**Page:** Analytics Dashboard
**URL:** `/teams/:teamId/analytics` (also rendered as tab within `/teams/:teamId?tab=analytics`)
**Auth:** Required (must be team member)
**Stories:** S-018, S-019, S-020, S-021

---

## 1. Overview

The analytics dashboard provides a comprehensive view of a team's retrospective health over time. It contains five primary visualizations: sprint health trend, participation breakdown, sentiment distribution, word cloud, and action item completion rate. All charts share a sprint range filter and respond to the same data context.

---

## 2. ASCII Wireframe

### 2.1 Full Dashboard Layout

```
+====================================================================================================+
|  [Logo]  Dashboard > Platform Team > Analytics                             [Avatar v]  [Logout]    |
+====================================================================================================+
|                                                                                                    |
|  Analytics                                                                                         |
|  Platform Team                                                                                     |
|                                                                                                    |
|  Filter: [Sprint Range: Last 10 sprints  v]   [Date: All time  v]   [Export CSV]                  |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +-- SPRINT HEALTH TREND ------------------------------------------------------------------+      |
|  |                                                                            [?] [Expand]  |      |
|  |                                                                                          |      |
|  |  Score                                                                                   |      |
|  |   10 |                                                                                   |      |
|  |      |                  *                                                                |      |
|  |    8 |          *              *                              *                          |      |
|  |      |     *         *              *    *    *    *                                      |      |
|  |    6 |                                                                                   |      |
|  |      |  *                                                          *                     |      |
|  |    4 |                                                                                   |      |
|  |      |                                                                                   |      |
|  |    2 |                                                                                   |      |
|  |      |                                                                                   |      |
|  |    0 +---+----+----+----+----+----+----+----+----+----+----                              |      |
|  |       S15  S16  S17  S18  S19  S20  S21  S22  S23  S24                                   |      |
|  |                                                                                          |      |
|  |  Average: 6.8  |  Trend: +0.4 per sprint  |  Best: Sprint 17 (8.5)                      |      |
|  |                                                                                          |      |
|  +------------------------------------------------------------------------------------------+      |
|                                                                                                    |
|  +-- PARTICIPATION ---------------------------------+  +-- SENTIMENT DISTRIBUTION ----------+      |
|  |                                         [?]      |  |                              [?]    |      |
|  |                                                   |  |                                     |      |
|  |  Cards + Votes per Member (Sprint 24)             |  |  Sentiment per Sprint               |      |
|  |                                                   |  |                                     |      |
|  |  Alice   |==========|======|  12c + 5v            |  |  S24  [#########|===|--]            |      |
|  |  Bob     |========|====|      10c + 4v            |  |  S23  [########|====|---]            |      |
|  |  Carol   |======|=====|       8c + 5v             |  |  S22  [######|=====|----]            |      |
|  |  Dave    |=====|===|          7c + 3v             |  |  S21  [#########|==|--]              |      |
|  |  Eve     |====|==|           6c + 2v              |  |  S20  [#######|====|---]             |      |
|  |  Frank   |===|==|            5c + 2v              |  |                                     |      |
|  |  Grace   |==|=|              3c + 1v              |  |  Legend:                            |      |
|  |  Hank    |=|                 2c + 0v              |  |  [###] Positive                     |      |
|  |                                                   |  |  [===] Neutral                      |      |
|  |  Average: 6.6 cards, 2.8 votes per member         |  |  [---] Negative                     |      |
|  |                                                   |  |                                     |      |
|  +---------------------------------------------------+  +-------------------------------------+      |
|                                                                                                    |
|  +-- WORD CLOUD ------------------------------------+  +-- ACTION ITEM COMPLETION ----------+      |
|  |                                         [?]      |  |                              [?]    |      |
|  |                                                   |  |                                     |      |
|  |           meetings                                |  |  Completion Rate per Sprint          |      |
|  |      testing     DEPLOY                           |  |                                     |      |
|  |   communication      pipeline                     |  |  100%|                              |      |
|  |        SPRINT     review                          |  |      |          *         *          |      |
|  |     documentation    PROCESS                      |  |   75%|     *         *              |      |
|  |        code    priorities                         |  |      |  *                   *       |      |
|  |    onboarding      CI                             |  |   50%|                              |      |
|  |       feedback   collaboration                    |  |      |                              |      |
|  |                                                   |  |   25%|                              |      |
|  |  Based on 156 cards across selected sprints       |  |      |                              |      |
|  |                                                   |  |    0%+---+---+---+---+---+---       |      |
|  +---------------------------------------------------+  |       S19 S20 S21 S22 S23 S24      |      |
|                                                          |                                     |      |
|                                                          |  Average: 72%  |  Trend: +3%/sprint |      |
|                                                          |                                     |      |
|                                                          +-------------------------------------+      |
|                                                                                                    |
+====================================================================================================+
```

### 2.2 Embedded Tab View (within Team Detail)

```
+-------------------------------------------------------------------------+
|  Analytics                       Sprint range: [Last 10 sprints v]      |
|                                                                         |
|  +-- SPRINT HEALTH TREND ------------------------------------------+   |
|  |                                                                  |   |
|  |  Score                                                           |   |
|  |   10 |                                                           |   |
|  |    8 |          *                              *                 |   |
|  |    6 |     *         *    *    *    *    *                        |   |
|  |    4 |  *                                          *             |   |
|  |    2 |                                                           |   |
|  |    0 +---+----+----+----+----+----+----+----+----+----           |   |
|  |       S15  S16  S17  S18  S19  S20  S21  S22  S23  S24          |   |
|  |                                                                  |   |
|  |  Average: 6.8  |  Trend: +0.4/sprint                            |   |
|  |                                                                  |   |
|  +------------------------------------------------------------------+   |
|                                                                         |
|  Quick Stats:                                                           |
|  +-------------+  +-------------+  +-------------+  +--------------+   |
|  | 156 cards   |  | 89 votes    |  | 72% actions |  | 6.8 avg      |   |
|  | submitted   |  | cast        |  | completed   |  | health score |   |
|  +-------------+  +-------------+  +-------------+  +--------------+   |
|                                                                         |
|  [View Full Analytics ->]                                               |
|                                                                         |
+-------------------------------------------------------------------------+
```

### 2.3 Empty State (Fewer than 3 Sprints)

```
+-------------------------------------------------------------------------+
|  Analytics                                                              |
|                                                                         |
|  +-----------------------------------------------------------------+   |
|  |                                                                  |   |
|  |              +------------------+                                |   |
|  |              |  (chart icon)    |                                |   |
|  |              +------------------+                                |   |
|  |                                                                  |   |
|  |         Not enough data yet for analytics.                       |   |
|  |                                                                  |   |
|  |   Complete at least 3 retrospectives to see trends               |   |
|  |   and insights for your team.                                    |   |
|  |                                                                  |   |
|  |   Sprints completed: 1 of 3 minimum                              |   |
|  |   [=====-----------]                                             |   |
|  |                                                                  |   |
|  +-----------------------------------------------------------------+   |
|                                                                         |
+-------------------------------------------------------------------------+
```

---

## 3. Component Breakdown

### 3.1 Component Tree

```
<AnalyticsDashboardPage>
  <AppHeader breadcrumbs={["Dashboard", teamName, "Analytics"]} />
  <DashboardTitle teamName={string} />
  <FilterBar>
    <SprintRangeSelector value={range} onChange={fn} sprints={Sprint[]} />
    <DateRangeFilter value={dateRange} onChange={fn} />
    <ExportCSVButton onClick={fn} />
  </FilterBar>

  <ChartGrid>
    <ChartCard title="Sprint Health Trend" span="full">
      <HealthTrendChart data={HealthTrendData[]} />
      <TrendSummary average={number} trend={number} best={SprintScore} />
    </ChartCard>

    <ChartCard title="Participation" span="half">
      <ParticipationChart data={ParticipationData[]} sprintId={string} />
      <ParticipationSummary avgCards={number} avgVotes={number} />
    </ChartCard>

    <ChartCard title="Sentiment Distribution" span="half">
      <SentimentChart data={SentimentData[]} />
      <SentimentLegend />
    </ChartCard>

    <ChartCard title="Word Cloud" span="half">
      <WordCloudViz words={WordFrequency[]} />
      <WordCloudFooter totalCards={number} />
    </ChartCard>

    <ChartCard title="Action Item Completion" span="half">
      <ActionCompletionChart data={ActionCompletionData[]} />
      <CompletionSummary average={number} trend={number} />
    </ChartCard>
  </ChartGrid>
</AnalyticsDashboardPage>
```

### 3.2 Component Specifications

| Component | Description | Key Props | Notes |
|-----------|-------------|-----------|-------|
| `AnalyticsDashboardPage` | Page container, fetches analytics data | -- | URL param: `:teamId` |
| `DashboardTitle` | Page heading with team name | `teamName` | |
| `FilterBar` | Top filter row | -- | Sticky on scroll |
| `SprintRangeSelector` | Dropdown: "Last 5/10/20 sprints" or "All" | `value`, `onChange`, `sprints` | Default: Last 10 |
| `DateRangeFilter` | Date range picker for custom filtering | `value`, `onChange` | Optional, secondary filter |
| `ExportCSVButton` | Download analytics data as CSV | `onClick` | Exports visible chart data |
| `ChartGrid` | Responsive grid for chart cards | `children` | `grid-cols-1 lg:grid-cols-2` |
| `ChartCard` | Wrapper for each chart with title, help, expand | `title`, `span`, `children` | `span: "full" | "half"` |
| `HealthTrendChart` | Line chart: health score over sprints | `data: HealthTrendData[]` | Full-width, y-axis 0-10 |
| `TrendSummary` | Stats row below health chart | `average`, `trend`, `best` | |
| `ParticipationChart` | Horizontal bar chart: cards+votes per member | `data`, `sprintId` | Per-sprint or aggregated |
| `ParticipationSummary` | Average stats below participation chart | `avgCards`, `avgVotes` | |
| `SentimentChart` | Stacked horizontal bar: positive/neutral/negative | `data: SentimentData[]` | Per-sprint breakdown |
| `SentimentLegend` | Color legend for sentiment categories | -- | Positive=green, Neutral=gray, Negative=red |
| `WordCloudViz` | Word cloud from card text | `words: WordFrequency[]` | Word size proportional to frequency |
| `WordCloudFooter` | Source info below word cloud | `totalCards` | |
| `ActionCompletionChart` | Line chart: completion rate per sprint | `data: ActionCompletionData[]` | y-axis 0-100% |
| `CompletionSummary` | Average + trend below completion chart | `average`, `trend` | |
| `EmptyChartState` | Placeholder for insufficient data | `minSprints`, `currentSprints` | Shows progress bar |

---

## 4. State Management (Zustand)

### 4.1 Analytics Store

```typescript
interface AnalyticsStore {
  // Filter state
  teamId: string | null;
  sprintRange: 'last_5' | 'last_10' | 'last_20' | 'all';
  dateRange: { start: string; end: string } | null;

  // Chart data
  healthTrend: HealthTrendData[];
  participation: ParticipationData[];
  sentiment: SentimentData[];
  wordCloud: WordFrequency[];
  actionCompletion: ActionCompletionData[];

  // Summary stats
  summaryStats: {
    totalCards: number;
    totalVotes: number;
    actionCompletionRate: number;
    averageHealthScore: number;
  } | null;

  // Loading
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAnalytics: (teamId: string) => Promise<void>;
  setSprintRange: (range: string) => void;
  setDateRange: (range: { start: string; end: string } | null) => void;
  exportCSV: () => void;
}
```

### 4.2 State Matrix

| State | `healthTrend` | `isLoading` | `error` | UI Behavior |
|-------|---------------|-------------|---------|-------------|
| Initial | `[]` | `true` | `null` | Skeleton chart placeholders (5 cards) |
| Loaded | `[...data]` | `false` | `null` | All charts rendered |
| Insufficient data | `[1-2 items]` | `false` | `null` | Empty state with progress indicator |
| Error | `[]` | `false` | `string` | Error banner with retry button |
| Filtering | `[...stale]` | `true` | `null` | Charts show stale data with overlay spinner |
| No data at all | `[]` | `false` | `null` | Full empty state: "No retros completed yet" |

---

## 5. User Interactions

| # | Action | Trigger | Result |
|---|--------|---------|--------|
| 1 | Change sprint range | Dropdown selection | Re-fetch analytics data with new range, all charts update |
| 2 | Set date range | Date picker selection | Filter analytics by custom date range |
| 3 | Clear date range | Click "X" on date filter | Revert to sprint-range-only filtering |
| 4 | Export CSV | Click "Export CSV" | Download CSV file with all visible chart data |
| 5 | Hover chart data point | Mouse hover on chart element | Show tooltip with exact values |
| 6 | Click "?" help icon on chart | Click info button | Show popover explaining what the chart measures |
| 7 | Click "Expand" on chart | Click expand button | Chart opens in fullscreen overlay modal |
| 8 | Click word in word cloud | Click on a word | (Future) Filter to show cards containing that word |
| 9 | Click sprint on health chart | Click data point | (Future) Navigate to that sprint's retro board |
| 10 | Click "View Full Analytics" | Link in embedded tab | Navigate to `/teams/:teamId/analytics` |

---

## 6. Data Requirements

### 6.1 API Endpoints

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/v1/teams/:teamId/analytics/dashboard` | GET | Full analytics dashboard data | `{ health, participation, sentiment, wordCloud, actionCompletion, summary }` |
| `/api/v1/teams/:teamId/analytics/summary` | GET | Compact summary for embedded tab | `{ health, summary }` |
| `/api/v1/teams/:teamId/analytics/export` | GET | CSV export of analytics data | `text/csv` response |

### 6.2 Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `sprint_range` | `last_5` \| `last_10` \| `last_20` \| `all` | `last_10` | Number of recent sprints to include |
| `start_date` | ISO 8601 date | -- | Custom date range start (optional) |
| `end_date` | ISO 8601 date | -- | Custom date range end (optional) |

### 6.3 Data Types

```typescript
interface HealthTrendData {
  sprint_id: string;
  sprint_name: string;
  sprint_number: number;
  health_score: number;           // 0.0 - 10.0
  card_count: number;
  participant_count: number;
  completed_at: string;
}

interface ParticipationData {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  cards_submitted: number;
  votes_cast: number;
  actions_owned: number;
  sprints_participated: number;
}

interface SentimentData {
  sprint_id: string;
  sprint_name: string;
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  positive_pct: number;           // 0.0 - 1.0
  neutral_pct: number;
  negative_pct: number;
}

interface WordFrequency {
  word: string;
  count: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface ActionCompletionData {
  sprint_id: string;
  sprint_name: string;
  total_actions: number;
  completed_actions: number;
  completion_rate: number;        // 0.0 - 1.0
  avg_days_to_complete: number;
}

interface AnalyticsSummary {
  total_cards: number;
  total_votes: number;
  action_completion_rate: number;
  average_health_score: number;
  total_sprints: number;
  total_participants: number;
}
```

---

## 7. Chart Specifications

### 7.1 Sprint Health Trend

| Aspect | Detail |
|--------|--------|
| Type | Line chart with data points |
| X-axis | Sprint names (e.g., "S15", "S16", ...) |
| Y-axis | Health score (0-10 scale) |
| Line color | Indigo-500 (`#6366f1`) |
| Data points | Filled circles, 6px radius |
| Hover | Tooltip showing: sprint name, score, card count, participant count |
| Reference line | Dashed horizontal line at average score |
| Summary | Below chart: "Average: X.X \| Trend: +/-X.X per sprint \| Best: Sprint N (X.X)" |

### 7.2 Participation

| Aspect | Detail |
|--------|--------|
| Type | Horizontal stacked bar chart |
| Y-axis | Member names (sorted by total descending) |
| X-axis | Count |
| Bar segments | Cards (blue) + Votes (green) |
| Labels | "Xc + Yv" at end of each bar |
| Sprint selector | Dropdown within chart to view per-sprint or aggregated |
| Hover | Tooltip showing exact card count, vote count, action items owned |

### 7.3 Sentiment Distribution

| Aspect | Detail |
|--------|--------|
| Type | Horizontal stacked bar chart, 100% width |
| Y-axis | Sprint names |
| X-axis | Percentage (0-100%) |
| Segments | Positive (green-500), Neutral (gray-400), Negative (red-500) |
| Hover | Tooltip showing exact counts and percentages |
| Legend | Below chart with color swatches |

### 7.4 Word Cloud

| Aspect | Detail |
|--------|--------|
| Type | Word cloud / tag cloud |
| Size | Word font size proportional to frequency (min 12px, max 48px) |
| Color | Based on sentiment: positive=green, neutral=gray, negative=red |
| Layout | Random placement within container bounds |
| Interaction | Hover shows count tooltip |
| Footer | "Based on N cards across selected sprints" |

### 7.5 Action Item Completion

| Aspect | Detail |
|--------|--------|
| Type | Line chart with filled area |
| X-axis | Sprint names |
| Y-axis | Completion rate (0-100%) |
| Line color | Green-500 (`#22c55e`) |
| Fill | Green-100 area below line |
| Reference line | Dashed horizontal at 80% (target) |
| Hover | Tooltip showing: total actions, completed, rate, avg days to complete |

---

## 8. Responsive Behavior

| Breakpoint | Layout Change |
|------------|---------------|
| `< 640px` (mobile) | All charts full width, stacked vertically. Sprint range selector becomes full-width dropdown. Charts reduce in height. |
| `640px - 1023px` (tablet) | Health trend full width, other charts 1 column. Filter bar wraps to 2 lines. |
| `1024px+` (desktop) | Health trend full width, other 4 charts in 2x2 grid. Filter bar single line. |

---

## 9. Accessibility

| Element | ARIA / A11y Requirement |
|---------|------------------------|
| Charts | `role="img"` with `aria-label` describing the chart content |
| Chart data | Hidden data table (`<table>`) available via screen reader, visually hidden |
| Color coding | All color-coded data also has text labels or patterns |
| Sentiment colors | Green/gray/red palette is color-blind friendly (differs in luminance, not just hue) |
| Filter controls | Proper `<label>` associations, keyboard navigable |
| Tooltips | `role="tooltip"`, triggered on focus as well as hover |
| Word cloud | Each word is focusable with `aria-label="{word}: {count} occurrences"` |
| Export button | `aria-label="Export analytics data as CSV"` |
| Empty state | `role="status"`, `aria-label="Insufficient data for analytics"` |

---

## 10. Health Score Calculation

The health score (0-10 scale) is computed server-side using a composite of signals from each retro. This is provided for context -- the UI simply displays the number.

| Signal | Weight | Description |
|--------|--------|-------------|
| Participation rate | 25% | Members who added at least 1 card / total members |
| Card volume | 20% | Cards per member (scaled to 0-10, where 2+ cards/member = 10) |
| Vote engagement | 15% | Votes cast / max possible votes |
| Sentiment balance | 20% | Ratio of positive to negative cards (balanced = high) |
| Action item creation | 10% | At least 1 action item created = 10, none = 0 |
| Action item completion (prior sprint) | 10% | Completion rate of previous sprint's actions |

---

## 11. Error Handling

| Scenario | UI Response |
|----------|-------------|
| Network error fetching analytics | Error banner: "Failed to load analytics. Check your connection." + Retry |
| Insufficient sprints (< 3) | Empty state with progress bar and explanation |
| No completed retros at all | Full empty state: "No retros completed yet. Run your first retro to start tracking analytics." |
| Individual chart fails | That chart shows inline error; other charts remain visible |
| CSV export fails | Toast: "Export failed. Please try again." |
| Team not found | Full page 404 |
| Access denied | Full page 403 |
