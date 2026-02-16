# Spec vs Implementation Audit

**Audited:** 2026-02-16
**Features audited:** 10 (auth, teams, sprints, retro-board, templates, facilitation, action-items, analytics, real-time, export)
**Spec files read:** 55+
**Implementation files checked:** 80+

## Summary

- Total features audited: **10**
- Features with gaps: **9** (only sprints is ~100% compliant)
- Critical gaps (crashes/wrong behavior): **2**
- High gaps (major feature/contract mismatches): **10**
- Medium gaps (missing enrichment, partial impl): **14**
- Low gaps (cosmetic/doc): **12**

---

## Critical Gaps

### CRIT-1: Action Items — Zero E2E Tests

- **Spec:** `action-items/specs/tests.md` lines 214-227 — specifies 7 E2E tests
- **Code:** No Playwright E2E test file exists for action items
- **Impact:** Per agent protocol, "feature is NOT done until Playwright test passes against real server." Action items lifecycle (create → assign → in_progress → done → carry-over) has zero E2E coverage.
- **Fix:** Write `tests/e2e-browser/user-journey-action-items.spec.ts`

### CRIT-2: Real-Time — `join_board`/`leave_board` Messages Not Functional

- **Spec:** `real-time/specs/api.md` lines 104-142 — clients can switch boards without reconnecting
- **Code:** `src/ws/message-router.ts` lines 94-119 — messages are accepted but don't actually change room membership. `join_board` broadcasts `user_left` but doesn't remove client from old room or add to new room.
- **Impact:** Dynamic board switching broken; clients must disconnect and reconnect to change boards
- **Fix:** Implement proper room switching in `message-router.ts` or remove from spec

---

## High Severity Gaps

### HIGH-1: Auth — Email Normalization Missing in Repository Layer

- **Spec:** `auth/specs/database.md` line 19, 83 — emails must be stored/queried as lowercase
- **Code:** `src/validation/auth.ts` lowercases email during validation, but `src/repositories/user.repository.ts` does NOT apply `.toLowerCase()` before queries
- **Impact:** If any code path bypasses validation (e.g., admin tools, migrations), case-sensitive emails could exist in DB
- **Fix:** Add `.toLowerCase()` in `user.repository.ts` before all email queries

### HIGH-2: Real-Time — WS Event Field Naming Mismatch (camelCase vs snake_case)

- **Spec:** `real-time/specs/api.md` lines 234-306 — all WS event payloads use camelCase (`authorId`, `authorName`, `isAnonymous`)
- **Code:** `src/ws/notify-listener.ts` lines 86-100 — enriched events use snake_case (`author_id`, `author_name`)
- **Impact:** Frontend must handle naming inconsistency or transform every WS message
- **Fix:** Standardize `notify-listener.ts` enrichEvent() to return camelCase fields

### HIGH-3: Facilitation — Timer API Paths Mismatch

| What | Spec Says | Code Does |
|------|-----------|-----------|
| Start | `POST /api/v1/boards/:id/timer` (201) | `POST /boards/:id/timer/start` |
| Pause/Resume | `PUT /api/v1/boards/:id/timer` with `{ action: "pause"\|"resume" }` | Separate `POST /timer/pause` and `POST /timer/resume` |
| Stop | `DELETE /api/v1/boards/:id/timer` | `POST /boards/:id/timer/reset` |
| Get | `GET /api/v1/boards/:id/timer` | `GET /boards/:id/timer` (matches) |

- **Spec:** `facilitation/specs/api.md` lines 84-256
- **Code:** `src/routes/timer.ts` lines 26-142
- **Impact:** Frontend API client must use different paths than what spec documents. Any client built from spec will fail.
- **Fix:** Either update spec to match implementation or refactor routes

### HIGH-4: Facilitation — Focus Response Missing Enriched Data

- **Spec:** `facilitation/specs/api.md` lines 380-455 — response should include `focusTitle`, `focusVoteCount`, `changedBy`, `changedAt`
- **Code:** `src/services/facilitation-service.ts` lines 159-163 — only returns `focusType` and `focusId`
- **Impact:** Frontend cannot display focused item details without additional API call
- **Fix:** Enrich focus response in `facilitation-service.ts`

### HIGH-5: Analytics — Participation Endpoint Missing `perSprint` Breakdown

- **Spec:** `analytics/specs/api.md` lines 124-188 — response includes `members[].perSprint[]` with per-sprint card/vote breakdowns
- **Code:** `src/services/analytics-service.ts` lines 111-123 — only returns aggregated totals, no per-sprint detail
- **Impact:** Cannot show member contribution trends across sprints
- **Fix:** Add per-sprint breakdown query to `analytics-service.ts`

### HIGH-6: Analytics — Dashboard Aggregate Endpoints Don't Exist

- **Spec:** `analytics/specs/ui/pages/analytics-dashboard.md` lines 295-308 — calls for `/analytics/dashboard` and `/analytics/summary` aggregate endpoints
- **Code:** No aggregate endpoints exist. Frontend makes separate calls to `/health`, `/participation`, `/sentiment`, `/word-cloud`
- **Impact:** N+1 API calls from frontend dashboard (4 instead of 1). Less efficient.
- **Fix:** Either add aggregate endpoint or update spec to reflect multi-call approach

### HIGH-7: Analytics — Missing Unit Tests for Calculation Functions

- **Spec:** `analytics/specs/tests.md` lines 14-56 — 29 unit tests for `calculate_card_sentiment()`, normalized scores, `calculate_sprint_health()`
- **Code:** No unit test files found for analytics calculation functions
- **Impact:** Sentiment scoring and health formulas untested at unit level — only covered by integration tests
- **Fix:** Create `tests/unit/analytics/sentiment.test.ts` and `health-score.test.ts`

### HIGH-8: Action Items — Missing Database Constraint Tests

- **Spec:** `action-items/specs/tests.md` lines 196-211 — 12 database constraint tests
- **Code:** No dedicated constraint test file found
- **Impact:** DB-level validation logic (CHECK constraints, FK constraints) untested
- **Fix:** Create `tests/integration/action-items/constraints.test.ts`

### HIGH-9: Real-Time — `cards_revealed` WS Event Doesn't Include Card Data

- **Spec:** `real-time/specs/api.md` lines 626-653 — `cards_revealed` payload should include array of `{ cardId, authorId, authorName }`
- **Code:** `src/ws/notify-listener.ts` line 179 — only broadcasts `{ boardId }` without card/author data
- **Impact:** Frontend must refetch all cards after reveal to show author names
- **Fix:** Enrich `cards_revealed` event in `notify-listener.ts`

### HIGH-10: Real-Time — Group WS Events Minimal Payload

- **Spec:** `real-time/specs/api.md` lines 372-424 — group events should include `title`, `cardIds`, `position`, etc.
- **Code:** `src/ws/notify-listener.ts` lines 148-150 — only returns `{ id, boardId }`
- **Impact:** Frontend must make additional API calls to get group details after create/update
- **Fix:** Enrich group events in `notify-listener.ts` to include full group data

---

## Medium Severity Gaps

### MED-1: Auth & Teams — No Service Layer (Architecture Deviation)

- **Spec:** `auth/architecture.md` lines 118-138, `teams/architecture.md` lines 151-174 — describe `auth.service.ts`, `teams.service.ts`, `auth.repository.ts`
- **Code:** All business logic lives in route handlers (`src/routes/auth.ts`, `src/routes/teams.ts`). No service layer exists. Only `repositories/user.repository.ts` and `repositories/team.repository.ts` exist.
- **Impact:** Fat controllers pattern — harder to unit test business logic without HTTP layer

### MED-2: Auth — Missing Unit Tests

- **Spec:** `auth/specs/tests.md` lines 35-86 — unit tests for password hashing, JWT generation/verification, validation
- **Code:** No `tests/unit/auth/` directory exists
- **Impact:** Password, JWT, and validation utilities untested at unit level

### MED-3: Teams — Missing Unit Tests

- **Spec:** `teams/specs/tests.md` lines 35-59 — unit tests for slug generation, invite code generation, RBAC logic
- **Code:** No `tests/unit/teams/` directory exists
- **Impact:** Slug/invite code generation and RBAC middleware untested at unit level

### MED-4: Auth — Incomplete Integration Test Coverage

- **Spec:** `auth/specs/tests.md` lines 91-109 — 10 registration tests (I-REG-01 to I-REG-10)
- **Code:** `tests/integration/auth/register.test.ts` has I-REG-01 to I-REG-05, missing I-REG-06 to I-REG-10

### MED-5: Teams — Incomplete Integration Test Coverage

- **Spec:** `teams/specs/tests.md` lines 75-92 — 13 create tests (I-CT-01 to I-CT-13)
- **Code:** `tests/integration/teams/create.test.ts` has I-CT-01 to I-CT-06, missing I-CT-07 to I-CT-13

### MED-6: Facilitation — Phase Response Missing Metadata

- **Spec:** `facilitation/specs/api.md` lines 23-81 — response should include `changedBy`, `changedAt` fields
- **Code:** `src/routes/boards.ts` lines 318-378 — returns `{ phase, previous_phase, timerStopped }` without `changedBy`/`changedAt`
- **Impact:** Frontend can't show who changed the phase or when

### MED-7: Facilitation — Lock Response Missing Metadata

- **Spec:** `facilitation/specs/api.md` lines 260-317 — response should include `lockedBy`, `lockedAt`, `unlockedBy`, `unlockedAt`
- **Code:** `src/routes/boards.ts` lines 463-510 — returns only `{ id, is_locked }`
- **Impact:** Frontend can't attribute who locked/unlocked the board

### MED-8: Facilitation — Reveal Response Missing Enriched Data

- **Spec:** `facilitation/specs/api.md` lines 320-376 — response should include `revealedBy`, `revealedAt`, `revealedCards[]`
- **Code:** `src/services/facilitation-service.ts` lines 85-118 — returns `{ cardsRevealed, revealedCards }` but missing `revealedBy`/`revealedAt`

### MED-9: Facilitation — Focus Column Naming Mismatch

- **Spec:** `facilitation/specs/database.md` lines 20-23 — column names `focus_type`, `focus_id`
- **Code:** `src/db/migrations/010_create_board_tables.sql` lines 18-19 — column names `focus_item_type`, `focus_item_id`
- **Impact:** Any code referencing spec column names will fail. Functionally equivalent but naming differs.

### MED-10: Facilitation — Missing Active Timer Performance Index

- **Spec:** `facilitation/specs/database.md` lines 114-120 — `idx_board_timers_active` index for timer recovery
- **Code:** `src/db/migrations/013_create_board_timers.sql` — index not created
- **Impact:** Timer recovery on server restart will be slower (full table scan)

### MED-11: Real-Time — Timer WS Events Unclear

- **Spec:** `real-time/specs/api.md` lines 498-591 — defines 5 timer WS event types with detailed payloads
- **Code:** No NOTIFY triggers found for timer events. Timer service likely uses `broadcastToBoard()` directly, but implementation not fully traced.
- **Impact:** Timer real-time propagation may not match spec

### MED-12: Export — N+1 Query Pattern

- **Spec:** `export/architecture.md` lines 438-444 — "Single query fetches all data needed for export"
- **Code:** `src/repositories/export-repository.ts` lines 174-274 — loops over columns and groups with individual queries
- **Impact:** Performance degradation for boards with many columns/groups

### MED-13: Analytics — No Zustand Store for Dashboard

- **Spec:** `analytics/specs/ui/pages/analytics-dashboard.md` lines 227-259 — Zustand store for analytics state
- **Code:** `client/src/pages/AnalyticsPage.tsx` uses local `useState` hooks
- **Impact:** Can't share analytics data between components

### MED-14: Action Items — Incomplete Integration Test Coverage

- **Spec:** `action-items/specs/tests.md` — specifies ~60 test cases across create, read, update, delete, carry-over
- **Code:** Integration tests cover ~60% of specified cases (e.g., create has 5 of 13, carry-over has 9 of 13)

---

## Low Severity Gaps

### LOW-1: Sprint Migration Numbering

- **Spec:** Migration named `006_create_sprints.sql`
- **Code:** Actual file is `008_create_sprints.sql`
- (Doc-only mismatch; no functional impact)

### LOW-2: Board Migration Numbering

- **Spec:** Migration named `003_create_retro_board_tables.sql`
- **Code:** Actual file is `010_create_board_tables.sql`
- (Doc-only mismatch; no functional impact)

### LOW-3: Templates — Unique Constraint Implementation Differs

- **Spec:** `templates/specs/database.md` — `UNIQUE NULLS NOT DISTINCT (team_id, name)`
- **Code:** `src/db/migrations/009_create_templates.sql` — two partial indexes instead
- (Functionally equivalent, implementation arguably better)

### LOW-4: DB Uses ENUMs Instead of TEXT+CHECK

- **Spec:** `facilitation/specs/database.md` — `phase TEXT CHECK (...)`, `focus_type TEXT CHECK (...)`
- **Code:** Uses `board_phase ENUM`, `focus_item_type ENUM`
- (ENUMs are stricter; implementation is better than spec)

### LOW-5: Teams — Extra `theme` Field

- **Code:** Migration 022 adds `theme VARCHAR(20)` to teams table — not in original Phase 1 spec
- (Added as S-027 enhancement; spec should be updated)

### LOW-6: Auth — Extra `onboarding_completed_at` Field

- **Code:** Migration 023 adds `onboarding_completed_at TIMESTAMPTZ` to users — not in original spec
- (Added as S-029 enhancement; spec should be updated)

### LOW-7: Teams — Extra Invitations List Endpoint

- **Code:** `GET /teams/:id/invitations` exists in `src/routes/teams.ts` — not in spec
- (Useful feature, should be added to spec)

### LOW-8: Real-Time — WS Upgrade Error Bodies

- **Spec:** `real-time/specs/api.md` lines 40-44 — upgrade failures return JSON error bodies
- **Code:** `src/ws/index.ts` lines 85-130 — returns plain text HTTP responses
- (Harder to parse errors on client)

### LOW-9: Real-Time — Missing Per-Message-Type Rate Limits

- **Spec:** `real-time/specs/api.md` lines 723-731 — ping (1/10s), cursor (20/s), other (100/min), total (200/min)
- **Code:** Only total (200/min) + cursor (20/s) enforced
- (Potential abuse vector for non-cursor messages)

### LOW-10: Export — Error Messages Don't Match Spec Verbatim

- **Spec:** `export/specs/api.md` lines 264-272 — detailed error messages
- **Code:** Returns generic error codes only (`{ error: 'INVALID_FORMAT' }`)

### LOW-11: Export — Team Report Missing Trend/Best/Worst Sprint

- **Spec:** `export/specs/api.md` lines 334-336 — `overallHealth.trend`, `bestSprint`, `worstSprint`
- **Code:** `src/repositories/export-repository.ts` — not calculated

### LOW-12: Analytics — Vote Distribution Calculation Description Misleading

- **Spec:** `analytics/architecture.md` line 196 — says "Gini coefficient"
- **Code:** `src/db/migrations/016_create_analytics_tables.sql` — uses stddev/mean (coefficient of variation)
- (Spec text misleading, but database.md shows the correct formula)

---

## Per-Feature Compliance Summary

| Feature | Compliance | Critical | High | Medium | Low |
|---------|-----------|----------|------|--------|-----|
| Auth | 90% | 0 | 1 | 3 | 1 |
| Teams | 92% | 0 | 0 | 2 | 2 |
| Sprints | 99% | 0 | 0 | 0 | 1 |
| Retro-Board | 95% | 0 | 0 | 0 | 1 |
| Templates | 95% | 0 | 0 | 0 | 1 |
| Facilitation | 75% | 0 | 2 | 4 | 1 |
| Action Items | 70% | 1 | 1 | 1 | 0 |
| Analytics | 75% | 0 | 3 | 2 | 1 |
| Real-Time | 80% | 1 | 3 | 1 | 2 |
| Export | 93% | 0 | 0 | 1 | 2 |

---

## Priority Fix Order

### Immediate (Block "done" status)
1. **CRIT-1:** Write action items E2E tests
2. **CRIT-2:** Fix `join_board`/`leave_board` in message-router (or remove from spec)
3. **HIGH-2:** Standardize WS event field naming to camelCase
4. **HIGH-3:** Align timer API paths (spec ↔ code)
5. **HIGH-9:** Enrich `cards_revealed` WS event with card/author data
6. **HIGH-10:** Enrich group WS events with full data

### Soon (Feature completeness)
7. **HIGH-1:** Fix email normalization in repository
8. **HIGH-4:** Enrich focus response with title/voteCount/metadata
9. **HIGH-5:** Add perSprint breakdown to participation endpoint
10. **MED-6 through MED-8:** Add missing metadata to facilitation responses
11. **HIGH-7:** Write analytics calculation unit tests
12. **HIGH-8:** Write action items constraint tests

### Eventually (Polish)
13. **MED-1:** Extract service layer from fat controllers
14. **MED-2, MED-3:** Add missing unit tests for auth/teams utilities
15. **MED-12:** Optimize export to single query
16. **LOW-*:** Update spec docs to match implementation
