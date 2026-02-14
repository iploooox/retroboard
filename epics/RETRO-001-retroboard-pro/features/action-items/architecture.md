# Action Items Architecture

## Overview

Action items are the tangible outcomes of a retrospective. During the discuss and action phases, the facilitator and team members create actionable tasks from discussed cards. Each action item has an assignee, due date, and status, and can be tracked across sprints. Unresolved action items from previous sprints automatically carry over to the next retro, ensuring accountability and follow-through.

## Design Principles

1. **Action items are first-class entities** -- not just annotations on cards but fully trackable items with their own lifecycle
2. **Linked to source** -- every action item optionally links back to the card or group that inspired it, preserving context
3. **Cross-sprint continuity** -- carry-over mechanism ensures nothing falls through the cracks between sprints
4. **Team-wide visibility** -- action items are viewable across all sprints for a team, not buried inside individual retros
5. **PostgreSQL-native** -- all status tracking, filtering, and aggregation via SQL

## Data Model

```
┌──────────────────────────────────────────────────────────────────┐
│                        Action Items ERD                           │
│                                                                  │
│  ┌──────────┐     ┌──────────────┐     ┌──────────┐             │
│  │  boards   │     │ action_items │     │  users    │             │
│  │          │     │              │     │          │             │
│  │  id ─────┼──>>─┤ board_id     │     │  id ─────┼──┐         │
│  │          │     │ id           │     │  name    │  │         │
│  └──────────┘     │ card_id ────>│     └──────────┘  │         │
│                   │ title        │                    │         │
│  ┌──────────┐     │ description  │                    │         │
│  │  cards    │     │ assignee_id──┼────────────────────┘         │
│  │          │     │ due_date     │                              │
│  │  id ─────┼──>>─┤ status       │    ┌──────────────┐          │
│  │          │     │ carried_     │    │ action_items │          │
│  └──────────┘     │  from_id ───┼──>>┤ (previous    │          │
│                   │ created_by──┼──┐ │  sprint's)   │          │
│                   │ created_at  │  │ └──────────────┘          │
│                   │ updated_at  │  │                            │
│                   └──────────────┘  │                            │
│                        │            │  ┌──────────┐             │
│                        │            └──┤  users    │             │
│                        │               └──────────┘             │
│                        │                                         │
│                   Self-referential FK                             │
│                   (carried_from_id)                               │
│                   links to original                               │
│                   action item from                                │
│                   previous sprint                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Action Item Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                    Action Item State Machine                      │
│                                                                  │
│                     ┌──────────┐                                 │
│                     │          │                                 │
│      ┌──────────────┤  OPEN    │<─────────────────┐             │
│      │              │          │                  │             │
│      │              └────┬─────┘                  │             │
│      │                   │                        │             │
│      │         Mark as   │               Reopen   │             │
│      │         in progress               (undo)   │             │
│      │                   │                        │             │
│      │              ┌────┴─────────┐              │             │
│      │              │              │              │             │
│      │              │ IN_PROGRESS  ├──────────────┘             │
│      │              │              │                             │
│      │              └────┬─────────┘                             │
│      │                   │                                       │
│      │         Mark as   │                                       │
│      │         done      │                                       │
│      │                   │                                       │
│      │              ┌────┴─────┐                                 │
│      │              │          │                                 │
│      │              │   DONE   │                                 │
│      │              │          │                                 │
│      │              └──────────┘                                 │
│      │                                                          │
│      │  Delete                                                  │
│      │  (hard delete, not soft)                                 │
│      │                                                          │
│      v                                                          │
│   [removed]                                                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

  Valid transitions:
    open -> in_progress
    open -> done
    in_progress -> done
    in_progress -> open
    done -> open
    done -> in_progress
    any -> deleted
```

## Carry-Over Mechanism

When a new retro board is created for a sprint, unresolved action items from the team's most recent previous sprint are automatically surfaced for carry-over.

```
  Sprint N (completed)                    Sprint N+1 (new)
  ┌────────────────────┐                 ┌────────────────────┐
  │  Board: Sprint 14   │                 │  Board: Sprint 15   │
  │                    │                 │                    │
  │  Action Items:     │                 │  Action Items:     │
  │  ┌────────────┐    │    carry-over    │  ┌────────────┐    │
  │  │ AI-001     │    │ ──────────────> │  │ AI-005     │    │
  │  │ status:    │    │   (cloned)      │  │ status:    │    │
  │  │ open       │    │                 │  │ open       │    │
  │  │ "Fix CI"   │    │                 │  │ "Fix CI"   │    │
  │  └────────────┘    │                 │  │ carried_   │    │
  │                    │                 │  │ from: AI-001│    │
  │  ┌────────────┐    │    carry-over    │  └────────────┘    │
  │  │ AI-002     │    │ ──────────────> │                    │
  │  │ status:    │    │   (cloned)      │  ┌────────────┐    │
  │  │ in_progress│    │                 │  │ AI-006     │    │
  │  │ "Add tests"│    │                 │  │ "Add tests"│    │
  │  └────────────┘    │                 │  │ carried_   │    │
  │                    │                 │  │ from: AI-002│    │
  │  ┌────────────┐    │   NOT carried    │  └────────────┘    │
  │  │ AI-003     │    │   (already done) │                    │
  │  │ status:    │    │                 │  ┌────────────┐    │
  │  │ done       │    │                 │  │ AI-007     │    │
  │  │ "Deploy"   │    │                 │  │ (new item) │    │
  │  └────────────┘    │                 │  └────────────┘    │
  │                    │                 │                    │
  └────────────────────┘                 └────────────────────┘
```

### Carry-Over Algorithm

```
1. User calls POST /api/v1/boards/:newBoardId/action-items/carry-over
2. Server identifies the team from the new board's sprint
3. Server finds the most recent completed sprint for that team
4. Server queries action items from that sprint where status != 'done'
5. For each unresolved item:
   a. Clone the action item (new ID, new board_id)
   b. Set carried_from_id = original item's ID
   c. Preserve: title, description, assignee_id, due_date
   d. Reset status to 'open'
6. Return the list of carried-over items
```

### Carry-Over Rules

- Only items with status `open` or `in_progress` are carried over
- Items already carried over to this board are skipped (idempotent)
- The `carried_from_id` field creates a chain: you can trace an action item back to its original sprint
- Carry-over is explicit (facilitator triggers it), not automatic, to give the team control
- The original item in the previous sprint retains its status -- it is not modified

## Team-Wide Action Item Dashboard

Action items can be viewed across all sprints for a team, providing a holistic view of accountability.

```
┌──────────────────────────────────────────────────────────────┐
│               Team Action Items Dashboard                     │
│                                                              │
│  Filter: [All Statuses ▼]  [All Sprints ▼]  [All Members ▼] │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Sprint 15 (Current)                          3 items   │  │
│  │                                                        │  │
│  │  [O] Fix CI pipeline             @Alice   Due: Mar 1  │  │
│  │      carried from Sprint 14                           │  │
│  │                                                        │  │
│  │  [P] Add integration tests       @Bob     Due: Mar 5  │  │
│  │      carried from Sprint 14                           │  │
│  │                                                        │  │
│  │  [O] Set up monitoring           @Charlie Due: Mar 7  │  │
│  │      new this sprint                                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Sprint 14                                    4 items   │  │
│  │                                                        │  │
│  │  [O] Fix CI pipeline             @Alice   Due: Feb 15 │  │
│  │      ↳ carried to Sprint 15                           │  │
│  │                                                        │  │
│  │  [P] Add integration tests       @Bob     Due: Feb 20 │  │
│  │      ↳ carried to Sprint 15                           │  │
│  │                                                        │  │
│  │  [D] Deploy staging environment  @Charlie Due: Feb 10 │  │
│  │      ✓ completed                                      │  │
│  │                                                        │  │
│  │  [D] Update documentation        @Alice   Due: Feb 12 │  │
│  │      ✓ completed                                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [O] = Open   [P] = In Progress   [D] = Done                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Creating Action Items from Cards

During the discuss or action phase, users can create action items directly from a card or group being discussed.

```
  Client                          Server                        PostgreSQL
    │                               │                               │
    │  POST /boards/:id/            │                               │
    │  action-items                 │                               │
    │  {                            │                               │
    │    cardId: "card-001",        │                               │
    │    title: "Fix CI pipeline",  │                               │
    │    description: "...",        │                               │
    │    assigneeId: "user-002",    │                               │
    │    dueDate: "2026-03-01"      │                               │
    │  }                            │                               │
    │ ─────────────────────────────>│                               │
    │                               │  Validate:                    │
    │                               │  - Board exists               │
    │                               │  - User has access            │
    │                               │  - Phase allows action items  │
    │                               │  - Card belongs to board      │
    │                               │  - Assignee is team member    │
    │                               │                               │
    │                               │  INSERT INTO action_items     │
    │                               │ ─────────────────────────────>│
    │                               │                               │
    │  201 Created                  │                               │
    │  { id: "ai-001", ... }       │                               │
    │ <─────────────────────────────│                               │
    │                               │                               │
```

## Module Structure

```
src/services/
  action-item-service.ts     -- CRUD, carry-over logic, status transitions

src/routes/
  action-item-routes.ts      -- REST API endpoints

src/repositories/
  action-item-repository.ts  -- SQL queries for action items
```

## Client-Side State (Zustand)

```typescript
interface ActionItemsState {
  // Board-scoped action items
  boardActionItems: ActionItem[];
  setBoardActionItems: (items: ActionItem[]) => void;
  addActionItem: (item: ActionItem) => void;
  updateActionItem: (id: string, updates: Partial<ActionItem>) => void;
  removeActionItem: (id: string) => void;

  // Team-scoped action items (dashboard)
  teamActionItems: ActionItem[];
  setTeamActionItems: (items: ActionItem[]) => void;

  // Filters
  statusFilter: ActionItemStatus | 'all';
  sprintFilter: string | 'all';
  assigneeFilter: string | 'all';
  setFilters: (filters: Partial<FilterState>) => void;

  // Loading
  isLoading: boolean;
  isCarryingOver: boolean;

  // Actions
  fetchBoardActionItems: (boardId: string) => Promise<void>;
  fetchTeamActionItems: (teamId: string, filters?: FilterParams) => Promise<void>;
  carryOverItems: (boardId: string) => Promise<ActionItem[]>;
}

interface ActionItem {
  id: string;
  boardId: string;
  cardId: string | null;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;     // ISO 8601 date
  status: 'open' | 'in_progress' | 'done';
  carriedFromId: string | null;
  carriedFromSprintName: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
```

## Notification Integration

Action items integrate with the real-time system. When an action item is created, updated, or deleted during a live retro session, the change propagates to all connected clients via WebSocket.

The NOTIFY mechanism is application-level (not trigger-based) because action item events are lower frequency and the server can emit NOTIFY directly after the database write, including enriched payload data (assignee name, card title).

## Error Handling

| Scenario | HTTP Status | Error Code | Message |
|----------|-------------|-----------|---------|
| Board not found | 404 | NOT_FOUND | Board not found |
| Action item not found | 404 | NOT_FOUND | Action item not found |
| Card not on this board | 400 | INVALID_CARD | Card does not belong to this board |
| Assignee not a team member | 400 | INVALID_ASSIGNEE | Assignee is not a member of this team |
| Invalid status transition | 400 | INVALID_STATUS | Invalid status value |
| Invalid due date | 400 | INVALID_DATE | Due date must be a valid future date |
| Phase does not allow action items | 403 | PHASE_RESTRICTED | Action items can only be created during discuss or action phases |
| No previous sprint to carry from | 404 | NO_PREVIOUS_SPRINT | No previous sprint found for carry-over |
| Not a team member | 403 | FORBIDDEN | Access denied |

## Related Documents

- [Action Items API Spec](specs/api.md)
- [Action Items Database Spec](specs/database.md)
- [Action Items Test Plan](specs/tests.md)
- [Facilitation Architecture](../facilitation/architecture.md) -- phase integration
- [Analytics Architecture](../analytics/architecture.md) -- action item metrics
