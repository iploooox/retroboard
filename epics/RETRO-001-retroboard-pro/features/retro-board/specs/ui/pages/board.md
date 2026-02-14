# Retro Board — Board Page Spec

## Route

`/teams/:teamId/sprints/:sprintId/board`

## Purpose

The board page is the primary workspace for running a retrospective. It displays themed columns with feedback cards, supports voting, grouping, and facilitated discussion through sequential phases.

---

## ASCII Wireframe

### Write Phase (Default)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◄ Team Alpha  /  Sprint 23                          ○○○  ⚙ Settings       │
│                                                                              │
│  Phase: [WRITE]  Group  Vote  Discuss  Action         Votes: —              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ ■ What Went Well │  │ ■ Improvements   │  │ ■ Action Items   │           │
│  │   (3 cards)      │  │   (2 cards)      │  │   (0 cards)      │           │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤           │
│  │                  │  │                  │  │                  │           │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │                  │           │
│  │ │ Great team   │ │  │ │ CI pipeline  │ │  │  No cards yet.   │           │
│  │ │ communication│ │  │ │ is too slow  │ │  │                  │           │
│  │ │              │ │  │ │              │ │  │  + Add a card     │           │
│  │ │ — Alice   ⋮  │ │  │ │ — Bob     ⋮  │ │  │                  │           │
│  │ └──────────────┘ │  │ └──────────────┘ │  │                  │           │
│  │                  │  │                  │  │                  │           │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │                  │           │
│  │ │ Shipped on   │ │  │ │ Too many     │ │  │                  │           │
│  │ │ time despite │ │  │ │ meetings     │ │  │                  │           │
│  │ │ challenges   │ │  │ │              │ │  │                  │           │
│  │ │ — Charlie ⋮  │ │  │ │ — Alice   ⋮  │ │  │                  │           │
│  │ └──────────────┘ │  │ └──────────────┘ │  │                  │           │
│  │                  │  │                  │  │                  │           │
│  │ ┌──────────────┐ │  │                  │  │                  │           │
│  │ │ New testing  │ │  │  + Add a card    │  │                  │           │
│  │ │ process works│ │  │                  │  │                  │           │
│  │ │ — Bob     ⋮  │ │  │                  │  │                  │           │
│  │ └──────────────┘ │  │                  │  │                  │           │
│  │                  │  │                  │  │                  │           │
│  │  + Add a card    │  │                  │  │                  │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Vote Phase

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◄ Team Alpha  /  Sprint 23                          ○○○  ⚙ Settings       │
│                                                                              │
│  Phase: Write  Group  [VOTE]  Discuss  Action        Votes: 3/5 remaining   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ ■ What Went Well │  │ ■ Improvements   │  │ ■ Action Items   │           │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤           │
│  │                  │  │                  │  │                  │           │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌──────────────┐ │           │
│  │ │ Great team   │ │  │ │ CI pipeline  │ │  │ │ Technical    │ │           │
│  │ │ communication│ │  │ │ is too slow  │ │  │ │ debt items   │ │           │
│  │ │              │ │  │ │              │ │  │ │              │ │           │
│  │ │  ▲ 3  [+1]   │ │  │ │  ▲ 5  [+1]   │ │  │ │  ▲ 1  [+1]   │ │           │
│  │ └──────────────┘ │  │ └──────────────┘ │  │ └──────────────┘ │           │
│  │                  │  │                  │  │                  │           │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │                  │           │
│  │ │ Shipped on   │ │  │ │ Too many     │ │  │                  │           │
│  │ │ time         │ │  │ │ meetings     │ │  │                  │           │
│  │ │              │ │  │ │              │ │  │                  │           │
│  │ │  ▲ 1  [+1]   │ │  │ │  ▲ 2  [+1]   │ │  │                  │           │
│  │ └──────────────┘ │  │ └──────────────┘ │  │                  │           │
│  │                  │  │                  │  │                  │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  Your votes: ●●○○○  (2 used / 5 total)                              │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Discuss Phase (with Focus)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◄ Team Alpha  /  Sprint 23                          ○○○  ⚙ Settings       │
│                                                                              │
│  Phase: Write  Group  Vote  [DISCUSS]  Action                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─── DISCUSSING ──────────────────────────────────────────────────────┐    │
│  │                                                                      │    │
│  │   ★ CI pipeline is too slow                              ▲ 5 votes  │    │
│  │                                                                      │    │
│  │   Author: Bob  |  Column: Improvements                              │    │
│  │                                                                      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ ■ What Went Well │  │ ■ Improvements   │  │ ■ Action Items   │           │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤           │
│  │ (dimmed cards)   │  │ ╔══════════════╗ │  │ (dimmed cards)   │           │
│  │                  │  │ ║ CI pipeline  ║ │  │                  │           │
│  │                  │  │ ║ is too slow  ║ │  │                  │           │
│  │                  │  │ ║    ▲ 5       ║ │  │                  │           │
│  │                  │  │ ╚══════════════╝ │  │                  │           │
│  │                  │  │                  │  │                  │           │
│  │                  │  │ (other cards     │  │                  │           │
│  │                  │  │  dimmed)         │  │                  │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Board Settings Modal

```
┌──────────────────────────────────────────┐
│  Board Settings                      ✕   │
├──────────────────────────────────────────┤
│                                          │
│  Template: What Went Well / Delta        │
│  Created by: Alice Johnson               │
│  Created: Feb 14, 2026                   │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  Anonymous Mode                          │
│  [  OFF  |  ON  ]                        │
│  Card authors hidden from team members   │
│  ⚠ Can only change during Write phase    │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  Voting Limits                           │
│                                          │
│  Max votes per user: [ 5  ▼ ]            │
│  Max votes per card: [ 3  ▼ ]            │
│  ⚠ Can only change during Write/Group    │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│         [ Cancel ]    [ Save Changes ]   │
│                                          │
└──────────────────────────────────────────┘
```

---

## Component Breakdown

### BoardPage

The root page component. Fetches board data on mount, subscribes to WebSocket events.

| Prop | Type | Source |
|------|------|--------|
| teamId | string | Route param |
| sprintId | string | Route param |

**Responsibilities:**
- Fetch board data via `GET /api/v1/sprints/:sprintId/board`
- Initialize WebSocket connection for board channel
- Render loading/error/empty states
- Provide board context to child components

### BoardHeader

Top bar with navigation, phase controls, and settings.

| Element | Visibility | Behavior |
|---------|------------|----------|
| TeamBreadcrumb | Always | Link back to team dashboard |
| SprintName | Always | Display-only |
| PhaseIndicator | Always | Shows all 5 phases, highlights current |
| PhaseControls | Admin/Facilitator only | Next/Back buttons for phase transitions |
| VoteBudgetIndicator | Vote phase only | Shows "X/Y remaining" |
| BoardSettingsButton | Admin/Facilitator only | Opens settings modal |

### Column

A vertical lane containing cards.

| Prop | Type | Description |
|------|------|-------------|
| column | ColumnData | Column name, color, ID |
| cards | CardData[] | Cards in this column |
| phase | BoardPhase | Current board phase |
| isAnonymous | boolean | Whether anonymous mode is active |

**Behavior by phase:**

| Phase | Column Behavior |
|-------|----------------|
| write | Show AddCardButton at bottom, cards are editable |
| group | Cards are draggable for grouping |
| vote | Vote buttons visible on cards, cards not editable |
| discuss | Focused card highlighted, others dimmed |
| action | Cards read-only, action item creation |

### Card

Individual feedback card within a column.

| Prop | Type | Description |
|------|------|-------------|
| card | CardData | Card content, author, votes |
| isFocused | boolean | Whether this card is the discussion focus |
| isOwnCard | boolean | Whether current user authored this card |
| phase | BoardPhase | Current board phase |

| Element | Visibility | Behavior |
|---------|------------|----------|
| Content | Always | Card text, max 4 lines with expand |
| AuthorName | Not in anonymous mode (or is own card) | Small text below content |
| VoteCount | Always (after write phase) | Number badge |
| VoteButton | Vote phase | "+1" button, disabled if limits reached |
| UnvoteButton | Vote phase, user has votes | "-1" button |
| EditButton | Write/Group phase, own card or admin | Opens inline edit |
| DeleteButton | Write/Group phase, own card or admin | Confirms then deletes |
| GroupBadge | If card is in a group | Small colored tag with group title |
| FocusHighlight | Discuss phase, card is focused | Yellow border + glow |

### VotesBudgetBar

Floating bar at the bottom showing vote budget.

```
Your votes: ●●●○○  (3 used / 5 total)
```

- Visible only during the `vote` phase.
- Dots fill from left as votes are cast.
- Filled dots are colored (blue), empty dots are gray.
- Shows numeric count alongside.

### BoardSettingsModal

Dialog for board configuration.

| Field | Type | Editable When |
|-------|------|---------------|
| Template name | Read-only | Never |
| Created by | Read-only | Never |
| Anonymous mode | Toggle | Write phase only |
| Max votes per user | Number input (1-99) | Write or Group phase |
| Max votes per card | Number input (1-99) | Write or Group phase |

---

## State Matrix

| State | Condition | Display |
|-------|-----------|---------|
| Loading | Board data being fetched | Skeleton layout: 3 column placeholders with shimmer effect |
| Empty Board | Board fetched, no cards in any column | Columns shown with empty state message and prominent "Add a card" CTA |
| Populated | Board with cards | Full board with cards in columns |
| Error (network) | API request failed | Error banner with retry button, previous data preserved if available |
| Error (not found) | 404 from API | "Board not found" message with link back to sprint |
| Error (forbidden) | 403 from API | "You don't have access" message |
| Disconnected | WebSocket connection lost | Yellow banner: "Reconnecting..." with auto-retry |
| Reconnected | WebSocket reconnected after drop | Brief green banner: "Connected", board data refetched |

---

## User Interactions

| # | Interaction | Phase | Result | API Call |
|---|------------|-------|--------|----------|
| 1 | Click "+ Add a card" button | write | Inline form expands below button | — |
| 2 | Type card text and press Enter or click Submit | write | Card appears at bottom of column | POST /boards/:id/cards |
| 3 | Press Escape while typing card | write | Form collapses, text discarded | — |
| 4 | Click card context menu (three dots) | write, group | Dropdown: Edit, Delete | — |
| 5 | Click "Edit" on own card | write, group | Card content becomes editable inline | — |
| 6 | Save edited card (Enter or blur) | write, group | Card content updated | PUT /boards/:id/cards/:cardId |
| 7 | Click "Delete" on own card | write, group | Confirmation dialog, then delete | DELETE /boards/:id/cards/:cardId |
| 8 | Click "+1" vote button on card | vote | Vote count increments, budget bar updates | POST /boards/:id/cards/:cardId/vote |
| 9 | Click "-1" (unvote) button on card | vote | Vote count decrements, budget bar updates | DELETE /boards/:id/cards/:cardId/vote |
| 10 | Click "Next Phase" button | any (facilitator) | Phase advances, UI updates for new phase | PUT /boards/:id/phase |
| 11 | Click "Previous Phase" button | any (facilitator) | Phase goes back | PUT /boards/:id/phase |
| 12 | Drag card onto another card | group | Both cards form a new group with auto-title | POST /boards/:id/groups |
| 13 | Drag card onto existing group | group | Card added to group | PUT /boards/:id/groups/:groupId |
| 14 | Drag card out of group | group | Card removed from group | PUT /boards/:id/groups/:groupId |
| 15 | Click group title to edit | group | Inline text edit for group title | PUT /boards/:id/groups/:groupId |
| 16 | Click "Delete Group" | group | Group dissolved, cards ungrouped | DELETE /boards/:id/groups/:groupId |
| 17 | Click card during discuss phase (facilitator) | discuss | Card becomes focused for everyone | PUT /boards/:id/focus |
| 18 | Click group during discuss phase (facilitator) | discuss | Group becomes focused for everyone | PUT /boards/:id/focus |
| 19 | Click "Clear Focus" | discuss | Focus removed | PUT /boards/:id/focus (null) |
| 20 | Click "Settings" gear icon | any (admin/facilitator) | Settings modal opens | — |
| 21 | Toggle anonymous mode in settings | write | Anonymous mode toggled | PUT /boards/:id |
| 22 | Change vote limit in settings | write, group | Limit updated | PUT /boards/:id |

---

## Data Requirements

### On Page Load

| Data | API | Zustand Store Key |
|------|-----|-------------------|
| Board (with columns, cards, groups, vote counts) | GET /api/v1/sprints/:sprintId/board | `boardStore.board` |
| Current user info | (from auth context) | `authStore.user` |
| Team membership & role | (from auth context / team API) | `authStore.teamRole` |

### Real-Time Updates (WebSocket)

| WS Event | Store Action | UI Effect |
|----------|-------------|-----------|
| card:created | `addCard(card)` | New card appears in column |
| card:updated | `updateCard(card)` | Card content/position refreshes |
| card:deleted | `removeCard(cardId)` | Card fades out and is removed |
| vote:added | `updateVoteCount(cardId, count)` | Vote count badge updates |
| vote:removed | `updateVoteCount(cardId, count)` | Vote count badge updates |
| group:created | `addGroup(group)` | Group panel appears |
| group:updated | `updateGroup(group)` | Group title/members refresh |
| group:deleted | `removeGroup(groupId)` | Group dissolved, cards return to normal |
| phase:changed | `setPhase(phase)` | Phase indicator updates, UI restrictions change |
| focus:changed | `setFocus(itemId, type)` | Focus overlay appears/changes/clears |
| board:updated | `updateBoardSettings(settings)` | Settings reflected, vote bars may change |

---

## Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| Desktop (>= 1024px) | Columns side by side, horizontal scroll if > 4 columns |
| Tablet (768-1023px) | Columns side by side, narrower cards, 2-3 visible columns |
| Mobile (< 768px) | Single column view with tab selector to switch between columns |

---

## Accessibility

| Element | A11y Feature |
|---------|-------------|
| Phase indicator | `role="tablist"`, current phase has `aria-selected="true"` |
| Cards | `role="article"`, content is `aria-label` |
| Vote button | `aria-label="Vote for this card. Current count: N"` |
| Add card form | `aria-label="Add a new card to {column name}"` |
| Focus overlay | `aria-live="polite"` announces focus changes |
| Settings modal | `role="dialog"`, `aria-modal="true"`, focus trap |
| Card delete | Confirmation dialog with `role="alertdialog"` |
| Column | `role="region"`, `aria-label="{column name}"` |
