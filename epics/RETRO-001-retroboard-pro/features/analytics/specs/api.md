# Analytics API Specification

## Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <JWT>
```

## Authorization

All analytics endpoints require the user to be a member of the team being queried. Sprint analytics require membership in the sprint's team.

---

## Endpoints

### GET /api/v1/teams/:teamId/analytics/health

Team health scores over time, one data point per sprint.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `teamId` | UUID | Team ID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Max sprints to return (1-100) |
| `offset` | integer | 0 | Pagination offset |

**Response 200 OK:**

```json
{
  "teamId": "team-001",
  "teamName": "Platform Team",
  "sprints": [
    {
      "sprintId": "sprint-015",
      "sprintName": "Sprint 15",
      "startDate": "2026-02-03",
      "endDate": "2026-02-14",
      "healthScore": 72.5,
      "sentimentScore": 65.0,
      "voteDistributionScore": 78.0,
      "participationScore": 80.0,
      "cardCount": 24,
      "totalMembers": 5,
      "activeMembers": 4
    },
    {
      "sprintId": "sprint-014",
      "sprintName": "Sprint 14",
      "startDate": "2026-01-20",
      "endDate": "2026-01-31",
      "healthScore": 68.3,
      "sentimentScore": 55.0,
      "voteDistributionScore": 80.0,
      "participationScore": 60.0,
      "cardCount": 18,
      "totalMembers": 5,
      "activeMembers": 3
    }
  ],
  "trend": {
    "direction": "up",
    "changePercent": 6.15,
    "averageHealthScore": 70.4,
    "bestSprint": { "sprintId": "sprint-015", "score": 72.5 },
    "worstSprint": { "sprintId": "sprint-012", "score": 55.0 }
  },
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sprints` | array | Health data per sprint, most recent first |
| `sprints[].healthScore` | number | Composite health score (0-100) |
| `sprints[].sentimentScore` | number | Sentiment component (0-100) |
| `sprints[].voteDistributionScore` | number | Vote distribution component (0-100) |
| `sprints[].participationScore` | number | Participation component (0-100) |
| `trend.direction` | string | `up`, `down`, or `stable` (comparing last 3 vs previous 3 sprints) |
| `trend.changePercent` | number | Percentage change in health score |
| `trend.averageHealthScore` | number | Average across all sprints |

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Team not found | `{ "error": "NOT_FOUND", "message": "Team not found" }` |

---

### GET /api/v1/teams/:teamId/analytics/participation

Participation metrics per team member across sprints.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `teamId` | UUID | Team ID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sprintId` | UUID | - | Filter to specific sprint |
| `limit` | integer | 20 | Max sprints (1-100) |
| `offset` | integer | 0 | Pagination offset |

**Response 200 OK:**

```json
{
  "teamId": "team-001",
  "teamName": "Platform Team",
  "members": [
    {
      "userId": "user-001",
      "userName": "Alice Chen",
      "totals": {
        "cardsSubmitted": 45,
        "votesCast": 120,
        "actionItemsOwned": 12,
        "actionItemsCompleted": 9,
        "completionRate": 75.0
      },
      "perSprint": [
        {
          "sprintId": "sprint-015",
          "sprintName": "Sprint 15",
          "cardsSubmitted": 6,
          "votesCast": 10,
          "actionItemsOwned": 2,
          "actionItemsCompleted": 1
        },
        {
          "sprintId": "sprint-014",
          "sprintName": "Sprint 14",
          "cardsSubmitted": 4,
          "votesCast": 8,
          "actionItemsOwned": 3,
          "actionItemsCompleted": 2
        }
      ]
    },
    {
      "userId": "user-002",
      "userName": "Bob Martinez",
      "totals": {
        "cardsSubmitted": 38,
        "votesCast": 105,
        "actionItemsOwned": 8,
        "actionItemsCompleted": 7,
        "completionRate": 87.5
      },
      "perSprint": [
        {
          "sprintId": "sprint-015",
          "sprintName": "Sprint 15",
          "cardsSubmitted": 5,
          "votesCast": 10,
          "actionItemsOwned": 1,
          "actionItemsCompleted": 1
        }
      ]
    }
  ],
  "teamAverages": {
    "avgCardsPerMember": 5.2,
    "avgVotesPerMember": 9.5,
    "avgCompletionRate": 78.5
  },
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

| Field | Type | Description |
|-------|------|-------------|
| `members` | array | Participation data per team member |
| `members[].totals` | object | Aggregate totals across all sprints |
| `members[].perSprint` | array | Per-sprint breakdown |
| `members[].totals.completionRate` | number | % of assigned action items completed (0-100) |
| `teamAverages` | object | Team-wide averages for comparison |

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Team not found | `{ "error": "NOT_FOUND", "message": "Team not found" }` |

---

### GET /api/v1/teams/:teamId/analytics/sentiment

Sentiment trends across sprints for the team.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `teamId` | UUID | Team ID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Max sprints (1-100) |
| `offset` | integer | 0 | Pagination offset |

**Response 200 OK:**

```json
{
  "teamId": "team-001",
  "teamName": "Platform Team",
  "sprints": [
    {
      "sprintId": "sprint-015",
      "sprintName": "Sprint 15",
      "averageSentiment": 1.2,
      "normalizedScore": 62.0,
      "positiveCards": 14,
      "negativeCards": 6,
      "neutralCards": 4,
      "totalCards": 24,
      "sentimentByColumn": [
        {
          "columnId": "col-went-well",
          "columnName": "Went Well",
          "averageSentiment": 2.8,
          "cardCount": 10
        },
        {
          "columnId": "col-to-improve",
          "columnName": "To Improve",
          "averageSentiment": -1.5,
          "cardCount": 8
        },
        {
          "columnId": "col-action-items",
          "columnName": "Action Items",
          "averageSentiment": 0.3,
          "cardCount": 6
        }
      ]
    }
  ],
  "overallTrend": {
    "direction": "up",
    "averageSentiment": 0.85,
    "averageNormalizedScore": 58.5
  },
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sprints[].averageSentiment` | number | Raw sentiment score (-5 to +5) |
| `sprints[].normalizedScore` | number | Normalized to 0-100 |
| `sprints[].positiveCards` | number | Cards with sentiment > 0.5 |
| `sprints[].negativeCards` | number | Cards with sentiment < -0.5 |
| `sprints[].neutralCards` | number | Cards with sentiment between -0.5 and 0.5 |
| `sprints[].sentimentByColumn` | array | Breakdown by board column |
| `overallTrend.direction` | string | `up`, `down`, or `stable` |

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Team not found | `{ "error": "NOT_FOUND", "message": "Team not found" }` |

---

### GET /api/v1/teams/:teamId/analytics/word-cloud

Word frequency data for generating word cloud visualizations.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `teamId` | UUID | Team ID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sprintId` | UUID | - | Filter to specific sprint. If omitted, aggregates across recent sprints. |
| `limit` | integer | 100 | Max words to return (1-500) |
| `minFrequency` | integer | 2 | Minimum occurrence count |

**Response 200 OK:**

```json
{
  "teamId": "team-001",
  "sprintId": "sprint-015",
  "sprintName": "Sprint 15",
  "words": [
    { "word": "deployment", "frequency": 12, "sentiment": -0.8 },
    { "word": "collaboration", "frequency": 9, "sentiment": 2.5 },
    { "word": "testing", "frequency": 8, "sentiment": 0.3 },
    { "word": "communication", "frequency": 7, "sentiment": 1.8 },
    { "word": "pipeline", "frequency": 6, "sentiment": -0.2 },
    { "word": "sprint", "frequency": 5, "sentiment": 0.1 },
    { "word": "review", "frequency": 5, "sentiment": 0.8 },
    { "word": "automated", "frequency": 4, "sentiment": 1.2 },
    { "word": "blocked", "frequency": 4, "sentiment": -2.1 },
    { "word": "documentation", "frequency": 3, "sentiment": 0.5 }
  ],
  "totalUniqueWords": 87,
  "totalCards": 24
}
```

| Field | Type | Description |
|-------|------|-------------|
| `words` | array | Words sorted by frequency descending |
| `words[].word` | string | The word |
| `words[].frequency` | number | How many times it appeared |
| `words[].sentiment` | number | Sentiment score for this word from lexicon (-5 to +5) |
| `totalUniqueWords` | number | Total unique words (after filtering) |
| `totalCards` | number | Total cards analyzed |

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Team not found | `{ "error": "NOT_FOUND", "message": "Team not found" }` |

---

### GET /api/v1/sprints/:sprintId/analytics

Comprehensive analytics summary for a single sprint.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sprintId` | UUID | Sprint ID |

**Response 200 OK:**

```json
{
  "sprintId": "sprint-015",
  "sprintName": "Sprint 15",
  "teamId": "team-001",
  "teamName": "Platform Team",
  "dateRange": {
    "startDate": "2026-02-03",
    "endDate": "2026-02-14"
  },
  "health": {
    "healthScore": 72.5,
    "sentimentScore": 65.0,
    "voteDistributionScore": 78.0,
    "participationScore": 80.0,
    "previousSprintHealthScore": 68.3,
    "changeFromPrevious": 4.2
  },
  "cards": {
    "total": 24,
    "byColumn": [
      { "columnId": "col-001", "columnName": "Went Well", "count": 10 },
      { "columnId": "col-002", "columnName": "To Improve", "count": 8 },
      { "columnId": "col-003", "columnName": "Action Items", "count": 6 }
    ],
    "groups": 5,
    "averageVotesPerCard": 3.2
  },
  "sentiment": {
    "averageSentiment": 1.2,
    "normalizedScore": 62.0,
    "positiveCards": 14,
    "negativeCards": 6,
    "neutralCards": 4,
    "topPositiveCards": [
      { "cardId": "card-001", "text": "Great team collaboration", "sentiment": 3.5, "votes": 5 }
    ],
    "topNegativeCards": [
      { "cardId": "card-010", "text": "Deploy process is broken", "sentiment": -2.8, "votes": 7 }
    ]
  },
  "participation": {
    "totalMembers": 5,
    "activeMembers": 4,
    "participationRate": 80.0,
    "members": [
      {
        "userId": "user-001",
        "userName": "Alice Chen",
        "cardsSubmitted": 6,
        "votesCast": 10,
        "actionItemsOwned": 2,
        "actionItemsCompleted": 1
      }
    ]
  },
  "actionItems": {
    "total": 8,
    "open": 3,
    "inProgress": 2,
    "done": 3,
    "carriedOver": 2,
    "completionRate": 37.5
  },
  "wordCloud": [
    { "word": "deployment", "frequency": 12, "sentiment": -0.8 },
    { "word": "collaboration", "frequency": 9, "sentiment": 2.5 },
    { "word": "testing", "frequency": 8, "sentiment": 0.3 }
  ]
}
```

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Unauthorized | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | Not team member | `{ "error": "FORBIDDEN", "message": "Access denied" }` |
| 404 | Sprint not found | `{ "error": "NOT_FOUND", "message": "Sprint not found" }` |
