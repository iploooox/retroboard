# Retro Board — Architecture

## Overview

The retro board is the central feature of RetroBoard Pro. It provides a structured, real-time collaborative surface where team members add feedback cards to themed columns, vote on items, group related cards, and discuss outcomes — all guided through facilitated phases.

## Domain Model

A **board** belongs to exactly one **sprint**, and a sprint has at most one board. When a board is created, the user selects a **template** which defines the initial column configuration. The board then tracks its own lifecycle through a sequence of **phases**.

### Key Entities

| Entity | Description |
|--------|-------------|
| Board | The retro surface for a sprint. Owns columns, tracks phase, settings. |
| Column | A vertical lane on the board (e.g., "What Went Well"). Defined at board creation from template. |
| Card | A feedback item within a column. Has text content, author, position. |
| CardVote | A single vote cast by a user on a card. Supports multiple votes per card up to limits. |
| CardGroup | A named cluster of related cards. Created during the grouping phase. |
| CardGroupMember | Join table linking cards to their group. |

### Relationships

- Board 1:1 Sprint (via sprint_id UNIQUE FK)
- Board 1:N Column
- Board 1:N Card (denormalized board_id on card for fast queries)
- Column 1:N Card
- Card 1:N CardVote
- Board 1:N CardGroup
- CardGroup N:M Card (via CardGroupMember)

## Data Model — ASCII Diagram

```
┌─────────────────────────────┐
│          sprints             │
│─────────────────────────────│
│ id (PK)                     │
│ team_id (FK)                │
│ name                        │
│ start_date                  │
│ end_date                    │
│ created_at                  │
└──────────────┬──────────────┘
               │ 1:1
               ▼
┌─────────────────────────────────────────────────────────┐
│                         boards                           │
│─────────────────────────────────────────────────────────│
│ id (PK)                                                  │
│ sprint_id (FK, UNIQUE) ─────────────────► sprints.id     │
│ template_id (FK) ───────────────────────► templates.id   │
│ phase (enum: write|group|vote|discuss|action)            │
│ anonymous_mode (bool, default false)                     │
│ max_votes_per_user (int, default 5)                      │
│ max_votes_per_card (int, default 3)                      │
│ focus_item_id (uuid, nullable)                           │
│ focus_item_type (enum: card|group, nullable)             │
│ created_by (FK) ────────────────────────► users.id       │
│ created_at                                               │
│ updated_at                                               │
└───────┬──────────────┬────────────────┬─────────────────┘
        │ 1:N          │ 1:N            │ 1:N
        ▼              ▼                ▼
┌───────────────┐ ┌──────────────────────────────┐ ┌────────────────────┐
│    columns     │ │           cards               │ │   card_groups       │
│───────────────│ │──────────────────────────────│ │────────────────────│
│ id (PK)       │ │ id (PK)                       │ │ id (PK)             │
│ board_id (FK)─┤ │ column_id (FK)──► columns.id  │ │ board_id (FK)──►    │
│ name          │ │ board_id (FK)───► boards.id   │ │   boards.id         │
│ color         │ │ content (text)                │ │ title               │
│ position (int)│ │ author_id (FK)──► users.id    │ │ position (int)      │
│ created_at    │ │ position (int)                │ │ created_at          │
└───────────────┘ │ created_at                    │ └─────────┬──────────┘
                  │ updated_at                    │           │ 1:N
                  └──────────────┬────────────────┘           ▼
                                 │ 1:N            ┌─────────────────────┐
                                 ▼                │ card_group_members   │
                  ┌─────────────────────────┐     │─────────────────────│
                  │       card_votes         │     │ group_id (FK, PK)   │
                  │─────────────────────────│     │   ──► card_groups.id │
                  │ id (PK)                 │     │ card_id (FK, PK)    │
                  │ card_id (FK)──► cards.id│     │   ──► cards.id      │
                  │ user_id (FK)──► users.id│     └─────────────────────┘
                  │ vote_number (int)       │
                  │ created_at              │
                  └─────────────────────────┘
                  UNIQUE(card_id, user_id,
                         vote_number)
```

## Board Phases

The board progresses through a strict sequence of phases. The facilitator (or admin) controls phase transitions. Certain actions are restricted based on the current phase.

```
┌───────┐    ┌───────┐    ┌───────┐    ┌─────────┐    ┌────────┐
│ WRITE │───►│ GROUP │───►│ VOTE  │───►│ DISCUSS │───►│ ACTION │
└───────┘    └───────┘    └───────┘    └─────────┘    └────────┘
    │             │            │             │              │
    │             │            │             │              │
    ▼             ▼            ▼             ▼              ▼
 Add/edit     Drag cards   Cast votes   Focus on a     Create
 cards to     into groups  on cards     card/group     action
 columns      (clusters)   (limited)    for discussion items
```

### Phase Restrictions

| Action | write | group | vote | discuss | action |
|--------|-------|-------|------|---------|--------|
| Add card | Yes | No | No | No | No |
| Edit own card | Yes | Yes | No | No | No |
| Delete own card | Yes | Yes | No | No | No |
| Create group | No | Yes | No | No | No |
| Modify group | No | Yes | No | No | No |
| Cast vote | No | No | Yes | No | No |
| Remove own vote | No | No | Yes | No | No |
| Set focus | No | No | No | Yes | No |
| Create action item | No | No | No | Yes | Yes |

## Voting System

- Each board has a `max_votes_per_user` setting (default: 5). This is the total number of votes a user can cast across all cards on the board.
- Each board has a `max_votes_per_card` setting (default: 3). This limits how many times a single user can vote on the same card.
- A vote is represented as a row in `card_votes`. The `vote_number` field (1, 2, 3...) tracks which vote it is for that user on that card.
- The UNIQUE constraint on `(card_id, user_id, vote_number)` prevents duplicates.
- Before casting a vote, the server checks:
  1. Total votes by user on this board < `max_votes_per_user`
  2. Votes by user on this specific card < `max_votes_per_card`
  3. Board phase is `vote`

## Card Grouping

- During the `group` phase, users (typically the facilitator) can create named groups and add cards to them.
- A card can belong to at most one group at a time (enforced by UNIQUE on `card_id` in `card_group_members`).
- Groups have a `position` for ordering on the board.
- When a group is deleted, its member cards are simply ungrouped (returned to their original columns). Cards are not deleted.

## Anonymous Mode

- When `anonymous_mode` is `true` on the board, the API responses exclude `author_id` from cards for non-admin users.
- The database always stores `author_id` for audit purposes.
- Only the board creator, team admins, and facilitators can toggle anonymous mode.
- Anonymous mode can only be toggled during the `write` phase to prevent de-anonymization mid-retro.

## Discussion Focus

- During the `discuss` phase, the facilitator sets a `focus_item_id` and `focus_item_type` (either `card` or `group`) on the board.
- All connected clients receive a WebSocket notification and highlight the focused item.
- Only one item can be focused at a time. Setting a new focus replaces the previous one.
- Setting `focus_item_id` to `null` clears the focus.

## Real-Time Integration

The board uses PostgreSQL LISTEN/NOTIFY for real-time updates. The server listens on a channel named `board:{board_id}` and forwards events to connected WebSocket clients.

### Event Types

| Event | Trigger | Payload (via WS) |
|-------|---------|-------------------|
| `card:created` | New card added | `{ cardId, columnId }` |
| `card:updated` | Card edited | `{ cardId }` |
| `card:deleted` | Card removed | `{ cardId, columnId }` |
| `vote:added` | Vote cast | `{ cardId, userId, totalVotes }` |
| `vote:removed` | Vote removed | `{ cardId, userId, totalVotes }` |
| `group:created` | Group created | `{ groupId }` |
| `group:updated` | Group modified | `{ groupId }` |
| `group:deleted` | Group deleted | `{ groupId }` |
| `phase:changed` | Phase transition | `{ phase }` |
| `focus:changed` | Focus set/cleared | `{ focusItemId, focusItemType }` |
| `board:updated` | Settings changed | `{ anonymous_mode, max_votes_per_user }` |

Per ADR-001, NOTIFY payloads are kept small (event type + IDs only). Clients fetch full data via the API when needed, or the WebSocket message includes enough data for optimistic UI updates.

## Security Considerations

- All board endpoints require authentication (JWT).
- Users must be members of the team that owns the sprint to access the board.
- Card ownership is enforced: only the card author (or admin/facilitator) can edit or delete a card.
- Vote manipulation is prevented by server-side limit checks within a database transaction.
- Phase transitions are restricted to facilitators and admins.
- Anonymous mode hides author info at the API response level, not the database level.
