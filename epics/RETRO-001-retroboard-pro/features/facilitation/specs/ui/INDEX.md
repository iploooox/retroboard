# Facilitation UI Specification Index

**Feature:** facilitation
**Phase:** 3
**Depends on:** retro-board, real-time
**Stories:** S-015, S-016, S-017

---

## Overview

The facilitation UI provides the facilitator (and team admins) with tools to guide the team through a structured retrospective ceremony. The primary surface is the **Facilitator Toolbar** -- a floating control panel at the bottom of the board page that is only visible to users with the facilitator or admin role.

Facilitation is not a separate page. All facilitation UI is overlaid onto the retro board page (`/boards/:boardId`). The facilitator sees the same board as other participants, plus the toolbar and enhanced click targets for focus control.

---

## Components

| Component | Spec | Description |
|-----------|------|-------------|
| Facilitator Toolbar | [facilitator-toolbar.md](pages/facilitator-toolbar.md) | Floating bottom toolbar with phase, timer, and board controls |

---

## Facilitator vs. Non-Facilitator Experience

The board page renders differently based on the user's role. Here is a comparison of what each role sees.

| Feature | Facilitator / Admin | Regular Member |
|---------|-------------------|----------------|
| Facilitator Toolbar | Visible (fixed bottom) | Hidden |
| Phase indicator in header | Interactive (clickable) | Display-only |
| Timer in header | Display-only (controlled via toolbar) | Display-only |
| Cards during Discuss phase | Clickable to set focus | Not clickable for focus |
| "Lock Board" effect | Can toggle | Sees locked state (inputs disabled) |
| "Reveal Anonymous" effect | Can toggle | Sees revealed names if toggled |
| Phase change notifications | Receives confirmation prompt | Receives notification toast |

---

## Phase Transition Flow

When the facilitator clicks a phase transition button, the following occurs:

```
Facilitator clicks "Next Phase" or specific phase button
       |
       v
Confirmation dialog: "Move to {phase}? This will change the board for all participants."
       |
       +-- Cancel -> No action
       |
       +-- Confirm -> PUT /api/v1/boards/:boardId/phase { phase: "{next}" }
                          |
                          v
                    Server validates transition
                          |
                          +-- Success -> WebSocket broadcasts phase:changed to all clients
                          |              All clients update UI for new phase
                          |
                          +-- Failure -> Show error toast to facilitator
```

---

## Timer Architecture

The timer is managed by the facilitator but displayed to all participants.

| Aspect | Detail |
|--------|--------|
| Duration input | Facilitator sets timer duration (1-60 minutes, default 5) |
| Start | Facilitator clicks play. Server records start time. WS broadcasts `timer:sync`. |
| Display | All clients compute remaining time from `startedAt + duration - now`. |
| Pause | Facilitator pauses. Server records elapsed. WS broadcasts `timer:sync` with `status: paused`. |
| Resume | Facilitator resumes. Server records new start. WS broadcasts. |
| Reset | Facilitator resets. Server clears timer. WS broadcasts `timer:sync` with `status: idle`. |
| Expiry | Client detects timer reached zero. Plays optional audio alert. Shows visual notification. |
| Sync | On WS reconnect, client re-syncs timer state from server. |

Timer state is server-authoritative. Clients compute the countdown locally between sync messages to avoid jitter, but re-sync on every `timer:sync` event.

---

## Real-Time Events (Facilitation-Specific)

| Event | Direction | Payload | Effect |
|-------|-----------|---------|--------|
| `phase:changed` | Server -> All Clients | `{ phase }` | UI updates to new phase restrictions |
| `timer:sync` | Server -> All Clients | `{ seconds, status, startedAt? }` | Timer display updates |
| `timer:expired` | Server -> All Clients | `{}` | Alert notification |
| `focus:changed` | Server -> All Clients | `{ focusItemId, focusItemType }` | Focused item highlighted, others dimmed |
| `board:updated` | Server -> All Clients | `{ is_locked, anonymous_mode }` | Board settings reflected |

---

## Accessibility Considerations

| Element | Requirement |
|---------|-------------|
| Toolbar visibility | Only rendered in DOM for facilitators (not just hidden via CSS) |
| Phase buttons | `role="radiogroup"`, each button `role="radio"`, `aria-checked` |
| Timer controls | `aria-label` on play/pause/reset buttons |
| Timer display | `aria-live="polite"` for time changes, `role="timer"` |
| Lock toggle | `role="switch"`, `aria-checked`, `aria-label="Lock board"` |
| Anonymous toggle | `role="switch"`, `aria-checked`, `aria-label="Reveal anonymous cards"` |
| Focus mode | Screen reader announces "Now discussing: {item title}" via `aria-live` |
| Phase change notification | Non-facilitators receive `aria-live="assertive"` announcement |

---

## Keyboard Shortcuts (Facilitator-Only)

| Shortcut | Action |
|----------|--------|
| `Right Arrow` | Advance to next phase (with confirmation) |
| `Left Arrow` | Go back to previous phase (with confirmation) |
| `Space` | Start/pause timer |
| `Shift+R` | Reset timer |
| `L` | Toggle board lock |
| `F` | Toggle focus on currently selected card/group (Discuss phase) |
