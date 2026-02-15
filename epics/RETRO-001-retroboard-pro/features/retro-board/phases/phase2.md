---
phase: 2
name: "Core Board"
status: done
stories: ["S-007", "S-008", "S-009", "S-010", "S-011", "S-022"]
estimated_duration: "3-4 weeks"
changed: 2026-02-15 — Phase 2 complete
---

# Phase 2: Core Board -- Board CRUD, Cards, Voting, Grouping, Action Items

## Overview

Phase 2 builds the core retro board experience. Users can create boards from templates, add and manage cards, vote on cards, group related cards, and create action items. This phase delivers the primary value of the application -- the ability to run a retrospective. Real-time features are deferred to Phase 3; this phase focuses on API correctness and UI components with standard HTTP request/response patterns.

## Stories Included

| Story | Title | Priority |
|-------|-------|----------|
| S-007 | Create Retro Board with Template Selection | Critical |
| S-008 | Add, Edit, Delete Cards in Columns | Critical |
| S-009 | Anonymous and Named Card Modes | High |
| S-010 | Vote on Cards with Configurable Limits | Critical |
| S-011 | Group Related Cards into Clusters | High |
| S-022 | Action Items with Assignee & Due Date | High |

## Dependencies

- Phase 1 completed (auth, teams, sprints, templates)
- S-007 depends on S-006 (sprints) and S-012 (templates)
- S-008, S-009, S-010, S-011 depend on S-007 (boards)
- S-022 depends on S-007 and S-008

## Tasks

### 1. Database Migrations for Board Entities

- [ ] **BE**: Create `boards` table migration (id UUID PK, sprint_id FK, team_id FK, name, template_id FK, status ENUM ['draft','active','completed','archived'], current_phase ENUM nullable, settings JSONB, created_by FK, created_at, updated_at)
- [ ] **BE**: Create `board_columns` table migration (id UUID PK, board_id FK, name, description, color, sort_order, created_at)
- [ ] **BE**: Create `cards` table migration (id UUID PK, board_id FK, column_id FK, group_id FK nullable, author_id FK, content TEXT, is_anonymous BOOLEAN, sentiment_score FLOAT nullable, sentiment_label VARCHAR nullable, sort_order, created_at, updated_at)
- [ ] **BE**: Create `votes` table migration (id UUID PK, card_id FK, user_id FK, created_at) with composite index on (card_id, user_id)
- [ ] **BE**: Create `card_groups` table migration (id UUID PK, board_id FK, column_id FK, name, sort_order, created_by FK, created_at, updated_at)
- [ ] **BE**: Create `action_items` table migration (id UUID PK, board_id FK, sprint_id FK, team_id FK, card_id FK nullable, group_id FK nullable, title, description TEXT nullable, assignee_id FK nullable, due_date DATE nullable, status ENUM ['open','in_progress','completed','carried_over'], original_action_item_id FK nullable, carry_over_count INT DEFAULT 0, completed_at TIMESTAMP nullable, created_by FK, created_at, updated_at)
- [ ] **BE**: Create indexes on board_id, column_id, author_id, sprint_id for cards, votes, groups
- [ ] **BE**: Run and verify all migrations in test database

### 2. Board API Endpoints (S-007)

- [ ] **BE**: Implement board repository (create, findById, findBySprintId, findByTeamId, update, updateStatus)
- [ ] **BE**: Implement board column repository (createBatch, findByBoardId)
- [ ] **BE**: Implement board creation service (validate template, copy template columns to board_columns, set default settings)
- [ ] **BE**: Define default board settings: `{ anonymous_mode: false, max_votes_per_user: 5, max_votes_per_card_per_user: 1, timer_duration_seconds: 300, is_locked: false, cards_revealed: true }`
- [ ] **BE**: Create `POST /api/v1/teams/:teamId/sprints/:sprintId/boards` -- create board with template selection (facilitator+)
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/sprints/:sprintId/boards` -- list boards for sprint
- [ ] **BE**: Create `GET /api/v1/boards/:boardId` -- full board with columns, cards, votes, groups, action items
- [ ] **BE**: Create `PATCH /api/v1/boards/:boardId` -- update board name and settings (facilitator+)
- [ ] **BE**: Create `PATCH /api/v1/boards/:boardId/status` -- transition board status (facilitator+)
- [ ] **BE**: Add board authorization middleware (verify team membership, check board belongs to team)
- [ ] **BE**: Write unit tests for board service and template application
- [ ] **BE**: Write integration tests for board endpoints
- [ ] **FE**: Build board creation dialog with sprint context and template selection grid
- [ ] **FE**: Build board settings panel (anonymous mode toggle, vote limit slider, timer duration input)
- [ ] **FE**: Build board list view within sprint detail page
- [ ] **FE**: Build main board layout component (horizontal columns with headers)
- [ ] **FE**: Build board header with name, status badge, settings button, participant count
- [ ] **FE**: Implement board API client functions
- [ ] **FE**: Add board status indicator and transition controls for facilitator

### 3. Card CRUD (S-008)

- [ ] **BE**: Implement card repository (create, findById, findByBoardId, findByColumnId, update, delete, updateOrder, moveToColumn)
- [ ] **BE**: Implement sort order management (fractional indexing or gap-based for insert-between)
- [ ] **BE**: Create `POST /api/v1/boards/:boardId/columns/:columnId/cards` -- add card to column
- [ ] **BE**: Create `GET /api/v1/boards/:boardId/cards` -- all cards grouped by column with vote counts
- [ ] **BE**: Create `PATCH /api/v1/cards/:cardId` -- edit card content (author only)
- [ ] **BE**: Create `DELETE /api/v1/cards/:cardId` -- delete card (author or facilitator)
- [ ] **BE**: Create `PATCH /api/v1/cards/:cardId/move` -- move card to different column/position
- [ ] **BE**: Add authorization: validate board is active, user is team member, author check for edit
- [ ] **BE**: Add validation: content not empty, max 500 characters, board not locked
- [ ] **BE**: Write unit tests for card service and authorization
- [ ] **BE**: Write integration tests for card endpoints
- [ ] **FE**: Build card component (content, author info, vote count, action buttons)
- [ ] **FE**: Build "Add Card" input area at bottom of each column (textarea + submit button)
- [ ] **FE**: Implement inline card editing (click to toggle edit mode, auto-focus textarea)
- [ ] **FE**: Implement card deletion with confirmation dialog
- [ ] **FE**: Integrate drag-and-drop library (dnd-kit) for card reordering within and across columns
- [ ] **FE**: Implement optimistic updates for card operations with rollback on error
- [ ] **FE**: Add character counter (0/500) to card textarea
- [ ] **FE**: Implement card API client functions

### 4. Anonymous Mode (S-009)

- [ ] **BE**: Implement card serializer with conditional author stripping based on board anonymous_mode
- [ ] **BE**: Update card list endpoint to apply anonymous serialization
- [ ] **BE**: Include author info only for the requesting user's own cards when anonymous mode is ON
- [ ] **BE**: Allow facilitator to toggle anonymous_mode via board settings update
- [ ] **BE**: Write unit tests for anonymous serialization (own card vs other's card)
- [ ] **BE**: Write integration tests for anonymous mode behavior
- [ ] **FE**: Update card component to conditionally show "Anonymous" vs author name/avatar
- [ ] **FE**: Add "You" badge on own cards when anonymous mode is ON
- [ ] **FE**: Add anonymous mode toggle to board settings (facilitator only)
- [ ] **FE**: Display anonymous mode indicator in board header (eye icon or similar)
- [ ] **FE**: Add tooltip explaining anonymous mode

### 5. Voting Logic (S-010)

- [ ] **BE**: Implement vote repository (create, delete, countByCard, countByUserOnBoard, findByUserAndCard)
- [ ] **BE**: Implement vote limit validation (check max_votes_per_user and max_votes_per_card_per_user from board settings)
- [ ] **BE**: Create `POST /api/v1/cards/:cardId/votes` -- add vote (enforce limits)
- [ ] **BE**: Create `DELETE /api/v1/cards/:cardId/votes` -- remove user's vote from card
- [ ] **BE**: Create `GET /api/v1/boards/:boardId/votes/summary` -- vote counts per card + user's remaining votes
- [ ] **BE**: Add vote limit settings to board JSONB settings schema
- [ ] **BE**: Write unit tests for vote limit enforcement (boundary cases)
- [ ] **BE**: Write integration tests for vote endpoints
- [ ] **FE**: Add vote button to card component (thumbs-up icon with count)
- [ ] **FE**: Implement vote toggle (filled icon when voted, outline when not)
- [ ] **FE**: Display remaining votes counter in board header or sidebar
- [ ] **FE**: Add vote limit configuration inputs to board settings
- [ ] **FE**: Implement sort-by-votes toggle per column
- [ ] **FE**: Disable vote button and show tooltip when user has reached limit
- [ ] **FE**: Add vote animation (count bounce or icon pulse)

### 6. Card Grouping (S-011)

- [ ] **BE**: Implement card group repository (create, findById, findByColumnId, findByBoardId, update, delete)
- [ ] **BE**: Implement card-to-group assignment (update card.group_id)
- [ ] **BE**: Create `POST /api/v1/boards/:boardId/columns/:columnId/groups` -- create group (facilitator+)
- [ ] **BE**: Create `PATCH /api/v1/groups/:groupId` -- update group name
- [ ] **BE**: Create `DELETE /api/v1/groups/:groupId` -- dissolve group (unset group_id on all member cards)
- [ ] **BE**: Create `PATCH /api/v1/cards/:cardId/group` -- assign/unassign card to group
- [ ] **BE**: Update board card retrieval to include group structure and aggregate vote counts per group
- [ ] **BE**: Write unit tests for grouping service
- [ ] **BE**: Write integration tests for group endpoints
- [ ] **FE**: Build group component (header with name + total votes, stacked/nested card layout)
- [ ] **FE**: Implement drag-card-into-group interaction (drop zone on group header)
- [ ] **FE**: Add "Create Group" option in column context menu (facilitator only)
- [ ] **FE**: Implement inline group name editing
- [ ] **FE**: Add "Remove from Group" action on grouped cards
- [ ] **FE**: Add "Dissolve Group" action with confirmation dialog
- [ ] **FE**: Style grouped cards with visual distinction (indented, bordered, subtle background)

### 7. Action Items CRUD (S-022)

- [ ] **BE**: Implement action item repository (create, findById, findByBoardId, findBySprintId, findByAssignee, update, updateStatus)
- [ ] **BE**: Create `POST /api/v1/boards/:boardId/action-items` -- create action item (any team member)
- [ ] **BE**: Create `GET /api/v1/boards/:boardId/action-items` -- list action items for board
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/sprints/:sprintId/action-items` -- list by sprint
- [ ] **BE**: Create `PATCH /api/v1/action-items/:actionItemId` -- update action item (assignee or facilitator)
- [ ] **BE**: Create `PATCH /api/v1/action-items/:actionItemId/status` -- update status
- [ ] **BE**: Write unit tests for action item service
- [ ] **BE**: Write integration tests for action item endpoints
- [ ] **FE**: Build action items panel (sidebar drawer or bottom panel on board view)
- [ ] **FE**: Build action item creation form (title, description, assignee dropdown, due date picker)
- [ ] **FE**: Build action item list component (title, status badge, assignee avatar, due date)
- [ ] **FE**: Implement status toggle (checkbox for completion, dropdown for full status)
- [ ] **FE**: Add "Create Action Item" in card context menu (auto-links card)
- [ ] **FE**: Add action items list to sprint detail page
- [ ] **FE**: Implement overdue visual indicator (red text/border for past-due items)
- [ ] **FE**: Implement action item API client functions

## Commits

| Hash | Description |
|------|-------------|
| 62ec4cb | feat: add board foundation — migrations, CRUD, phases, focus (Phase 2) |
| 97a03b9 | test(red): add failing tests for action items CRUD and carry-over |
| 8e38c61 | test(red): add failing tests for cards, voting, and grouping |
| b3d596c | feat(action-items): implement action items CRUD and carry-over |
| 69cea2d | feat(board): implement cards, voting, and grouping with anonymous mode |
| ab6e8ce | feat(frontend): implement Phase 2 board UI with cards, voting, groups, action items |
| 3b6f4c4 | test(e2e): add Phase 2 happy path — full retro ceremony flow |
| 8bde1c9 | fix: address Phase 2 code review findings — 5 fixes |

## Test Summary

- Backend: 556 tests passing (197 new for Phase 2, incl. E2E)
- Frontend: 59 tests passing (30 new for Phase 2)
- Total: 615 tests

## Exit Criteria

- [x] Boards can be created from templates with correct column setup
- [x] Cards can be added, edited, deleted, and reordered within and across columns
- [x] Anonymous mode correctly hides/shows author information
- [x] Voting works with configurable limits enforced server-side
- [x] Cards can be grouped and ungrouped by the facilitator
- [x] Action items can be created, updated, and tracked to completion
- [ ] Drag-and-drop works for cards between columns and into groups
- [x] All endpoints have unit and integration tests with >80% coverage
- [x] Board UI is functional with all core interactions working

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Drag-and-drop complexity with groups | Start simple (column reorder only), add group drop zones incrementally |
| Sort order conflicts with concurrent edits | Use fractional indexing; full re-index on conflict |
| Vote limit race conditions | Use database-level constraints and transactions for vote operations |
| Anonymous mode data leaks | Strict API-level serialization; never trust client for anonymity |
