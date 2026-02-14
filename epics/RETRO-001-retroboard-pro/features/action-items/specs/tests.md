# Action Items Feature Test Plan

## Test Framework

- **Unit tests**: Vitest
- **Integration tests**: Vitest + Supertest
- **Database**: Test PostgreSQL database, reset between test suites

---

## Unit Tests

### ActionItemService

#### Create

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Create with all fields | title, description, cardId, assigneeId, dueDate | Item created with all fields |
| 2 | Create with only title | title only | Item created, optional fields null |
| 3 | Create with cardId | Valid cardId on same board | Item linked to card |
| 4 | Create with cardId from wrong board | cardId from different board | Throws INVALID_CARD error |
| 5 | Create with non-existent cardId | Invalid UUID | Throws INVALID_CARD error |
| 6 | Create with assigneeId | Valid team member ID | Item assigned |
| 7 | Create with non-member assigneeId | User not in team | Throws INVALID_ASSIGNEE error |
| 8 | Create with empty title | `""` | Throws VALIDATION_ERROR |
| 9 | Create with title > 500 chars | 501 character string | Throws VALIDATION_ERROR |
| 10 | Create with description > 5000 chars | 5001 character string | Throws VALIDATION_ERROR |
| 11 | Create with invalid due date | `"not-a-date"` | Throws INVALID_DATE |
| 12 | Default status is open | No status provided | status = "open" |
| 13 | Board not found | Non-existent boardId | Throws NOT_FOUND |
| 14 | Created_by set to current user | Current user's ID | created_by matches |

#### Read

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | List items for board | boardId with 3 items | Returns 3 items |
| 2 | List items for empty board | boardId with 0 items | Returns empty array |
| 3 | Filter by status open | status=open | Only open items |
| 4 | Filter by status in_progress | status=in_progress | Only in_progress items |
| 5 | Filter by status done | status=done | Only done items |
| 6 | Filter by assignee | assigneeId | Only items for that assignee |
| 7 | Sort by created_at asc | sort=created_at, order=asc | Oldest first |
| 8 | Sort by due_date | sort=due_date, order=asc | Earliest due first, nulls last |
| 9 | Pagination limit | limit=2 | Returns 2 items |
| 10 | Pagination offset | offset=2, limit=2 | Skips first 2 |
| 11 | Includes assignee name | Item with assignee | assigneeName populated |
| 12 | Includes card text | Item with cardId | cardText populated |
| 13 | Includes carried-from info | Carried-over item | carriedFromSprintName populated |
| 14 | Board not found | Non-existent boardId | Throws NOT_FOUND |

#### Update

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Update title | New title | Title updated |
| 2 | Update description | New description | Description updated |
| 3 | Clear description | description: null | Description set to null |
| 4 | Update assignee | New assigneeId | Assignee changed |
| 5 | Unassign | assigneeId: null | Assignee set to null |
| 6 | Update due date | New date | Due date changed |
| 7 | Clear due date | dueDate: null | Due date set to null |
| 8 | Change status open -> in_progress | status: "in_progress" | Status updated |
| 9 | Change status in_progress -> done | status: "done" | Status updated |
| 10 | Change status done -> open | status: "open" | Status updated (reopen) |
| 11 | Invalid status value | status: "cancelled" | Throws INVALID_STATUS |
| 12 | Empty title | title: "" | Throws VALIDATION_ERROR |
| 13 | Assignee not team member | Non-member userId | Throws INVALID_ASSIGNEE |
| 14 | Item not found | Non-existent ID | Throws NOT_FOUND |
| 15 | Updated_at is set | Any update | updated_at changes |
| 16 | Partial update preserves other fields | Only update title | Other fields unchanged |

#### Delete

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Delete existing item | Valid ID | Item deleted |
| 2 | Delete non-existent item | Invalid ID | Throws NOT_FOUND |
| 3 | Delete carried-over item | Item with carried_from_id | Item deleted, original unaffected |
| 4 | Delete original after carry-over | Original item | Original deleted, carried item's carried_from_id set to null |

#### Carry-Over

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Carry over unresolved items | Previous sprint has 2 open items | 2 items created in new board |
| 2 | Skip done items | Previous sprint: 1 open, 1 done | Only 1 carried over |
| 3 | Include in_progress items | Previous sprint has in_progress item | Item carried over with status reset to open |
| 4 | Preserve title and description | Item with both fields | Both copied to new item |
| 5 | Preserve assignee | Item with assignee | Same assignee on new item |
| 6 | Preserve due date | Item with due date | Same due date on new item |
| 7 | Set carried_from_id | Original item id | New item's carried_from_id = original id |
| 8 | Idempotent: second call | Call carry-over twice | Second call returns items in alreadyCarried, no duplicates |
| 9 | No previous sprint | First sprint for team | Throws NO_PREVIOUS_SPRINT |
| 10 | Previous sprint has no items | Previous sprint, 0 action items | Returns empty carriedOver array |
| 11 | All items already done | Previous sprint, all done | Returns all in skipped array |
| 12 | Chain carry-over | Item carried from sprint N-1 to N, then N to N+1 | New item's carried_from_id points to sprint N's item |
| 13 | Created_by set to facilitator | Facilitator triggers carry-over | All new items have created_by = facilitator |

#### Team-Wide Query

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | All items across sprints | teamId | Items from all sprints |
| 2 | Filter by sprint | teamId + sprintId | Only items from that sprint |
| 3 | Filter by status | teamId + status=open | Only open items |
| 4 | Filter by assignee | teamId + assigneeId | Only that user's items |
| 5 | Combined filters | status=open + assigneeId | Items matching both |
| 6 | Summary counts correct | Mixed statuses | open, inProgress, done counts match |
| 7 | Overdue count correct | Items with past due dates | overdue count matches |
| 8 | Items include sprint name | Items from multiple sprints | Each has sprintName |
| 9 | Sort by sprint desc | Default sort | Most recent sprint first |
| 10 | Team not found | Non-existent teamId | Throws NOT_FOUND |

---

## Integration Tests

### POST /api/v1/boards/:id/action-items

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Create action item | POST with valid body | 201, item returned |
| 2 | Create with card link | POST with cardId | 201, cardText included in response |
| 3 | Create with assignee | POST with assigneeId | 201, assigneeName included |
| 4 | Missing title | POST without title | 400 |
| 5 | Invalid board | POST to non-existent board | 404 |
| 6 | Not team member | POST as non-member | 403 |
| 7 | Unauthenticated | POST without token | 401 |
| 8 | Card from wrong board | POST with card from other board | 400 |
| 9 | Non-member assignee | POST with non-member assigneeId | 400 |

### GET /api/v1/boards/:id/action-items

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | List all items | GET board with 5 items | 200, 5 items |
| 2 | Empty board | GET board with 0 items | 200, empty items array |
| 3 | Filter by status | GET ?status=open | 200, only open items |
| 4 | Filter by assignee | GET ?assigneeId=user-1 | 200, only user-1's items |
| 5 | Pagination | GET ?limit=2&offset=2 | 200, 2 items starting at 3rd |
| 6 | Sort by due_date | GET ?sort=due_date&order=asc | 200, earliest first |
| 7 | Invalid board | GET non-existent board | 404 |
| 8 | Not team member | GET as non-member | 403 |

### PUT /api/v1/action-items/:id

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Update title | PUT { title: "new" } | 200, title updated |
| 2 | Update status | PUT { status: "done" } | 200, status updated |
| 3 | Update multiple fields | PUT { title, status, assigneeId } | 200, all updated |
| 4 | Clear optional field | PUT { description: null } | 200, description null |
| 5 | Non-existent item | PUT to invalid ID | 404 |
| 6 | Not team member | PUT as non-member | 403 |
| 7 | Invalid status | PUT { status: "cancelled" } | 400 |
| 8 | Empty title | PUT { title: "" } | 400 |

### DELETE /api/v1/action-items/:id

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Delete item | DELETE existing item | 204 |
| 2 | Non-existent item | DELETE invalid ID | 404 |
| 3 | Not team member | DELETE as non-member | 403 |
| 4 | Confirm hard delete | DELETE then GET | 404 on GET |

### GET /api/v1/teams/:teamId/action-items

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | All team items | GET with teamId | 200, items from all sprints |
| 2 | Filter by sprint | GET ?sprintId=sprint-1 | 200, only sprint-1 items |
| 3 | Filter by status | GET ?status=done | 200, only done items |
| 4 | Summary counts | GET items | summary.open + inProgress + done = total |
| 5 | Overdue calculation | Items with past due dates | summary.overdue correct |
| 6 | Non-member | GET as non-member | 403 |
| 7 | Non-existent team | GET invalid teamId | 404 |

### POST /api/v1/boards/:id/action-items/carry-over

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Carry over items | POST to new board | 200, carriedOver populated |
| 2 | Idempotent | POST twice | Second call has alreadyCarried, no duplicates |
| 3 | No previous sprint | First sprint for team | 404 |
| 4 | All items done | Previous sprint all done | 200, empty carriedOver, skipped populated |
| 5 | Carried items have correct board_id | POST carry-over | New items belong to target board |
| 6 | Carried items have open status | Previous items in_progress | New items status is open |
| 7 | Not team member | POST as non-member | 403 |

---

## Database Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Status check constraint | INSERT with status="invalid" | Constraint violation |
| 2 | Title length constraint | INSERT with 501 char title | Constraint violation |
| 3 | Empty title constraint | INSERT with empty title | Constraint violation |
| 4 | Description length constraint | INSERT with 5001 char description | Constraint violation |
| 5 | Board CASCADE delete | DELETE board with action items | Action items deleted |
| 6 | Card SET NULL on delete | DELETE card linked to action item | card_id set to NULL |
| 7 | Assignee SET NULL on delete | DELETE user assigned to item | assignee_id set to NULL |
| 8 | Carried_from SET NULL on delete | DELETE original carried item | carried_from_id set to NULL in carried item |
| 9 | updated_at trigger fires | UPDATE action item | updated_at changes |
| 10 | Self-referential FK works | Carry-over creates valid chain | carried_from_id references valid action_item |
| 11 | Index used for board_id query | EXPLAIN for board_id filter | Index scan used |
| 12 | Index used for assignee query | EXPLAIN for assignee_id filter | Index scan used |

---

## End-to-End Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Full action item lifecycle | Create -> assign -> mark in_progress -> mark done | All transitions successful |
| 2 | Carry-over across sprints | Sprint 14: create items, Sprint 15: carry-over | Items appear in Sprint 15 with correct metadata |
| 3 | Dashboard shows all sprints | Create items across 3 sprints | Dashboard lists all with correct sprint names |
| 4 | Action item from card | Focus card, create action item | Item linked to card, cardText visible |
| 5 | Reopen carried item | Carry-over, mark done, reopen | Status transitions work on carried items |
| 6 | Delete and re-carry | Carry-over, delete carried item, carry-over again | Item re-created (not in alreadyCarried since deleted) |
| 7 | Concurrent updates | Two users update same item simultaneously | Last write wins, no errors |

---

## Performance Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Board with 100 action items | GET /boards/:id/action-items | Response < 200ms |
| 2 | Team with 500 items across 20 sprints | GET /teams/:id/action-items | Response < 500ms |
| 3 | Carry-over 50 items | POST carry-over with 50 unresolved | Response < 1000ms |
| 4 | Summary aggregation | GET team items with summary | Summary calculation < 200ms |
