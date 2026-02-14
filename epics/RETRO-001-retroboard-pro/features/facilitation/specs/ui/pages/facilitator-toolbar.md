# UI Component Spec: Facilitator Toolbar

**Feature:** facilitation
**Component:** Facilitator Toolbar
**Location:** Floating bar at bottom of Board Page (`/boards/:boardId`)
**Visibility:** Only rendered for users with `facilitator` or `admin` role
**Stories:** S-015, S-016, S-017

---

## 1. Overview

The facilitator toolbar is a floating control panel anchored to the bottom of the board page. It provides the facilitator with phase controls, a countdown timer, board-level toggles (lock, anonymous reveal), and a prominent "Next Phase" button. The toolbar is only rendered in the DOM for facilitator/admin users -- it is not hidden via CSS but omitted entirely for regular members.

---

## 2. ASCII Wireframes

### 2.1 Full Toolbar (Desktop)

```
+====================================================================================================+
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  |                                                                                              |  |
|  |  PHASE                           TIMER                  BOARD CONTROLS                       |  |
|  |  +------+-------+------+---------+--------+   +------+--------+-------+                      |  |
|  |  |Write | Group | Vote | Discuss | Action |   | 5:00 | [>]    | [||]  |  [<-]                |  |
|  |  |      |       | ***  |         |        |   |      | Start  | Pause |  Reset               |  |
|  |  +------+-------+------+---------+--------+   +------+--------+-------+                      |  |
|  |   current phase highlighted                     timer display   controls                      |  |
|  |                                                                                              |  |
|  |  +------------------+  +----------------------+  +--------------------+                       |  |
|  |  | Lock Board       |  | Reveal Anonymous     |  | Focus Mode         |   +---------------+  |  |
|  |  | [  OFF  |  on  ] |  | [  OFF  |  on  ]     |  | [  OFF  |  on  ]   |   | Next Phase -> |  |  |
|  |  +------------------+  +----------------------+  +--------------------+   | (to Group)    |  |  |
|  |                                                                           +---------------+  |  |
|  |                                                                                              |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                                                                    |
+====================================================================================================+
```

### 2.2 Toolbar Expanded Detail

```
+----------------------------------------------------------------------------------------------+
|                                                                                              |
|  SECTION 1: Phase Controls                                                                   |
|  +---------+---------+---------+-----------+-----------+                                     |
|  |         |         |         |           |           |                                     |
|  |  Write  |  Group  |  Vote   |  Discuss  |  Action   |                                     |
|  |         |         |         |           |           |                                     |
|  |  (1)    |  (2)    |  (3)    |  (4)      |  (5)      |                                     |
|  |         |         |         |           |           |                                     |
|  +---------+---------+---------+-----------+-----------+                                     |
|  [  dim  ] [  dim  ] [**ACTIVE**] [  dim  ] [  dim  ]                                        |
|                                                                                              |
|  The active phase button is highlighted with the primary accent color (indigo-600).           |
|  Completed phases show a checkmark icon. Future phases are dimmed.                           |
|  Clicking any phase button triggers a confirmation dialog.                                    |
|                                                                                              |
|  SECTION 2: Timer Controls                                                                   |
|  +--------------------------------------------+                                             |
|  |                                            |                                             |
|  |  +--------+   +-----+ +------+ +-------+  |                                             |
|  |  |  05:00 |   | [>] | | [||] | | [<-]  |  |                                             |
|  |  | (editable) | Play | Pause | Reset   |  |                                             |
|  |  +--------+   +-----+ +------+ +-------+  |                                             |
|  |                                            |                                             |
|  |  Duration input: click on "05:00" to       |                                             |
|  |  edit. Accepts MM:SS format. Range:        |                                             |
|  |  00:30 to 60:00.                           |                                             |
|  |                                            |                                             |
|  +--------------------------------------------+                                             |
|                                                                                              |
|  Timer States:                                                                               |
|  - Idle:    [05:00] in gray, Play button enabled, Pause/Reset disabled                       |
|  - Running: [04:23] counting down in green, Pause enabled, Play disabled                     |
|  - Paused:  [03:15] frozen in yellow, Play enabled (resumes), Reset enabled                  |
|  - Expired: [00:00] in red, pulsing animation, all buttons reset to idle                     |
|                                                                                              |
|  SECTION 3: Board Controls                                                                   |
|  +-------------------+  +------------------------+  +---------------------+                  |
|  |  Lock Board       |  |  Reveal Anonymous      |  |  Focus Mode         |                  |
|  |  +-----+-----+    |  |  +-----+-----+         |  |  +-----+-----+      |                  |
|  |  | OFF | ON  |    |  |  | OFF | ON  |          |  |  | OFF | ON  |      |                  |
|  |  +-----+-----+    |  |  +-----+-----+          |  |  +-----+-----+      |                  |
|  |                    |  |                         |  |                      |                  |
|  |  When ON: All      |  |  When ON: Author names  |  |  When ON: Clicking   |                  |
|  |  non-facilitator   |  |  revealed on all cards. |  |  a card/group sets   |                  |
|  |  inputs disabled.  |  |  Only in Write phase.   |  |  it as discussion    |                  |
|  |                    |  |                         |  |  focus. Discuss only. |                  |
|  +-------------------+  +------------------------+  +---------------------+                  |
|                                                                                              |
|  SECTION 4: Next Phase Button                                                                |
|  +-------------------------+                                                                 |
|  |                         |                                                                 |
|  |    Next Phase  ->       |   Large, prominent primary button.                              |
|  |    (to Group)           |   Shows name of next phase in subtitle.                         |
|  |                         |   Disabled when on last phase (Action).                         |
|  +-------------------------+                                                                 |
|                                                                                              |
+----------------------------------------------------------------------------------------------+
```

### 2.3 Mobile Toolbar (Collapsed / Sheet)

```
+------------------------------------------+
|                                          |
|  Phase: Vote (3/5)  Timer: 04:23        |
|  [Next Phase ->]                         |
|  [Expand Toolbar ^]                      |
|                                          |
+------------------------------------------+

  When expanded (slide-up sheet):

+------------------------------------------+
|  [v Collapse]                            |
|                                          |
|  Phase:                                  |
|  [Write][Group][Vote][Discuss][Action]   |
|                                          |
|  Timer: [05:00]  [>] [||] [<-]          |
|                                          |
|  Lock Board        [OFF | ON]            |
|  Reveal Anonymous  [OFF | ON]            |
|  Focus Mode        [OFF | ON]            |
|                                          |
|  +------------------------------------+  |
|  |       Next Phase -> (to Group)     |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
```

### 2.4 Phase Transition Confirmation Dialog

```
+------------------------------------------+
|                                          |
|  Change Phase                       [X]  |
|                                          |
|  Move from "Vote" to "Discuss"?          |
|                                          |
|  This will change the board for all      |
|  8 connected participants.               |
|                                          |
|  Changes:                                |
|  - Voting will be disabled               |
|  - Discussion focus mode enabled         |
|  - Cards become read-only                |
|                                          |
|  +----------+   +--------------------+   |
|  |  Cancel   |   |  Change Phase ->  |   |
|  +----------+   +--------------------+   |
|                                          |
+------------------------------------------+
```

### 2.5 Timer Expired Alert

```
+------------------------------------------+
|                                          |
|  (!)  Timer Expired                      |
|                                          |
|  The 5-minute timer for Vote phase       |
|  has ended.                              |
|                                          |
|  +----------+   +--------------------+   |
|  |  Dismiss  |   |  Next Phase ->    |   |
|  +----------+   +--------------------+   |
|                                          |
+------------------------------------------+
```

---

## 3. Component Breakdown

### 3.1 Component Tree

```
<FacilitatorToolbar>
  <ToolbarContainer>
    <PhaseControlsSection>
      <PhaseButton phase="write" label="Write" number={1} />
      <PhaseButton phase="group" label="Group" number={2} />
      <PhaseButton phase="vote" label="Vote" number={3} />
      <PhaseButton phase="discuss" label="Discuss" number={4} />
      <PhaseButton phase="action" label="Action" number={5} />
    </PhaseControlsSection>

    <TimerSection>
      <TimerDurationInput value={seconds} onChange={fn} />
      <TimerPlayButton onClick={fn} disabled={boolean} />
      <TimerPauseButton onClick={fn} disabled={boolean} />
      <TimerResetButton onClick={fn} disabled={boolean} />
    </TimerSection>

    <BoardControlsSection>
      <ToggleSwitch label="Lock Board" value={bool} onChange={fn} />
      <ToggleSwitch label="Reveal Anonymous" value={bool} onChange={fn} disabled={notWritePhase} />
      <ToggleSwitch label="Focus Mode" value={bool} onChange={fn} disabled={notDiscussPhase} />
    </BoardControlsSection>

    <NextPhaseSection>
      <NextPhaseButton nextPhase={Phase} onClick={fn} disabled={isLastPhase} />
    </NextPhaseSection>
  </ToolbarContainer>

  <PhaseConfirmationDialog />      // rendered on demand
  <TimerExpiredAlert />            // rendered on timer expiry
</FacilitatorToolbar>
```

### 3.2 Component Specifications

| Component | Description | Key Props | Notes |
|-----------|-------------|-----------|-------|
| `FacilitatorToolbar` | Root container, only rendered for facilitator/admin | -- | `position: fixed; bottom: 0; z-index: 50` |
| `ToolbarContainer` | Inner layout wrapper | -- | Flexbox row on desktop, column on mobile |
| `PhaseControlsSection` | Group of 5 phase buttons | `currentPhase: Phase` | `role="radiogroup"` |
| `PhaseButton` | Single phase selector button | `phase`, `label`, `number`, `isActive`, `isCompleted`, `onClick` | `role="radio"`, `aria-checked` |
| `TimerSection` | Timer display + controls | `seconds`, `status`, callbacks | |
| `TimerDurationInput` | Editable MM:SS display | `value`, `onChange` | Click to edit, blur to save |
| `TimerPlayButton` | Start/resume timer | `onClick`, `disabled` | Play icon, green accent |
| `TimerPauseButton` | Pause running timer | `onClick`, `disabled` | Pause icon, yellow accent |
| `TimerResetButton` | Reset timer to initial duration | `onClick`, `disabled` | Reset icon, gray |
| `BoardControlsSection` | Toggle switches for board settings | -- | Horizontal on desktop, stacked on mobile |
| `ToggleSwitch` | Labeled ON/OFF switch | `label`, `value`, `onChange`, `disabled` | `role="switch"` |
| `NextPhaseSection` | Prominent next-phase CTA | `nextPhase`, `onClick`, `disabled` | Shows next phase name as subtitle |
| `NextPhaseButton` | Large button to advance phase | `nextPhase`, `onClick`, `disabled` | Disabled on last phase |
| `PhaseConfirmationDialog` | Confirmation modal for phase changes | `fromPhase`, `toPhase`, `participantCount`, `onConfirm`, `onCancel` | Lists what changes |
| `TimerExpiredAlert` | Notification when timer reaches zero | `phase`, `duration`, `onDismiss`, `onNextPhase` | Optional audio + visual |

---

## 4. State Management

The facilitator toolbar reads from and writes to the board store (defined in the board page spec). It does not have its own separate store.

### 4.1 State Dependencies (from Board Store)

```typescript
// Read from board store
const currentPhase = useBoardStore(s => s.currentPhase);
const isFacilitator = useBoardStore(s => s.isFacilitator);
const isLocked = useBoardStore(s => s.isLocked);
const isAnonymous = useBoardStore(s => s.isAnonymous);
const timerSeconds = useBoardStore(s => s.timerSeconds);
const timerStatus = useBoardStore(s => s.timerStatus);
const timerDuration = useBoardStore(s => s.timerDuration);
const connectedUsers = useBoardStore(s => s.connectedUsers);
const focusedItemId = useBoardStore(s => s.focusedItemId);

// Write via board store actions
const changePhase = useBoardStore(s => s.changePhase);
const startTimer = useBoardStore(s => s.startTimer);
const pauseTimer = useBoardStore(s => s.pauseTimer);
const resetTimer = useBoardStore(s => s.resetTimer);
const toggleLock = useBoardStore(s => s.toggleLock);
const toggleAnonymous = useBoardStore(s => s.toggleAnonymous);
```

### 4.2 Local Component State

```typescript
// Within FacilitatorToolbar component
const [showPhaseConfirm, setShowPhaseConfirm] = useState(false);
const [pendingPhase, setPendingPhase] = useState<Phase | null>(null);
const [showTimerExpired, setShowTimerExpired] = useState(false);
const [isEditingDuration, setIsEditingDuration] = useState(false);
const [durationInput, setDurationInput] = useState('05:00');
const [isMobileExpanded, setIsMobileExpanded] = useState(false);
```

### 4.3 State Matrix -- Timer States

| State | `timerStatus` | Display | Play | Pause | Reset | Visual |
|-------|---------------|---------|------|-------|-------|--------|
| Idle | `idle` | Gray "05:00" | Enabled | Disabled | Disabled | Static, muted |
| Running | `running` | Green countdown | Disabled | Enabled | Disabled | Active, counting |
| Paused | `paused` | Yellow frozen | Enabled | Disabled | Enabled | Frozen, attention |
| Expired | `idle` (auto-reset) | Red "00:00" | Enabled | Disabled | Disabled | Pulsing red, alert |

### 4.4 State Matrix -- Toggle Controls

| Toggle | Enabled When | Disabled When | Effect When ON |
|--------|-------------|--------------|----------------|
| Lock Board | Any phase | Never | All non-facilitator card inputs disabled. "Board is locked" banner shown to members. |
| Reveal Anonymous | Write phase | Group, Vote, Discuss, Action phases | Author names and avatars shown on all cards. Toggle disabled once past Write phase. |
| Focus Mode | Discuss phase | Write, Group, Vote, Action phases | Facilitator clicks on cards/groups to set discussion focus. Other items dim. |

### 4.5 State Matrix -- Phase Buttons

| Phase Button | Current = Write | Current = Group | Current = Vote | Current = Discuss | Current = Action |
|-------------|----------------|-----------------|---------------|-------------------|-----------------|
| Write | **Active** (highlighted) | Completed (checkmark) | Completed | Completed | Completed |
| Group | Future (dim) | **Active** | Completed | Completed | Completed |
| Vote | Future (dim) | Future (dim) | **Active** | Completed | Completed |
| Discuss | Future (dim) | Future (dim) | Future (dim) | **Active** | Completed |
| Action | Future (dim) | Future (dim) | Future (dim) | Future (dim) | **Active** |

---

## 5. User Interactions

| # | Action | Trigger | Precondition | Result |
|---|--------|---------|-------------|--------|
| 1 | Click phase button | Click on any PhaseButton | User is facilitator | Open PhaseConfirmationDialog for that phase |
| 2 | Confirm phase change | Click "Change Phase" in dialog | Dialog open | API call `PUT /boards/:id/phase`, WS broadcast, UI updates |
| 3 | Cancel phase change | Click "Cancel" in dialog | Dialog open | Close dialog, no change |
| 4 | Click "Next Phase" | Click NextPhaseButton | Not on last phase | Open PhaseConfirmationDialog for next sequential phase |
| 5 | Edit timer duration | Click on timer display | Timer is idle | Display becomes editable input, MM:SS format |
| 6 | Save timer duration | Press Enter or blur input | Input focused | Validate (30s - 60min), update duration |
| 7 | Start timer | Click play button | Timer is idle or paused | API call, WS broadcast `timer:sync`, countdown begins |
| 8 | Pause timer | Click pause button | Timer is running | API call, WS broadcast, timer freezes |
| 9 | Reset timer | Click reset button | Timer is paused | API call, WS broadcast, timer returns to set duration |
| 10 | Dismiss timer expired | Click "Dismiss" in alert | Timer just expired | Close alert |
| 11 | Next phase from timer alert | Click "Next Phase" in alert | Timer just expired | Same as interaction #4 |
| 12 | Toggle lock board | Click Lock toggle | Any phase | API call `PUT /boards/:id/settings`, WS broadcast |
| 13 | Toggle reveal anonymous | Click Anonymous toggle | Write phase only | API call `PUT /boards/:id/settings`, WS broadcast |
| 14 | Toggle focus mode | Click Focus toggle | Discuss phase only | Enable/disable focus mode. When enabled, clicking card/group sets focus. |
| 15 | Expand mobile toolbar | Click "Expand Toolbar" | Mobile viewport | Slide-up sheet animation reveals full toolbar |
| 16 | Collapse mobile toolbar | Click "Collapse" or swipe down | Mobile, expanded | Sheet collapses back to compact bar |

---

## 6. Visual Design

### 6.1 Toolbar Styling

| Property | Value |
|----------|-------|
| Background | `bg-white dark:bg-gray-900` |
| Border | `border-t border-gray-200` |
| Shadow | `shadow-lg` (elevated above board content) |
| Position | `fixed bottom-0 left-0 right-0` |
| Z-index | `z-50` |
| Padding | `px-6 py-3` |
| Max width | Constrained to board content width |

### 6.2 Phase Button States

| State | Background | Text | Border | Icon |
|-------|-----------|------|--------|------|
| Active (current) | `bg-indigo-600` | `text-white` | `ring-2 ring-indigo-300` | Number filled |
| Completed (past) | `bg-indigo-50` | `text-indigo-700` | `border-indigo-200` | Checkmark |
| Future (upcoming) | `bg-gray-50` | `text-gray-400` | `border-gray-200` | Number outline |
| Hover (any) | Brightness increase | -- | -- | -- |

### 6.3 Timer Display States

| State | Text Color | Background | Animation |
|-------|-----------|------------|-----------|
| Idle | `text-gray-500` | `bg-gray-50` | None |
| Running | `text-green-600` | `bg-green-50` | None |
| Paused | `text-yellow-600` | `bg-yellow-50` | None |
| Expired | `text-red-600` | `bg-red-50` | `animate-pulse` |
| Last 30 seconds | `text-red-600` | `bg-red-50` | None (just color change) |

### 6.4 Toggle Switch

```
OFF state:                      ON state:
+------------------+            +------------------+
|  [ o       ]     |            |  [       o ]     |
|   OFF             |            |           ON     |
+------------------+            +------------------+
gray track, white dot           indigo track, white dot
```

### 6.5 Next Phase Button

| State | Appearance |
|-------|-----------|
| Default | `bg-indigo-600 text-white` with right arrow icon. Subtitle: "(to {nextPhaseName})" |
| Hover | `bg-indigo-700` |
| Disabled (last phase) | `bg-gray-200 text-gray-400`, no arrow, text: "Final Phase" |
| Loading (phase changing) | Spinner replaces arrow |

---

## 7. Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| `< 640px` (mobile) | Compact bar showing: current phase name, timer, "Next Phase" button. "Expand" button to reveal full toolbar as bottom sheet. |
| `640px - 1023px` (tablet) | Two-row layout. Row 1: Phase buttons + Timer. Row 2: Board controls + Next Phase. |
| `>= 1024px` (desktop) | Single-row layout as shown in wireframe. All controls visible. |

---

## 8. Accessibility

| Element | ARIA / A11y Requirement |
|---------|------------------------|
| Toolbar container | `role="toolbar"`, `aria-label="Facilitator controls"` |
| Phase buttons group | `role="radiogroup"`, `aria-label="Board phase"` |
| Individual phase button | `role="radio"`, `aria-checked`, `aria-label="Phase {N}: {name}"` |
| Timer display | `role="timer"`, `aria-live="polite"`, `aria-label="Timer: {MM:SS}"` |
| Timer duration input | `aria-label="Timer duration in minutes and seconds"`, `inputmode="numeric"` |
| Play button | `aria-label="Start timer"` |
| Pause button | `aria-label="Pause timer"` |
| Reset button | `aria-label="Reset timer"` |
| Lock toggle | `role="switch"`, `aria-checked`, `aria-label="Lock board for non-facilitators"` |
| Anonymous toggle | `role="switch"`, `aria-checked`, `aria-label="Reveal anonymous card authors"` |
| Focus toggle | `role="switch"`, `aria-checked`, `aria-label="Enable discussion focus mode"` |
| Next Phase button | `aria-label="Advance to {nextPhase} phase"`, `aria-disabled` when on last phase |
| Phase confirmation dialog | `role="alertdialog"`, `aria-modal="true"`, focus trap |
| Timer expired alert | `role="alert"`, `aria-live="assertive"` |
| Mobile expand button | `aria-label="Expand facilitator toolbar"`, `aria-expanded` |

---

## 9. Keyboard Navigation

| Key | Action | Context |
|-----|--------|---------|
| `Tab` | Move focus between toolbar sections | Any |
| `Left Arrow` / `Right Arrow` | Navigate between phase buttons | Within phase group |
| `Enter` / `Space` | Activate focused button or toggle | Any button/toggle |
| `Space` (global shortcut) | Start/pause timer | When not in text input |
| `Right Arrow` (global) | Open "Next Phase" confirmation | When toolbar focused |
| `Escape` | Close confirmation dialog or timer alert | When dialog open |
| `Shift+R` (global) | Reset timer | When not in text input |
| `L` (global) | Toggle board lock | When not in text input |

---

## 10. Data Requirements

The facilitator toolbar does not fetch data independently. It reads state from the board store and dispatches actions via the board store.

### 10.1 API Calls (dispatched through board store)

| Action | Endpoint | Method | Body |
|--------|----------|--------|------|
| Change phase | `/api/v1/boards/:boardId/phase` | PUT | `{ phase: Phase }` |
| Update settings | `/api/v1/boards/:boardId/settings` | PUT | `{ is_locked?, anonymous_mode? }` |
| Set focus | `/api/v1/boards/:boardId/focus` | PUT | `{ focus_item_id, focus_item_type }` |
| Clear focus | `/api/v1/boards/:boardId/focus` | PUT | `{ focus_item_id: null }` |
| Start timer | (WebSocket message) | -- | `{ type: "timer:start", duration }` |
| Pause timer | (WebSocket message) | -- | `{ type: "timer:pause" }` |
| Reset timer | (WebSocket message) | -- | `{ type: "timer:reset" }` |

### 10.2 WebSocket Messages (Sent by Facilitator)

| Message | Payload | Server Behavior |
|---------|---------|-----------------|
| `timer:start` | `{ duration: number }` | Server records start, broadcasts `timer:sync` to all |
| `timer:pause` | `{}` | Server records elapsed, broadcasts `timer:sync` with paused status |
| `timer:reset` | `{}` | Server clears timer, broadcasts `timer:sync` with idle status |

---

## 11. Error Handling

| Scenario | UI Response |
|----------|-------------|
| Phase change API fails | Show error toast: "Failed to change phase. Please try again." Revert phase UI. |
| Phase change rejected (invalid transition) | Show toast: "Cannot skip to {phase}. Complete the current phase first." |
| Settings update fails | Show error toast. Revert toggle to previous state. |
| Timer WS message fails to send | Show toast: "Timer sync failed. Timer may not be visible to all participants." |
| Focus set fails | Show toast: "Failed to set discussion focus." Clear highlight. |
| Duration input invalid | Inline validation: "Enter a valid duration between 0:30 and 60:00" |
| Multiple facilitators | Board supports single active facilitator. If another facilitator/admin opens the toolbar, both can control. Last-write-wins semantics. |
