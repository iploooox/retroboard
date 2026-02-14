# UI Page Spec: Team Dashboard

**Feature:** retro-board
**Page:** Team Dashboard (Landing Page)
**URL:** `/dashboard`
**Auth:** Required (redirects to `/login` if unauthenticated)
**Stories:** S-003, S-006, S-022

---

## 1. Overview

The team dashboard is the primary landing page after login. It provides a bird's-eye view of all teams the user belongs to, recent retro activity across those teams, and upcoming action items that need attention. The page is designed to answer three questions immediately: "Which teams am I on?", "What happened recently?", and "What do I owe?"

---

## 2. ASCII Wireframe

```
+============================================================================+
|  [RetroBoard Pro Logo]            /dashboard           [Avatar ▼] [Logout] |
+============================================================================+
|                                                                            |
|  Good morning, Alice!                                          [+ Create   |
|                                                                  Team]     |
|  ┌─ MY TEAMS ──────────────────────────────────────────────────────────┐   |
|  │                                                                     │   |
|  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────┐  │   |
|  │  │ ┌──┐                │  │ ┌──┐                │  │ ┌──┐       │  │   |
|  │  │ │AV│ Platform Team  │  │ │AV│ Mobile Squad   │  │ │AV│ Data  │  │   |
|  │  │ └──┘                │  │ └──┘                │  │ └──┘ Engin.│  │   |
|  │  │                     │  │                     │  │            │  │   |
|  │  │  👥 8 members       │  │  👥 5 members       │  │  👥 6 memb │  │   |
|  │  │                     │  │                     │  │            │  │   |
|  │  │  Last sprint:       │  │  Last sprint:       │  │  Last:     │  │   |
|  │  │  Sprint 24          │  │  Sprint 12          │  │  Sprint 8  │  │   |
|  │  │                     │  │                     │  │            │  │   |
|  │  │  ┌───────────────┐  │  │  ┌───────────────┐  │  │ ┌────────┐│  │   |
|  │  │  │ Open Retro ->  │  │  │ Open Retro ->  │  │  │ │Open -> ││  │   |
|  │  │  └───────────────┘  │  │  └───────────────┘  │  │ └────────┘│  │   |
|  │  └─────────────────────┘  └─────────────────────┘  └────────────┘  │   |
|  │                                                                     │   |
|  └─────────────────────────────────────────────────────────────────────┘   |
|                                                                            |
|  ┌─ RECENT ACTIVITY ──────────────────┐  ┌─ ACTION ITEMS DUE ──────────┐  |
|  │                                    │  │                              │  |
|  │  ● Platform Team completed retro   │  │  ☐ Fix flaky test suite     │  |
|  │    Sprint 24 - 2 hours ago         │  │    Platform Team · Due Feb 15│  |
|  │                                    │  │                              │  |
|  │  ● Mobile Squad completed retro    │  │  ☐ Update API docs          │  |
|  │    Sprint 12 - 1 day ago           │  │    Platform Team · Due Feb 18│  |
|  │                                    │  │                              │  |
|  │  ● Data Engineering completed      │  │  ☐ Schedule design review   │  |
|  │    retro Sprint 8 - 3 days ago     │  │    Mobile Squad · Due Feb 16 │  |
|  │                                    │  │                              │  |
|  │  ● Platform Team completed retro   │  │  ☐ Migrate to new CI        │  |
|  │    Sprint 23 - 1 week ago          │  │    Data Eng. · Due Feb 20   │  |
|  │                                    │  │                              │  |
|  │  ● Mobile Squad completed retro    │  │  ☐ Write post-mortem        │  |
|  │    Sprint 11 - 2 weeks ago         │  │    Platform Team · Overdue! │  |
|  │                                    │  │                              │  |
|  │  [View all activity]               │  │  [View all action items]    │  |
|  └────────────────────────────────────┘  └──────────────────────────────┘  |
|                                                                            |
+============================================================================+
```

---

## 3. Component Breakdown

### 3.1 Component Tree

```
<DashboardPage>
  <AppHeader />
  <DashboardGreeting userName={string} />
  <CreateTeamButton />
  <TeamCardGrid>
    <TeamCard team={Team} />        // repeated for each team
    <TeamCard team={Team} />
    ...
  </TeamCardGrid>
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <RecentActivityFeed activities={Activity[]} />
    <ActionItemsDueList actionItems={ActionItem[]} />
  </div>
</DashboardPage>
```

### 3.2 Component Specifications

| Component | Description | Props | Notes |
|-----------|-------------|-------|-------|
| `DashboardPage` | Top-level page container | -- | Fetches all dashboard data on mount |
| `AppHeader` | Global nav header with logo, breadcrumb, user menu | `user: User` | Shared across all pages |
| `DashboardGreeting` | Time-of-day greeting with user name | `userName: string` | "Good morning/afternoon/evening, {name}!" |
| `CreateTeamButton` | Primary CTA to create a new team | `onClick: () => void` | Opens `CreateTeamModal` |
| `TeamCardGrid` | Responsive grid container for team cards | `children: ReactNode` | `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` |
| `TeamCard` | Individual team card with summary and quick action | `team: TeamSummary` | Clickable navigates to `/teams/:teamId` |
| `RecentActivityFeed` | List of last 5 retro completions | `activities: Activity[]` | Shows relative timestamps |
| `ActionItemsDueList` | List of upcoming/overdue action items | `actionItems: ActionItem[]` | Sorted by due date, overdue items highlighted red |
| `CreateTeamModal` | Modal form for creating a new team | `onSubmit, onClose` | Fields: name, description |

### 3.3 Component Detail: TeamCard

```
┌───────────────────────────────┐
│  ┌──────┐                     │
│  │Avatar│  {team.name}        │   <- Click anywhere navigates to team
│  └──────┘                     │
│                               │
│  {memberCount} members        │   <- Icon + count
│                               │
│  Last sprint: {sprintName}    │   <- Muted text, or "No sprints yet"
│                               │
│  ┌─────────────────────────┐  │
│  │    Open Current Retro   │  │   <- Primary button, only if active board
│  └─────────────────────────┘  │
│                               │
└───────────────────────────────┘
```

**States:**
- Default: Shows team info with "Open Retro" button
- No active retro: Button text changes to "Start New Retro" (navigates to sprint creation)
- Hover: Card background lightens, subtle shadow elevation
- No sprints: "Last sprint" row shows "No sprints yet" in muted italic

---

## 4. State Management (Zustand)

### 4.1 Dashboard Store

```typescript
interface DashboardStore {
  // Data
  teams: TeamSummary[];
  recentActivity: Activity[];
  actionItemsDue: ActionItem[];

  // Loading states
  isLoadingTeams: boolean;
  isLoadingActivity: boolean;
  isLoadingActions: boolean;

  // Errors
  teamsError: string | null;
  activityError: string | null;
  actionsError: string | null;

  // Actions
  fetchTeams: () => Promise<void>;
  fetchRecentActivity: () => Promise<void>;
  fetchActionItemsDue: () => Promise<void>;
  fetchAll: () => Promise<void>;
  createTeam: (name: string, description: string) => Promise<TeamSummary>;
}
```

### 4.2 State Matrix

| State | `teams` | `isLoadingTeams` | `teamsError` | UI Behavior |
|-------|---------|------------------|-------------|-------------|
| Initial | `[]` | `true` | `null` | Show skeleton cards (3 placeholders) |
| Loaded | `[...data]` | `false` | `null` | Render team cards |
| Empty | `[]` | `false` | `null` | Show empty state with "Create your first team" CTA |
| Error | `[]` | `false` | `string` | Show error banner with retry button |
| Refreshing | `[...stale]` | `true` | `null` | Show stale data with subtle loading indicator |

| State | `recentActivity` | `isLoadingActivity` | UI Behavior |
|-------|-------------------|---------------------|-------------|
| Initial | `[]` | `true` | Show skeleton lines (5 placeholders) |
| Loaded | `[...data]` | `false` | Render activity items with relative times |
| Empty | `[]` | `false` | Show "No recent activity" message |
| Error | `[]` | `false` | Show inline error with retry |

| State | `actionItemsDue` | `isLoadingActions` | UI Behavior |
|-------|-------------------|---------------------|-------------|
| Initial | `[]` | `true` | Show skeleton list |
| Loaded | `[...data]` | `false` | Render action items, overdue items in red |
| Empty | `[]` | `false` | Show "No action items due" with checkmark icon |
| Error | `[]` | `false` | Show inline error with retry |

---

## 5. User Interactions

| # | User Action | Trigger | Result | Navigation |
|---|-------------|---------|--------|------------|
| 1 | Click team card body | `onClick` on `TeamCard` | Navigate to team detail | `/teams/:teamId` |
| 2 | Click "Open Retro" on team card | `onClick` on button (stops propagation) | Navigate directly to active board | `/boards/:boardId` |
| 3 | Click "Create Team" button | `onClick` on `CreateTeamButton` | Open `CreateTeamModal` | -- (modal) |
| 4 | Submit Create Team form | `onSubmit` in modal | API call, add team to list, close modal | -- |
| 5 | Click activity item | `onClick` on `ActivityItem` | Navigate to completed retro board | `/boards/:boardId` |
| 6 | Click action item | `onClick` on `ActionItem` | Navigate to team action items tab | `/teams/:teamId?tab=actions` |
| 7 | Click "View all activity" | `onClick` link | (Future) Navigate to full activity page | -- |
| 8 | Click "View all action items" | `onClick` link | Navigate to action items across teams | -- |
| 9 | Click user avatar menu | `onClick` on avatar | Open dropdown: Profile, Settings, Logout | Various |
| 10 | Click retry on error | `onClick` on retry button | Re-fetch failed data section | -- |

---

## 6. Data Requirements

### 6.1 API Endpoints

| Endpoint | Method | Purpose | Response Shape |
|----------|--------|---------|----------------|
| `/api/v1/teams` | GET | Fetch user's teams with summary data | `{ teams: TeamSummary[] }` |
| `/api/v1/activity/recent` | GET | Fetch last 5 retro completions | `{ activities: Activity[] }` |
| `/api/v1/action-items/due` | GET | Fetch upcoming action items for user | `{ action_items: ActionItem[] }` |
| `/api/v1/teams` | POST | Create a new team | `{ team: TeamSummary }` |

### 6.2 Data Types

```typescript
interface TeamSummary {
  id: string;                  // UUID
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  last_sprint: {
    id: string;
    name: string;
  } | null;
  active_board: {
    id: string;
    phase: BoardPhase;
  } | null;
  role: 'admin' | 'facilitator' | 'member';
}

interface Activity {
  id: string;
  type: 'retro_completed';
  team_id: string;
  team_name: string;
  sprint_id: string;
  sprint_name: string;
  board_id: string;
  completed_at: string;        // ISO 8601
}

interface ActionItem {
  id: string;
  title: string;
  team_id: string;
  team_name: string;
  sprint_id: string;
  assignee_id: string;
  due_date: string;            // ISO 8601 date
  is_overdue: boolean;
  status: 'pending' | 'in_progress' | 'done';
}
```

### 6.3 Query Parameters

| Endpoint | Param | Type | Default | Description |
|----------|-------|------|---------|-------------|
| `/api/v1/activity/recent` | `limit` | number | 5 | Number of activity items to return |
| `/api/v1/action-items/due` | `days_ahead` | number | 14 | How many days ahead to look for due items |
| `/api/v1/action-items/due` | `include_overdue` | boolean | true | Include overdue items in response |

---

## 7. Responsive Behavior

| Breakpoint | Team Cards Grid | Activity/Actions Layout | Notes |
|------------|----------------|------------------------|-------|
| `< 640px` (mobile) | 1 column, full width | Stacked vertically | Activity above Actions |
| `640px - 1023px` (tablet) | 2 columns | Stacked vertically | |
| `1024px - 1279px` (desktop) | 2 columns | Side by side (50/50) | |
| `>= 1280px` (wide) | 3 columns | Side by side (50/50) | Max container width: 1280px |

---

## 8. Loading & Empty States

### 8.1 Skeleton Loading

```
┌─ MY TEAMS ───────────────────────────────────────┐
│  ┌────────────────┐  ┌────────────────┐          │
│  │ ░░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░░░░ │          │
│  │ ░░░░░░░░       │  │ ░░░░░░░░       │          │
│  │ ░░░░░░░░░░░    │  │ ░░░░░░░░░░░    │          │
│  │ ░░░░░░░░░░░░░  │  │ ░░░░░░░░░░░░░  │          │
│  └────────────────┘  └────────────────┘          │
└──────────────────────────────────────────────────┘
```

### 8.2 Empty State (No Teams)

```
┌──────────────────────────────────────────────────┐
│                                                  │
│              ┌────────────────┐                   │
│              │   (team icon)  │                   │
│              └────────────────┘                   │
│                                                  │
│          You're not on any teams yet.             │
│    Create a team to start running retrospectives. │
│                                                  │
│            ┌──────────────────────┐               │
│            │  + Create Your First │               │
│            │       Team           │               │
│            └──────────────────────┘               │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 9. Accessibility

| Element | ARIA / A11y Requirement |
|---------|------------------------|
| Team card | `role="article"`, `aria-label="{team name} team"` |
| "Open Retro" button | `aria-label="Open current retro for {team name}"` |
| Activity feed | `role="feed"`, `aria-label="Recent activity"` |
| Action items list | `role="list"`, `aria-label="Upcoming action items"` |
| Overdue indicator | `aria-label="Overdue"`, red color + text label (not color-only) |
| Create Team modal | Focus trap, `aria-modal="true"`, `role="dialog"` |
| Skeleton loaders | `aria-busy="true"`, `aria-label="Loading..."` |
| Greeting heading | `<h1>` element for page title |

---

## 10. Error Handling

| Error Scenario | UI Response |
|----------------|-------------|
| Network failure (all fetches) | Banner at top: "Failed to load dashboard. Check your connection." + Retry |
| Teams fetch fails | Error state in teams section only; activity and actions still load |
| Activity fetch fails | Inline error in activity section with retry |
| Action items fetch fails | Inline error in action items section with retry |
| Create team fails (validation) | Inline field errors in modal form |
| Create team fails (server) | Toast notification with error message |
| 401 Unauthorized | Redirect to `/login` (handled by auth interceptor) |
