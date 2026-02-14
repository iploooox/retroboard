# RETRO-001: Requirements

## Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-01 | Users can register and log in with email/password | Must | Registration creates account, login returns JWT |
| FR-02 | Users can create teams and invite members | Must | Team created, invitation link generated, member joins |
| FR-03 | Teams have roles: admin, facilitator, member | Must | Permissions enforced per role on all endpoints |
| FR-04 | Teams can create sprints with name and date range | Must | Sprint associated with team, dates stored |
| FR-05 | Each sprint can have a retro board | Must | Board created with columns per template |
| FR-06 | Users can add cards to board columns | Must | Card persisted, visible to team members |
| FR-07 | Cards support anonymous mode | Must | Author hidden when anonymous mode enabled |
| FR-08 | Users can vote on cards with configurable limits | Must | Vote count tracked, limit enforced per user |
| FR-09 | Cards can be grouped into clusters | Should | Drag cards into groups, groups have titles |
| FR-10 | Board updates in real-time via WebSocket | Must | All connected clients see changes < 100ms |
| FR-11 | Facilitator can control board phases | Must | Phases: write → group → vote → discuss → action |
| FR-12 | Built-in countdown timer per phase | Should | Timer visible to all, audible alert at zero |
| FR-13 | Multiple retro templates available | Must | At least 6 templates with different column configurations |
| FR-14 | Action items with assignee and due date | Must | Action items created from cards, tracked per sprint |
| FR-15 | Unresolved action items carry over to next sprint | Must | Pending items auto-appear in next retro |
| FR-16 | Sprint analytics with health trends | Should | Charts showing team metrics across sprints |
| FR-17 | Participation metrics per member | Should | Cards submitted, votes cast, actions owned |
| FR-18 | Sentiment analysis on card text | Should | Positive/negative/neutral scoring using PG text functions |
| FR-19 | Export retro to PDF, Markdown, JSON | Should | Complete retro data exported in chosen format |
| FR-20 | Live presence indicators (who's online) | Should | Avatars/indicators for connected users |
| FR-21 | Emoji reactions on cards | Nice | React with emoji beyond simple voting |
| FR-22 | Board color themes per team | Nice | Teams can pick a theme/color scheme |
| FR-23 | Icebreaker question generator | Nice | Random icebreaker shown at retro start |
| FR-24 | Keyboard shortcuts for power users | Nice | Common actions accessible via keyboard |
| FR-25 | Onboarding flow for first-time teams | Nice | Guided setup for new teams |

## Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|------------|--------|
| NFR-01 | Performance | API response time for board operations | < 200ms p95 |
| NFR-02 | Performance | WebSocket message delivery | < 100ms |
| NFR-03 | Performance | Support concurrent users per board | 50+ |
| NFR-04 | Performance | Sprint history query performance | < 500ms for 100+ sprints |
| NFR-05 | Security | Passwords hashed with bcrypt | Cost factor 12 |
| NFR-06 | Security | JWT tokens with expiry and refresh | Access: 15min, Refresh: 7d |
| NFR-07 | Security | All endpoints auth-protected except login/register | 100% coverage |
| NFR-08 | Security | Team data isolated — no cross-team access | Row-level enforcement |
| NFR-09 | Reliability | Database migrations idempotent | Rerunnable safely |
| NFR-10 | Reliability | Graceful WebSocket reconnection | Auto-reconnect with state sync |
| NFR-11 | Scalability | PostgreSQL-only architecture | No Redis, no external cache |
| NFR-12 | UX | Mobile-responsive board layout | Usable on tablet+ |
| NFR-13 | UX | Accessible to screen readers | WCAG 2.1 AA basics |
| NFR-14 | Deployment | Single process, single `npm start` | No Docker compose, no multi-service |

## Constraints

- **PostgreSQL only** — all persistence, caching, pub/sub, and search via PostgreSQL. No Redis, Memcached, Elasticsearch, or other stores.
- **Single TypeScript server** — one `server.ts` entry point serving API, WebSocket, and static frontend assets. No separate frontend dev server in production.
- **No microservices** — monolithic architecture. All features in one codebase, one deployment unit.
- **No external AI APIs** — sentiment analysis must use PostgreSQL text functions and in-process logic, not OpenAI/Claude/etc.

## Dependencies

| Dependency | Type | Status | Impact if Delayed |
|-----------|------|--------|-------------------|
| PostgreSQL 15+ | Infrastructure | Available | Blocks everything |
| Node.js 20+ | Runtime | Available | Blocks everything |

## Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Use LISTEN/NOTIFY for real-time or poll? | Architect | Open |
| 2 | Bundle frontend with esbuild or Vite? | Architect | Open |
| 3 | Use pg driver directly or Drizzle ORM? | Architect | Open |
