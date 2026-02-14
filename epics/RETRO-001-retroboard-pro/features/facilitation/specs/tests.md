# Facilitation Feature Test Plan

## Test Framework

- **Unit tests**: Vitest
- **Integration tests**: Vitest + Supertest (HTTP) + `ws` client (WebSocket)
- **Database**: Test PostgreSQL database, reset between test suites

---

## Unit Tests

### FacilitationService

#### Phase Management

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Set valid phase | `setPhase(boardId, "group", facilitatorId)` | Phase updated, returns new phase |
| 2 | Set same phase (idempotent) | `setPhase(boardId, "write")` when already `write` | No error, returns current phase |
| 3 | Set invalid phase value | `setPhase(boardId, "invalid")` | Throws INVALID_PHASE error |
| 4 | Set phase stops running timer | Timer running, `setPhase(boardId, "group")` | Timer stopped with reason `phase_change` |
| 5 | Set phase when no timer running | No timer, `setPhase(boardId, "vote")` | Phase changed, no timer side effect |
| 6 | Board not found | `setPhase("nonexistent", "group")` | Throws NOT_FOUND error |
| 7 | Skip phases forward allowed | Phase is `write`, set to `vote` | Phase updated to `vote` |
| 8 | Go backward allowed | Phase is `discuss`, set to `write` | Phase updated to `write` |

#### Lock Management

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Lock board | `setLock(boardId, true, userId)` | is_locked set to true |
| 2 | Unlock board | `setLock(boardId, false, userId)` | is_locked set to false |
| 3 | Lock already locked board | Lock when is_locked=true | Idempotent, no error |
| 4 | Unlock already unlocked board | Unlock when is_locked=false | Idempotent, no error |

#### Card Reveal

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Reveal cards on anonymous board | `revealCards(boardId, userId)` | cards_revealed set to true |
| 2 | Reveal on non-anonymous board | Board where is_anonymous=false | Throws NOT_ANONYMOUS error |
| 3 | Reveal already revealed | cards_revealed already true | Throws ALREADY_REVEALED error |
| 4 | Reveal returns card-author mapping | Multiple anonymous cards | Returns array of {cardId, authorId, authorName} |

#### Discussion Focus

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Set focus on card | `setFocus(boardId, "card", cardId)` | focus_type and focus_id updated |
| 2 | Set focus on group | `setFocus(boardId, "group", groupId)` | focus_type and focus_id updated |
| 3 | Clear focus | `setFocus(boardId, null, null)` | focus_type and focus_id set to null |
| 4 | Focus on non-existent card | Invalid cardId | Throws FOCUS_TARGET_NOT_FOUND error |
| 5 | Focus on card from different board | Card belongs to another board | Throws FOCUS_TARGET_NOT_FOUND error |
| 6 | Change focus from one card to another | Already focused on card-1, focus on card-2 | Updated to card-2 |

### TimerService

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Start timer | `start(boardId, "write", 300, userId)` | Timer created, interval started |
| 2 | Start with min duration | `start(boardId, "write", 1, userId)` | Timer created with 1 second |
| 3 | Start with max duration | `start(boardId, "write", 3600, userId)` | Timer created with 3600 seconds |
| 4 | Start with 0 duration | `start(boardId, "write", 0, userId)` | Throws INVALID_DURATION error |
| 5 | Start with negative duration | `start(boardId, "write", -1, userId)` | Throws INVALID_DURATION error |
| 6 | Start with duration > 3600 | `start(boardId, "write", 3601, userId)` | Throws INVALID_DURATION error |
| 7 | Start when timer already running | Timer exists for board | Throws TIMER_CONFLICT error |
| 8 | Pause running timer | Timer running with 187s left | paused_at set, remaining_seconds = 187 |
| 9 | Pause when no timer running | No timer for board | Throws TIMER_NOT_RUNNING error |
| 10 | Pause already paused timer | Timer already paused | Throws TIMER_NOT_RUNNING error (already paused) |
| 11 | Resume paused timer | Timer paused | paused_at cleared, interval restarted |
| 12 | Resume when not paused | Timer running (not paused) | Throws TIMER_NOT_PAUSED error |
| 13 | Resume when no timer exists | No timer for board | Throws TIMER_NOT_PAUSED error |
| 14 | Stop running timer | Timer running | Timer deleted, interval cleared |
| 15 | Stop paused timer | Timer paused | Timer deleted |
| 16 | Stop when no timer exists | No timer for board | Throws TIMER_NOT_FOUND error |
| 17 | Timer tick decrements remaining | remaining = 300, tick | remaining = 299 |
| 18 | Timer reaches zero | remaining = 1, tick | remaining = 0, timer stopped, reason = "expired" |
| 19 | Timer reaches zero triggers auto-stop | remaining = 0 | Interval cleared, timer_stopped broadcast |
| 20 | getState returns current timer | Timer running | Returns TimerState object |
| 21 | getState returns null when no timer | No timer | Returns null |

### Phase Permission Guard

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Add card in write phase | phase=write, action=add_card | Allowed |
| 2 | Add card in group phase | phase=group, action=add_card | Denied (403) |
| 3 | Add card in vote phase | phase=vote, action=add_card | Denied (403) |
| 4 | Move card to group in group phase | phase=group, action=group_card | Allowed |
| 5 | Move card to group in write phase | phase=write, action=group_card | Denied (403) |
| 6 | Vote in vote phase | phase=vote, action=vote | Allowed |
| 7 | Vote in write phase | phase=write, action=vote | Denied (403) |
| 8 | Create action item in action phase | phase=action, action=create_action | Allowed |
| 9 | Create action item in discuss phase | phase=discuss, action=create_action | Allowed |
| 10 | Create action item in write phase | phase=write, action=create_action | Denied (403) |
| 11 | Edit own card in write phase | phase=write, action=edit_card | Allowed |
| 12 | Edit own card in group phase | phase=group, action=edit_card | Allowed |
| 13 | Edit own card in vote phase | phase=vote, action=edit_card | Denied (403) |
| 14 | Board locked, non-facilitator add card | is_locked=true, role=member | Denied (403) |
| 15 | Board locked, facilitator add card | is_locked=true, role=facilitator | Allowed |

---

## Integration Tests

### Phase Endpoints

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Facilitator changes phase | PUT /boards/:id/phase { phase: "group" } as facilitator | 200, phase is "group" |
| 2 | Member cannot change phase | PUT /boards/:id/phase as member | 403 |
| 3 | Admin can change phase | PUT /boards/:id/phase as admin | 200 |
| 4 | Invalid phase rejected | PUT /boards/:id/phase { phase: "invalid" } | 400 |
| 5 | Phase change broadcasts WS event | Change phase with 2 WS clients | Both receive phase_changed |
| 6 | Phase change auto-stops timer | Timer running, change phase | timer_stopped event broadcast |
| 7 | Non-existent board | PUT /boards/nonexistent/phase | 404 |
| 8 | Unauthenticated request | No Authorization header | 401 |

### Timer Endpoints

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Start timer | POST /boards/:id/timer { durationSeconds: 300 } | 201, timer started |
| 2 | Timer ticks broadcast every second | Start 5s timer, listen WS | Receive 5 timer_tick events |
| 3 | Timer expires | Start 3s timer, wait 4s | timer_stopped with reason "expired" |
| 4 | Pause timer | Start timer, PUT /boards/:id/timer { action: "pause" } | 200, timer paused |
| 5 | Resume timer | Pause then PUT { action: "resume" } | 200, timer resumed, ticks resume |
| 6 | Stop timer | Start timer, DELETE /boards/:id/timer | 200, timer stopped |
| 7 | Start timer when one exists | Timer running, POST again | 409 |
| 8 | Pause when not running | No timer, PUT { action: "pause" } | 400 |
| 9 | Resume when not paused | Running timer, PUT { action: "resume" } | 400 |
| 10 | Get timer state | GET /boards/:id/timer | 200, current timer state |
| 11 | Get timer when none exists | GET /boards/:id/timer (no timer) | 200, timer: null |
| 12 | Member cannot start timer | POST as member role | 403 |
| 13 | Duration below minimum (0) | POST { durationSeconds: 0 } | 400 |
| 14 | Duration above maximum (3601) | POST { durationSeconds: 3601 } | 400 |
| 15 | Timer survives page refresh | Start timer, GET timer state after delay | remaining_seconds reflects elapsed time |

### Lock Endpoints

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Lock board | PUT /boards/:id/lock { isLocked: true } | 200, board locked |
| 2 | Unlock board | PUT /boards/:id/lock { isLocked: false } | 200, board unlocked |
| 3 | Lock broadcasts WS event | Lock with WS clients | board_locked event received |
| 4 | Unlock broadcasts WS event | Unlock with WS clients | board_unlocked event received |
| 5 | Locked board rejects card creation | Lock board, POST card as member | 403 |
| 6 | Locked board allows facilitator edits | Lock board, POST card as facilitator | 201 |
| 7 | Member cannot lock board | PUT /lock as member | 403 |

### Reveal Endpoints

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Reveal cards | PUT /boards/:id/reveal on anonymous board | 200, cards revealed |
| 2 | Reveal broadcasts WS event | Reveal with WS clients | cards_revealed with author mapping |
| 3 | Non-anonymous board | PUT /reveal on named board | 400 |
| 4 | Already revealed | PUT /reveal twice | Second returns 400 |
| 5 | After reveal, cards show authors | GET cards after reveal | authorId and authorName populated |
| 6 | Member cannot reveal | PUT /reveal as member | 403 |

### Focus Endpoints

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Set focus on card | PUT /boards/:id/focus { focusType: "card", focusId: "..." } | 200 |
| 2 | Set focus on group | PUT /boards/:id/focus { focusType: "group", focusId: "..." } | 200 |
| 3 | Clear focus | PUT /boards/:id/focus { focusType: null, focusId: null } | 200 |
| 4 | Focus broadcasts WS event | Set focus with WS clients | focus_changed received |
| 5 | Focus on non-existent card | PUT /focus with invalid cardId | 404 |
| 6 | Member cannot set focus | PUT /focus as member | 403 |
| 7 | Change focus between items | Set focus, then change to different card | focus_changed with new item |

---

## Database Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Phase check constraint | INSERT board with phase="invalid" | Constraint violation error |
| 2 | Focus consistency constraint | SET focus_type="card", focus_id=NULL | Constraint violation error |
| 3 | Focus null consistency | SET focus_type=NULL, focus_id=UUID | Constraint violation error |
| 4 | Both focus fields null | SET focus_type=NULL, focus_id=NULL | Succeeds |
| 5 | Timer duration constraint | INSERT timer with duration=0 | Constraint violation |
| 6 | Timer remaining <= duration | INSERT timer remaining > duration | Constraint violation |
| 7 | Timer cascade delete | DELETE board with active timer | Timer deleted too |
| 8 | One timer per board | INSERT two timers for same board | Primary key conflict |
| 9 | Phase change trigger fires NOTIFY | UPDATE phase from write to group | NOTIFY received on channel |
| 10 | Lock change trigger fires NOTIFY | UPDATE is_locked = true | NOTIFY received |
| 11 | Reveal trigger fires NOTIFY | UPDATE cards_revealed = true | NOTIFY received |
| 12 | Focus change trigger fires NOTIFY | UPDATE focus_type and focus_id | NOTIFY received |
| 13 | Phase event logged | Change phase | Row in board_events with type phase_changed |
| 14 | Phase durations default | New board created | phase_durations has all 5 phases with defaults |

---

## End-to-End Facilitation Flow

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Full retro ceremony | 1. Create board (phase=write) 2. Start write timer 3. Add cards 4. Timer expires 5. Advance to group phase 6. Group cards 7. Advance to vote 8. Vote on cards 9. Advance to discuss 10. Set focus 11. Discuss 12. Advance to action 13. Create action items | All phases complete, all events received by all clients |
| 2 | Anonymous reveal flow | 1. Create anonymous board 2. Add cards 3. Verify authors hidden 4. Advance past write 5. Reveal cards 6. Verify authors visible | Authors correctly hidden/revealed |
| 3 | Lock during discussion | 1. Lock board 2. Verify member cannot add cards 3. Facilitator adds card 4. Unlock 5. Member can add cards | Lock correctly controls access |
| 4 | Timer pause/resume cycle | 1. Start 300s timer 2. Wait 5s 3. Pause 4. Wait 5s 5. Resume 6. Check remaining | Remaining reflects only running time (not paused time) |
| 5 | Phase change clears timer | 1. Start timer 2. Change phase 3. Verify timer stopped | Timer stopped with reason "phase_change" |
| 6 | Server restart during timer | 1. Start timer 2. Restart server 3. Clients reconnect | Timer resumes with corrected remaining time |

---

## Performance Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Phase change latency | Change phase, measure WS delivery | < 100ms |
| 2 | Timer tick jitter | Start 60s timer, measure tick intervals | Each tick within +/- 50ms of 1000ms |
| 3 | Timer with 50 clients | 50 WS clients, timer running | All receive ticks, < 50ms skew between clients |
| 4 | Rapid phase changes | Change phase 10 times in 5 seconds | All events delivered in order |
