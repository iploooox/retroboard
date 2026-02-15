---
phase: 3
name: "Collaboration"
status: in-progress
changed: 2026-02-15 — Phase 3 implementation started
stories: ["S-013", "S-014", "S-015", "S-016", "S-017"]
estimated_duration: "3-4 weeks"
---

# Phase 3: Collaboration -- WebSocket Server, Real-Time Sync, Facilitation Tools, Timer

## Overview

Phase 3 transforms RetroBoard Pro from a multi-user CRUD application into a real-time collaborative experience. This phase introduces WebSocket connectivity for live card synchronization, presence tracking with live cursors, structured facilitation phases, a countdown timer, and facilitator controls for managing the retro session. At the end of this phase, teams can run a complete, facilitated real-time retrospective.

## Stories Included

| Story | Title | Priority |
|-------|-------|----------|
| S-013 | Real-Time Card Sync via WebSocket | Critical |
| S-014 | Live Cursors & Presence Indicators | Medium |
| S-015 | Facilitation Phases (Write, Group, Vote, Discuss, Action) | Critical |
| S-016 | Built-In Countdown Timer per Phase | High |
| S-017 | Facilitator Controls (Lock Board, Reveal Cards, Next Phase) | High |

## Dependencies

- Phase 2 completed (boards, cards, votes, groups, action items)
- S-013 depends on S-008 (cards), S-010 (votes), S-011 (groups)
- S-014 depends on S-013 (WebSocket infrastructure)
- S-015 depends on S-007 (boards) and S-013 (WebSocket)
- S-016 depends on S-015 (phases)
- S-017 depends on S-015 and S-016

## Tasks

### 1. WebSocket Server Setup (S-013)

- [ ] **BE**: Set up WebSocket server (ws library) integrated with Hono HTTP server on upgrade path
- [ ] **BE**: Implement WebSocket authentication middleware (validate JWT from query param or first message)
- [ ] **BE**: Define WebSocket message protocol schema (JSON: { type, payload, timestamp, senderId })
- [ ] **BE**: Implement room/channel manager:
  - `joinRoom(boardId, userId, ws)` -- add connection to board room
  - `leaveRoom(boardId, userId)` -- remove connection from board room
  - `broadcastToRoom(boardId, event, excludeUserId?)` -- send event to all room members
  - `getRoomMembers(boardId)` -- list connected user IDs
- [ ] **BE**: Set up PostgreSQL LISTEN/NOTIFY infrastructure:
  - Create trigger functions for cards, votes, card_groups tables
  - Triggers fire NOTIFY with channel name and payload JSON (operation, table, row_id, data)
  - PG listener process in Node.js that subscribes to channels
- [ ] **BE**: Create event dispatcher service:
  - Listen to PG NOTIFY events
  - Map database events to WebSocket event types (INSERT on cards -> `card:created`)
  - Broadcast mapped events to appropriate board rooms
- [ ] **BE**: Define all WebSocket event types:
  - `card:created`, `card:updated`, `card:deleted`, `card:moved`
  - `vote:added`, `vote:removed`
  - `group:created`, `group:updated`, `group:dissolved`, `card:grouped`, `card:ungrouped`
  - `board:settings_updated`, `board:status_changed`
  - `action_item:created`, `action_item:updated`, `action_item:status_changed`
- [ ] **BE**: Implement connection heartbeat (ping/pong every 30 seconds, disconnect stale after 60s)
- [ ] **BE**: Implement graceful shutdown (close all connections, unsubscribe PG listeners)
- [ ] **BE**: Create board state reconciliation endpoint `GET /api/v1/boards/:boardId/state` (full snapshot)
- [ ] **BE**: Write unit tests for room manager and event dispatcher
- [ ] **BE**: Write integration tests for WebSocket connection and event flow
- [ ] **FE**: Create WebSocket client service class:
  - `connect(boardId, token)` -- establish authenticated connection
  - `disconnect()` -- clean close
  - `on(eventType, handler)` -- register event handler
  - `off(eventType, handler)` -- unregister event handler
  - `send(eventType, payload)` -- send message to server
- [ ] **FE**: Implement automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- [ ] **FE**: Implement event handler registry (type -> handler[] map)
- [ ] **FE**: Integrate real-time card events into board state management:
  - `card:created` -> add card to column
  - `card:updated` -> update card content
  - `card:deleted` -> remove card from column
  - `card:moved` -> move card between columns/positions
- [ ] **FE**: Integrate real-time vote events (update vote counts on cards)
- [ ] **FE**: Integrate real-time group events (create/update/dissolve groups, reassign cards)
- [ ] **FE**: Integrate real-time action item events
- [ ] **FE**: Implement state reconciliation on reconnect (fetch full board state, merge with local state)
- [ ] **FE**: Add connection status indicator in board header (green dot = connected, yellow = reconnecting, red = disconnected)
- [ ] **FE**: Create `useBoardSync` hook that provides real-time board state to components
- [ ] **FE**: Handle duplicate event detection (idempotency via event IDs or timestamps)

### 2. Presence & Live Cursors (S-014)

- [ ] **BE**: Implement presence tracking service (in-memory Map: boardId -> Map<userId, { status, lastCursorAt, connectedAt }>)
- [ ] **BE**: Handle `presence:join` event on WebSocket connection (add to presence map, broadcast to room)
- [ ] **BE**: Handle `presence:leave` event on WebSocket disconnect (remove from map, broadcast to room)
- [ ] **BE**: Handle `cursor:move` event (relay cursor position to all other room members)
- [ ] **BE**: Implement server-side cursor event throttling (max 20 events/second per user)
- [ ] **BE**: Implement idle detection (mark user idle if no cursor events for 2 minutes)
- [ ] **BE**: Broadcast updated presence list when status changes (join, leave, idle, active)
- [ ] **BE**: Send current presence list to newly joined participants
- [ ] **BE**: Implement 10-second grace period on disconnect before removing presence (allow reconnect)
- [ ] **BE**: Write unit tests for presence tracking service
- [ ] **FE**: Create participants bar component (horizontal list of avatars with status dots)
- [ ] **FE**: Implement status indicators (green = online, yellow = idle, gray = offline/disconnected)
- [ ] **FE**: Track local mouse position and send throttled cursor updates (requestAnimationFrame, max 20/s)
- [ ] **FE**: Render remote cursors as colored SVG pointers with name labels below
- [ ] **FE**: Assign consistent colors to users based on userId hash (palette of 12 distinct colors)
- [ ] **FE**: Implement smooth cursor interpolation using CSS transitions or requestAnimationFrame
- [ ] **FE**: Implement cursor fade-out animation on user disconnect (opacity 1 -> 0 over 3 seconds)
- [ ] **FE**: Implement client-side idle detection (track mousemove/keydown, mark idle after 2 min)
- [ ] **FE**: Create `usePresence` hook exposing: participants[], localCursorEnabled, toggleCursor
- [ ] **FE**: Add participant count badge in board header
- [ ] **FE**: Add option to disable cursor sharing in user preferences (privacy)

### 3. Facilitation Phases (S-015)

- [ ] **BE**: Add `current_phase` nullable ENUM column to boards table (migration): 'write', 'group', 'vote', 'discuss', 'action'
- [ ] **BE**: Define phase restrictions matrix:
  - write: cards create/edit YES, vote NO, group NO
  - group: cards create NO, edit NO, group YES, vote NO
  - vote: cards create NO, edit NO, group NO, vote YES
  - discuss: all modifications NO (read-only with discussion features)
  - action: action items create/edit YES, cards NO, votes NO
  - null (unstructured): all operations YES
- [ ] **BE**: Create phase validation middleware:
  - Extract current_phase from board
  - Check if requested operation is allowed in current phase
  - Return 403 with phase restriction message if disallowed
- [ ] **BE**: Apply phase middleware to card, vote, group, and action item endpoints
- [ ] **BE**: Create `PATCH /api/v1/boards/:boardId/phase` endpoint:
  - Accept { phase: string } body
  - Validate: only facilitator can change phase
  - Validate: phase is a valid enum value
  - Update board.current_phase
  - Broadcast `board:phase_changed` via WebSocket
- [ ] **BE**: Write unit tests for phase restrictions matrix (every operation x every phase)
- [ ] **BE**: Write integration tests for phase-gated operations
- [ ] **FE**: Create phase indicator bar component:
  - Horizontal bar with 5 phase circles/steps
  - Current phase highlighted, completed phases checked
  - Phase names displayed below each step
- [ ] **FE**: Add "Next Phase" and "Previous Phase" buttons (facilitator only)
- [ ] **FE**: Implement phase transition confirmation dialog ("Advance to Vote phase?")
- [ ] **FE**: Implement phase-based UI control visibility:
  - Hide "Add Card" button when not in write phase
  - Hide vote buttons when not in vote phase
  - Hide group actions when not in group phase
  - Show action item panel when in action phase
- [ ] **FE**: Show phase-specific instructions banner ("Time to write! Add your cards anonymously")
- [ ] **FE**: Handle real-time `board:phase_changed` event (update phase bar, show/hide controls, show notification)
- [ ] **FE**: Create `useBoardPhase` hook (currentPhase, canCreateCard, canVote, canGroup, canCreateAction, isUnstructured)

### 4. Countdown Timer (S-016)

- [ ] **BE**: Implement timer service (in-memory per board):
  - State: { boardId, startedAt, durationMs, pausedAt, remainingOnPauseMs, status: 'running'|'paused'|'stopped' }
  - Methods: start(boardId, durationMs), pause(boardId), resume(boardId), reset(boardId), extend(boardId, additionalMs)
  - Timer expiration: use setTimeout, fire `timer:expired` event
- [ ] **BE**: Create WebSocket handlers for timer control (facilitator only):
  - `timer:start` -> start timer, broadcast `timer:started` with { startedAt, durationMs }
  - `timer:pause` -> pause timer, broadcast `timer:paused` with { remainingMs }
  - `timer:resume` -> resume timer, broadcast `timer:resumed` with { startedAt, durationMs }
  - `timer:reset` -> reset timer, broadcast `timer:reset`
  - `timer:extend` -> extend timer, broadcast `timer:extended` with { additionalMs, newDurationMs }
- [ ] **BE**: Broadcast `timer:expired` when timer reaches zero
- [ ] **BE**: Send current timer state to newly connected participants
- [ ] **BE**: Add default timer durations per phase to board settings JSONB
- [ ] **BE**: Handle timer cleanup on board close/complete
- [ ] **BE**: Write unit tests for timer service (start, pause, resume, extend, expire)
- [ ] **FE**: Create timer display component:
  - Large minutes:seconds display
  - Circular progress ring (optional, visually appealing)
  - Color changes: green (>50%), yellow (20-50%), red (<20%)
- [ ] **FE**: Create timer control panel for facilitator:
  - Duration picker: preset buttons (3m, 5m, 10m, 15m) + custom input
  - Start, Pause, Resume, Reset buttons (context-dependent visibility)
  - Extend buttons: +1m, +2m, +5m (visible when timer is running)
- [ ] **FE**: Calculate remaining time client-side from server's startedAt + durationMs
- [ ] **FE**: Implement timer reconciliation on reconnect (fetch current timer state)
- [ ] **FE**: Implement timer expiration notification:
  - Play alarm sound (using Web Audio API)
  - Visual flash/pulse animation on timer component
  - Show toast notification "Time's up!"
- [ ] **FE**: Add timer sound mute toggle in user preferences
- [ ] **FE**: Handle all real-time timer events and update display
- [ ] **FE**: Create `useTimer` hook (remainingMs, status, isExpired, controls for facilitator)

### 5. Facilitator Controls (S-017)

- [ ] **BE**: Add `is_locked` and `cards_revealed` to board settings JSONB
- [ ] **BE**: Create `POST /api/v1/boards/:boardId/lock` endpoint (toggle board lock, facilitator only)
- [ ] **BE**: Create `POST /api/v1/boards/:boardId/reveal` endpoint (reveal all cards, facilitator only)
- [ ] **BE**: Enforce board lock in all card/vote/group mutation middlewares (check settings.is_locked)
- [ ] **BE**: Implement card hiding during write phase:
  - When cards_revealed = false, API returns only requesting user's cards + counts of hidden cards per column
  - On reveal, return all cards
- [ ] **BE**: Implement spotlight WebSocket event:
  - `spotlight:set` (facilitator sends cardId)
  - `spotlight:clear` (facilitator clears)
  - Broadcast to all room members
- [ ] **BE**: Write unit tests for board lock enforcement and card hiding
- [ ] **BE**: Write integration tests for facilitator control endpoints
- [ ] **FE**: Create floating facilitator toolbar component (fixed to bottom center of board):
  - Lock/Unlock button with padlock icon
  - Reveal Cards button (eye icon) -- only visible in write phase with hidden cards
  - Next Phase button
  - Timer controls (compact)
  - Spotlight toggle
- [ ] **FE**: Show "Board Locked" overlay banner when board is locked
- [ ] **FE**: Disable all mutation controls (add card, edit, delete, vote, group) when locked
- [ ] **FE**: Implement card reveal animation (CSS flip or fade-in with stagger delay)
- [ ] **FE**: During write phase with cards hidden: show own cards + "X cards from others" placeholders per column
- [ ] **FE**: Implement card spotlight:
  - Facilitator clicks "Spotlight" on a card context menu
  - Spotlighted card gets visual emphasis (border glow, scale up slightly)
  - Other cards are dimmed (reduced opacity)
  - Clear spotlight returns to normal view
- [ ] **FE**: Handle real-time facilitator control events (lock/unlock, reveal, spotlight)
- [ ] **FE**: Add keyboard shortcuts for facilitator: L (lock), R (reveal), N (next phase), T (timer start/pause)
- [ ] **FE**: Hide facilitator toolbar from non-facilitator users

## Exit Criteria

- [ ] WebSocket connections are authenticated and stable with automatic reconnection
- [ ] All card, vote, group, and action item changes sync in real-time (<200ms latency)
- [ ] Presence tracking shows online participants with live cursors
- [ ] Facilitation phases restrict operations correctly and transitions are smooth
- [ ] Timer is synchronized across all participants with start/pause/resume/extend/expire
- [ ] Facilitator can lock/unlock board, reveal hidden cards, and spotlight cards
- [ ] All real-time features degrade gracefully on connection loss (reconnect + reconcile)
- [ ] Integration tests cover WebSocket event flows
- [ ] Board UI feels responsive and collaborative

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WebSocket scaling with many concurrent boards | Room-based isolation; consider Redis pub/sub for multi-instance |
| Cursor event bandwidth | Aggressive throttling (20/s), compression, skip if position unchanged |
| Timer clock drift between server and client | Server is source of truth; client calculates from startedAt; periodic reconciliation |
| PG LISTEN/NOTIFY reliability | Add fallback polling mechanism; reconnect listener on PG connection loss |
| Phase transition race conditions | Server-side locking on phase transitions; reject concurrent transitions |
