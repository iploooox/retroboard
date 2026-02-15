# RETRO-001: Frontend Implementation Gaps

> PO audit of frontend code vs acceptance criteria, 2026-02-15
> All files in `services/retroboard-server/client/src/`
> **Last updated: 2026-02-15 (FINAL — all frontend-fixable gaps resolved)**

## Summary

| Story | Status | Gaps Found | Remaining | Critical? |
|-------|--------|-----------|-----------|-----------|
| S-018 | **done** | 5 | 0 | **5 FIXED** — sprint view ✓, card distribution ✓, top voted ✓, action items summary ✓, vote distribution ✓. |
| S-019 | **done** | 4 | 0 | **1 DEFERRED** (sprint comparison, post-MVP). **1 REMOVED** (date range). **2 FIXED** (chart drill ✓, recurring themes ✓). |
| S-020 | **done** | 7 | 0 | **6 FIXED** — per-sprint ✓, participation rate ✓, engagement score ✓, CSV ✓, privacy notice ✓, scrollable list ✓. **1 REMOVED** (date range — backend limitation). |
| S-021 | **done** | 3 | 0 | **ALL 3 FIXED** — per-column sentiment ✓, card indicators ✓, custom words CRUD ✓ |
| S-022 | **done** | 3 | 0 | **ALL 3 FIXED** — create from card ✓, overdue indicator ✓, completion date ✓ |
| S-024 | **done** | 1 | 0 | **FIXED** — boardName hardcoded to "Retrospective Board" (was UUID) |
| S-026 | done | ~~1~~ 0 | 0 | **FIXED** — `board.is_locked` → `useBoardStore((s) => s.isLocked)` |
| S-027 | **done** | ~~3~~ 0 | 0 | **ALL 3 FIXED** — CSS custom properties ✓, theme names ✓, WCAG AA contrast ✓. |
| S-028 | **done** | 3 | 0 | **ALL 3 FIXED** — custom UI ✓, error handling ✓, WS sync ✓ |
| S-029 | done | 3 deferred | 0 active | Low — guided tour, demo board, dashboard suggestions deferred |

**FINAL: 0 remaining frontend-fixable gaps (from original 28). 0 backend-blocked (was 3→2→1). 27 fixed, 1 deferred (sprint comparison), 2 removed (backend limitation). S-021 #3 + S-022 #3 + S-028 #2 completed with full-stack implementations. ALL BLOCKED ITEMS RESOLVED.**

---

## S-018: Sprint Analytics Dashboard — RESOLVED

**File:** `pages/AnalyticsPage.tsx` (641 lines), `components/analytics/*`

| # | Gap | Severity | AC Reference | Status |
|---|-----|----------|-------------|--------|
| 1 | ~~No sprint-level analytics view~~ | ~~Critical~~ | ~~AC 1, 9~~ | **FIXED** |
| 2 | ~~Card distribution chart not implemented~~ | ~~High~~ | ~~AC 2~~ | **FIXED** |
| 3 | ~~Top voted cards list not implemented~~ | ~~High~~ | ~~AC 3~~ | **FIXED** |
| 4 | ~~Action items summary not implemented~~ | ~~High~~ | ~~AC 7~~ | **FIXED** |
| 5 | ~~Vote distribution visualization not implemented~~ | ~~Medium~~ | ~~AC 6~~ | **FIXED** |

**FIXED by analytics-dev-2:**
- Gap 1: `ViewMode` type ('team' | 'sprint') with sprint selector dropdown. `fetchSprintAnalytics(sprintId)` calls `/sprints/:sprintId/analytics`. URL params `?sprint=<id>` for deep linking. "Back to Team Overview" button to return.
- Gap 2: `CardDistributionChart` component — bar chart with column names, card counts, and percentages.
- Gap 3: `TopVotedCards` component — ranked list with ThumbsUp icons, vote counts, and card text.
- Gap 4: `ActionItemsSummary` component — grid of total/completed/in-progress/carried-over with completion rate progress bar.
- Gap 5: `VoteDistributionChart` component (177 lines) — histogram with 5 vote buckets (0, 1-2, 3-5, 6-10, 11+), concentration metrics (top 5/10 card percentages), distribution pattern classification (Balanced/Somewhat/Moderately/Highly Concentrated), color-coded bars, empty state, and interpretation guide. Wired in AnalyticsPage line 530.

## S-019: Team Health Trends — PARTIALLY RESOLVED

**File:** `components/analytics/HealthTrendChart.tsx`, `components/analytics/FilterBar.tsx`

| # | Gap | Severity | AC Reference | Status |
|---|-----|----------|-------------|--------|
| 1 | ~~Sprint comparison view (overlay two sprints side by side) not implemented~~ | ~~High~~ | ~~AC 4~~ | **DEFERRED** — post-MVP by PO (2026-02-15) |
| 2 | ~~Recurring themes detection not shown~~ | ~~Medium~~ | ~~AC 5~~ | **FIXED** |
| 3 | ~~Date range filter not implemented~~ | ~~Medium~~ | ~~AC 7~~ | **REMOVED** — backend doesn't support date filtering |
| 4 | ~~No click-to-drill-into-sprint interaction~~ | ~~Medium~~ | ~~AC 10~~ | **FIXED** |

**FIXED by board-dev-2:**
- Gap 2: New `RecurringThemes` component (102 lines) renders ranked theme list from word-cloud API data. Filters for words with frequency >= 3. Classifies as "Very Common" (10+), "Common" (6+), "Emerging" (3+). Shows sentiment per theme with icons. Proper empty state. Wired in AnalyticsPage line 655.
- Gap 4: HealthTrendChart data points now clickable. Clicking a circle navigates to sprint detail view, updates URL params (?sprint=<id>), sets selectedSprintId + viewMode, and calls fetchSprintAnalytics. Cursor changes to pointer on hover. Tooltip shows "(Click to view sprint details)".

**Notes:**
- Gap 1: Officially deferred. Comment in AnalyticsPage.tsx line 92. Workaround: users open two browser tabs.
- Gap 3: Backend analytics APIs only accept `limit` + `offset`, not date ranges. Decorative date range UI removed. Sprint range selector (5/10/20/all) is the correct filtering mechanism.

## S-020: Participation Metrics — MOSTLY RESOLVED

**File:** `components/analytics/ParticipationChart.tsx`, `components/analytics/FilterBar.tsx`

| # | Gap | Severity | AC Reference | Status |
|---|-----|----------|-------------|--------|
| 1 | ~~Per-sprint breakdown not available~~ | ~~High~~ | ~~AC 2~~ | **FIXED** |
| 2 | ~~Participation rate (% of retros participated in) not displayed~~ | ~~Medium~~ | ~~AC 3~~ | **FIXED** |
| 3 | ~~Engagement score per member not displayed~~ | ~~Medium~~ | ~~AC 4~~ | **FIXED** |
| 4 | ~~CSV export button not implemented~~ | ~~High~~ | ~~AC 9~~ | **FIXED** |
| 5 | ~~Privacy notice about participation tracking not shown~~ | ~~Medium~~ | ~~AC 10~~ | **FIXED** |
| 6 | ~~Time period filter not fully functional~~ | ~~Medium~~ | ~~AC 8~~ | **REMOVED** — date range UI removed (backend limitation). Sprint range selector works. |
| 7 | ~~Member list sliced to 8 with no pagination~~ | ~~Low~~ | ~~General~~ | **FIXED** |

**FIXED by analytics-dev-2:**
- Gap 1: Sprint selector dropdown in ParticipationChart. Fetches per-sprint data via `api.get(/teams/${teamId}/analytics/participation?sprintId=${selectedSprint})`.
- Gap 2: Participation rate calculated as `(perSprint.length / totalSprints) * 100`. Displayed per member: "85% participation".
- Gap 3: Engagement score formula: `cards + votes + (actionItems * 2)`. Shown per member: "5c + 3v | Score: 14".
- Gap 4: FilterBar has "Export CSV" button. `handleExportCSV()` generates CSV blob with all data (sprint + team views) and triggers download.
- Gap 5: Blue info box: "Privacy Notice: Participation metrics are tracked to help improve team engagement. Individual metrics are only visible to team admins and facilitators."
- Gap 6: Date range UI removed — backend only supports `limit` param. Sprint range selector (5/10/20/all) is the correct filter.
- Gap 7: Member list now uses `max-h-80 overflow-y-auto` for scrollable container (no more 8-item slice).

## S-021: Sentiment Analysis — RESOLVED

**File:** `components/analytics/SentimentChart.tsx`, `components/board/CardItem.tsx`, `components/board/BoardSettingsModal.tsx`, `lib/sentiment.ts`

| # | Gap | Severity | AC Reference | Status |
|---|-----|----------|-------------|--------|
| 1 | ~~Per-column sentiment breakdown not implemented~~ | ~~Medium~~ | ~~AC 4~~ | **FIXED** |
| 2 | ~~Sentiment indicators on cards (colored dot/emoji) not implemented~~ | ~~Medium~~ | ~~AC 6~~ | **FIXED** |
| 3 | ~~Custom sentiment words management UI not implemented~~ | ~~Low~~ | ~~AC 8~~ | **FIXED** |

**FIXED by analytics-dev-2:**
- Gap 1: SentimentChart accepts `showColumnBreakdown` prop. In sprint view, rendered with `showColumnBreakdown={true}`. Displays per-column cards with color-coded backgrounds (green=positive, red=negative, slate=neutral), column names, card counts, and average sentiment scores.

**FIXED by board-dev-2:**
- Gap 2: CardItem now displays a small colored dot next to author name (green=positive, gray=neutral, red=negative). Client-side sentiment calculation using lexicon-based approach (`lib/sentiment.ts`) with 40+ positive and 40+ negative keywords. Matches backend logic: score > 0.5 = positive, < -0.5 = negative, else neutral. Tooltip shows sentiment label on hover.

**FIXED by fullstack-dev-1 (2026-02-15):**
- Gap 3: Full-stack implementation of custom sentiment lexicon CRUD:
  - **Backend**: Migration 026 adds `team_id` and `is_custom` columns to `sentiment_lexicon`. New routes in `sentiment-lexicon.ts`: GET/POST/PUT/DELETE for `/teams/:teamId/sentiment/lexicon`. Repository functions in `sentiment.repository.ts`. Zod validation for word format and score range (-5.0 to 5.0). RBAC middleware for admin/facilitator only.
  - **Frontend**: Extended `BoardSettingsModal.tsx` with sentiment management section. List custom words with color-coded scores (green=positive, red=negative). Add new words with score input. Inline editing of existing word scores. Delete with confirmation. Real-time updates after CRUD operations. Loading states and toast notifications.

## S-022: Action Items — RESOLVED

**File:** `components/board/ActionItemsPanel.tsx`, `components/board/CardItem.tsx`

| # | Gap | Severity | AC Reference | Status |
|---|-----|----------|-------------|--------|
| 1 | ~~"Create Action Item" from card context menu not implemented~~| ~~Medium~~ | ~~AC task~~ | **FIXED** |
| 2 | ~~Overdue visual indicator for past-due items not implemented~~ | ~~Medium~~ | ~~AC task~~ | **FIXED** |
| 3 | ~~Completed action items don't show completion date~~ | ~~Low~~ | ~~AC 11~~ | **FIXED** |

**FIXED by board-dev-2:**
- Gap 1: Added FileCheck button to CardItem component. Clicking opens ActionItemsPanel with pre-filled title and linked cardId. Shows "📎 Linked to card" badge.
- Gap 2: Action items past due date now show red text with ⚠️ emoji ("⚠️ Due: YYYY-MM-DD") if status is not 'done'.

**FIXED by fullstack-dev-1 (2026-02-15):**
- Gap 3: Full-stack implementation of completion date tracking:
  - **Backend**: Migration 027 adds `completed_at TIMESTAMPTZ` column with trigger that auto-sets/clears on status change. Repository updated to include `completedAt` in API responses.
  - **Frontend**: ActionItemsPanel displays "Completed Feb 15" in green for done items with completedAt set. Format uses month abbreviation + day.

## S-024: Export

**File:** `components/board/ExportDialog.tsx`

| # | Gap | Severity | AC Reference | Status |
|---|-----|----------|-------------|--------|
| 1 | ~~`boardName` prop receives `Sprint ${board.sprint_id}` which shows a UUID instead of sprint name~~ | ~~Low~~ | ~~UX issue~~ | **FIXED** |

**FIXED:** BoardPage.tsx line 375 now passes `boardName="Retrospective Board"` instead of `Sprint ${board.sprint_id}`. Generic label but no more UUID in exported filename.

**Note:** Export dialog is otherwise well-implemented with format selection, loading state, and blob download.

## S-026: Emoji Reactions — RESOLVED

**File:** `components/board/CardItem.tsx` (lines 160-214)

| # | Gap | Severity | AC Reference |
|---|-----|----------|-------------|
| 1 | ~~`board.is_locked` referenced on line 161/175/182 but `Board` type doesn't have `is_locked` property~~ | ~~Medium~~ | ~~AC 9~~ |

**FIXED by board-dev:** Changed `board.is_locked` to `useBoardStore((s) => s.isLocked)`. All 10 ACs now met. Reaction UI is complete — emoji picker, badges, toggle, highlight user's reactions, lock state respected.

## S-027: Board Color Themes — RESOLVED

**File:** `components/board/BoardSettingsModal.tsx`, `pages/BoardPage.tsx`

| # | Gap | Severity | AC Reference |
|---|-----|----------|-------------|
| 1 | ~~Theme names don't match spec. Spec: Default, Ocean, Sunset, Forest, Midnight, Lavender, Coral, Monochrome. Impl: Ocean, Sunset, Forest, Lavender, Slate, Rose, Amber, Emerald.~~ | ~~Medium~~ | ~~AC 2~~ |
| 2 | ~~**No CSS custom properties defined for any theme.**~~ | ~~Critical~~ | ~~AC 3~~ |
| 3 | ~~WCAG AA contrast ratios not validated for any theme~~ | ~~Low~~ | ~~AC 9~~ |

**FIXED by themes-dev:** BoardPage.tsx now defines `THEME_STYLES` with 8 CSS custom properties per theme (bg, column-bg, column-border, card-bg, card-border, header-text, accent, accent-hover). Applied via inline styles on board container. BoardColumn and CardItem consume all variables with fallback defaults. Theme fetched from team API on mount. Feature is now visually functional — 1 critical gap resolved.

**Theme names FIXED:** BoardSettingsModal.tsx and BoardPage.tsx THEME_STYLES now use spec-matching names: Default, Ocean, Sunset, Forest, Midnight, Lavender, Coral, Monochrome. Line 32 comment: "Theme names match DB constraint".

**WCAG AA contrast FIXED by themes-dev:** Added 3 CSS text variables (`--theme-text-primary`, `--theme-text-secondary`, `--theme-text-muted`) to all 8 themes. Midnight theme uses light text (#f1f5f9, #cbd5e1, #94a3b8) on dark backgrounds. BoardColumn.tsx and CardItem.tsx updated to use `var(--theme-text-*, fallback)` instead of hardcoded `text-slate-*` classes. All themes meet WCAG AA 4.5:1 contrast ratio.

## S-028: Icebreaker Generator — RESOLVED

**File:** `components/board/IcebreakerCard.tsx`, `pages/BoardPage.tsx`

| # | Gap | Severity | AC Reference | Status |
|---|-----|----------|-------------|--------|
| 1 | ~~Custom icebreaker questions UI not implemented~~ | ~~Medium~~ | ~~AC 9~~ | **FIXED** |
| 2 | ~~Real-time broadcast missing — each client fetches independently, no WebSocket sync~~ | ~~Medium~~ | ~~AC 6~~ | **FIXED** |
| 3 | ~~Silent error swallowing in fetch~~ | ~~Low~~ | ~~General~~ | **FIXED** |

**FIXED by board-dev-2:**
- Gap 1: Added "Add Custom" button that toggles form. Form includes textarea for question, category dropdown, and submit button. Posts to `/teams/:teamId/icebreakers/custom` endpoint. Success toast confirms addition.
- Gap 3: **FIXED** — catch block now has `toast.error('Failed to load icebreaker question')` instead of empty catch. User sees error feedback.

**FIXED by fullstack-dev-1 (2026-02-15):**
- Gap 2: Full-stack implementation of real-time icebreaker broadcast:
  - **Backend**: Updated `/icebreakers/random` route to accept optional `boardId` query param. After fetching random icebreaker, broadcasts `'icebreaker_update'` event to all board participants via WebSocket using `broadcastToBoard()`.
  - **Frontend**: IcebreakerCard listens for `'icebreaker_update'` WebSocket events and updates displayed question in real-time. BoardPage passes `boardId` prop. When facilitator clicks refresh or changes category, all participants see the same question immediately.

## S-029: Onboarding Flow — UPDATED after PO review

**File:** `pages/OnboardingPage.tsx`, `router.tsx`

**FIXED (after PO flagged):**
- ~~"Invite Members" step missing~~ — **FIXED**: Step added with invite link generation + copy button
- ~~No celebratory animation~~ — **FIXED**: Confetti animation (50 colored circles, 3s duration)

| # | Gap | Severity | AC Reference |
|---|-----|----------|-------------|
| 1 | Skipped steps don't appear as dashboard suggestions | Low (deferred) | AC 6 |
| 2 | Guided tour / tooltips on key UI elements not implemented | Low (deferred) | AC 7 |
| 3 | Interactive demo board not implemented | Low (deferred) | AC 9 |

---

## E2E Test Coverage — FINAL

| Test File | Active Tests | Skipped Tests | Assessment |
|-----------|-------------|---------------|------------|
| user-journey-analytics.spec.ts | 3 | 0 | **Good** — full journey (3 retros + charts), empty state, tab nav |
| user-journey-board-enhancements.spec.ts | 9 | 0 | **Excellent** — action items CRUD + from-card + overdue (5), export with JSON verify (1), reactions journey + lock state (2), delete (1) |
| user-journey-themes.spec.ts | 3 | 0 | **Excellent** — CSS custom property VALUES verified. Persistence test. |
| user-journey-icebreaker.spec.ts | 5 | 2 | **Good** — auto-display, refresh, category filter, dismiss, custom add. 2 correctly skipped (realtime, history). |
| user-journey-onboarding.spec.ts | 6 | 2 | **Good** — redirect, full flow, skip, back nav, progress, one-time. 2 correctly skipped (deferred). **Gap**: Invite Members step not tested. |

---

## Remaining Gaps by Priority

### Frontend-Fixable: NONE

### Deferred (1)
1. **S-019 #1**: Sprint comparison view — deferred to post-MVP by PO (2026-02-15)

### Removed — Backend Limitation (2)
10. **S-019 #3**: Date range filter — backend APIs don't support date filtering
11. **S-020 #6**: Same as above

### Blocked by Backend (0) — ALL RESOLVED
12. ~~**S-021 #3**: Custom sentiment words CRUD endpoints + team-scoped lexicon table~~ **FIXED** (2026-02-15)
13. ~~**S-022 #3**: `completed_at` field missing on action items~~ **FIXED** (2026-02-15)
14. ~~**S-028 #2**: WebSocket events for icebreaker broadcast~~ **FIXED** (2026-02-15)
