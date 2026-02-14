# Retro Board — Test Plan

## Test Framework

- **Unit tests**: Vitest
- **Integration tests**: Vitest + Supertest (HTTP) + postgres (test database)
- **Test database**: Isolated PostgreSQL database, migrated fresh per test suite
- **Fixtures**: Factory functions for creating test boards, cards, users, teams, sprints

## Test Utilities

```typescript
// tests/helpers/factories.ts
createUser(overrides?) -> User
createTeam(overrides?) -> Team
createTeamMember(teamId, userId, role) -> TeamMember
createSprint(teamId, overrides?) -> Sprint
createBoard(sprintId, templateId, overrides?) -> Board
createCard(boardId, columnId, authorId, overrides?) -> Card
createVote(cardId, userId, voteNumber?) -> CardVote
createGroup(boardId, title, cardIds?) -> CardGroup
```

---

## 1. Unit Tests

### 1.1 Card CRUD Logic

**File:** `tests/unit/board/cards.test.ts`

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1.1.1 | Create card with valid content and column_id | Card created with auto-assigned position, correct board_id, author_id from JWT |
| 1.1.2 | Create card with empty content (whitespace only) | Validation error: content required |
| 1.1.3 | Create card with content exceeding 2000 chars | Validation error: content too long |
| 1.1.4 | Create card with non-existent column_id | 404 error: column not found |
| 1.1.5 | Create card with column_id from different board | Validation error: column does not belong to this board |
| 1.1.6 | Edit card content with valid text | Card updated, updated_at changed |
| 1.1.7 | Edit card to move to different column | Card's column_id updated, position recalculated |
| 1.1.8 | Edit card with empty content | Validation error: content required |
| 1.1.9 | Delete card that has votes | Card and all associated votes deleted |
| 1.1.10 | Delete card that is in a group | Card removed from group, group still exists |
| 1.1.11 | Position auto-assignment: new card gets next position in column | Position = max existing position + 1 |
| 1.1.12 | Position reordering: move card to specific position | Other cards' positions shift accordingly |

### 1.2 Voting Logic

**File:** `tests/unit/board/voting.test.ts`

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1.2.1 | Cast first vote on a card | Vote created with vote_number=1, counts updated |
| 1.2.2 | Cast second vote on same card | Vote created with vote_number=2, counts updated |
| 1.2.3 | Cast vote up to max_votes_per_card limit | Succeeds on the last allowed vote |
| 1.2.4 | Exceed max_votes_per_card | 422 VOTE_LIMIT_REACHED error |
| 1.2.5 | Cast votes up to max_votes_per_user across multiple cards | Succeeds on the last allowed vote |
| 1.2.6 | Exceed max_votes_per_user across board | 422 VOTE_LIMIT_REACHED error |
| 1.2.7 | Remove vote (LIFO): removes highest vote_number | vote_number N removed, vote_number N-1 still exists |
| 1.2.8 | Remove last vote on a card | No votes remain for user on that card |
| 1.2.9 | Remove vote when user has no votes on card | 422 VALIDATION_ERROR |
| 1.2.10 | Concurrent voting: two users vote simultaneously | Both succeed (no race condition) |
| 1.2.11 | Concurrent voting: same user rapid-fire votes | Only succeeds up to limits, extras rejected |
| 1.2.12 | Vote count recalculation after card deletion | User's remaining votes increase when voted card is deleted |
| 1.2.13 | Vote with max_votes_per_user = 1 (single vote mode) | Only one vote allowed across entire board |
| 1.2.14 | Vote with max_votes_per_card = 1 | Only one vote per card per user |
| 1.2.15 | max_votes_per_user < max_votes_per_card | Board limit takes precedence over card limit |

### 1.3 Grouping Logic

**File:** `tests/unit/board/grouping.test.ts`

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1.3.1 | Create group with title and no initial cards | Empty group created |
| 1.3.2 | Create group with initial card_ids | Group created, all cards linked |
| 1.3.3 | Create group with card already in another group | Card moved from old group to new group |
| 1.3.4 | Create group with empty title | Validation error |
| 1.3.5 | Create group with card from different board | Validation error |
| 1.3.6 | Add card to existing group | Card linked to group, card's group_id set |
| 1.3.7 | Remove card from group | Card unlinked, card's group_id becomes null |
| 1.3.8 | Delete group with member cards | Group deleted, all cards ungrouped (not deleted) |
| 1.3.9 | Delete group with no members | Group deleted |
| 1.3.10 | Group total_votes aggregation | total_votes = sum of vote_count across all cards in group |
| 1.3.11 | Group position auto-assignment | New group gets next position |
| 1.3.12 | Create group with more than 50 cards | Validation error: max 50 cards per group |

### 1.4 Phase Transition Logic

**File:** `tests/unit/board/phases.test.ts`

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1.4.1 | Advance from write to group | Phase updated to group |
| 1.4.2 | Advance from group to vote | Phase updated to vote |
| 1.4.3 | Advance from vote to discuss | Phase updated to discuss |
| 1.4.4 | Advance from discuss to action | Phase updated to action |
| 1.4.5 | Go back from group to write | Phase updated to write |
| 1.4.6 | Go back from vote to group | Phase updated to group |
| 1.4.7 | Go back from discuss to vote | Phase updated to vote |
| 1.4.8 | Go back from action to discuss | Phase updated to discuss |
| 1.4.9 | Skip forward: write to vote | 422 INVALID_PHASE error |
| 1.4.10 | Skip forward: write to discuss | 422 INVALID_PHASE error |
| 1.4.11 | Skip forward: group to discuss | 422 INVALID_PHASE error |
| 1.4.12 | Skip backward: action to write | 422 INVALID_PHASE error |
| 1.4.13 | Set phase to current phase (no-op) | 422 INVALID_PHASE or 200 OK (idempotent — design decision) |
| 1.4.14 | Focus cleared when leaving discuss phase | focus_item_id set to null |

---

## 2. Integration Tests

### 2.1 POST /api/v1/sprints/:sprintId/board — Create Board

**File:** `tests/integration/board/create-board.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.1.1 | Create board with valid template_id | 201 | Board created with columns from template, phase=write |
| 2.1.2 | Create board for sprint that already has a board | 409 | BOARD_ALREADY_EXISTS |
| 2.1.3 | Create board for non-existent sprint | 404 | SPRINT_NOT_FOUND |
| 2.1.4 | Create board with invalid template_id | 422 | VALIDATION_ERROR |
| 2.1.5 | Create board with custom vote limits | 201 | max_votes_per_user and max_votes_per_card set |
| 2.1.6 | Create board with anonymous_mode true | 201 | anonymous_mode = true |
| 2.1.7 | Create board as regular member (not admin/facilitator) | 403 | FORBIDDEN |
| 2.1.8 | Create board without authentication | 401 | UNAUTHORIZED |
| 2.1.9 | Create board for sprint in a different team | 403 | FORBIDDEN |
| 2.1.10 | Response includes columns populated from template | 201 | columns array matches template definition |

### 2.2 GET /api/v1/sprints/:sprintId/board — Get Board

**File:** `tests/integration/board/get-board.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.2.1 | Get board with no cards | 200 | Board with empty columns |
| 2.2.2 | Get board with cards in multiple columns | 200 | Cards nested under correct columns |
| 2.2.3 | Get board with votes | 200 | vote_count and user_votes populated per card |
| 2.2.4 | Get board with groups | 200 | groups array with card_ids and total_votes |
| 2.2.5 | Get board with anonymous_mode=true as regular member | 200 | author_id and author_name are null on all cards |
| 2.2.6 | Get board with anonymous_mode=true as admin | 200 | author_id and author_name are visible |
| 2.2.7 | Get board with anonymous_mode=true as facilitator | 200 | author_id and author_name are visible |
| 2.2.8 | Get board for sprint with no board | 404 | BOARD_NOT_FOUND |
| 2.2.9 | user_votes_remaining is correct | 200 | Equals max_votes_per_user minus votes cast |
| 2.2.10 | Cards ordered by position within columns | 200 | Cards in ascending position order |
| 2.2.11 | Groups ordered by position | 200 | Groups in ascending position order |
| 2.2.12 | Get board from different team | 403 | FORBIDDEN |

### 2.3 PUT /api/v1/boards/:id — Update Board Settings

**File:** `tests/integration/board/update-board.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.3.1 | Update anonymous_mode during write phase | 200 | anonymous_mode toggled |
| 2.3.2 | Update anonymous_mode during vote phase | 422 | INVALID_PHASE |
| 2.3.3 | Update max_votes_per_user during write phase | 200 | Limit updated |
| 2.3.4 | Update max_votes_per_user during group phase | 200 | Limit updated |
| 2.3.5 | Update max_votes_per_user during vote phase | 422 | INVALID_PHASE |
| 2.3.6 | Update with invalid max_votes_per_user (0) | 422 | VALIDATION_ERROR |
| 2.3.7 | Update with invalid max_votes_per_user (100) | 422 | VALIDATION_ERROR |
| 2.3.8 | Update as regular member | 403 | FORBIDDEN |
| 2.3.9 | Update non-existent board | 404 | BOARD_NOT_FOUND |

### 2.4 POST /api/v1/boards/:id/cards — Add Card

**File:** `tests/integration/board/add-card.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.4.1 | Add card during write phase | 201 | Card created in column |
| 2.4.2 | Add card during group phase | 422 | INVALID_PHASE |
| 2.4.3 | Add card during vote phase | 422 | INVALID_PHASE |
| 2.4.4 | Add card with missing content | 422 | VALIDATION_ERROR |
| 2.4.5 | Add card with missing column_id | 422 | VALIDATION_ERROR |
| 2.4.6 | Add card as any team member | 201 | author_id set from JWT |
| 2.4.7 | Card position auto-increments | 201 | position = existing max + 1 |
| 2.4.8 | Add card to non-existent board | 404 | BOARD_NOT_FOUND |

### 2.5 PUT /api/v1/boards/:id/cards/:cardId — Edit Card

**File:** `tests/integration/board/edit-card.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.5.1 | Edit own card content during write phase | 200 | Content updated |
| 2.5.2 | Edit own card during group phase | 200 | Content updated (allowed) |
| 2.5.3 | Edit own card during vote phase | 422 | INVALID_PHASE |
| 2.5.4 | Edit another user's card as member | 403 | FORBIDDEN |
| 2.5.5 | Edit another user's card as admin | 200 | Content updated |
| 2.5.6 | Edit another user's card as facilitator | 200 | Content updated |
| 2.5.7 | Move card to different column | 200 | column_id updated |
| 2.5.8 | Edit non-existent card | 404 | CARD_NOT_FOUND |

### 2.6 DELETE /api/v1/boards/:id/cards/:cardId — Delete Card

**File:** `tests/integration/board/delete-card.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.6.1 | Delete own card during write phase | 200 | Card deleted |
| 2.6.2 | Delete own card during vote phase | 422 | INVALID_PHASE |
| 2.6.3 | Delete another user's card as member | 403 | FORBIDDEN |
| 2.6.4 | Delete another user's card as admin | 200 | Card deleted |
| 2.6.5 | Delete card with votes (cascade) | 200 | Card and votes deleted |
| 2.6.6 | Delete card in a group | 200 | Card deleted, removed from group |
| 2.6.7 | Delete non-existent card | 404 | CARD_NOT_FOUND |

### 2.7 POST /api/v1/boards/:id/cards/:cardId/vote — Vote

**File:** `tests/integration/board/vote.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.7.1 | Vote on card during vote phase | 201 | Vote created, counts updated |
| 2.7.2 | Vote during write phase | 422 | INVALID_PHASE |
| 2.7.3 | Vote during group phase | 422 | INVALID_PHASE |
| 2.7.4 | Multiple votes on same card (within limit) | 201 | vote_number increments |
| 2.7.5 | Exceed max_votes_per_card | 422 | VOTE_LIMIT_REACHED |
| 2.7.6 | Exceed max_votes_per_user | 422 | VOTE_LIMIT_REACHED |
| 2.7.7 | Vote response includes remaining votes | 201 | user_votes_remaining correct |
| 2.7.8 | Vote on non-existent card | 404 | CARD_NOT_FOUND |
| 2.7.9 | Vote on card from different board | 404 | CARD_NOT_FOUND |
| 2.7.10 | Vote as non-team member | 403 | FORBIDDEN |

### 2.8 DELETE /api/v1/boards/:id/cards/:cardId/vote — Remove Vote

**File:** `tests/integration/board/remove-vote.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.8.1 | Remove vote during vote phase | 200 | Highest vote_number removed |
| 2.8.2 | Remove vote during write phase | 422 | INVALID_PHASE |
| 2.8.3 | Remove vote when user has no votes on card | 422 | VALIDATION_ERROR |
| 2.8.4 | Remove second vote (leaves first) | 200 | vote_number 2 removed, vote_number 1 remains |
| 2.8.5 | user_votes_remaining increments after removal | 200 | Correct count returned |

### 2.9 POST /api/v1/boards/:id/groups — Create Group

**File:** `tests/integration/board/create-group.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.9.1 | Create group during group phase | 201 | Group created |
| 2.9.2 | Create group with initial cards | 201 | Cards linked to group |
| 2.9.3 | Create group during write phase | 422 | INVALID_PHASE |
| 2.9.4 | Create group as member (not facilitator) | 403 | FORBIDDEN |
| 2.9.5 | Create group with empty title | 422 | VALIDATION_ERROR |
| 2.9.6 | Create group with card from different board | 422 | VALIDATION_ERROR |

### 2.10 PUT /api/v1/boards/:id/groups/:groupId — Update Group

**File:** `tests/integration/board/update-group.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.10.1 | Rename group | 200 | Title updated |
| 2.10.2 | Add cards to group | 200 | card_ids extended |
| 2.10.3 | Remove cards from group | 200 | card_ids reduced |
| 2.10.4 | Add card already in another group (moves it) | 200 | Card moved to new group |
| 2.10.5 | Update group during vote phase | 422 | INVALID_PHASE |
| 2.10.6 | Update non-existent group | 404 | GROUP_NOT_FOUND |

### 2.11 DELETE /api/v1/boards/:id/groups/:groupId — Delete Group

**File:** `tests/integration/board/delete-group.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.11.1 | Delete group with cards | 200 | Group deleted, cards ungrouped |
| 2.11.2 | Delete empty group | 200 | Group deleted |
| 2.11.3 | Delete group during vote phase | 422 | INVALID_PHASE |
| 2.11.4 | Delete non-existent group | 404 | GROUP_NOT_FOUND |

### 2.12 PUT /api/v1/boards/:id/phase — Set Phase

**File:** `tests/integration/board/set-phase.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.12.1 | Advance write to group | 200 | Phase set to group |
| 2.12.2 | Advance group to vote | 200 | Phase set to vote |
| 2.12.3 | Advance vote to discuss | 200 | Phase set to discuss |
| 2.12.4 | Advance discuss to action | 200 | Phase set to action |
| 2.12.5 | Go back group to write | 200 | Phase set to write |
| 2.12.6 | Skip write to vote | 422 | INVALID_PHASE |
| 2.12.7 | Set phase as member (not facilitator) | 403 | FORBIDDEN |
| 2.12.8 | Set phase on non-existent board | 404 | BOARD_NOT_FOUND |

### 2.13 PUT /api/v1/boards/:id/focus — Set Focus

**File:** `tests/integration/board/set-focus.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.13.1 | Focus on card during discuss phase | 200 | focus_item_id and focus_item_type set |
| 2.13.2 | Focus on group during discuss phase | 200 | focus_item_id and focus_item_type set |
| 2.13.3 | Clear focus (null) | 200 | Both fields set to null |
| 2.13.4 | Set focus during write phase | 422 | INVALID_PHASE |
| 2.13.5 | Focus on non-existent card | 422 | VALIDATION_ERROR |
| 2.13.6 | Focus on card from different board | 422 | VALIDATION_ERROR |
| 2.13.7 | Set focus as member (not facilitator) | 403 | FORBIDDEN |
| 2.13.8 | Type mismatch: card ID with type=group | 422 | VALIDATION_ERROR |

---

## 3. Edge Cases and Boundary Tests

**File:** `tests/integration/board/edge-cases.test.ts`

### 3.1 Vote Limit Edge Cases

| # | Test Case | Expected |
|---|-----------|----------|
| 3.1.1 | Vote limit of 1: cast one vote, try second | First succeeds, second returns VOTE_LIMIT_REACHED |
| 3.1.2 | Remove vote then re-vote up to limit | Succeeds — freed slot is reusable |
| 3.1.3 | max_votes_per_card = max_votes_per_user: all votes on one card | Allowed up to the limit |
| 3.1.4 | Reduce max_votes_per_user after votes already cast | Setting accepted; existing votes preserved but no new votes allowed |
| 3.1.5 | Delete card that had votes, then vote on another card | Freed votes are available again |
| 3.1.6 | Board with max_votes_per_user=99 and many cards | No performance degradation in vote counting |

### 3.2 Anonymous Mode Edge Cases

| # | Test Case | Expected |
|---|-----------|----------|
| 3.2.1 | Anon mode: card creator sees their own author_id | author_id visible to the creator |
| 3.2.2 | Anon mode: other member sees null author_id | author_id is null |
| 3.2.3 | Anon mode: admin sees all author_ids | All author_ids visible |
| 3.2.4 | Toggle anon mode off during write phase | author_ids become visible to all |
| 3.2.5 | Attempt to toggle anon mode during vote phase | 422 INVALID_PHASE |
| 3.2.6 | Anon mode with card edit: cannot infer author from updated_at | Card updated_at does not reveal authorship |

### 3.3 Phase Restriction Edge Cases

| # | Test Case | Expected |
|---|-----------|----------|
| 3.3.1 | Add card then immediately advance to group | Card persists, no more card creation |
| 3.3.2 | Create group then go back to write | Groups persist, but cannot create new groups |
| 3.3.3 | Cast votes then go back to group then forward to vote again | Previous votes preserved |
| 3.3.4 | Set focus then advance to action | Focus cleared on phase change |
| 3.3.5 | Rapid phase changes (write->group->vote in quick succession) | All transitions succeed, state consistent |

### 3.4 Card Ownership Validation

| # | Test Case | Expected |
|---|-----------|----------|
| 3.4.1 | User edits card they authored | 200 OK |
| 3.4.2 | User edits card authored by another user | 403 FORBIDDEN |
| 3.4.3 | Admin edits any card | 200 OK |
| 3.4.4 | Facilitator edits any card | 200 OK |
| 3.4.5 | User deletes card they authored | 200 OK |
| 3.4.6 | User deletes card authored by another user | 403 FORBIDDEN |

### 3.5 Concurrent Operations

| # | Test Case | Expected |
|---|-----------|----------|
| 3.5.1 | Two users create cards simultaneously | Both succeed with different positions |
| 3.5.2 | Two users vote on same card simultaneously | Both succeed if within limits |
| 3.5.3 | User votes while facilitator changes phase to discuss | Vote may succeed or fail depending on timing; no crash |
| 3.5.4 | User creates card while facilitator advances from write to group | Card creation may succeed or fail; no data corruption |
| 3.5.5 | Two facilitators try to advance phase simultaneously | One succeeds, other gets stale data or same result (idempotent) |

### 3.6 Data Integrity

| # | Test Case | Expected |
|---|-----------|----------|
| 3.6.1 | Delete board: all columns, cards, votes, groups cascade deleted | No orphaned rows |
| 3.6.2 | Delete sprint: board cascade deleted along with all children | Clean cascade |
| 3.6.3 | Card in group that gets deleted: group_members row removed | card_group_members cleaned up |
| 3.6.4 | Cannot create board with deleted template | 422 VALIDATION_ERROR |
| 3.6.5 | Cannot create card with column_id from another board | 422 VALIDATION_ERROR |

---

## 4. Test Data Fixtures

### Minimal Board Setup

Used by most tests as a baseline:

```typescript
// Creates: user, team, team_member, sprint, template, board with 3 columns
async function setupBoard(options?: {
  phase?: BoardPhase;
  anonymousMode?: boolean;
  maxVotesPerUser?: number;
  maxVotesPerCard?: number;
  cardCount?: number;
}) {
  const admin = await createUser({ name: 'Admin' });
  const member = await createUser({ name: 'Member' });
  const team = await createTeam({ name: 'Test Team' });
  await createTeamMember(team.id, admin.id, 'admin');
  await createTeamMember(team.id, member.id, 'member');
  const sprint = await createSprint(team.id, { name: 'Sprint 1' });
  const template = await getSystemTemplate('www-delta');
  const board = await createBoard(sprint.id, template.id, {
    phase: options?.phase ?? 'write',
    anonymous_mode: options?.anonymousMode ?? false,
    max_votes_per_user: options?.maxVotesPerUser ?? 5,
    max_votes_per_card: options?.maxVotesPerCard ?? 3,
  });

  return { admin, member, team, sprint, template, board };
}
```

### Board with Cards and Votes

```typescript
async function setupBoardWithVotes() {
  const { admin, member, team, sprint, board } = await setupBoard({
    phase: 'vote',
  });
  const columns = await getColumns(board.id);
  const card1 = await createCard(board.id, columns[0].id, admin.id, {
    content: 'Card 1',
  });
  const card2 = await createCard(board.id, columns[0].id, member.id, {
    content: 'Card 2',
  });
  await createVote(card1.id, admin.id, 1);
  await createVote(card1.id, member.id, 1);
  await createVote(card2.id, admin.id, 1);

  return { admin, member, team, sprint, board, columns, card1, card2 };
}
```

---

## 5. Test Coverage Requirements

| Area | Minimum Coverage |
|------|-----------------|
| Card CRUD handlers | 95% |
| Voting logic | 100% |
| Phase transition logic | 100% |
| Grouping logic | 90% |
| Authorization checks | 100% |
| Anonymous mode filtering | 100% |
| Input validation | 90% |
| Database constraints | 85% |

## 6. Test Environment

- Each integration test suite runs in a transaction that is rolled back after each test.
- The test database is created from migrations before the test suite starts.
- Environment variables for test:
  - `DATABASE_URL=postgresql://test:test@localhost:5432/retroboard_test`
  - `JWT_SECRET=test-secret-key`
  - `NODE_ENV=test`
