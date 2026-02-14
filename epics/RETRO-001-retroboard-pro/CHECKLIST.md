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
- [ ] UI/API contract validated — all UI fields match API fields

**Test Plan:**
- [x] specs/tests.md complete with test cases

### Feature: teams

**Architecture:**
- [x] architecture.md created with design decisions

**API / Data Specs:**
- [x] specs/api.md has all endpoints with request/response shapes
- [x] specs/database.md has all table schemas
- [ ] UI/API contract validated

**Test Plan:**
- [x] specs/tests.md complete with test cases

### Feature: sprints

**Architecture:**
- [x] architecture.md created with design decisions

**API / Data Specs:**
- [x] specs/api.md has all endpoints with request/response shapes
- [x] specs/database.md has all table schemas
- [ ] UI/API contract validated

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
- [ ] UI/API contract validated

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

- [ ] PO reviewed specs from user perspective
- [ ] QA reviewed test plans for gaps and edge cases
- [ ] Security reviewed specs for vulnerabilities
- [ ] All review findings addressed

## Pre-Implementation Validation

- [ ] All spec files consistent with each other
- [ ] Phase plans created with task breakdowns
- [ ] No unresolved UI/API mismatches
- [ ] Architecture decisions recorded as ADRs

## Phase Completion

### Phase 1: Foundation

- [ ] Tests written and failing (RED)
- [ ] Implementation passes all tests (GREEN)
- [ ] Code refactored, tests still green
- [ ] E2E happy path test passes
- [ ] PR created (< 2000 lines)
- [ ] PR merged
- [ ] Phase plan updated with PR links
- [ ] EPIC.md story/phase status updated

### Phase 2: Core Board

- [ ] Tests written and failing (RED)
- [ ] Implementation passes all tests (GREEN)
- [ ] Code refactored, tests still green
- [ ] E2E happy path test passes
- [ ] PR created (< 2000 lines)
- [ ] PR merged

### Phase 3: Collaboration

- [ ] Tests written and failing (RED)
- [ ] Implementation passes all tests (GREEN)
- [ ] Code refactored, tests still green
- [ ] E2E happy path test passes
- [ ] PR created (< 2000 lines)
- [ ] PR merged

### Phase 4: Intelligence

- [ ] Tests written and failing (RED)
- [ ] Implementation passes all tests (GREEN)
- [ ] Code refactored, tests still green
- [ ] E2E happy path test passes
- [ ] PR created (< 2000 lines)
- [ ] PR merged

### Phase 5: Polish

- [ ] Tests written and failing (RED)
- [ ] Implementation passes all tests (GREEN)
- [ ] Code refactored, tests still green
- [ ] E2E happy path test passes
- [ ] PR created (< 2000 lines)
- [ ] PR merged

## Closure

- [ ] All phases complete
- [ ] All success criteria met
- [ ] Feature documentation created in services/
- [ ] ADRs synced to service decisions/
- [ ] EPIC.md status → complete
- [ ] epics/INDEX.md updated
