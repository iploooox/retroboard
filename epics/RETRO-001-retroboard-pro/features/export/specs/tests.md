# Export Feature Test Plan

## Test Framework

- **Unit tests**: Vitest
- **Integration tests**: Vitest + Supertest
- **Database**: Test PostgreSQL database seeded with boards, cards, votes, groups, action items, and analytics data

---

## Unit Tests

### ExportService

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Fetch complete board data | Valid boardId | Returns board with all related data |
| 2 | Board not found | Non-existent boardId | Throws NOT_FOUND |
| 3 | Anonymous cards not revealed | Anonymous board, not revealed | authorId/authorName are null |
| 4 | Anonymous cards revealed | Anonymous board, revealed | authorId/authorName populated |
| 5 | Non-anonymous board | Named board | authorId/authorName always populated |
| 6 | Cards sorted by vote count | Board with voted cards | Cards ordered by voteCount DESC |
| 7 | Groups include card IDs | Board with groups | Groups contain their card references |
| 8 | Action items include source card | AI linked to card | sourceCardText populated |
| 9 | Action items without source card | AI not linked to card | sourceCardText is null |
| 10 | Analytics included when requested | includeAnalytics=true | analytics section populated |
| 11 | Analytics excluded when requested | includeAnalytics=false | analytics section absent |
| 12 | Action items excluded when requested | includeActionItems=false | actionItems section absent |
| 13 | Board with 5000 cards | Large board | Data returned successfully |
| 14 | Board with >5000 cards | Oversized board | Throws PAYLOAD_TOO_LARGE |

### JSONFormatter

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Valid JSON output | Board data | JSON.parse succeeds |
| 2 | Export version included | Any board | exportVersion = "1.0" |
| 3 | Exported timestamp set | Any board | exportedAt is valid ISO 8601 |
| 4 | Board metadata complete | Board with all fields | All metadata fields present |
| 5 | Columns ordered by position | 3 columns | position 0, 1, 2 |
| 6 | Cards nested under columns | Cards in different columns | Each column has its own cards |
| 7 | Empty columns included | Column with no cards | Column present with empty cards array |
| 8 | Group totalVotes calculated | Group with 3 cards | Sum of card vote counts |
| 9 | Null fields serialized as null | No assignee on action item | assigneeName is null, not omitted |
| 10 | Unicode preserved | Card with emoji/CJK chars | Characters intact in output |

### MarkdownFormatter

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Valid Markdown structure | Board data | Starts with # header |
| 2 | Metadata table rendered | Board with metadata | Markdown table with team, sprint, etc. |
| 3 | Summary table rendered | Board with analytics | Health score, card count, etc. in table |
| 4 | Columns as H2 headers | 3 columns | Three ## sections |
| 5 | Cards as H3 headers | Cards in column | ### with text and vote count |
| 6 | Author in blockquote | Named card | > **Author:** name |
| 7 | Anonymous author handled | Anonymous, not revealed | > **Author:** Anonymous |
| 8 | Groups section rendered | Board with groups | Groups listed with cards |
| 9 | Action items as table | 5 action items | Markdown table with 5 rows |
| 10 | Top voted cards listed | Cards with votes | Numbered list, top 5 |
| 11 | Word cloud rendered | Word frequency data | Comma-separated word (freq) list |
| 12 | Footer included | Any board | "Exported from RetroBoard Pro" line |
| 13 | Special characters escaped | Card with | and # | Characters escaped for Markdown |
| 14 | Empty board | Board with no cards | Renders without errors, shows "No cards" |

### HTMLFormatter

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Valid HTML output | Board data | Contains <!DOCTYPE html> |
| 2 | Title set | Board data | <title>Retrospective: {name}</title> |
| 3 | Print CSS included | Any board | @media print styles present |
| 4 | Print banner included | Any board | "Use your browser's Print function" text |
| 5 | Cards styled with border | Cards present | .card class with border-left |
| 6 | Vote counts highlighted | Voted cards | .votes class applied |
| 7 | Action item status colored | Various statuses | .status-open, .status-done classes |
| 8 | Tables have borders | Summary table | border-collapse styles |
| 9 | Page breaks avoided mid-card | Multiple cards | break-inside: avoid on .card |
| 10 | Page margins set for print | @media print | @page margin: 1.5cm |
| 11 | No-print elements hidden | Print mode | .no-print elements display: none |
| 12 | XSS prevention | Card with <script> tag | Script tags escaped |
| 13 | Unicode rendered | Card with special chars | Characters display correctly |

### ReportFormatter

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | JSON report valid | Team data | JSON.parse succeeds |
| 2 | Markdown report valid | Team data | Starts with # header |
| 3 | Sprint count correct | 12 sprints in range | sprintCount = 12 |
| 4 | Health trend ordered | Multiple sprints | Most recent first |
| 5 | Participation per member | 5 members | 5 entries in members array |
| 6 | Action item totals correct | Mixed status items | totalCreated, totalCompleted match |
| 7 | Completion rate calculated | 32/48 items done | completionRate = 66.7 |
| 8 | Top themes sorted | Word frequencies | Highest frequency first |
| 9 | Date range respected | from and to dates | Only sprints within range |
| 10 | Empty date range | No sprints in range | Empty arrays, zero counts |

---

## Integration Tests

### GET /api/v1/boards/:id/export?format=json

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Export board as JSON | GET with format=json | 200, valid JSON |
| 2 | Content-Type header | GET | application/json |
| 3 | Content-Disposition header | GET | attachment with filename |
| 4 | Filename format | GET | retro-{sanitized-name}-{date}.json |
| 5 | All sections present | Seeded board | board, columns, groups, actionItems, analytics |
| 6 | Cards sorted by votes | Cards with different votes | Highest vote count first |
| 7 | Anonymous cards hidden | Anonymous board, not revealed | authorId/authorName null |
| 8 | Anonymous cards shown after reveal | Revealed board | authorId/authorName populated |
| 9 | Board not found | Invalid boardId | 404 |
| 10 | Not team member | Non-member user | 403 |
| 11 | Unauthenticated | No token | 401 |
| 12 | Empty board | Board with no cards | 200, empty arrays |
| 13 | Large board (1000 cards) | Seeded large board | 200, complete data, < 2s response |

### GET /api/v1/boards/:id/export?format=markdown

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Export board as Markdown | GET with format=markdown | 200, valid Markdown |
| 2 | Content-Type header | GET | text/markdown; charset=utf-8 |
| 3 | Content-Disposition header | GET | attachment with .md filename |
| 4 | Markdown renders correctly | Parse output | Valid Markdown structure |
| 5 | Sections present | Seeded board | Summary, columns, groups, action items |
| 6 | Pipe characters in card text | Card with "A | B" | Properly escaped |
| 7 | Board not found | Invalid boardId | 404 |

### GET /api/v1/boards/:id/export?format=html

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Export board as HTML | GET with format=html | 200, valid HTML |
| 2 | Content-Type header | GET | text/html; charset=utf-8 |
| 3 | No Content-Disposition | GET | No attachment header (renders in browser) |
| 4 | Print CSS present | Inspect HTML | @media print block present |
| 5 | Print banner present | Inspect HTML | "Use your browser's Print" message |
| 6 | Script injection prevented | Card with <script> alert("xss") </script> | Script tag escaped in output |
| 7 | Board not found | Invalid boardId | 404 |

### GET /api/v1/boards/:id/export (error cases)

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Missing format parameter | GET without format | 400 |
| 2 | Invalid format value | GET ?format=pdf | 400 |
| 3 | Invalid format value | GET ?format=csv | 400 |
| 4 | Board exceeds size limit | Board with 5001 cards | 413 |

### GET /api/v1/teams/:teamId/report

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | JSON team report | GET ?format=json | 200, valid JSON |
| 2 | Markdown team report | GET ?format=markdown | 200, valid Markdown |
| 3 | Default format is JSON | GET without format | 200, JSON |
| 4 | Default date range | GET without from/to | Last 6 months |
| 5 | Custom date range | GET ?from=2025-01-01&to=2025-06-30 | Only sprints in range |
| 6 | Health trend data | Team with 10 sprints | 10 entries in healthTrend |
| 7 | Participation per member | Team with 5 members | 5 entries |
| 8 | Action item totals | Team with action items | Correct counts |
| 9 | from after to | GET ?from=2026-01-01&to=2025-01-01 | 400 |
| 10 | Invalid date format | GET ?from=not-a-date | 400 |
| 11 | Team not found | Invalid teamId | 404 |
| 12 | Not team member | Non-member | 403 |
| 13 | Team with no sprints | New team | 200, empty arrays |
| 14 | Response < 500ms | 20 sprints, 100 cards | Response within 500ms |

---

## Data Integrity Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | JSON round-trip | Export JSON, parse, compare to DB | Data matches database |
| 2 | Card count matches | Count cards in export vs DB | Exact match |
| 3 | Vote counts match | Sum votes in export vs DB | Exact match |
| 4 | Action item count matches | Count AIs in export vs DB | Exact match |
| 5 | Group membership matches | Cards in groups in export vs DB | Same card IDs |
| 6 | Column order preserved | Export columns vs DB column positions | Same order |
| 7 | Analytics accuracy | Compare export analytics to direct query | Scores match |

---

## End-to-End Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Full export cycle (JSON) | Create board with cards, votes, groups, action items, export as JSON | Complete valid JSON file |
| 2 | Full export cycle (Markdown) | Same board, export as Markdown | Complete valid Markdown |
| 3 | Full export cycle (HTML) | Same board, export as HTML | Complete valid HTML page |
| 4 | Anonymous export flow | Create anonymous board, add cards, export before reveal | Author info hidden |
| 5 | Revealed export flow | Reveal cards, re-export | Author info visible |
| 6 | Team report | Create team with 3 sprints, each with full retro data, generate report | All sprints aggregated |
| 7 | Export after board completion | Complete board, export | Analytics populated from materialized views |

---

## Performance Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Small board export | 10 cards, 20 votes | Response < 200ms |
| 2 | Medium board export | 100 cards, 200 votes | Response < 500ms |
| 3 | Large board export | 1000 cards, 2000 votes | Response < 2s |
| 4 | Team report (10 sprints) | 10 sprints, 50 cards each | Response < 1s |
| 5 | Team report (50 sprints) | 50 sprints, 50 cards each | Response < 3s |
| 6 | Concurrent exports | 5 simultaneous export requests | All complete < 3s |
| 7 | JSON size check | 1000 cards export | JSON < 5MB |
| 8 | HTML size check | 1000 cards export | HTML < 2MB |
| 9 | Markdown size check | 1000 cards export | Markdown < 1MB |

---

## Security Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | XSS in card text (HTML export) | Card with `<script>alert(1)</script>` | Script escaped in HTML output |
| 2 | XSS in card text (JSON export) | Card with script tag | JSON string properly escaped |
| 3 | SQL injection in board ID | GET /boards/'; DROP TABLE--/export | 400 or 404, no SQL execution |
| 4 | Path traversal in filename | Board name with ../../../ | Filename sanitized |
| 5 | Cross-team export | Export board from another team | 403 |
| 6 | Expired token | Export with expired JWT | 401 |
