# Retro Board — Navigation & Interaction Flows

## 1. Navigation Flow: Dashboard to Board

```
┌─────────────────────┐
│   Team Dashboard     │
│   /teams/:teamId     │
│                      │
│   Sprint list:       │
│   • Sprint 23 (active)──────┐
│   • Sprint 22               │
│   • Sprint 21               │
└─────────────────────┘       │
                               │ Click sprint row
                               ▼
┌─────────────────────────────────────────┐
│   Sprint Detail                          │
│   /teams/:teamId/sprints/:sprintId       │
│                                          │
│   Sprint 23 — Feb 3-14, 2026            │
│                                          │
│   ┌──────────┐  ┌──────────┐            │
│   │ Open      │  │ Action   │            │
│   │ Retro     │──┤ Items    │            │
│   │ Board     │  │          │            │
│   └──────────┘  └──────────┘            │
└───────┬─────────────────────────────────┘
        │ Click "Open Retro Board"
        │
        ▼
┌─────────────────────────────────────────┐
│   Board exists?                          │
│                                          │
│   YES ──► Load board page               │
│                                          │
│   NO  ──► Show "Create Board" prompt    │
│           User picks a template          │
│           POST /sprints/:id/board        │
│           ──► Load new board page        │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│   Board Page                             │
│   /teams/:teamId/sprints/:sprintId/board │
│                                          │
│   Breadcrumb: Team Alpha > Sprint 23     │
│   [Back arrow] returns to Sprint Detail  │
└─────────────────────────────────────────┘
```

### URL Structure

| Page | Route | Description |
|------|-------|-------------|
| Team Dashboard | `/teams/:teamId` | Lists sprints for the team |
| Sprint Detail | `/teams/:teamId/sprints/:sprintId` | Sprint overview with link to board |
| Board Page | `/teams/:teamId/sprints/:sprintId/board` | The retro board |

### Breadcrumb Trail

```
Team Alpha  >  Sprint 23  >  Retro Board
   │               │
   │               └── Link to /teams/:teamId/sprints/:sprintId
   └── Link to /teams/:teamId
```

---

## 2. Board Phases Flow

The facilitator guides the team through phases. Each phase has distinct allowed actions.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌──────────┐
│   │  WRITE  │────►│  GROUP  │────►│  VOTE   │────►│ DISCUSS │────►│  ACTION  │
│   │         │◄────│         │◄────│         │◄────│         │◄────│          │
│   └─────────┘     └─────────┘     └─────────┘     └─────────┘     └──────────┘
│                                                                          │
│   Allowed        Allowed          Allowed         Allowed           Allowed    │
│   transitions:   transitions:     transitions:    transitions:      transitions:│
│   ► group        ► vote           ► discuss       ► action          ► discuss   │
│                  ◄ write          ◄ group         ◄ vote                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Phase Transition Detail

| # | Transition | Trigger | Side Effects | UI Changes |
|---|-----------|---------|--------------|------------|
| 1 | write -> group | Facilitator clicks "Next: Group" | None | Cards become non-editable; add card buttons hidden; drag-to-group enabled |
| 2 | group -> write | Facilitator clicks "Back: Write" | None | Cards become editable again; add card buttons appear; drag disabled |
| 3 | group -> vote | Facilitator clicks "Next: Vote" | None | Group creation disabled; vote buttons appear on cards; vote budget bar appears |
| 4 | vote -> group | Facilitator clicks "Back: Group" | None | Vote buttons hidden; drag-to-group re-enabled; votes preserved |
| 5 | vote -> discuss | Facilitator clicks "Next: Discuss" | None | Vote buttons hidden; focus mode enabled; cards sorted by vote count |
| 6 | discuss -> vote | Facilitator clicks "Back: Vote" | Focus cleared | Vote buttons reappear; focus overlay removed |
| 7 | discuss -> action | Facilitator clicks "Next: Action" | Focus cleared | Action item creation enabled on cards |
| 8 | action -> discuss | Facilitator clicks "Back: Discuss" | None | Focus mode re-enabled; action item creation paused |

### Phase Indicator UI

```
Write Phase:    [WRITE]   Group    Vote    Discuss   Action
Group Phase:     Write   [GROUP]   Vote    Discuss   Action
Vote Phase:      Write    Group   [VOTE]   Discuss   Action
Discuss Phase:   Write    Group    Vote   [DISCUSS]  Action
Action Phase:    Write    Group    Vote    Discuss  [ACTION]
```

- Current phase is highlighted (filled background, bold text).
- Completed phases have a checkmark icon.
- Future phases are dimmed.
- Clicking a phase label does NOT change the phase (only the facilitator's Next/Back buttons do).

---

## 3. Card Lifecycle Flow

```
┌──────────────┐
│  User types  │
│  card text   │
│  + column_id │
└──────┬───────┘
       │
       ▼ (write phase only)
┌──────────────────────────┐
│ POST /boards/:id/cards   │
│                          │
│ Optimistic: card appears │
│ in column immediately    │
│ with temp ID             │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Card CREATED             │
│                          │
│ Server assigns real ID   │
│ WS broadcasts to others  │
│ Temp ID replaced         │
└──────────┬───────────────┘
           │
     ┌─────┴──────────────────────────────┐
     │                                     │
     ▼                                     ▼
┌──────────────┐                 ┌──────────────────┐
│ EDIT CARD    │                 │ CARD GROUPED     │
│ (write/group │                 │ (group phase)    │
│  phase)      │                 │                  │
│              │                 │ Dragged into     │
│ PUT .../cards│                 │ a group cluster  │
│ /:cardId     │                 └────────┬─────────┘
└──────┬───────┘                          │
       │                                  ▼
       ▼                        ┌──────────────────┐
┌──────────────┐               │ CARD VOTED ON    │
│ Card UPDATED │               │ (vote phase)     │
│              │               │                  │
│ Content or   │               │ Users click +1   │
│ column_id    │               │ POST .../vote    │
│ changed      │               └────────┬─────────┘
└──────────────┘                        │
       │                                ▼
       │                      ┌──────────────────┐
       │                      │ CARD DISCUSSED   │
       │                      │ (discuss phase)  │
       │                      │                  │
       │                      │ Facilitator sets │
       │                      │ focus on card    │
       │                      └────────┬─────────┘
       │                               │
       │                               ▼
       │                      ┌──────────────────┐
       │                      │ ACTION CREATED   │
       │                      │ (action phase)   │
       │                      │                  │
       │                      │ Card becomes     │
       │                      │ basis for an     │
       │                      │ action item      │
       │                      └──────────────────┘
       │
       ▼
┌──────────────┐
│ DELETE CARD  │
│ (write/group │
│  phase)      │
│              │
│ DELETE .../  │
│ cards/:cardId│
│              │
│ Side effects:│
│ • Votes      │
│   removed    │
│ • Group      │
│   membership │
│   removed    │
│ • User vote  │
│   budget     │
│   recalculated│
└──────────────┘
```

### Card State Transitions

| State | Description | Allowed Actions |
|-------|-------------|-----------------|
| Draft | User is typing in the add-card form | Submit (create), Cancel (discard) |
| Created | Card exists on board | Edit, Delete (write/group phase) |
| Grouped | Card is a member of a group | View group badge, can be ungrouped |
| Voted | Card has received votes | View vote count |
| Focused | Card is the current discussion focus | Highlighted with overlay |
| Actioned | An action item was created from this card | Action item link visible |

---

## 4. Board Creation Flow

```
┌─────────────────────────┐
│ Sprint Detail page       │
│                          │
│ "No retro board yet"    │
│                          │
│ [Create Retro Board]     │
└──────────┬───────────────┘
           │ Click
           ▼
┌─────────────────────────────────────┐
│ Template Picker Modal               │
│                                      │
│ Choose a template for your retro:   │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ ★ What Went Well / Delta       │ │
│ │   Two columns: positives and   │ │
│ │   changes needed               │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │   Start / Stop / Continue      │ │
│ │   Three columns for actionable │ │
│ │   feedback                     │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │   4Ls (Liked/Learned/Lacked/   │ │
│ │   Longed For)                  │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │   Mad / Sad / Glad             │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │   Sailboat                     │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │   Starfish                     │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │   + Custom templates...        │ │
│ └─────────────────────────────────┘ │
│                                      │
│        [Cancel]   [Create Board]    │
└──────────────┬──────────────────────┘
               │ Select template + click Create
               ▼
┌──────────────────────────────────────┐
│ POST /api/v1/sprints/:sprintId/board │
│ { template_id: "..." }              │
└──────────────┬───────────────────────┘
               │ 201 Created
               ▼
┌──────────────────────────────────────┐
│ Navigate to Board Page               │
│ /teams/:teamId/sprints/:sprintId/board│
│                                      │
│ Board loads in WRITE phase           │
│ with columns from template           │
└──────────────────────────────────────┘
```

---

## 5. Voting Flow

```
┌─────────────────────────────────────────────────────────┐
│ Vote Phase Active                                        │
│                                                          │
│ User sees cards with vote buttons and budget bar         │
│ Budget: ●○○○○ (0/5 used)                                │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │ User clicks +1 on     │
               │ Card "CI is slow"     │
               └───────────┬───────────┘
                           │
                     ┌─────┴─────┐
                     │ Check     │
                     │ limits    │
                     └─────┬─────┘
                     ┌─────┴─────────────────────┐
                     │                            │
                     ▼                            ▼
           ┌──────────────────┐       ┌───────────────────┐
           │ Within limits    │       │ Limit reached     │
           │                  │       │                   │
           │ Optimistic:      │       │ Toast: "You've    │
           │ • Count 0 → 1   │       │ used all your     │
           │ • Budget ●●○○○  │       │ votes!" or "Max   │
           │                  │       │ votes on this     │
           │ POST .../vote    │       │ card reached"     │
           └────────┬─────────┘       │                   │
                    │                 │ Button disabled    │
              ┌─────┴─────┐          └───────────────────┘
              ▼           ▼
        API Success   API Error
              │           │
              ▼           ▼
        Confirm       Rollback:
        optimistic    Count 1 → 0
        update        Budget ●○○○○
                      Toast: error msg
```

### Unvote Flow

```
User clicks "-1" on card they voted on
       │
       ▼
Optimistic: decrement counts
       │
       ▼
DELETE .../vote
       │
  ┌────┴────┐
  ▼         ▼
Success   Error → rollback
```

---

## 6. Grouping Flow

```
┌────────────────────────────────────────────────────────┐
│ Group Phase Active                                      │
│                                                         │
│ Facilitator sees cards as draggable                     │
└───────────────────────┬────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ Drag card A  │ │ Click "New   │ │ Click group      │
│ onto card B  │ │ Group" button│ │ title to rename  │
│              │ │              │ │                  │
│ Creates new  │ │ Empty group  │ │ Inline edit      │
│ group with   │ │ created with │ │ PUT .../groups/  │
│ both cards   │ │ title prompt │ │ :id              │
│              │ │              │ │                  │
│ POST .../    │ │ POST .../    │ └──────────────────┘
│ groups       │ │ groups       │
│ {cardIds:    │ │ {title: ""}  │
│  [A, B]}     │ │              │
└──────────────┘ └──────────────┘

┌──────────────────┐ ┌──────────────────┐
│ Drag card into   │ │ Drag card out    │
│ existing group   │ │ of group         │
│                  │ │                  │
│ PUT .../groups/  │ │ PUT .../groups/  │
│ :id              │ │ :id              │
│ {add_card_ids:   │ │ {remove_card_ids:│
│  [cardId]}       │ │  [cardId]}       │
└──────────────────┘ └──────────────────┘

┌──────────────────┐
│ Delete group     │
│                  │
│ Cards return to  │
│ their columns    │
│ (ungrouped)      │
│                  │
│ DELETE .../      │
│ groups/:id       │
└──────────────────┘
```

---

## 7. Discussion Focus Flow

```
┌────────────────────────────────────────────────────────┐
│ Discuss Phase Active                                    │
│                                                         │
│ Facilitator can click cards/groups to set focus         │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────┐
         │ Facilitator clicks       │
         │ on a card or group       │
         └─────────────┬────────────┘
                       │
                       ▼
         ┌──────────────────────────┐
         │ PUT /boards/:id/focus    │
         │ {                        │
         │   focus_item_id: "...",  │
         │   focus_item_type: "card"│
         │ }                        │
         └─────────────┬────────────┘
                       │
                       ▼
         ┌──────────────────────────┐
         │ WS: focus:changed        │
         │                          │
         │ ALL clients:             │
         │ • Selected item gets     │
         │   highlighted border     │
         │ • Focus panel appears    │
         │   at top with card       │
         │   details                │
         │ • Other cards dimmed     │
         │   (opacity 0.5)          │
         └─────────────┬────────────┘
                       │
                       ▼
         ┌──────────────────────────┐
         │ Team discusses the       │
         │ focused item             │
         │                          │
         │ Facilitator can:         │
         │ • Click another item     │
         │   (changes focus)        │
         │ • Click "Clear Focus"    │
         │   (removes focus)        │
         │ • Click "Next Phase"     │
         │   (advances to action)   │
         └──────────────────────────┘
```

---

## 8. Error Handling Flows

### Network Error During Card Creation

```
User submits card → Optimistic insert → API fails (network)
       │
       ▼
┌─────────────────────────────────────┐
│ Card removed (rollback optimistic)  │
│ Toast: "Failed to add card. Retry?" │
│ Card text preserved in form         │
└─────────────────────────────────────┘
```

### Vote Limit Exceeded (Race Condition)

```
User clicks +1 → Optimistic increment → API returns 422 VOTE_LIMIT_REACHED
       │
       ▼
┌─────────────────────────────────────┐
│ Vote count rolled back              │
│ Budget bar rolled back              │
│ Toast: "Vote limit reached"         │
│ +1 button disabled                  │
└─────────────────────────────────────┘
```

### Phase Changed by Facilitator Mid-Action

```
User typing card → Facilitator advances to group phase → WS: phase:changed
       │
       ▼
┌─────────────────────────────────────┐
│ Add card form disabled              │
│ Toast: "Phase changed to Group.     │
│ Card creation is no longer allowed."│
│ Unsaved text discarded              │
└─────────────────────────────────────┘
```

### WebSocket Disconnect

```
WS drops → Yellow banner "Reconnecting..."
       │
       ▼
Auto-retry (exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s)
       │
  ┌────┴────┐
  ▼         ▼
Reconnected  Failed 5 times
  │              │
  ▼              ▼
Green banner  Red banner:
"Connected"   "Connection lost.
Refetch all   [Retry]"
board data
```
