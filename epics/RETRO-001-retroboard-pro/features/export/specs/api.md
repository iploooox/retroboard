# Export API Specification

## Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <JWT>
```

## Authorization

Export endpoints require the user to be a member of the team that owns the board or team being queried.

---

## Endpoints

### GET /api/v1/boards/:id/export

Export a retro board in the specified format.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Board ID |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | string | Yes | - | Export format: `json`, `markdown`, `html` |
| `includeAnalytics` | boolean | No | `true` | Include analytics summary in export |
| `includeActionItems` | boolean | No | `true` | Include action items in export |

#### format=json

**Response 200 OK:**

```
Content-Type: application/json
Content-Disposition: attachment; filename="retro-sprint-15-2026-02-14.json"
```

```json
{
  "exportVersion": "1.0",
  "exportedAt": "2026-02-14T15:00:00.000Z",
  "exportedBy": "user-001",
  "board": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Sprint 15 Retro",
    "teamName": "Platform Team",
    "sprintName": "Sprint 15",
    "sprintStartDate": "2026-02-03",
    "sprintEndDate": "2026-02-14",
    "templateName": "Start/Stop/Continue",
    "facilitatorName": "Alice Chen",
    "phase": "action",
    "isAnonymous": true,
    "cardsRevealed": true,
    "participantCount": 5,
    "createdAt": "2026-02-14T09:00:00.000Z"
  },
  "columns": [
    {
      "id": "col-001",
      "name": "Start",
      "position": 0,
      "cards": [
        {
          "id": "card-001",
          "text": "More pair programming sessions",
          "authorId": "user-002",
          "authorName": "Bob Martinez",
          "voteCount": 5,
          "groupId": "group-001",
          "groupTitle": "Collaboration Ideas",
          "position": 0
        },
        {
          "id": "card-002",
          "text": "Daily standup async in Slack",
          "authorId": "user-003",
          "authorName": "Charlie Kim",
          "voteCount": 3,
          "groupId": null,
          "groupTitle": null,
          "position": 1
        }
      ]
    },
    {
      "id": "col-002",
      "name": "Stop",
      "position": 1,
      "cards": []
    },
    {
      "id": "col-003",
      "name": "Continue",
      "position": 2,
      "cards": []
    }
  ],
  "groups": [
    {
      "id": "group-001",
      "title": "Collaboration Ideas",
      "columnId": "col-001",
      "columnName": "Start",
      "totalVotes": 8,
      "cardIds": ["card-001", "card-005"],
      "position": 0
    }
  ],
  "actionItems": [
    {
      "id": "ai-001",
      "title": "Schedule weekly pair programming",
      "description": "Set up rotating pair programming schedule starting next sprint",
      "assigneeName": "Bob Martinez",
      "dueDate": "2026-02-21",
      "status": "open",
      "sourceCardText": "More pair programming sessions",
      "carriedFromSprintName": null
    }
  ],
  "analytics": {
    "healthScore": 72.5,
    "sentimentScore": 65.0,
    "participationRate": 80.0,
    "totalCards": 24,
    "totalVotes": 48,
    "sentimentBreakdown": {
      "positive": 14,
      "negative": 6,
      "neutral": 4
    },
    "topVotedCards": [
      {
        "text": "More pair programming sessions",
        "voteCount": 5,
        "columnName": "Start"
      }
    ],
    "topWords": [
      { "word": "deployment", "frequency": 8 },
      { "word": "collaboration", "frequency": 6 },
      { "word": "testing", "frequency": 5 }
    ]
  }
}
```

#### format=markdown

**Response 200 OK:**

```
Content-Type: text/markdown; charset=utf-8
Content-Disposition: attachment; filename="retro-sprint-15-2026-02-14.md"
```

```markdown
# Retrospective: Sprint 15 Retro

**Team:** Platform Team
**Sprint:** Sprint 15 (2026-02-03 - 2026-02-14)
**Template:** Start/Stop/Continue
**Facilitator:** Alice Chen
**Date:** 2026-02-14
**Participants:** 5

---

## Summary

| Metric | Value |
|--------|-------|
| Health Score | 72.5/100 |
| Cards | 24 |
| Votes | 48 |
| Participation | 80% |
| Sentiment | Slightly Positive (65/100) |

---

## Start (10 cards)

### More pair programming sessions (5 votes)
> **Author:** Bob Martinez
> **Group:** Collaboration Ideas

### Daily standup async in Slack (3 votes)
> **Author:** Charlie Kim

...

---

## Stop (8 cards)

...

---

## Continue (6 cards)

...

---

## Groups

### Collaboration Ideas (8 total votes)
_Column: Start_
- More pair programming sessions (5 votes)
- Cross-team knowledge sharing (3 votes)

---

## Action Items

| # | Title | Assignee | Due Date | Status |
|---|-------|----------|----------|--------|
| 1 | Schedule weekly pair programming | Bob Martinez | 2026-02-21 | Open |
| 2 | Set up deployment alerts | Charlie Kim | 2026-02-28 | Open |
| 3 | Update CI config | Alice Chen | 2026-02-21 | In Progress |

---

## Top Voted Cards

1. **More pair programming sessions** - 5 votes (Start)
2. **Fix the flaky CI tests** - 4 votes (Stop)
3. **Weekly team demos** - 4 votes (Continue)

---

## Frequent Words

deployment (8), collaboration (6), testing (5), communication (4), sprint (3)

---

*Exported from RetroBoard Pro on 2026-02-14*
```

#### format=html

**Response 200 OK:**

```
Content-Type: text/html; charset=utf-8
```

Returns a complete HTML page with embedded CSS optimized for printing. The page includes a banner prompting the user to use Ctrl+P / Cmd+P to save as PDF. The HTML contains the same information as the Markdown export, styled with print-optimized CSS.

The response does NOT include a `Content-Disposition` header (no download), because the HTML is meant to be rendered in a new browser tab for printing.

**Error Responses (all formats):**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Missing format param | `{ "error": "INVALID_FORMAT", "message": "format query parameter is required. Use: json, markdown, or html" }` |
| 400 | Invalid format value | `{ "error": "INVALID_FORMAT", "message": "Format must be one of: json, markdown, html" }` |
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Board not found | `{ "error": "NOT_FOUND", "message": "Board not found" }` |
| 413 | Board too large | `{ "error": "PAYLOAD_TOO_LARGE", "message": "Board exceeds export size limit (5000 cards)" }` |

---

### GET /api/v1/teams/:teamId/report

Generate a team report aggregating data across sprints.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `teamId` | UUID | Team ID |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `from` | string | No | 6 months ago | Start date (YYYY-MM-DD) |
| `to` | string | No | today | End date (YYYY-MM-DD) |
| `format` | string | No | `json` | Report format: `json` or `markdown` |

**Response 200 OK (format=json):**

```
Content-Type: application/json
Content-Disposition: attachment; filename="team-report-platform-team-2026-02-14.json"
```

```json
{
  "exportVersion": "1.0",
  "exportedAt": "2026-02-14T15:00:00.000Z",
  "team": {
    "id": "team-001",
    "name": "Platform Team",
    "memberCount": 5
  },
  "dateRange": {
    "from": "2025-08-14",
    "to": "2026-02-14"
  },
  "sprintCount": 12,
  "healthTrend": [
    {
      "sprintName": "Sprint 15",
      "startDate": "2026-02-03",
      "healthScore": 72.5,
      "sentimentScore": 65.0,
      "participationScore": 80.0
    },
    {
      "sprintName": "Sprint 14",
      "startDate": "2026-01-20",
      "healthScore": 68.3,
      "sentimentScore": 55.0,
      "participationScore": 60.0
    }
  ],
  "overallHealth": {
    "averageHealthScore": 67.8,
    "trend": "up",
    "bestSprint": { "name": "Sprint 15", "score": 72.5 },
    "worstSprint": { "name": "Sprint 8", "score": 52.0 }
  },
  "participation": {
    "averageParticipationRate": 75.0,
    "members": [
      {
        "userName": "Alice Chen",
        "totalCards": 45,
        "totalVotes": 120,
        "actionItemsCompleted": 9,
        "actionItemCompletionRate": 75.0
      }
    ]
  },
  "actionItems": {
    "totalCreated": 48,
    "totalCompleted": 32,
    "completionRate": 66.7,
    "totalCarriedOver": 12,
    "currentlyOpen": 6
  },
  "sentimentTrend": [
    {
      "sprintName": "Sprint 15",
      "normalizedScore": 62.0,
      "positiveCards": 14,
      "negativeCards": 6
    }
  ],
  "topThemes": [
    { "word": "deployment", "frequency": 45 },
    { "word": "communication", "frequency": 32 },
    { "word": "testing", "frequency": 28 }
  ]
}
```

**Response 200 OK (format=markdown):**

```
Content-Type: text/markdown; charset=utf-8
Content-Disposition: attachment; filename="team-report-platform-team-2026-02-14.md"
```

```markdown
# Team Report: Platform Team

**Period:** 2025-08-14 to 2026-02-14
**Sprints:** 12
**Members:** 5
**Generated:** 2026-02-14

---

## Health Trend

| Sprint | Date | Health | Sentiment | Participation |
|--------|------|--------|-----------|---------------|
| Sprint 15 | 2026-02-03 | 72.5 | 65.0 | 80.0 |
| Sprint 14 | 2026-01-20 | 68.3 | 55.0 | 60.0 |
| ... | ... | ... | ... | ... |

**Average Health:** 67.8/100 | **Trend:** Improving

---

## Participation

| Member | Cards | Votes | Actions Done | Completion % |
|--------|-------|-------|-------------|-------------|
| Alice Chen | 45 | 120 | 9/12 | 75% |
| Bob Martinez | 38 | 105 | 7/8 | 87.5% |
| ... | ... | ... | ... | ... |

**Average Participation Rate:** 75%

---

## Action Items

| Metric | Value |
|--------|-------|
| Total Created | 48 |
| Total Completed | 32 |
| Completion Rate | 66.7% |
| Carried Over | 12 |
| Currently Open | 6 |

---

## Top Themes

deployment (45), communication (32), testing (28), collaboration (22), sprint (18)

---

*Generated by RetroBoard Pro on 2026-02-14*
```

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | from after to | `{ "error": "INVALID_DATE_RANGE", "message": "from date must be before to date" }` |
| 400 | Invalid date format | `{ "error": "INVALID_DATE", "message": "Dates must be in YYYY-MM-DD format" }` |
| 400 | Invalid format | `{ "error": "INVALID_FORMAT", "message": "Format must be json or markdown" }` |
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Team not found | `{ "error": "NOT_FOUND", "message": "Team not found" }` |
