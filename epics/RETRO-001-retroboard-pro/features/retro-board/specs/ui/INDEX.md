# Retro Board — UI Spec Index

## Pages

| Page | Route | Description | Spec |
|------|-------|-------------|------|
| Board | `/teams/:teamId/sprints/:sprintId/board` | Main retro board view with columns, cards, voting, grouping, and discussion | [board.md](pages/board.md) |
| Board Settings Modal | (overlay on Board page) | Modal for configuring board settings: anonymous mode, vote limits, template info | [board.md](pages/board.md) (section: Board Settings Modal) |

## Supporting Specs

| Spec | Description |
|------|-------------|
| [state.md](state.md) | Zustand store shape, WebSocket sync strategy, optimistic updates |
| [flows.md](flows.md) | Navigation flows, phase transitions, card lifecycle |

## Component Hierarchy

```
BoardPage
├── BoardHeader
│   ├── TeamBreadcrumb
│   ├── SprintName
│   ├── PhaseIndicator
│   ├── PhaseControls (facilitator only)
│   ├── TimerDisplay (future — facilitation feature)
│   ├── PresenceAvatars (future — real-time feature)
│   └── BoardSettingsButton
├── BoardColumns
│   ├── Column (repeated)
│   │   ├── ColumnHeader (name, color, card count)
│   │   ├── CardList
│   │   │   ├── Card (repeated)
│   │   │   │   ├── CardContent
│   │   │   │   ├── CardAuthor (hidden in anonymous mode)
│   │   │   │   ├── VoteButton + VoteCount
│   │   │   │   ├── CardActions (edit, delete — context menu)
│   │   │   │   └── GroupBadge (if card is in a group)
│   │   │   └── AddCardButton (write phase only)
│   │   └── AddCardForm (inline, expandable)
│   └── GroupPanel (shown during group/discuss phases)
│       ├── GroupCard (repeated)
│       │   ├── GroupTitle
│       │   ├── GroupCardList (mini cards)
│       │   ├── GroupVoteTotal
│       │   └── GroupActions
│       └── CreateGroupButton
├── FocusOverlay (discuss phase — highlights focused card/group)
├── BoardSettingsModal (dialog overlay)
│   ├── AnonymousModeToggle
│   ├── VoteLimitInput (max per user)
│   ├── CardLimitInput (max per card)
│   └── TemplateInfo (read-only)
└── VotesBudgetBar (floating — shows remaining votes in vote phase)
```
