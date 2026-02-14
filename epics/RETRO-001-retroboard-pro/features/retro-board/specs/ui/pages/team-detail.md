# UI Page Spec: Team Detail

**Feature:** retro-board
**Page:** Team Detail
**URL:** `/teams/:teamId`
**Auth:** Required (must be team member)
**Stories:** S-003, S-004, S-005, S-006, S-022

---

## 1. Overview

The team detail page is the central hub for managing a single team. It shows the team header with name, description, and settings access, then a tabbed interface covering Sprints, Members, Action Items, and Analytics. The page adapts based on the user's role within the team (admin, facilitator, or member).

---

## 2. ASCII Wireframe

### 2.1 Full Page Layout

```
+============================================================================+
|  [Logo]  Dashboard > Platform Team                   [Avatar ▼] [Logout]   |
+============================================================================+
|                                                                            |
|  ┌──────────────────────────────────────────────────────────────────────┐  |
|  │  ┌──────┐                                                           │  |
|  │  │ TEAM │   Platform Team                              [Settings]   │  |
|  │  │AVATAR│   Building the core platform infrastructure   [gear icon] │  |
|  │  └──────┘   8 members · 24 sprints · admin                         │  |
|  └──────────────────────────────────────────────────────────────────────┘  |
|                                                                            |
|  ┌──────────┬──────────┬───────────────┬────────────┐                     |
|  │ Sprints  │ Members  │ Action Items  │ Analytics  │                     |
|  │ (active) │          │     (3)       │            │                     |
|  ├──────────┴──────────┴───────────────┴────────────┴──────────────────┐  |
|  │                                                                     │  |
|  │                    <<< TAB CONTENT AREA >>>                         │  |
|  │                                                                     │  |
|  │                (See sections 2.2 - 2.5 below)                       │  |
|  │                                                                     │  |
|  └─────────────────────────────────────────────────────────────────────┘  |
|                                                                            |
+============================================================================+
```

### 2.2 Sprints Tab

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Sprints                                                [+ New Sprint]  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Sprint 24          Feb 3 - Feb 14, 2026        ┌──────────┐   │    │
│  │  ● Active                                       │ Open      │   │    │
│  │  Retro: In Progress (Vote phase)                │ Board ->  │   │    │
│  │  12 cards · 8 participants                      └──────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Sprint 23          Jan 20 - Jan 31, 2026       ┌──────────┐   │    │
│  │  ✓ Completed                                    │ View      │   │    │
│  │  Retro: Done · 18 cards · 5 actions created     │ Board ->  │   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Sprint 22          Jan 6 - Jan 17, 2026        ┌──────────┐   │    │
│  │  ✓ Completed                                    │ View      │   │    │
│  │  Retro: Done · 15 cards · 3 actions created     │ Board ->  │   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Sprint 21          Dec 23, 2025 - Jan 3, 2026  ┌──────────┐   │    │
│  │  ✓ Completed                                    │ View      │   │    │
│  │  No retro conducted                             │ Board ->  │   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  [Show older sprints...]                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Members Tab

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Members (8)                                         [+ Invite Member]  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  ┌──┐  Alice Johnson        admin          alice@example.com      │  │
│  │  │AV│  Joined Jan 2025                                  [...]    │  │
│  │  └──┘                                                             │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  ┌──┐  Bob Smith            facilitator    bob@example.com        │  │
│  │  │AV│  Joined Feb 2025                                  [...]    │  │
│  │  └──┘                                                             │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  ┌──┐  Carol Davis          member         carol@example.com      │  │
│  │  │AV│  Joined Mar 2025                                  [...]    │  │
│  │  └──┘                                                             │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  ┌──┐  Dave Wilson          member         dave@example.com       │  │
│  │  │AV│  Joined Mar 2025                                  [...]    │  │
│  │  └──┘                                                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─ PENDING INVITATIONS ────────────────────────────────────────────┐   │
│  │  eve@example.com     Invited Feb 10, 2026     [Resend] [Revoke]  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Action Items Tab

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Action Items                                                           │
│                                                                         │
│  Filter: [All ▼]  [All Sprints ▼]  [All Assignees ▼]  [Search...]     │
│                                                                         │
│  ┌─ OVERDUE (2) ───────────────────────────────────────────────────┐    │
│  │  ☐  Write post-mortem for outage                                │    │
│  │     Sprint 23 · Alice Johnson · Due Feb 7 (7 days overdue)     │    │
│  │                                                                  │    │
│  │  ☐  Update deployment runbook                                    │    │
│  │     Sprint 23 · Bob Smith · Due Feb 10 (4 days overdue)         │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─ UPCOMING (3) ──────────────────────────────────────────────────┐    │
│  │  ☐  Fix flaky test suite                                        │    │
│  │     Sprint 24 · Carol Davis · Due Feb 15                        │    │
│  │                                                                  │    │
│  │  ☐  Schedule design review meeting                               │    │
│  │     Sprint 24 · Alice Johnson · Due Feb 18                      │    │
│  │                                                                  │    │
│  │  ☐  Migrate CI/CD to new provider                                │    │
│  │     Sprint 24 · Dave Wilson · Due Feb 20                        │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─ COMPLETED (12) ────────────────────────────────────────────────┐    │
│  │  ✓  Add monitoring to payment service                            │    │
│  │     Sprint 22 · Bob Smith · Completed Jan 20                    │    │
│  │                                                                  │    │
│  │  [Show more completed items...]                                  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.5 Analytics Tab

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Analytics                       Sprint range: [Last 10 sprints ▼]     │
│                                                                         │
│  ┌─ TEAM HEALTH TREND ─────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  Score                                                           │   │
│  │   10 ┤                                                           │   │
│  │    8 ┤          *                              *                 │   │
│  │    6 ┤     *         *    *    *    *    *                        │   │
│  │    4 ┤  *                                          *             │   │
│  │    2 ┤                                                           │   │
│  │    0 ┼────────────────────────────────────────────────           │   │
│  │       S15  S16  S17  S18  S19  S20  S21  S22  S23  S24          │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  (See analytics feature spec for full chart details)                    │
│  [View Full Analytics ->]                                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown

### 3.1 Component Tree

```
<TeamDetailPage>
  <AppHeader breadcrumbs={["Dashboard", teamName]} />
  <TeamHeader team={Team} userRole={Role} />
  <TabBar activeTab={string} onTabChange={fn} tabs={Tab[]} />
  <TabContent>
    {activeTab === 'sprints'  && <SprintsTab teamId={string} />}
    {activeTab === 'members'  && <MembersTab teamId={string} userRole={Role} />}
    {activeTab === 'actions'  && <ActionItemsTab teamId={string} />}
    {activeTab === 'analytics' && <AnalyticsTab teamId={string} />}
  </TabContent>
</TeamDetailPage>
```

### 3.2 Component Specifications

| Component | Description | Key Props | Notes |
|-----------|-------------|-----------|-------|
| `TeamDetailPage` | Page container, fetches team on mount | -- | URL param: `:teamId` |
| `TeamHeader` | Team avatar, name, description, stats, settings link | `team`, `userRole` | Settings gear only for admin |
| `TabBar` | Horizontal tab navigation | `activeTab`, `onTabChange`, `tabs` | Badge count on Action Items tab |
| `SprintsTab` | Sprint list with statuses | `teamId` | Paginated, newest first |
| `SprintRow` | Single sprint in list | `sprint: SprintSummary` | Status badge, board link |
| `MembersTab` | Member list with roles | `teamId`, `userRole` | Invite button for admin/facilitator |
| `MemberRow` | Single member in list | `member: TeamMember` | Role badge, action menu for admin |
| `ActionItemsTab` | Filtered action items list | `teamId` | Grouped by status: Overdue, Upcoming, Completed |
| `ActionItemRow` | Single action item | `item: ActionItem` | Checkbox to toggle completion |
| `AnalyticsTab` | Health trend chart preview | `teamId` | Links to full analytics dashboard |
| `NewSprintModal` | Modal to create sprint | `teamId`, `onSubmit` | Fields: name, start_date, end_date |
| `InviteMemberModal` | Modal to invite via email | `teamId`, `onSubmit` | Fields: email, role |
| `TeamSettingsModal` | Modal for team settings | `team`, `onSubmit` | Fields: name, description, avatar |
| `MemberActionMenu` | Dropdown for member actions | `member`, `userRole` | Change role, remove member |

---

## 4. State Management (Zustand)

### 4.1 Team Detail Store

```typescript
interface TeamDetailStore {
  // Core
  team: TeamDetail | null;
  activeTab: 'sprints' | 'members' | 'actions' | 'analytics';
  isLoading: boolean;
  error: string | null;

  // Sprints
  sprints: SprintSummary[];
  sprintsPage: number;
  sprintsHasMore: boolean;
  isLoadingSprints: boolean;

  // Members
  members: TeamMember[];
  pendingInvites: Invitation[];
  isLoadingMembers: boolean;

  // Action Items
  actionItems: ActionItem[];
  actionItemsFilter: ActionItemFilter;
  isLoadingActions: boolean;

  // Actions
  fetchTeam: (teamId: string) => Promise<void>;
  setActiveTab: (tab: string) => void;
  fetchSprints: (teamId: string, page?: number) => Promise<void>;
  createSprint: (teamId: string, data: CreateSprintData) => Promise<void>;
  fetchMembers: (teamId: string) => Promise<void>;
  inviteMember: (teamId: string, email: string, role: string) => Promise<void>;
  changeMemberRole: (teamId: string, userId: string, role: string) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  fetchActionItems: (teamId: string, filter?: ActionItemFilter) => Promise<void>;
  toggleActionItem: (itemId: string) => Promise<void>;
  updateTeamSettings: (teamId: string, data: UpdateTeamData) => Promise<void>;
}
```

### 4.2 State Matrix

| State | `team` | `isLoading` | `error` | UI Behavior |
|-------|--------|-------------|---------|-------------|
| Initial | `null` | `true` | `null` | Full page skeleton |
| Loaded | `{...}` | `false` | `null` | Render team header + active tab |
| Not found | `null` | `false` | `"Team not found"` | 404 message with back link |
| Forbidden | `null` | `false` | `"Access denied"` | 403 message |
| Error | `null` | `false` | `string` | Error banner with retry |

| State | Sprints Tab | Members Tab | Action Items Tab |
|-------|-------------|-------------|-------------------|
| Loading | Skeleton rows (4) | Skeleton rows (6) | Skeleton rows (5) |
| Loaded | Sprint rows with badges | Member list with roles | Grouped action items |
| Empty | "No sprints yet. Create one!" | Shows only current user | "No action items yet" |
| Error | Inline error + retry | Inline error + retry | Inline error + retry |

---

## 5. User Interactions

| # | Action | Tab | Role Required | Trigger | Result |
|---|--------|-----|---------------|---------|--------|
| 1 | Switch tab | All | Any | Click tab | Load tab content, update URL query param `?tab=` |
| 2 | Click "New Sprint" | Sprints | Admin, Facilitator | Button click | Open `NewSprintModal` |
| 3 | Submit new sprint | Sprints | Admin, Facilitator | Modal submit | Create sprint, prepend to list |
| 4 | Click "Open Board" | Sprints | Any | Button click | Navigate to `/boards/:boardId` |
| 5 | Click "View Board" | Sprints | Any | Button click | Navigate to `/boards/:boardId` (read-only for completed) |
| 6 | Click "Invite Member" | Members | Admin | Button click | Open `InviteMemberModal` |
| 7 | Click member action menu | Members | Admin | `[...]` click | Show dropdown: Change Role, Remove |
| 8 | Change member role | Members | Admin | Dropdown select | API call, update role badge |
| 9 | Remove member | Members | Admin | Dropdown + confirm | API call, remove from list |
| 10 | Resend invitation | Members | Admin | Button click | API call, show toast confirmation |
| 11 | Revoke invitation | Members | Admin | Button + confirm | API call, remove from pending list |
| 12 | Toggle action item | Actions | Any | Checkbox click | API call, move between sections |
| 13 | Filter action items | Actions | Any | Dropdown change | Re-filter local data |
| 14 | Click Settings gear | Header | Admin | Icon click | Open `TeamSettingsModal` |
| 15 | Load more sprints | Sprints | Any | "Show older" click | Fetch next page, append to list |

---

## 6. Data Requirements

### 6.1 API Endpoints

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/v1/teams/:teamId` | GET | Fetch team details | `{ team: TeamDetail }` |
| `/api/v1/teams/:teamId` | PUT | Update team settings | `{ team: TeamDetail }` |
| `/api/v1/teams/:teamId/sprints` | GET | List sprints (paginated) | `{ sprints: SprintSummary[], has_more: bool }` |
| `/api/v1/teams/:teamId/sprints` | POST | Create sprint | `{ sprint: SprintSummary }` |
| `/api/v1/teams/:teamId/members` | GET | List members | `{ members: TeamMember[] }` |
| `/api/v1/teams/:teamId/members` | POST | Invite member | `{ invitation: Invitation }` |
| `/api/v1/teams/:teamId/members/:userId` | PUT | Update member role | `{ member: TeamMember }` |
| `/api/v1/teams/:teamId/members/:userId` | DELETE | Remove member | `204 No Content` |
| `/api/v1/teams/:teamId/invitations` | GET | List pending invites | `{ invitations: Invitation[] }` |
| `/api/v1/teams/:teamId/invitations/:id/resend` | POST | Resend invitation | `200 OK` |
| `/api/v1/teams/:teamId/invitations/:id` | DELETE | Revoke invitation | `204 No Content` |
| `/api/v1/teams/:teamId/action-items` | GET | List action items | `{ action_items: ActionItem[] }` |
| `/api/v1/action-items/:id` | PUT | Update action item status | `{ action_item: ActionItem }` |

### 6.2 Data Types

```typescript
interface TeamDetail {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  sprint_count: number;
  user_role: 'admin' | 'facilitator' | 'member';
  created_at: string;
}

interface SprintSummary {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'planned';
  board: {
    id: string;
    phase: BoardPhase;
    card_count: number;
    participant_count: number;
    action_count: number;
  } | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  role: 'admin' | 'facilitator' | 'member';
  joined_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: 'facilitator' | 'member';
  invited_at: string;
  status: 'pending' | 'accepted' | 'expired';
}

interface ActionItemFilter {
  status: 'all' | 'pending' | 'in_progress' | 'done';
  sprint_id: string | 'all';
  assignee_id: string | 'all';
  search: string;
}
```

---

## 7. Role-Based Visibility

| Element | Admin | Facilitator | Member |
|---------|-------|-------------|--------|
| Settings gear icon | Visible | Hidden | Hidden |
| "New Sprint" button | Visible | Visible | Hidden |
| "Invite Member" button | Visible | Hidden | Hidden |
| Member action menu `[...]` | Visible | Hidden | Hidden |
| Pending invitations section | Visible | Hidden | Hidden |
| Change role dropdown | Visible | Hidden | Hidden |
| Remove member option | Visible (not self) | Hidden | Hidden |
| All other content | Visible | Visible | Visible |

---

## 8. Sprint Status Badges

| Status | Badge Color | Badge Text | Icon |
|--------|-------------|------------|------|
| `planned` | Gray bg, gray text | Planned | Calendar icon |
| `active` | Green bg, green text | Active | Play icon |
| `completed` | Blue bg, blue text | Completed | Check icon |

### Board Phase Indicators (within sprint row, when board exists)

| Phase | Display Text | Color |
|-------|-------------|-------|
| `write` | Write phase | Yellow |
| `group` | Group phase | Orange |
| `vote` | Vote phase | Purple |
| `discuss` | Discuss phase | Blue |
| `action` | Action phase | Green |

---

## 9. URL & Navigation

### 9.1 URL Structure

- Base: `/teams/:teamId`
- With tab: `/teams/:teamId?tab=sprints` (default)
- With tab: `/teams/:teamId?tab=members`
- With tab: `/teams/:teamId?tab=actions`
- With tab: `/teams/:teamId?tab=analytics`

### 9.2 Tab Persistence

The active tab is stored as a URL query parameter (`?tab=`). This ensures:
- Bookmarkable tab views
- Browser back/forward works with tabs
- Deep-linking to specific tabs from other pages (e.g., dashboard action item click)

---

## 10. Responsive Behavior

| Breakpoint | Layout Change |
|------------|---------------|
| `< 640px` | Team header stacks vertically. Tabs become horizontally scrollable. Sprint rows stack date below name. Member email hidden. |
| `640px - 1023px` | Team header inline. Tabs fully visible. Sprint rows inline. |
| `>= 1024px` | Full layout as shown in wireframe. |

---

## 11. Accessibility

| Element | ARIA / A11y Requirement |
|---------|------------------------|
| Tab bar | `role="tablist"`, each tab `role="tab"`, content `role="tabpanel"` |
| Tab panel | `aria-labelledby` matching tab ID |
| Sprint status badge | `aria-label="{status}"` (not color-only) |
| Member role badge | Text visible, not color-only |
| Action item checkbox | `role="checkbox"`, `aria-checked` |
| Overdue items | `aria-label` includes "overdue" text |
| Modal dialogs | Focus trap, `aria-modal`, `role="dialog"` |
| Settings gear | `aria-label="Team settings"` |
| Member menu | `aria-haspopup="true"`, `aria-expanded` |
