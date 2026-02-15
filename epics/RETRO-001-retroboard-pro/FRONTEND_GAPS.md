# RETRO-001: Frontend Implementation Gaps

> PO audit of frontend code vs acceptance criteria, 2026-02-15
> All files in `services/retroboard-server/client/src/`

## Summary

| Story | Status | Gaps Found | Critical? |
|-------|--------|-----------|-----------|
| S-018 | partial | 5 | Yes — no sprint-level view, missing charts |
| S-019 | partial | 4 | Yes — no comparison, no filter, no drill-down |
| S-020 | partial | 7 | Yes — no CSV export, no per-sprint breakdown |
| S-021 | partial | 3 | Medium — missing per-column sentiment, card indicators |
| S-022 | partial | ~~3~~ 1 blocked | **2 FIXED** — create from card ✓, overdue indicator ✓. 1 blocked (completion date needs backend) |
| S-024 | done | 1 | Low — boardName shows UUID |
| S-026 | done | ~~1~~ 0 | **FIXED** — `board.is_locked` → `useBoardStore((s) => s.isLocked)` |
| S-027 | partial | ~~3~~ 2 | **CSS FIXED** — themes now visually apply. 2 medium remain (theme names, WCAG) |
| S-028 | partial | ~~3~~ 2 (1 blocked) | **1 FIXED** — custom UI ✓. 1 blocked (WS sync needs backend), 1 low (error handling) |
| S-029 | done | 3 deferred | Low — guided tour, demo board, dashboard suggestions deferred |

**Total: ~~32~~ 28 frontend-fixable gaps, 2 backend-blocked. 2 stories have critical gaps. S-022: 2/3 fixed. S-028: 1/3 fixed, 1 blocked.**

---

## S-018: Sprint Analytics Dashboard

**File:** `pages/AnalyticsPage.tsx`, `components/analytics/*`

| # | Gap | Severity | AC Reference |
|---|-----|----------|-------------|
| 1 | No sprint-level analytics view — page only shows team-wide multi-sprint data. Spec says "view analytics for a sprint's retrospective." | Critical | AC 1, 9 |
| 2 | Card distribution chart (cards per column) not implemented | High | AC 2 |
| 3 | Top voted cards list not implemented | High | AC 3 |
| 4 | Action items summary (total, completed, carried over) not implemented | High | AC 7 |
| 5 | Vote distribution visualization not implemented | Medium | AC 6 |

## S-019: Team Health Trends

**File:** `components/analytics/HealthTrendChart.tsx`

| # | Gap | Severity | AC Reference |
|---|-----|----------|-------------|
| 1 | Sprint comparison view (overlay two sprints side by side) not implemented | High | AC 4 |
| 2 | Recurring themes detection not shown | Medium | AC 5 |
| 3 | Date range filter not implemented — hardcoded `limit=20` | Medium | AC 7 |
| 4 | No click-to-drill-into-sprint interaction — only SVG title tooltips | Medium | AC 10 |

## S-020: Participation Metrics

**File:** `components/analytics/ParticipationChart.tsx`

| # | Gap | Severity | AC Reference |
|---|-----|----------|-------------|
| 1 | Per-sprint breakdown not available — only aggregated totals shown | High | AC 2 |
| 2 | Participation rate (% of retros participated in) not displayed | Medium | AC 3 |
| 3 | Engagement score per member not displayed | Medium | AC 4 |
| 4 | CSV export button not implemented | High | AC 9 |
| 5 | Privacy notice about participation tracking not shown | Medium | AC 10 |
| 6 | Time period filter not implemented — hardcoded limit | Medium | AC 8 |
| 7 | Member list sliced to 8 with no pagination — breaks for large teams | Low | General |

## S-021: Sentiment Analysis

**File:** `components/analytics/SentimentChart.tsx`

| # | Gap | Severity | AC Reference |
|---|-----|----------|-------------|
| 1 | Per-column sentiment breakdown not implemented | Medium | AC 4 |
| 2 | Sentiment indicators on cards (colored dot/emoji) not implemented | Medium | AC 6 |
| 3 | Custom sentiment words management UI not implemented | Low | AC 8 |

## S-022: Action Items — PARTIALLY RESOLVED

**File:** `components/board/ActionItemsPanel.tsx`, `components/board/CardItem.tsx`

| # | Gap | Severity | AC Reference | Status |
|---|-----|----------|-------------|--------|
| 1 | ~~"Create Action Item" from card context menu not implemented~~| ~~Medium~~ | ~~AC task~~ | **FIXED** |
| 2 | ~~Overdue visual indicator for past-due items not implemented~~ | ~~Medium~~ | ~~AC task~~ | **FIXED** |
| 3 | Completed action items don't show completion date | Low | AC 11 | **Blocked — backend missing `completed_at` field** |

**FIXED by board-dev-2:**
- Gap 1: Added FileCheck button to CardItem component. Clicking opens ActionItemsPanel with pre-filled title and linked cardId. Shows "📎 Linked to card" badge.
- Gap 2: Action items past due date now show red text with ⚠️ emoji ("⚠️ Due: YYYY-MM-DD") if status is not 'done'.
- Gap 3: Cannot implement — ActionItem type lacks `completed_at` field. Backend must add timestamp tracking when status changes to 'done'.

## S-024: Export

**File:** `components/board/ExportDialog.tsx`

| # | Gap | Severity | AC Reference |
|---|-----|----------|-------------|
| 1 | `boardName` prop receives `Sprint ${board.sprint_id}` which shows a UUID instead of sprint name | Low | UX issue |

**Note:** Export dialog is otherwise well-implemented with format selection, loading state, and blob download.

## S-026: Emoji Reactions — RESOLVED

**File:** `components/board/CardItem.tsx` (lines 160-214)

| # | Gap | Severity | AC Reference |
|---|-----|----------|-------------|
| 1 | ~~`board.is_locked` referenced on line 161/175/182 but `Board` type doesn't have `is_locked` property~~ | ~~Medium~~ | ~~AC 9~~ |

**FIXED by board-dev:** Changed `board.is_locked` to `useBoardStore((s) => s.isLocked)`. All 10 ACs now met. Reaction UI is complete — emoji picker, badges, toggle, highlight user's reactions, lock state respected.

## S-027: Board Color Themes — PARTIALLY RESOLVED

**File:** `components/board/BoardSettingsModal.tsx`, `pages/BoardPage.tsx`

| # | Gap | Severity | AC Reference |
|---|-----|----------|-------------|
| 1 | Theme names don't match spec. Spec: Default, Ocean, Sunset, Forest, Midnight, Lavender, Coral, Monochrome. Impl: Ocean, Sunset, Forest, Lavender, Slate, Rose, Amber, Emerald. | Medium | AC 2 |
| 2 | ~~**No CSS custom properties defined for any theme.**~~ | ~~Critical~~ | ~~AC 3~~ |
| 3 | WCAG AA contrast ratios not validated for any theme | Medium | AC 9 |

**FIXED by settings-dev:** BoardPage.tsx now defines `THEME_STYLES` with 8 CSS custom properties per theme (bg, column-bg, column-border, card-bg, card-border, header-text, accent, accent-hover). Applied via inline styles on board container. BoardColumn and CardItem consume all variables with fallback defaults. Theme fetched from team API on mount. Feature is now visually functional — 1 critical gap resolved, 2 medium remain.

## S-028: Icebreaker Generator — PARTIALLY RESOLVED

**File:** `components/board/IcebreakerCard.tsx`

| # | Gap | Severity | AC Reference | Status |
|---|-----|----------|-------------|--------|
| 1 | ~~Custom icebreaker questions UI not implemented~~ | ~~Medium~~ | ~~AC 9~~ | **FIXED** |
| 2 | Real-time broadcast missing — each client fetches independently, no WebSocket sync | Medium | AC 6 | **Blocked — backend WebSocket support needed** |
| 3 | Silent error swallowing in fetch (line 30: `catch {}`) — user sees "Loading..." forever if API fails | Low | General | **Unchanged** |

**FIXED by board-dev-2:**
- Gap 1: Added "Add Custom" button that toggles form. Form includes textarea for question, category dropdown, and submit button. Posts to `/teams/:teamId/icebreakers/custom` endpoint. Success toast confirms addition.
- Gap 2: Cannot implement — no WebSocket message types for icebreaker:shown / icebreaker:dismissed. Backend must emit events when facilitator refreshes question so all participants see same question in real-time.
- Gap 3: Not addressed (low priority, requires error handling refactor).

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

## E2E Test Coverage — UPDATED after all tester improvements

| Test File | Active Tests | Skipped Tests | Assessment |
|-----------|-------------|---------------|------------|
| user-journey-analytics.spec.ts | 3 | 0 | **Improved** — full journey test creates 3 retros, verifies all 4 charts render with real data |
| user-journey-board-enhancements.spec.ts | 9+ | 0 | **Improved** — action items (3), export with board completion + JSON verification (1), reactions journey + lock state (2) |
| user-journey-themes.spec.ts | 3 | 0 | **Excellent** — verifies CSS custom property VALUES after theme change (not just modal). Persistence test logs out and back in. |
| user-journey-icebreaker.spec.ts | 4 | 3 | Good — core flows active, missing features correctly skipped |
| user-journey-onboarding.spec.ts | 6 | 2 | **Improved** — redirect, full flow, skip, back nav, progress, one-time. 2 correctly skipped (deferred). **Gap**: Invite Members step not tested. |
