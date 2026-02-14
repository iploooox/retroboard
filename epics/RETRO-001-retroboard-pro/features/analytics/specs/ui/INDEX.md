# Analytics UI Specification Index

**Feature:** analytics
**Phase:** 4
**Depends on:** retro-board, action-items
**Stories:** S-018, S-019, S-020, S-021

---

## Overview

The analytics UI provides data visualizations that help teams understand their retrospective health, participation patterns, sentiment trends, and action item effectiveness across sprints. The analytics surface is available in two contexts:

1. **Embedded tab** within the Team Detail page (`/teams/:teamId?tab=analytics`) -- a compact summary view with a link to the full dashboard.
2. **Full analytics dashboard** (`/teams/:teamId/analytics`) -- a dedicated page with all charts, filters, and drill-down capabilities.

---

## Pages

| Page | Path | Spec | Description |
|------|------|------|-------------|
| Analytics Dashboard | `/teams/:teamId/analytics` | [analytics-dashboard.md](pages/analytics-dashboard.md) | Full analytics dashboard with all charts and filters |

---

## Shared Components

These components are used across the analytics pages and the embedded team detail tab.

| Component | Description | Used In |
|-----------|-------------|---------|
| `SprintRangeSelector` | Dropdown/slider to select sprint range for charts | Dashboard, Team Detail tab |
| `HealthTrendChart` | Line chart showing sprint health score over time | Dashboard, Team Detail tab |
| `ParticipationChart` | Bar chart showing cards + votes per member | Dashboard |
| `SentimentChart` | Stacked bar or pie chart for positive/neutral/negative per sprint | Dashboard |
| `WordCloudViz` | Word cloud generated from card text | Dashboard |
| `ActionCompletionChart` | Line/bar chart for action item completion rate | Dashboard |
| `ChartCard` | Wrapper container for each chart with title, info tooltip, and optional expand | Dashboard |
| `EmptyChartState` | Placeholder shown when insufficient data for a chart | All |

---

## Data Flow

```
Team Detail (Analytics Tab)          Analytics Dashboard
         |                                    |
         v                                    v
   GET /api/v1/teams/:teamId/           GET /api/v1/teams/:teamId/
       analytics/summary                    analytics/dashboard
         |                                    |
         v                                    v
   Compact summary data               Full chart datasets
   (health trend only)                (all charts + filters)
```

---

## Chart Library

Charts will be rendered using a lightweight, React-compatible charting library. Candidates:

| Library | Pros | Cons |
|---------|------|------|
| **Recharts** | React-native, composable, good defaults | Bundle size ~150KB |
| **Chart.js + react-chartjs-2** | Powerful, well-documented | Canvas-based, less React-idiomatic |
| **Visx** | Low-level, composable D3 + React | More code to write |

Decision deferred to implementation. The spec is library-agnostic -- it describes chart types, axes, and data shapes only.

---

## Design Principles

1. **Data density over decoration** -- maximize the information-to-pixel ratio. Minimal chart chrome, clear labels, no 3D effects.
2. **Sprint-centric** -- the x-axis for trend charts is always sprint names/numbers, not calendar dates.
3. **Actionable insights** -- charts should answer a question ("Are we improving?", "Who is participating?", "Are we closing our action items?").
4. **Graceful degradation** -- charts show meaningful empty states when data is insufficient (e.g., "At least 3 sprints needed for trend analysis").
5. **Accessible** -- all charts have alt text, color-blind-safe palettes, and data table fallbacks.
