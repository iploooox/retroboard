# RETRO-001: Lifecycle Checklist

> Skip protocol: Items are done `[x]` or skipped `[x] ~~Item~~ — SKIPPED: {reason} (approved by: {name})`. Never leave unchecked.

## Planning

- [x] EPIC.md created with phases and success criteria
- [x] REQUIREMENTS.md complete (FR + NFR)
- [x] features/INDEX.md lists all features
- [x] decisions/INDEX.md created

## Specifications (per feature)

### Feature: auth

**Architecture:**
- [x] architecture.md created with design decisions

**API / Data Specs:**
- [x] specs/api.md has all endpoints with request/response shapes
- [x] specs/database.md has all table schemas
- [x] UI/API contract validated — login/register fields match auth API responses

**Test Plan:**
- [x] specs/tests.md complete with test cases

### Feature: teams

**Architecture:**
- [x] architecture.md created with design decisions

**API / Data Specs:**
- [x] specs/api.md has all endpoints with request/response shapes
- [x] specs/database.md has all table schemas
- [x] UI/API contract validated — member list nested structure noted, Phase 2+ fields deferred

**Test Plan:**
- [x] specs/tests.md complete with test cases

### Feature: sprints

**Architecture:**
- [x] architecture.md created with design decisions

**API / Data Specs:**
- [x] specs/api.md has all endpoints with request/response shapes
- [x] specs/database.md has all table schemas
- [x] UI/API contract validated — sprint_number now in API, board fields deferred to Phase 2

**Test Plan:**
- [x] specs/tests.md complete with test cases

### Feature: retro-board

**Architecture:**
- [x] architecture.md created with design decisions

**UI Specs:**
- [x] specs/ui/INDEX.md created
- [x] Page specs written in specs/ui/pages/ for each view
- [x] specs/ui/flows.md documents navigation between pages
- [x] specs/ui/state.md documents global state structure

**API / Data Specs:**
- [x] specs/api.md has all endpoints with request/response shapes
- [x] specs/database.md has all table schemas
- [x] UI/API contract validated — board/activity/action-item fields deferred to Phase 2+

**Test Plan:**
- [x] specs/tests.md complete with test cases

### Feature: templates

**Architecture:**
- [x] architecture.md created with design decisions

**API / Data Specs:**
- [x] specs/api.md has all endpoints
- [x] specs/database.md has all table schemas

**Test Plan:**
- [x] specs/tests.md complete with test cases

### Feature: facilitation

**Architecture:**
- [x] architecture.md created with design decisions

**UI Specs:**
- [x] specs/ui/INDEX.md created
- [x] Page specs written

**API / Data Specs:**
- [x] specs/api.md has all endpoints
- [x] specs/database.md has all table schemas

**Test Plan:**
- [x] specs/tests.md complete with test cases

### Feature: action-items

**Architecture:**
- [x] architecture.md created with design decisions

**API / Data Specs:**
- [x] specs/api.md has all endpoints
- [x] specs/database.md has all table schemas

**Test Plan:**
- [x] specs/tests.md complete with test cases

### Feature: analytics

**Architecture:**
- [x] architecture.md created with design decisions

**UI Specs:**
- [x] specs/ui/INDEX.md created
- [x] Page specs written

**API / Data Specs:**
- [x] specs/api.md has all endpoints
- [x] specs/database.md has all table schemas

**Test Plan:**
- [x] specs/tests.md complete with test cases

### Feature: real-time

**Architecture:**
- [x] architecture.md created with design decisions

**API / Data Specs:**
- [x] specs/api.md has WebSocket protocol documented

**Test Plan:**
- [x] specs/tests.md complete with test cases

### Feature: export

**Architecture:**
- [x] architecture.md created with design decisions

**API / Data Specs:**
- [x] specs/api.md has all endpoints

**Test Plan:**
- [x] specs/tests.md complete with test cases

## Spec Review Gate

- [x] PO reviewed specs from user perspective — 20 findings (reviews/po-review.md)
- [x] QA reviewed test plans for gaps and edge cases — 45 missing tests found (reviews/qa-review.md)
- [x] Security reviewed specs for vulnerabilities — 18 findings (reviews/security-review.md)
- [x] All review findings addressed — 4 remediation commits (f83fc94, cc16465, 44f010a, fac24ef)

## Pre-Implementation Validation

- [x] All spec files consistent with each other — reconciled after review gate
- [x] Phase plans created with task breakdowns — phase1.md reconciled with DB specs
- [x] No unresolved UI/API mismatches — Phase 1 fields validated, Phase 2+ deferred
- [x] Architecture decisions recorded as ADRs — ADR-001..003 + security additions in architecture.md

## Phase Completion

### Phase 1: Foundation

- [x] Tests written and failing (RED) — TDD cycle per feature agent
- [x] Implementation passes all tests (GREEN) — 352 backend + 29 frontend = 381 tests
- [x] Code refactored, tests still green
- [x] E2E happy path test passes — 15-step E2E test (70685ca)
- [x] Code review findings addressed — 6 fixes (48c9301): transaction, HSTS, bodyLimit, template IDOR, refresh rate limit
- [x] ~~PR created (< 2000 lines)~~ — SKIPPED: Implemented directly on main per project workflow (approved by: developer)
- [x] ~~PR merged~~ — SKIPPED: Commits on main directly (approved by: developer)
- [x] Phase plan updated with commit links
- [x] EPIC.md story/phase status updated

### Phase 2: Core Board

- [x] Tests written and failing (RED) — 3 TDD writers in parallel: board (54), cards/voting/grouping (69), action items (73) = 196 tests
- [x] Implementation passes all tests (GREEN) — 555 backend + 59 frontend = 614 tests
- [x] Code refactored, tests still green
- [x] E2E happy path test passes — 23-step retro ceremony flow (board → cards → group → vote → discuss → action items)
- [x] ~~PR created (< 2000 lines)~~ — SKIPPED: Implemented directly on main per project workflow (approved by: developer)
- [x] ~~PR merged~~ — SKIPPED: Commits on main directly (approved by: developer)

### Phase 3: Collaboration

- [x] Tests written and failing (RED)
- [x] Implementation passes all tests (GREEN)
- [x] Code refactored, tests still green
- [x] E2E happy path test passes
- [x] ~~PR created (< 2000 lines)~~ — SKIPPED: Implemented directly on main per project workflow (approved by: developer)
- [x] ~~PR merged~~ — SKIPPED: Commits on main directly (approved by: developer)

### Phase 4: Intelligence

- [x] Tests written and failing (RED) — 118 analytics tests + 36 carry-over tests
- [x] Implementation passes all tests (GREEN) — 901 total tests passing
- [x] Code refactored, tests still green
- [x] E2E happy path test passes — phase4-analytics-pipeline.test.ts (557 lines)
- [x] ~~PR created (< 2000 lines)~~ — SKIPPED: Implemented directly on main per project workflow (approved by: developer)
- [x] ~~PR merged~~ — SKIPPED: Commits on main directly (approved by: developer)

### Phase 5: Polish

- [x] Tests written and failing (RED) — 129 tests: export (21), templates (26), reactions (14), icebreakers (12), themes (16), onboarding (40)
- [x] Implementation passes all tests (GREEN) — 1100 total tests passing (107 test files)
- [x] Code refactored, tests still green
- [x] E2E happy path test passes — phase5-polish-features.test.ts (20-step flow)
- [x] ~~PR created (< 2000 lines)~~ — SKIPPED: Implemented directly on main per project workflow (approved by: developer)
- [x] ~~PR merged~~ — SKIPPED: Commits on main directly (approved by: developer)

## Closure

- [ ] All phases complete
- [ ] All success criteria met
- [ ] Feature documentation created in services/
- [ ] ADRs synced to service decisions/
- [ ] EPIC.md status → complete
- [ ] epics/INDEX.md updated
