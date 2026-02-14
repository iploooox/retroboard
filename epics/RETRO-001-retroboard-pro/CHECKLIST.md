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
- [ ] architecture.md created with design decisions

**API / Data Specs:**
- [ ] specs/api.md has all endpoints with request/response shapes
- [ ] specs/database.md has all table schemas
- [ ] UI/API contract validated — all UI fields match API fields

**Test Plan:**
- [ ] specs/tests.md complete with test cases

### Feature: teams

**Architecture:**
- [ ] architecture.md created with design decisions

**API / Data Specs:**
- [ ] specs/api.md has all endpoints with request/response shapes
- [ ] specs/database.md has all table schemas
- [ ] UI/API contract validated

**Test Plan:**
- [ ] specs/tests.md complete with test cases

### Feature: sprints

**Architecture:**
- [ ] architecture.md created with design decisions

**API / Data Specs:**
- [ ] specs/api.md has all endpoints with request/response shapes
- [ ] specs/database.md has all table schemas
- [ ] UI/API contract validated

**Test Plan:**
- [ ] specs/tests.md complete with test cases

### Feature: retro-board

**Architecture:**
- [ ] architecture.md created with design decisions

**UI Specs:**
- [ ] specs/ui/INDEX.md created
- [ ] Page specs written in specs/ui/pages/ for each view
- [ ] specs/ui/flows.md documents navigation between pages
- [ ] specs/ui/state.md documents global state structure

**API / Data Specs:**
- [ ] specs/api.md has all endpoints with request/response shapes
- [ ] specs/database.md has all table schemas
- [ ] UI/API contract validated

**Test Plan:**
- [ ] specs/tests.md complete with test cases

### Feature: templates

**Architecture:**
- [ ] architecture.md created with design decisions

**API / Data Specs:**
- [ ] specs/api.md has all endpoints
- [ ] specs/database.md has all table schemas

**Test Plan:**
- [ ] specs/tests.md complete with test cases

### Feature: facilitation

**Architecture:**
- [ ] architecture.md created with design decisions

**UI Specs:**
- [ ] specs/ui/INDEX.md created
- [ ] Page specs written

**API / Data Specs:**
- [ ] specs/api.md has all endpoints
- [ ] specs/database.md has all table schemas

**Test Plan:**
- [ ] specs/tests.md complete with test cases

### Feature: action-items

**Architecture:**
- [ ] architecture.md created with design decisions

**API / Data Specs:**
- [ ] specs/api.md has all endpoints
- [ ] specs/database.md has all table schemas

**Test Plan:**
- [ ] specs/tests.md complete with test cases

### Feature: analytics

**Architecture:**
- [ ] architecture.md created with design decisions

**UI Specs:**
- [ ] specs/ui/INDEX.md created
- [ ] Page specs written

**API / Data Specs:**
- [ ] specs/api.md has all endpoints
- [ ] specs/database.md has all table schemas

**Test Plan:**
- [ ] specs/tests.md complete with test cases

### Feature: real-time

**Architecture:**
- [ ] architecture.md created with design decisions

**API / Data Specs:**
- [ ] specs/api.md has WebSocket protocol documented

**Test Plan:**
- [ ] specs/tests.md complete with test cases

### Feature: export

**Architecture:**
- [ ] architecture.md created with design decisions

**API / Data Specs:**
- [ ] specs/api.md has all endpoints

**Test Plan:**
- [ ] specs/tests.md complete with test cases

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
