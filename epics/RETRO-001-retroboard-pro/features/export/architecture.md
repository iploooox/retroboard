# Export Feature Architecture

## Overview

The export feature allows teams to take retro data outside of RetroBoard Pro. Boards can be exported as raw JSON (for programmatic use), formatted Markdown (for documentation/wikis), or printer-friendly HTML (for PDF via the browser's print function). A team-level report endpoint aggregates data across sprints for retrospective reviews.

## Design Principles

1. **No heavy server-side PDF libraries** -- instead of bundling puppeteer or wkhtmltopdf (large dependencies), the server generates a printer-friendly HTML page and the client uses `window.print()` for PDF output. This keeps the server lightweight.
2. **Complete export** -- every export includes all board data: metadata, columns, cards (with vote counts), groups, action items, and analytics summary.
3. **Privacy-aware** -- anonymous cards respect the reveal state. If cards are not revealed, author info is omitted from exports.
4. **Streaming for large exports** -- JSON and Markdown exports stream directly from PostgreSQL to the HTTP response to avoid loading entire boards into memory.
5. **Consistent formatting** -- Markdown output follows a well-defined template that works in GitHub, Confluence, and other Markdown renderers.

## Export Formats

```
┌──────────────────────────────────────────────────────────────────┐
│                      Export Formats                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  JSON Export                                               │  │
│  │                                                            │  │
│  │  - Raw structured data                                     │  │
│  │  - Content-Type: application/json                          │  │
│  │  - Filename: retroboard-{boardName}-{date}.json            │  │
│  │  - Use case: data migration, backup, custom analysis       │  │
│  │  - Includes everything: metadata, columns, cards,          │  │
│  │    votes, groups, action items, analytics                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Markdown Export                                           │  │
│  │                                                            │  │
│  │  - Human-readable formatted text                           │  │
│  │  - Content-Type: text/markdown                             │  │
│  │  - Filename: retroboard-{boardName}-{date}.md              │  │
│  │  - Use case: paste into wiki, Slack, Confluence            │  │
│  │  - Structured with headers, tables, lists                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  HTML Export (printer-friendly)                             │  │
│  │                                                            │  │
│  │  - Styled HTML page optimized for printing                 │  │
│  │  - Content-Type: text/html                                 │  │
│  │  - Includes @media print CSS for clean PDF output          │  │
│  │  - Client calls window.print() to save as PDF              │  │
│  │  - Use case: formal meeting records, audit trails          │  │
│  │  - Opens in new tab, user can print to PDF                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Export Data Structure

All three formats include the same data, presented differently:

```
Board Export Contents:
├── Board Metadata
│   ├── Board name
│   ├── Team name
│   ├── Sprint name and dates
│   ├── Template used
│   ├── Created date
│   ├── Facilitator name
│   ├── Phase (at time of export)
│   └── Participant count
│
├── Columns (ordered by position)
│   └── For each column:
│       ├── Column name
│       ├── Card count
│       └── Cards (ordered by vote count, desc)
│           ├── Card text
│           ├── Author (if not anonymous or if revealed)
│           ├── Vote count
│           └── Group name (if grouped)
│
├── Groups
│   └── For each group:
│       ├── Group title
│       ├── Column name
│       ├── Total votes (sum of card votes)
│       └── Card list
│
├── Action Items
│   └── For each item:
│       ├── Title
│       ├── Description
│       ├── Assignee
│       ├── Due date
│       ├── Status
│       └── Source card text (if linked)
│
└── Analytics Summary
    ├── Health score
    ├── Sentiment breakdown (positive/negative/neutral)
    ├── Participation rate
    ├── Top voted cards (top 5)
    └── Word frequency (top 20 words)
```

## Export Flow

```
  Client                          Server                        PostgreSQL
    │                               │                               │
    │  GET /api/v1/boards/:id/      │                               │
    │  export?format=markdown       │                               │
    │ ─────────────────────────────>│                               │
    │                               │                               │
    │                               │  Verify auth & access         │
    │                               │                               │
    │                               │  Query board with all         │
    │                               │  related data:                │
    │                               │  - Board metadata             │
    │                               │  - Columns                    │
    │                               │  - Cards with votes           │
    │                               │  - Groups                     │
    │                               │  - Action items               │
    │                               │  - Analytics (from MV)        │
    │                               │ ─────────────────────────────>│
    │                               │ <─────────────────────────────│
    │                               │                               │
    │                               │  Format as Markdown           │
    │                               │  (ExportFormatter.toMarkdown) │
    │                               │                               │
    │  200 OK                       │                               │
    │  Content-Type: text/markdown  │                               │
    │  Content-Disposition:         │                               │
    │    attachment;                 │                               │
    │    filename="retro-sprint-    │                               │
    │    15-2026-02-14.md"          │                               │
    │ <─────────────────────────────│                               │
    │                               │                               │
    │  (Browser downloads file)     │                               │
    │                               │                               │
```

## Markdown Template

```markdown
# Retrospective: {boardName}

**Team:** {teamName}
**Sprint:** {sprintName} ({startDate} - {endDate})
**Template:** {templateName}
**Facilitator:** {facilitatorName}
**Date:** {exportDate}
**Participants:** {participantCount}

---

## Summary

| Metric | Value |
|--------|-------|
| Health Score | {healthScore}/100 |
| Cards | {totalCards} |
| Votes | {totalVotes} |
| Participation | {participationRate}% |
| Sentiment | {sentimentLabel} ({normalizedScore}/100) |

---

## {columnName1}

### {cardText1} ({voteCount} votes)
> Author: {authorName}
> Group: {groupName}

### {cardText2} ({voteCount} votes)
> Author: {authorName}

---

## {columnName2}

...

---

## Groups

### {groupTitle1} ({totalVotes} total votes)
- {card1Text} ({votes})
- {card2Text} ({votes})

---

## Action Items

| # | Title | Assignee | Due Date | Status |
|---|-------|----------|----------|--------|
| 1 | {title} | {assignee} | {dueDate} | {status} |
| 2 | {title} | {assignee} | {dueDate} | {status} |

---

## Top Voted Cards

1. **{cardText}** - {voteCount} votes ({columnName})
2. **{cardText}** - {voteCount} votes ({columnName})
3. **{cardText}** - {voteCount} votes ({columnName})

---

## Word Cloud (Top 20)

{word1} ({freq}), {word2} ({freq}), {word3} ({freq}), ...

---

*Exported from RetroBoard Pro on {exportDate}*
```

## HTML Template for Printing

The HTML export includes embedded CSS optimized for print:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Retrospective: {boardName}</title>
  <style>
    /* Screen styles */
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
    h2 { color: #2563eb; margin-top: 24px; }
    .card { background: #f8f9fa; border-left: 3px solid #2563eb; padding: 12px; margin: 8px 0; }
    .votes { color: #059669; font-weight: bold; }
    .action-item { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .status-open { color: #d97706; }
    .status-done { color: #059669; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    th { background: #f3f4f6; }

    /* Print styles */
    @media print {
      body { max-width: 100%; padding: 0; font-size: 11pt; }
      h1 { font-size: 18pt; }
      h2 { font-size: 14pt; color: #000; break-after: avoid; }
      .card { break-inside: avoid; border-left-color: #000; }
      .no-print { display: none; }
      table { font-size: 10pt; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background: #fef3c7; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
    Use your browser's Print function (Ctrl+P / Cmd+P) to save as PDF.
  </div>
  <!-- Content follows same structure as Markdown but as HTML -->
</body>
</html>
```

## Team Report

The team report aggregates data across multiple sprints for retrospective reviews and management reporting.

```
Team Report Contents:
├── Team Metadata
│   ├── Team name
│   ├── Date range
│   └── Sprint count
│
├── Health Trend
│   ├── Per-sprint health scores
│   ├── Trend direction
│   └── Average health
│
├── Participation Summary
│   ├── Per-member totals
│   └── Team averages
│
├── Sentiment Trend
│   ├── Per-sprint sentiment
│   └── Overall trend
│
├── Action Item Summary
│   ├── Total created
│   ├── Completion rate
│   └── Carry-over rate
│
└── Top Themes
    └── Most frequent words across sprints
```

## Anonymous Card Handling

```
Export Logic for Anonymous Cards:
  IF board.is_anonymous = false:
    Always include author info

  ELSE IF board.cards_revealed = true:
    Include author info (cards have been revealed)

  ELSE (anonymous and not revealed):
    Omit authorId, authorName from all formats
    Show "Anonymous" as author in Markdown/HTML
    Set authorId: null, authorName: null in JSON
```

## Module Structure

```
src/services/
  export-service.ts           -- Orchestrates data fetching and formatting

src/formatters/
  json-formatter.ts           -- Formats board data as JSON
  markdown-formatter.ts       -- Formats board data as Markdown
  html-formatter.ts           -- Formats board data as printer-friendly HTML
  report-formatter.ts         -- Formats team report (JSON/Markdown)

src/routes/
  export-routes.ts            -- REST API endpoints

src/repositories/
  export-repository.ts        -- Queries to fetch complete board data for export
```

## Data Fetching Query

A single query fetches all data needed for export to minimize database round-trips:

```sql
-- Fetch complete board data for export
WITH board_data AS (
  SELECT
    b.*,
    s.name AS sprint_name,
    s.start_date AS sprint_start,
    s.end_date AS sprint_end,
    t.name AS team_name,
    tmpl.name AS template_name,
    u.name AS facilitator_name
  FROM boards b
  JOIN sprints s ON b.sprint_id = s.id
  JOIN teams t ON s.team_id = t.id
  LEFT JOIN templates tmpl ON b.template_id = tmpl.id
  LEFT JOIN users u ON b.facilitator_id = u.id
  WHERE b.id = $1
),
columns_data AS (
  SELECT json_agg(
    json_build_object(
      'id', col.id,
      'name', col.name,
      'position', col.position
    ) ORDER BY col.position
  ) AS columns
  FROM columns col
  WHERE col.board_id = $1
),
cards_data AS (
  SELECT json_agg(
    json_build_object(
      'id', c.id,
      'columnId', c.column_id,
      'text', c.text,
      'authorId', CASE WHEN bd.is_anonymous AND NOT bd.cards_revealed THEN NULL ELSE c.created_by END,
      'authorName', CASE WHEN bd.is_anonymous AND NOT bd.cards_revealed THEN NULL ELSE u.name END,
      'voteCount', COALESCE(vc.cnt, 0),
      'groupId', c.group_id,
      'position', c.position
    ) ORDER BY COALESCE(vc.cnt, 0) DESC
  ) AS cards
  FROM cards c
  JOIN board_data bd ON c.board_id = bd.id
  LEFT JOIN users u ON c.created_by = u.id
  LEFT JOIN (SELECT card_id, COUNT(*) AS cnt FROM votes GROUP BY card_id) vc ON vc.card_id = c.id
),
groups_data AS (
  SELECT json_agg(
    json_build_object(
      'id', g.id,
      'title', g.title,
      'columnId', g.column_id,
      'position', g.position
    ) ORDER BY g.position
  ) AS groups
  FROM groups g
  WHERE g.board_id = $1
),
action_items_data AS (
  SELECT json_agg(
    json_build_object(
      'id', ai.id,
      'title', ai.title,
      'description', ai.description,
      'assigneeName', u.name,
      'dueDate', ai.due_date,
      'status', ai.status,
      'sourceCardText', c.text
    ) ORDER BY ai.created_at
  ) AS action_items
  FROM action_items ai
  LEFT JOIN users u ON ai.assignee_id = u.id
  LEFT JOIN cards c ON ai.card_id = c.id
  WHERE ai.board_id = $1
)
SELECT
  bd.*,
  cd.columns,
  crd.cards,
  gd.groups,
  aid.action_items
FROM board_data bd
CROSS JOIN columns_data cd
CROSS JOIN cards_data crd
CROSS JOIN groups_data gd
CROSS JOIN action_items_data aid;
```

## Error Handling

| Scenario | HTTP Status | Error Code | Message |
|----------|-------------|-----------|---------|
| Board not found | 404 | NOT_FOUND | Board not found |
| Not team member | 403 | FORBIDDEN | Access denied |
| Invalid format | 400 | INVALID_FORMAT | Format must be one of: json, markdown, html |
| Team not found | 404 | NOT_FOUND | Team not found |
| Invalid date range | 400 | INVALID_DATE_RANGE | from must be before to |
| Export too large | 413 | PAYLOAD_TOO_LARGE | Board data exceeds export limit |

## Performance Considerations

1. **Single query** -- all board data fetched in one SQL query to avoid N+1 problems
2. **Analytics from materialized view** -- health score and word cloud data come from pre-computed views
3. **Response headers** -- `Content-Disposition: attachment` triggers download rather than inline rendering
4. **Size limits** -- boards with >5000 cards are rejected with 413 (unlikely in practice but guards against abuse)
5. **Caching** -- export results can be cached for 5 minutes (board data doesn't change frequently during/after retros)

## Related Documents

- [Export API Spec](specs/api.md)
- [Export Test Plan](specs/tests.md)
- [Analytics Architecture](../analytics/architecture.md) -- analytics data included in exports
