# UI Page Spec: Retro Board

**Feature:** retro-board
**Page:** Retro Board (The Main Board)
**URL:** `/boards/:boardId`
**Auth:** Required (must be member of owning team)
**Stories:** S-007, S-008, S-009, S-010, S-011, S-013, S-014, S-015, S-016, S-017

---

## 1. Overview

The retro board is the crown jewel of RetroBoard Pro. It is a real-time, multi-column collaborative surface where team members add feedback cards, vote on items, group related cards into clusters, and discuss outcomes -- all guided through five structured phases controlled by a facilitator. The board connects via WebSocket for live updates and displays presence indicators for all connected participants.

---

## 2. ASCII Wireframes

### 2.1 Full Board Layout (Write Phase)

```
+====================================================================================================+
|  [< Back]   Platform Team  >  Sprint 24  >  Retro Board                    [Settings]  [Export]    |
+====================================================================================================+
|                                                                                                    |
|  Phase:  (1)Write  (2)Group  (3)Vote  (4)Discuss  (5)Action       Timer: [05:00]   Participants:   |
|          [*****]   [ooooo]   [ooooo]  [ooooo]     [ooooo]         [> Start]        (AV)(AV)(AV)+5  |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +-- What Went Well -----------+  +-- What Didn't Go Well --------+  +-- Action Items ----------+  |
|  |  ## (green accent)   3      |  |  ## (red accent)      4       |  |  ## (blue accent)      1  |  |
|  |                             |  |                               |  |                           |  |
|  |  +---------------------+   |  |  +----------------------+     |  |  +-----------------------+ |  |
|  |  | Deployment went     |   |  |  | Too many meetings    |     |  |  | Need to update the    | |  |
|  |  | smoothly this       |   |  |  | this sprint, hard    |     |  |  | onboarding docs for   | |  |
|  |  | sprint!             |   |  |  | to focus on code     |     |  |  | new hires             | |  |
|  |  |                     |   |  |  |                      |     |  |  |                       | |  |
|  |  | +--+          <3 0  |   |  |  | +--+          <3 0   |     |  |  | +--+            <3 0  | |  |
|  |  | |AV|  Alice         |   |  |  | |??|  Anonymous      |     |  |  | |AV|  Carol          | |  |
|  |  | +--+               |   |  |  | +--+                 |     |  |  | +--+                 | |  |
|  |  +---------------------+   |  |  +----------------------+     |  |  +-----------------------+ |  |
|  |                             |  |                               |  |                           |  |
|  |  +---------------------+   |  |  +----------------------+     |  |                           |  |
|  |  | Great teamwork on   |   |  |  | CI pipeline was      |     |  |                           |  |
|  |  | the API migration   |   |  |  | broken for 2 days    |     |  |                           |  |
|  |  | project             |   |  |  | and nobody noticed   |     |  |                           |  |
|  |  |                     |   |  |  |                      |     |  |                           |  |
|  |  | +--+          <3 0  |   |  |  | +--+          <3 0   |     |  |                           |  |
|  |  | |AV|  Bob           |   |  |  | |??|  Anonymous      |     |  |                           |  |
|  |  | +--+               |   |  |  | +--+                 |     |  |                           |  |
|  |  +---------------------+   |  |  +----------------------+     |  |                           |  |
|  |                             |  |                               |  |                           |  |
|  |  +---------------------+   |  |  +----------------------+     |  |                           |  |
|  |  | Code review         |   |  |  | Unclear priorities   |     |  |                           |  |
|  |  | turnaround was      |   |  |  | from PM at start     |     |  |                           |  |
|  |  | fast                |   |  |  | of sprint            |     |  |                           |  |
|  |  |                     |   |  |  |                      |     |  |                           |  |
|  |  | +--+          <3 0  |   |  |  | +--+          <3 0   |     |  |                           |  |
|  |  | |AV|  Carol         |   |  |  | |AV|  Dave           |     |  |                           |  |
|  |  | +--+               |   |  |  | +--+                 |     |  |                           |  |
|  |  +---------------------+   |  |  +----------------------+     |  |                           |  |
|  |                             |  |                               |  |                           |  |
|  |  + - - - - - - - - - - +   |  |  +----------------------+     |  |  + - - - - - - - - - - -+ |  |
|  |  | + Add a card...     |   |  |  | Didn't finish the    |     |  |  | + Add a card...      | |  |
|  |  + - - - - - - - - - - +   |  |  | planned refactor     |     |  |  + - - - - - - - - - - -+ |  |
|  |                             |  |  |                      |     |  |                           |  |
|  |                             |  |  | +--+          <3 0   |     |  |                           |  |
|  |                             |  |  | |??|  Anonymous      |     |  |                           |  |
|  |                             |  |  | +--+                 |     |  |                           |  |
|  |                             |  |  +----------------------+     |  |                           |  |
|  |                             |  |                               |  |                           |  |
|  |                             |  |  + - - - - - - - - - - - +   |  |                           |  |
|  |                             |  |  | + Add a card...        |   |  |                           |  |
|  |                             |  |  + - - - - - - - - - - - +   |  |                           |  |
|  |                             |  |                               |  |                           |  |
|  +-----------------------------+  +-------------------------------+  +---------------------------+  |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|  +-- PRESENCE ---------------------------------------------------------------------------------+   |
|  |  (AV) Alice - online    (AV) Bob - online    (AV) Carol - online    (AV) Dave - idle        |   |
|  +---------------------------------------------------------------------------------------------+   |
+====================================================================================================+
|                                                                                                    |
|  +-- FACILITATOR TOOLBAR (facilitator only) ---------------------------------------------------+   |
|  |                                                                                             |   |
|  |  Phase: [Write] [Group] [Vote] [Discuss] [Action]   Timer: [5:00] [>] [||] [<-]            |   |
|  |                                                                                             |   |
|  |  Board: [Lock Board] [Reveal Anonymous] [Focus Mode: Off]              [Next Phase ->]      |   |
|  |                                                                                             |   |
|  +---------------------------------------------------------------------------------------------+   |
|                                                                                                    |
+====================================================================================================+
```

### 2.2 Vote Phase View

```
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  Phase:  (1)Write  (2)Group  (3)Vote  (4)Discuss  (5)Action       Timer: [02:34]   Votes: 3/5     |
|          [ooooo]   [ooooo]   [*****]  [ooooo]     [ooooo]         [counting down]  remaining      |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +-- What Went Well -----------+  +-- What Didn't Go Well --------+  +-- Action Items ----------+  |
|  |  ## (green accent)   3      |  |  ## (red accent)      4       |  |  ## (blue accent)      1  |  |
|  |                             |  |                               |  |                           |  |
|  |  +---------------------+   |  |  +----------------------+     |  |  +-----------------------+ |  |
|  |  | Deployment went     |   |  |  | Too many meetings    |     |  |  | Need to update the    | |  |
|  |  | smoothly this       |   |  |  | this sprint, hard    |     |  |  | onboarding docs for   | |  |
|  |  | sprint!             |   |  |  | to focus on code     |     |  |  | new hires             | |  |
|  |  |                     |   |  |  |                      |     |  |  |                       | |  |
|  |  | +--------------+   |   |  |  | +--------------+     |     |  |  | +--------------+      | |  |
|  |  | | [+1] <3<3<3 3|   |   |  |  | | [+1] <3<3  4 |     |     |  |  | | [+1] <3    1 |      | |  |
|  |  | +--------------+   |   |  |  | +--------------+     |     |  |  | +--------------+      | |  |
|  |  | +--+               |   |  |  | +--+                 |     |  |  | +--+                  | |  |
|  |  | |AV| Alice         |   |  |  | |??| Anonymous       |     |  |  | |AV| Carol            | |  |
|  |  | +--+               |   |  |  | +--+                 |     |  |  | +--+                  | |  |
|  |  +---------------------+   |  |  +----------------------+     |  |  +-----------------------+ |  |
|  |                             |  |                               |  |                           |  |
|  |  (no add card input         |  |  (no add card input           |  |  (no add card input       |  |
|  |   during vote phase)        |  |   during vote phase)          |  |   during vote phase)      |  |
|  |                             |  |                               |  |                           |  |
+--+-----------------------------+--+-------------------------------+--+---------------------------+--+
|                                                                                                    |
|  Your votes: ###oo  (3 used / 5 total)  -- 2 remaining                                            |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 2.3 Group Phase View (with Card Groups)

```
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  Phase:  (1)Write  (2)Group  (3)Vote  (4)Discuss  (5)Action       Timer: [--:--]                  |
|          [ooooo]   [*****]   [ooooo]  [ooooo]     [ooooo]         (no timer)                      |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +-- What Didn't Go Well ------------------------------------------------------------------+      |
|  |  ## (red accent)   4 cards  .  2 groups                                                  |      |
|  |                                                                                          |      |
|  |  +== GROUP: "Meeting Overload" ====================================================+     |      |
|  |  ||                                                                                ||     |      |
|  |  ||  +========================+   +========================+                       ||     |      |
|  |  ||  || Too many meetings    ||   || Sprint planning took  ||                       ||     |      |
|  |  ||  || this sprint, hard    ||   || 3 hours instead of 1  ||                       ||     |      |
|  |  ||  || to focus on code     ||   ||                       ||                       ||     |      |
|  |  ||  ||                      ||   || +--+                  ||                       ||     |      |
|  |  ||  || +--+    Anonymous    ||   || |AV|  Eve             ||                       ||     |      |
|  |  ||  || |??|                 ||   || +--+                  ||                       ||     |      |
|  |  ||  || +--+                 ||   +========================+                       ||     |      |
|  |  ||  +========================+                                                     ||     |      |
|  |  ||                                                                   [x ungroup]  ||     |      |
|  |  +=================================================================================+     |      |
|  |                                                                                          |      |
|  |  +-------------------------+     +-------------------------+                              |      |
|  |  | CI pipeline was broken  |     | Didn't finish the       |     <- Ungrouped cards      |      |
|  |  | for 2 days and nobody   |     | planned refactor        |        available for         |      |
|  |  | noticed                 |     |                         |        drag into groups      |      |
|  |  |                         |     |                         |                              |      |
|  |  | +--+       Anonymous    |     | +--+       Anonymous    |                              |      |
|  |  | |??|          [drag =]  |     | |??|          [drag =]  |                              |      |
|  |  | +--+                    |     | +--+                    |                              |      |
|  |  +-------------------------+     +-------------------------+                              |      |
|  |                                                                                          |      |
|  |  [+ Create New Group]                                                                    |      |
|  |                                                                                          |      |
|  +------------------------------------------------------------------------------------------+      |
|                                                                                                    |
```

### 2.4 Discuss Phase View (with Focus Highlight)

```
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  Phase:  (1)Write  (2)Group  (3)Vote  (4)Discuss  (5)Action       Timer: [03:00]                  |
|          [ooooo]   [ooooo]   [ooooo]  [*****]     [ooooo]         [per-item timer]                |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +-- What Didn't Go Well ------------------------------------------------------------------+      |
|  |                                                                                          |      |
|  |  (dimmed)  +-------------------+                                                         |      |
|  |  (dimmed)  | CI pipeline       |                                                         |      |
|  |  (dimmed)  | was broken...     |                                                         |      |
|  |  (dimmed)  +-------------------+                                                         |      |
|  |                                                                                          |      |
|  |  +===============================================================================+      |      |
|  |  ||                                                                              ||      |      |
|  |  ||  FOCUSED: "Meeting Overload"  (group)                            <3<3<3<3  7 ||      |      |
|  |  ||                                                                              ||      |      |
|  |  ||  +---------------------------+   +---------------------------+               ||      |      |
|  |  ||  | Too many meetings         |   | Sprint planning took      |               ||      |      |
|  |  ||  | this sprint               |   | 3 hours instead of 1      |               ||      |      |
|  |  ||  |                <3<3<3  3  |   |                <3<3<3<3 4 |               ||      |      |
|  |  ||  +---------------------------+   +---------------------------+               ||      |      |
|  |  ||                                                                              ||      |      |
|  |  ||  +-- DISCUSSION THREAD --------------------------------------------------+   ||      |      |
|  |  ||  |                                                                       |   ||      |      |
|  |  ||  |  (AV) Alice: We should cap meetings to 30min max                     |   ||      |      |
|  |  ||  |        2 min ago                                                      |   ||      |      |
|  |  ||  |                                                                       |   ||      |      |
|  |  ||  |  (AV) Bob: Agree. Maybe async standup on Slack?                      |   ||      |      |
|  |  ||  |        1 min ago                                                      |   ||      |      |
|  |  ||  |                                                                       |   ||      |      |
|  |  ||  |  +--------------------------------------------------------------+    |   ||      |      |
|  |  ||  |  | Add a comment...                                     [Send]  |    |   ||      |      |
|  |  ||  |  +--------------------------------------------------------------+    |   ||      |      |
|  |  ||  +-----------------------------------------------------------------------+   ||      |      |
|  |  ||                                                                              ||      |      |
|  |  +===============================================================================+      |      |
|  |                                                                                          |      |
|  |  (dimmed)  +-------------------+                                                         |      |
|  |  (dimmed)  | Didn't finish     |                                                         |      |
|  |  (dimmed)  | the refactor      |                                                         |      |
|  |  (dimmed)  +-------------------+                                                         |      |
|  |                                                                                          |      |
|  +------------------------------------------------------------------------------------------+      |
|                                                                                                    |
```

### 2.5 Action Phase View

```
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  Phase:  (1)Write  (2)Group  (3)Vote  (4)Discuss  (5)Action       Timer: [--:--]                  |
|          [ooooo]   [ooooo]   [ooooo]  [ooooo]     [*****]                                         |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +-- BOARD CARDS (sorted by votes) -----------------------+  +-- ACTION ITEMS -----------------+   |
|  |                                                         |  |                                 |   |
|  |  +-------------------------------------------------+   |  |  Created from this retro:        |   |
|  |  | "Meeting Overload" (group)          <3<3<3<3  7 |   |  |                                 |   |
|  |  |  Too many meetings / Planning too long           |   |  |  +---------------------------+  |   |
|  |  |                          [+ Create Action ->]    |   |  |  | [ ] Cap meetings at 30min |  |   |
|  |  +-------------------------------------------------+   |  |  |   Assignee: [Alice v]      |  |   |
|  |                                                         |  |  |   Due: [Feb 28 v]          |  |   |
|  |  +-------------------------------------------------+   |  |  |   Source: Meeting Overl.   |  |   |
|  |  | CI pipeline was broken for 2 days   <3<3<3    3 |   |  |  +---------------------------+  |   |
|  |  |                          [+ Create Action ->]    |   |  |                                 |   |
|  |  +-------------------------------------------------+   |  |  +---------------------------+  |   |
|  |                                                         |  |  | [ ] Set up CI alerts      |  |   |
|  |  +-------------------------------------------------+   |  |  |   Assignee: [Bob v]        |  |   |
|  |  | Deployment went smoothly            <3<3<3    3 |   |  |  |   Due: [Feb 21 v]          |  |   |
|  |  |                          [+ Create Action ->]    |   |  |  |   Source: CI pipeline      |  |   |
|  |  +-------------------------------------------------+   |  |  +---------------------------+  |   |
|  |                                                         |  |                                 |   |
|  |  ...                                                    |  |  [+ Add Action Item Manually]   |   |
|  |                                                         |  |                                 |   |
|  +---------------------------------------------------------+  |  +-- CARRIED OVER -----------+  |   |
|                                                                |  |                            |  |   |
|                                                                |  |  [ ] Write post-mortem     |  |   |
|                                                                |  |    From Sprint 23 - Alice  |  |   |
|                                                                |  |                            |  |   |
|                                                                |  +----------------------------+  |   |
|                                                                |                                 |   |
|                                                                +---------------------------------+   |
|                                                                                                    |
```

### 2.6 Single Card Anatomy

```
+-------------------------------------+
|  = (drag handle, group phase only)  |
|                                     |
|  Deployment went smoothly this      |
|  sprint! The new CI pipeline made   |
|  everything faster.                 |
|                                     |
|  +------------------------------+   |
|  |  [+1]  <3<3<3   3 votes     |   |   <- Vote button + count (vote phase only)
|  +------------------------------+   |
|                                     |
|  +--+                               |
|  |AV|  Alice Johnson                |   <- Author (or "Anonymous" with ?? avatar)
|  +--+  2 min ago                    |
|                                     |
|  [Edit] [Delete]                    |   <- Only visible to card author (write/group phase)
+-------------------------------------+
```

### 2.7 Board Settings Modal

```
+----------------------------------------------+
|  Board Settings                          [X]  |
+----------------------------------------------+
|                                               |
|  Template: What Went Well / Delta             |
|  Created by: Alice Johnson                    |
|  Created: Feb 14, 2026                        |
|                                               |
|  ----------------------------------------    |
|                                               |
|  Anonymous Mode                               |
|  [  OFF  |  ON  ]                             |
|  Card authors hidden from team members        |
|  (!) Can only change during Write phase       |
|                                               |
|  ----------------------------------------    |
|                                               |
|  Voting Limits                                |
|                                               |
|  Max votes per user: [ 5  v ]                 |
|  Max votes per card: [ 3  v ]                 |
|  (!) Can only change during Write/Group       |
|                                               |
|  ----------------------------------------    |
|                                               |
|         [ Cancel ]    [ Save Changes ]        |
|                                               |
+-----------------------------------------------+
```

---

## 3. Component Breakdown

### 3.1 Component Tree

```
<BoardPage>
  <BoardHeader>
    <BackLink />
    <Breadcrumbs team={Team} sprint={Sprint} />
    <PhaseIndicator currentPhase={Phase} />
    <TimerDisplay time={number} status={TimerStatus} />
    <VoteCounter remaining={number} total={number} />        // vote phase only
    <ParticipantAvatars participants={User[]} />
    <BoardSettingsButton />
  </BoardHeader>

  <BoardColumns>
    <BoardColumn column={Column}>                             // repeated per column
      <ColumnHeader name={string} color={string} count={number} />

      <CardList>
        <CardGroup group={Group}>                             // if cards are grouped
          <GroupHeader title={string} />
          <RetroCard card={Card} />
          <RetroCard card={Card} />
        </CardGroup>

        <RetroCard card={Card} />                             // ungrouped cards
        <RetroCard card={Card} />
      </CardList>

      <AddCardInput columnId={string} />                      // write phase only
    </BoardColumn>
  </BoardColumns>

  <PresenceBar users={ConnectedUser[]} />

  <FacilitatorToolbar>                                        // facilitator only
    <PhaseControls currentPhase={Phase} onPhaseChange={fn} />
    <TimerControls onStart={fn} onPause={fn} onReset={fn} duration={number} />
    <BoardControls locked={bool} anonymous={bool} focusMode={bool} />
    <NextPhaseButton />
  </FacilitatorToolbar>

  <DiscussionPanel>                                           // discuss phase, when item focused
    <FocusedItemDisplay item={Card | Group} />
    <CommentThread comments={Comment[]} />
    <CommentInput onSubmit={fn} />
  </DiscussionPanel>

  <ActionItemPanel>                                           // action phase
    <ActionItemList items={ActionItem[]} />
    <CreateActionItemForm />
    <CarriedOverItems items={ActionItem[]} />
  </ActionItemPanel>

  <BoardSettingsModal />                                      // opened on demand
</BoardPage>
```

### 3.2 Component Specifications

| Component | Description | Key Props | Phase Visibility |
|-----------|-------------|-----------|-----------------|
| `BoardPage` | Top-level page, manages WebSocket connection | -- | All |
| `BoardHeader` | Top bar with navigation, phase, timer, participants | `board`, `sprint`, `team` | All |
| `PhaseIndicator` | 5 dots/labels showing current phase | `currentPhase: Phase` | All |
| `TimerDisplay` | Countdown timer readout | `seconds`, `status` | All |
| `VoteCounter` | "X/Y votes remaining" display | `remaining`, `total` | Vote only |
| `ParticipantAvatars` | Stacked avatar circles with +N overflow | `participants: User[]` | All |
| `BoardColumns` | Horizontal scrollable column container | `children` | All |
| `BoardColumn` | Single column with header + cards | `column: Column` | All |
| `ColumnHeader` | Column name, color accent bar, card count | `name`, `color`, `count` | All |
| `RetroCard` | Individual feedback card | `card: Card`, `phase: Phase` | All |
| `CardVoteButton` | Upvote button with count | `card`, `onVote`, `votes` | Vote only |
| `CardAuthor` | Avatar + name (or anonymous) | `author`, `isAnonymous` | All |
| `CardActions` | Edit/Delete buttons for card owner | `card`, `onEdit`, `onDelete` | Write, Group |
| `CardDragHandle` | Drag grip icon for grouping | -- | Group only |
| `CardGroup` | Outlined container for grouped cards | `group: CardGroup` | Group, Vote, Discuss |
| `GroupHeader` | Group title, editable in group phase | `title`, `onEdit` | Group+ |
| `AddCardInput` | Text input to add new card to column | `columnId`, `onSubmit` | Write only |
| `PresenceBar` | Bottom bar showing connected users | `users: ConnectedUser[]` | All |
| `FacilitatorToolbar` | Floating bottom toolbar for facilitator | Multiple controls | All (facilitator only) |
| `PhaseControls` | 5 phase buttons | `currentPhase`, `onPhaseChange` | All (facilitator) |
| `TimerControls` | Start/pause/reset + duration input | Timer state + callbacks | All (facilitator) |
| `BoardControls` | Lock, reveal anonymous, focus mode toggles | Board settings | All (facilitator) |
| `NextPhaseButton` | Prominent "Next Phase" CTA | `nextPhase`, `onClick` | All (facilitator) |
| `DiscussionPanel` | Side/overlay panel for discussion thread | `focusedItem`, `comments` | Discuss |
| `CommentThread` | List of comments on focused item | `comments: Comment[]` | Discuss |
| `CommentInput` | Text input to add comment | `onSubmit` | Discuss |
| `ActionItemPanel` | Side panel for action item creation | `items`, `cards` | Action |
| `CreateActionItemForm` | Form: title, assignee, due date | `onSubmit`, `members` | Action |
| `CarriedOverItems` | List of unresolved items from previous sprint | `items` | Action |
| `BoardSettingsModal` | Settings dialog: anonymous mode, vote limits | `board`, `onSave` | Any (admin/facilitator) |
| `VotesBudgetBar` | Bottom bar showing vote usage | `used`, `total` | Vote only |

---

## 4. State Management (Zustand)

### 4.1 Board Store

```typescript
interface BoardStore {
  // Core board state
  board: Board | null;
  columns: Column[];
  cards: Card[];
  groups: CardGroup[];
  groupMembers: CardGroupMember[];

  // Phase & facilitator
  currentPhase: Phase;
  isFacilitator: boolean;
  isLocked: boolean;
  isAnonymous: boolean;
  focusedItemId: string | null;
  focusedItemType: 'card' | 'group' | null;

  // Timer
  timerSeconds: number;
  timerStatus: 'idle' | 'running' | 'paused';
  timerDuration: number;

  // Voting
  userVotesRemaining: number;
  maxVotesPerUser: number;
  maxVotesPerCard: number;
  cardVoteCounts: Record<string, number>;        // cardId -> total votes
  userCardVotes: Record<string, number>;          // cardId -> user's votes on that card

  // Presence
  connectedUsers: ConnectedUser[];

  // Discussion (discuss phase)
  comments: Comment[];
  isLoadingComments: boolean;

  // Action items (action phase)
  actionItems: ActionItem[];
  carriedOverItems: ActionItem[];

  // Loading
  isLoading: boolean;
  error: string | null;

  // WebSocket
  wsConnected: boolean;
  wsReconnecting: boolean;

  // Actions - Board
  fetchBoard: (boardId: string) => Promise<void>;
  subscribeToBoard: (boardId: string) => void;
  unsubscribeFromBoard: () => void;

  // Actions - Cards
  addCard: (columnId: string, content: string) => Promise<void>;
  editCard: (cardId: string, content: string) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;

  // Actions - Voting
  voteOnCard: (cardId: string) => Promise<void>;
  removeVoteFromCard: (cardId: string) => Promise<void>;

  // Actions - Grouping
  createGroup: (title: string, columnId: string) => Promise<void>;
  addCardToGroup: (cardId: string, groupId: string) => Promise<void>;
  removeCardFromGroup: (cardId: string) => Promise<void>;
  renameGroup: (groupId: string, title: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;

  // Actions - Facilitator
  changePhase: (phase: Phase) => Promise<void>;
  startTimer: (duration: number) => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  toggleLock: () => Promise<void>;
  toggleAnonymous: () => Promise<void>;
  setFocus: (itemId: string, itemType: 'card' | 'group') => Promise<void>;
  clearFocus: () => Promise<void>;

  // Actions - Discussion
  addComment: (content: string) => Promise<void>;
  fetchComments: (itemId: string) => Promise<void>;

  // Actions - Action Items
  createActionItem: (data: CreateActionItemData) => Promise<void>;
  fetchActionItems: () => Promise<void>;
  fetchCarriedOverItems: () => Promise<void>;

  // Actions - WebSocket event handlers
  handleCardCreated: (data: WsCardCreated) => void;
  handleCardUpdated: (data: WsCardUpdated) => void;
  handleCardDeleted: (data: WsCardDeleted) => void;
  handleVoteAdded: (data: WsVoteAdded) => void;
  handleVoteRemoved: (data: WsVoteRemoved) => void;
  handleGroupCreated: (data: WsGroupCreated) => void;
  handleGroupUpdated: (data: WsGroupUpdated) => void;
  handlePhaseChanged: (data: WsPhaseChanged) => void;
  handleFocusChanged: (data: WsFocusChanged) => void;
  handleBoardUpdated: (data: WsBoardUpdated) => void;
  handleUserJoined: (data: WsUserJoined) => void;
  handleUserLeft: (data: WsUserLeft) => void;
  handleTimerSync: (data: WsTimerSync) => void;
}
```

### 4.2 State Matrix -- Phase-Based UI

| UI Element | Write | Group | Vote | Discuss | Action |
|------------|-------|-------|------|---------|--------|
| Add card input | Visible | Hidden | Hidden | Hidden | Hidden |
| Card edit/delete buttons | Visible (own cards) | Visible (own cards) | Hidden | Hidden | Hidden |
| Card drag handle | Hidden | Visible | Hidden | Hidden | Hidden |
| Vote button on cards | Hidden | Hidden | Visible | Hidden | Hidden |
| Vote counter in header | Hidden | Hidden | Visible | Hidden | Hidden |
| Votes budget bar | Hidden | Hidden | Visible | Hidden | Hidden |
| "Create Group" button | Hidden | Visible | Hidden | Hidden | Hidden |
| Group containers | Hidden | Visible | Visible | Visible | Visible |
| Discussion panel | Hidden | Hidden | Hidden | Visible | Hidden |
| Comment input | Hidden | Hidden | Hidden | Visible | Hidden |
| Focus highlight | Hidden | Hidden | Hidden | Visible | Hidden |
| Action item panel | Hidden | Hidden | Hidden | Hidden | Visible |
| "Create Action" buttons | Hidden | Hidden | Hidden | Hidden | Visible |
| Carried-over items | Hidden | Hidden | Hidden | Hidden | Visible |

### 4.3 State Matrix -- Loading States

| State | `board` | `isLoading` | `wsConnected` | UI Behavior |
|-------|---------|-------------|---------------|-------------|
| Initial | `null` | `true` | `false` | Full page skeleton with column placeholders |
| Loaded, connecting WS | `{...}` | `false` | `false` | Board visible, "Connecting..." indicator |
| Loaded, connected | `{...}` | `false` | `true` | Fully interactive board |
| WS disconnected | `{...}` | `false` | `false` | Board visible, "Reconnecting..." banner |
| WS reconnected | `{...}` | `false` | `true` | Re-sync board state, clear banner |
| Board not found | `null` | `false` | `false` | 404 message |
| Access denied | `null` | `false` | `false` | 403 message |
| Empty board | `{...}` | `false` | `true` | Columns shown with "Add a card" CTA, no cards |

---

## 5. User Interactions

### 5.1 Card Interactions

| # | Action | Phase | Trigger | Result |
|---|--------|-------|---------|--------|
| 1 | Add card | Write | Type in "Add a card..." input, press Enter or click submit | Card appears in column, broadcast to all via WS |
| 2 | Edit card | Write, Group | Click "Edit" on own card | Inline edit mode, save on Enter or blur |
| 3 | Delete card | Write, Group | Click "Delete" on own card | Confirmation prompt, card removed, WS broadcast |
| 4 | Vote on card | Vote | Click "+1" vote button | Vote count increments, user's remaining votes decrements |
| 5 | Remove vote | Vote | Click filled heart on own vote | Vote count decrements, remaining votes increments |
| 6 | Drag card to group | Group | Drag card by handle, drop on group | Card added to group, WS broadcast |
| 7 | Remove card from group | Group | Drag card out of group or click ungroup | Card returns to ungrouped area |

### 5.2 Group Interactions

| # | Action | Phase | Trigger | Result |
|---|--------|-------|---------|--------|
| 8 | Create group | Group | Click "+ Create New Group", enter title | Empty group container appears |
| 9 | Rename group | Group | Click group title, type new name | Title updates, WS broadcast |
| 10 | Delete group | Group | Click "x ungroup" on group | Group dissolved, cards ungrouped |
| 11 | Drag card onto another card | Group | Drag card and drop on ungrouped card | New group auto-created containing both cards |

### 5.3 Facilitator Interactions

| # | Action | Phase | Trigger | Result |
|---|--------|-------|---------|--------|
| 12 | Change phase | Any | Click phase button in toolbar | Phase transitions, UI updates for all users |
| 13 | Next phase | Any | Click "Next Phase ->" button | Advance to next sequential phase |
| 14 | Start timer | Any | Click play button, set duration | Timer starts counting down for all users |
| 15 | Pause timer | Any | Click pause button | Timer freezes for all users |
| 16 | Reset timer | Any | Click reset button | Timer resets to configured duration |
| 17 | Lock board | Any | Click "Lock Board" toggle | All card inputs disabled for non-facilitators |
| 18 | Reveal anonymous | Write | Click "Reveal Anonymous" toggle | Author names shown on all cards |
| 19 | Set focus | Discuss | Click on card or group | Item highlighted, others dimmed, discussion thread opens |
| 20 | Clear focus | Discuss | Click "Clear Focus" or click focused item again | All items return to normal |

### 5.4 Discussion Interactions

| # | Action | Phase | Trigger | Result |
|---|--------|-------|---------|--------|
| 21 | Add comment | Discuss | Type in comment input, click Send | Comment appears in thread, WS broadcast |

### 5.5 Action Item Interactions

| # | Action | Phase | Trigger | Result |
|---|--------|-------|---------|--------|
| 22 | Create action from card | Action | Click "+ Create Action" on card | Pre-fills action item form with card context |
| 23 | Create manual action | Action | Click "+ Add Action Item Manually" | Opens blank action item form |
| 24 | Set assignee | Action | Select from member dropdown | Assignee set on action item |
| 25 | Set due date | Action | Select date in date picker | Due date set on action item |

### 5.6 Settings Interactions

| # | Action | Phase | Trigger | Result |
|---|--------|-------|---------|--------|
| 26 | Open settings | Any | Click Settings gear (admin/facilitator) | Open BoardSettingsModal |
| 27 | Toggle anonymous mode | Write | Toggle switch in settings | Mode changes, WS broadcast |
| 28 | Change vote limits | Write, Group | Number input in settings | Limits updated |
| 29 | Save settings | Any | Click "Save Changes" | API call, close modal |

---

## 6. Data Requirements

### 6.1 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/boards/:boardId` | GET | Fetch full board state (board + columns + cards + groups + votes) |
| `/api/v1/boards/:boardId` | PUT | Update board settings (anonymous, vote limits) |
| `/api/v1/boards/:boardId/cards` | POST | Add card to column |
| `/api/v1/boards/:boardId/cards/:cardId` | PUT | Edit card content |
| `/api/v1/boards/:boardId/cards/:cardId` | DELETE | Delete card |
| `/api/v1/boards/:boardId/cards/:cardId/votes` | POST | Cast vote on card |
| `/api/v1/boards/:boardId/cards/:cardId/votes` | DELETE | Remove vote from card |
| `/api/v1/boards/:boardId/groups` | POST | Create card group |
| `/api/v1/boards/:boardId/groups/:groupId` | PUT | Rename group |
| `/api/v1/boards/:boardId/groups/:groupId` | DELETE | Delete group |
| `/api/v1/boards/:boardId/groups/:groupId/cards` | POST | Add card to group |
| `/api/v1/boards/:boardId/groups/:groupId/cards/:cardId` | DELETE | Remove card from group |
| `/api/v1/boards/:boardId/phase` | PUT | Change board phase (facilitator) |
| `/api/v1/boards/:boardId/focus` | PUT | Set/clear discussion focus |
| `/api/v1/boards/:boardId/comments` | GET | Fetch comments for focused item |
| `/api/v1/boards/:boardId/comments` | POST | Add comment |
| `/api/v1/boards/:boardId/action-items` | GET | Fetch action items for this board |
| `/api/v1/boards/:boardId/action-items` | POST | Create action item |
| `/api/v1/boards/:boardId/action-items/carried-over` | GET | Fetch carried-over items from previous sprint |

### 6.2 WebSocket Events (Received)

| Event | Payload | UI Update |
|-------|---------|-----------|
| `card:created` | `{ card: Card }` | Insert card into correct column |
| `card:updated` | `{ card: Card }` | Update card content in place |
| `card:deleted` | `{ cardId, columnId }` | Remove card from column |
| `vote:added` | `{ cardId, totalVotes, userId }` | Increment vote count on card |
| `vote:removed` | `{ cardId, totalVotes, userId }` | Decrement vote count on card |
| `group:created` | `{ group: CardGroup }` | Add group container to column |
| `group:updated` | `{ group: CardGroup }` | Update group title |
| `group:deleted` | `{ groupId }` | Dissolve group, ungroup cards |
| `group:card_added` | `{ groupId, cardId }` | Move card visual into group |
| `group:card_removed` | `{ groupId, cardId }` | Move card visual out of group |
| `phase:changed` | `{ phase: Phase }` | Update entire board UI for new phase |
| `focus:changed` | `{ focusItemId, focusItemType }` | Highlight/dim cards |
| `board:updated` | `{ anonymous_mode, is_locked }` | Update board settings |
| `timer:sync` | `{ seconds, status }` | Sync timer display |
| `timer:expired` | `{}` | Show timer alert, optional sound |
| `user:joined` | `{ user: ConnectedUser }` | Add to presence bar |
| `user:left` | `{ userId }` | Remove from presence bar |
| `comment:created` | `{ comment: Comment }` | Append to discussion thread |

### 6.3 Data Types

```typescript
type Phase = 'write' | 'group' | 'vote' | 'discuss' | 'action';
type TimerStatus = 'idle' | 'running' | 'paused';

interface Board {
  id: string;
  sprint_id: string;
  sprint_name: string;
  team_id: string;
  team_name: string;
  template_id: string;
  phase: Phase;
  anonymous_mode: boolean;
  is_locked: boolean;
  max_votes_per_user: number;
  max_votes_per_card: number;
  focus_item_id: string | null;
  focus_item_type: 'card' | 'group' | null;
  created_by: string;
  created_at: string;
}

interface Column {
  id: string;
  board_id: string;
  name: string;
  color: string;                // hex color for accent
  position: number;
}

interface Card {
  id: string;
  column_id: string;
  board_id: string;
  content: string;
  author_id: string | null;     // null when anonymous_mode and non-admin
  author_name: string | null;
  author_avatar: string | null;
  position: number;
  vote_count: number;
  user_votes: number;           // how many votes current user cast on this card
  group_id: string | null;
  created_at: string;
}

interface CardGroup {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  position: number;
  card_ids: string[];
  total_votes: number;
}

interface ConnectedUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  status: 'online' | 'idle';
  is_facilitator: boolean;
}

interface Comment {
  id: string;
  board_id: string;
  item_id: string;
  item_type: 'card' | 'group';
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  created_at: string;
}

interface CreateActionItemData {
  title: string;
  assignee_id: string;
  due_date: string;
  source_card_id?: string;
  source_group_id?: string;
}
```

---

## 7. Responsive Behavior

| Breakpoint | Layout Change |
|------------|---------------|
| `< 640px` (mobile) | Single column visible at a time with swipe/nav to switch columns. Phase indicator collapses to current phase only. Facilitator toolbar becomes slide-up sheet. |
| `640px - 1023px` (tablet) | 2 columns visible at a time, horizontal scroll for others. Timer and votes in header move to second line. |
| `1024px - 1439px` (desktop) | 3 columns visible (standard retro). Facilitator toolbar at bottom. |
| `>= 1440px` (wide) | Up to 5 columns visible. More breathing room between cards. |

### Mobile Column Navigation

```
+------------------------+
| < Prev   [2/3]  Next > |   <- Column navigation
+------------------------+
|                        |
|  What Didn't Go Well   |
|  ##################    |
|                        |
|  +--------------------+|
|  | Too many meetings  ||
|  | this sprint...     ||
|  |                    ||
|  | <3<3<3  3          ||
|  | (AV) Anonymous     ||
|  +--------------------+|
|                        |
|  +--------------------+|
|  | CI pipeline...     ||
|  |                    ||
|  +--------------------+|
|                        |
|  + - - - - - - - - - -+|
|  | + Add a card...    ||
|  + - - - - - - - - - -+|
|                        |
+------------------------+
```

---

## 8. Real-Time and WebSocket Integration

### 8.1 Connection Lifecycle

```
Board Page Mounts
       |
       v
Connect WebSocket: ws://host/ws/boards/:boardId
       |
       v
Send: { type: "auth", token: accessToken }
       |
       +-- Auth success -> Send: { type: "join", boardId }
       |                          |
       |                          v
       |                   Receive: { type: "board:state", ...fullState }
       |                          |
       |                          v
       |                   Listen for incremental events
       |
       +-- Auth failure -> Show error, redirect to login
```

### 8.2 Reconnection Strategy

| Attempt | Delay | Behavior |
|---------|-------|----------|
| 1 | 1s | Immediate retry |
| 2 | 2s | Short delay |
| 3 | 4s | Exponential backoff |
| 4 | 8s | Continue backoff |
| 5+ | 15s | Cap at 15s, keep retrying |
| After reconnect | 0s | Re-fetch full board state to sync |

Show "Reconnecting..." banner during attempts. Show "Connection lost" after 30s of failure.

### 8.3 Optimistic Updates

| Action | Optimistic Behavior | Rollback on Failure |
|--------|--------------------|--------------------|
| Add card | Card appears immediately in column | Remove card, show error toast |
| Edit card | Content updates immediately | Revert to previous content |
| Delete card | Card disappears immediately | Card re-appears |
| Cast vote | Vote count increments, remaining decrements | Revert both counts |
| Remove vote | Vote count decrements, remaining increments | Revert both counts |
| Add comment | Comment appears in thread | Remove comment, show error |

---

## 9. Accessibility

| Element | ARIA / A11y Requirement |
|---------|------------------------|
| Column | `role="region"`, `aria-label="{column name}"` |
| Card | `role="article"`, `aria-label` with card content preview |
| Card drag handle | `aria-label="Drag to reorder or group"`, keyboard: Space to grab, arrows to move, Enter to drop |
| Vote button | `aria-label="Vote for this card. Current votes: {n}"`, `aria-pressed` for own votes |
| Phase indicator | `role="progressbar"`, `aria-valuenow`, `aria-valuetext="{phase name}"` |
| Timer | `aria-live="polite"` for time updates, `aria-label="Timer: {mm:ss}"` |
| Presence bar | `role="status"`, `aria-label="{n} participants online"` |
| Focus highlight | `aria-current="true"` on focused item |
| Facilitator toolbar | `role="toolbar"`, `aria-label="Facilitator controls"` |
| Discussion thread | `role="log"`, `aria-label="Discussion thread"` |
| Add card input | `aria-label="Add a card to {column name}"` |
| Comment input | `aria-label="Add a comment to the discussion"` |
| Settings modal | `role="dialog"`, `aria-modal="true"`, focus trap |
| Card delete confirmation | `role="alertdialog"` |

---

## 10. Keyboard Shortcuts

| Shortcut | Action | Phase |
|----------|--------|-------|
| `N` | Focus "Add card" input in first column | Write |
| `1` - `5` | Focus "Add card" input in column N | Write |
| `V` | Vote on currently focused card | Vote |
| `Esc` | Cancel current input / close panel / close modal | All |
| `Tab` / `Shift+Tab` | Navigate between cards | All |
| `Enter` | Open focused card detail / submit input | All |
| `Ctrl+Enter` | Submit card or comment | Write, Discuss |
| `F` | Set focus on currently highlighted card (facilitator) | Discuss |
| `Right Arrow` / `Left Arrow` | Navigate phases (facilitator) | All |
| `Space` | Start/pause timer (facilitator) | All |
| `?` | Show keyboard shortcut help overlay | All |

---

## 11. Error Handling

| Scenario | UI Response |
|----------|-------------|
| Board not found | Full page 404: "Board not found. It may have been deleted." + Back link |
| Access denied | Full page 403: "You don't have access to this board." + Back link |
| WebSocket disconnect | Yellow banner: "Reconnecting..." with spinner |
| WebSocket permanent failure | Red banner: "Connection lost. Your changes may not be saved." + Retry button |
| Add card fails | Remove optimistic card, show toast: "Failed to add card" |
| Vote fails (limit reached) | Revert optimistic vote, show toast: "Vote limit reached" |
| Vote fails (wrong phase) | Revert, show toast: "Voting is not available in this phase" |
| Phase change fails | Revert phase indicator, show toast: "Failed to change phase" |
| Timer sync lost | Re-sync on next WS message, show brief "Syncing..." |
| Card edit conflict | Show conflict resolution: "This card was edited by someone else. Keep yours / Keep theirs" |
| Settings save fails | Keep modal open, show inline error |
