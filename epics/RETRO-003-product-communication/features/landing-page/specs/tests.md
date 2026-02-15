# Landing Page Test Plan

**changed:** 2026-02-15 — Spec Creation

**Feature:** landing-page
**Test framework:** Vitest + Supertest (backend), Vitest + React Testing Library (frontend), Playwright (E2E)
**Test database:** Dedicated test PostgreSQL database, reset between test suites

---

## 1. Test Structure

```
tests/
  unit/
    stats/
      stats.service.test.ts          # Stats service unit tests
      number-formatting.test.ts      # Number formatting helpers
  integration/
    stats/
      stats-api.test.ts              # GET /api/stats endpoint
  component/
    landing/
      HeroSection.test.tsx           # Hero component
      FeatureShowcase.test.tsx       # Feature grid component
      SocialProof.test.tsx           # Stats section component
      LandingPage.test.tsx           # Full page component
  e2e/
    landing/
      landing-page.spec.ts           # E2E tests with Playwright
```

---

## 2. Unit Tests

### 2.1 Stats Service (`stats.service.test.ts`)

| # | Test case | Input | Expected |
|---|-----------|-------|----------|
| U-STAT-01 | getPublicStats returns zero counts for empty DB | Empty database | `{ team_count: 0, retro_count: 0, card_count: 0 }` |
| U-STAT-02 | getPublicStats returns correct team count | 5 teams in DB | `team_count: 5` |
| U-STAT-03 | getPublicStats returns correct retro count | 3 sprints with boards, 2 sprints without boards | `retro_count: 3` |
| U-STAT-04 | getPublicStats returns correct card count | 100 cards in DB | `card_count: 100` |
| U-STAT-05 | getPublicStats handles large numbers | 1M+ teams | Returns correct count as number |
| U-STAT-06 | getPublicStats throws error on DB failure | Mock DB error | Throws AppError with INTERNAL_ERROR |

### 2.2 Number Formatting (`number-formatting.test.ts`)

| # | Test case | Input | Expected |
|---|-----------|-------|----------|
| U-FMT-01 | Format zero | `0` | `"0"` |
| U-FMT-02 | Format single digit | `5` | `"5"` |
| U-FMT-03 | Format hundreds | `247` | `"247"` |
| U-FMT-04 | Format thousands with comma | `1247` | `"1,247"` |
| U-FMT-05 | Format tens of thousands | `45821` | `"45,821"` |
| U-FMT-06 | Format millions | `1000000` | `"1,000,000"` |
| U-FMT-07 | Format negative numbers | `-100` | `"-100"` (edge case, shouldn't happen in production) |

---

## 3. Integration Tests (Backend API)

### 3.1 Stats API (`stats-api.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-API-01 | Returns 200 for empty database | Empty DB | GET /api/stats | 200, all counts are 0 |
| I-API-02 | Returns correct team count | Create 3 teams | GET /api/stats | 200, `team_count: 3` |
| I-API-03 | Returns correct retro count (only activated boards) | Create 5 sprints, activate 2 boards | GET /api/stats | 200, `retro_count: 2` |
| I-API-04 | Does not count sprints without boards | Create 3 sprints, no boards | GET /api/stats | 200, `retro_count: 0` |
| I-API-05 | Returns correct card count | Create 50 cards across multiple boards | GET /api/stats | 200, `card_count: 50` |
| I-API-06 | Endpoint is public (no auth required) | No Authorization header | GET /api/stats | 200 (not 401) |
| I-API-07 | Response shape is correct | Any DB state | GET /api/stats | Response has `team_count`, `retro_count`, `card_count` fields |
| I-API-08 | Counts are numbers, not strings | Any DB state | GET /api/stats | All values are `typeof number` |
| I-API-09 | Endpoint returns quickly | 100 teams, 500 sprints, 5000 cards | GET /api/stats | Response time < 100ms |
| I-API-10 | Endpoint handles concurrent requests | 10 simultaneous requests | GET /api/stats | All return 200 with same counts |

---

## 4. Component Tests (Frontend)

### 4.1 Hero Section (`HeroSection.test.tsx`)

| # | Test case | Expected |
|---|-----------|----------|
| C-HERO-01 | Renders tagline | Text "Retrospectives that actually drive improvement" is visible |
| C-HERO-02 | Renders subheading | Subheading text is visible |
| C-HERO-03 | Renders "Get Started" CTA | Button/link with text "Get Started" is present |
| C-HERO-04 | Renders "Login" CTA | Button/link with text "Login" is present |
| C-HERO-05 | "Get Started" links to /register | Link has `href="/register"` or navigates to /register |
| C-HERO-06 | "Login" links to /login | Link has `href="/login"` or navigates to /login |

### 4.2 Feature Showcase (`FeatureShowcase.test.tsx`)

| # | Test case | Expected |
|---|-----------|----------|
| C-FEAT-01 | Renders section heading | "Why RetroBoard Pro?" is visible |
| C-FEAT-02 | Renders all 6 feature cards | 6 cards are rendered |
| C-FEAT-03 | Each feature card has an icon | All cards have an icon (lucide-react) |
| C-FEAT-04 | Each feature card has a title | All titles are visible |
| C-FEAT-05 | Each feature card has a description | All descriptions are visible |
| C-FEAT-06 | Feature cards include expected titles | "6 Retro Templates", "Real-Time Collaboration", "Analytics Dashboard", "Facilitation Tools", "Export Options", "Action Items" |

### 4.3 Social Proof (`SocialProof.test.tsx`)

| # | Test case | Setup | Expected |
|---|-----------|-------|----------|
| C-PROOF-01 | Shows skeleton loading initially | Mock pending fetch | Skeleton placeholders visible |
| C-PROOF-02 | Fetches stats from /api/stats | Mock successful fetch | `fetch('/api/stats')` called |
| C-PROOF-03 | Displays stats on success | Mock response `{team_count: 100, retro_count: 500, card_count: 2000}` | Numbers displayed: "100", "500", "2,000" |
| C-PROOF-04 | Formats numbers with commas | Mock response `{team_count: 1247, ...}` | Displays "1,247" |
| C-PROOF-05 | Shows error message on fetch failure | Mock fetch rejection | "Stats temporarily unavailable" visible |
| C-PROOF-06 | Shows error message on 500 response | Mock 500 status | "Stats temporarily unavailable" visible |
| C-PROOF-07 | Renders stat labels correctly | Mock successful response | Labels: "Teams using RetroBoard", "Retrospectives completed", "Cards created" |

### 4.4 Landing Page (Full Page) (`LandingPage.test.tsx`)

| # | Test case | Expected |
|---|-----------|----------|
| C-PAGE-01 | Renders all sections | Hero, Features, SocialProof, Footer all present |
| C-PAGE-02 | Footer has Login link | Link to /login is present |
| C-PAGE-03 | Footer has Register link | Link to /register is present |
| C-PAGE-04 | Page is scrollable | Page height > viewport height (content flows) |

---

## 5. End-to-End Tests (Playwright)

### 5.1 Landing Page Journey (`landing-page.spec.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| E2E-01 | Unauthenticated user sees landing page | Not logged in | Navigate to `/` | Landing page renders, hero visible |
| E2E-02 | Authenticated user redirects to dashboard | Logged in | Navigate to `/` | Redirects to `/dashboard` |
| E2E-03 | Click "Get Started" navigates to register | Not logged in, on `/` | Click "Get Started" button | URL changes to `/register` |
| E2E-04 | Click "Login" navigates to login | Not logged in, on `/` | Click "Login" button in hero | URL changes to `/login` |
| E2E-05 | Click footer "Login" link navigates | Not logged in, on `/` | Click "Login" link in footer | URL changes to `/login` |
| E2E-06 | Click footer "Register" link navigates | Not logged in, on `/` | Click "Register" link in footer | URL changes to `/register` |
| E2E-07 | Stats section shows loading skeleton initially | Not logged in, on `/` | Wait for stats section | Skeleton visible briefly |
| E2E-08 | Stats section displays fetched numbers | Seeded DB with 3 teams, 5 retros, 20 cards | Wait for stats to load | Numbers "3", "5", "20" visible |
| E2E-09 | Stats numbers are formatted with commas | Seeded DB with 1247 teams | Wait for stats to load | "1,247" displayed |
| E2E-10 | All 6 feature cards are visible | Not logged in, on `/` | Scroll to features section | 6 feature cards visible |
| E2E-11 | Feature icons render correctly | Not logged in, on `/` | Check feature cards | Icons visible (not broken) |
| E2E-12 | Page is responsive on mobile | Not logged in, on `/` | Resize viewport to 375px width | Layout adapts, CTAs stack vertically, features stack |
| E2E-13 | Stats API is called exactly once | Not logged in, on `/` | Monitor network requests | `/api/stats` called 1 time |
| E2E-14 | Stats error state displays on API failure | Mock /api/stats to return 500 | Navigate to `/` | "Stats temporarily unavailable" visible |
| E2E-15 | Page has correct meta title | Not logged in | Navigate to `/` | Page title is "RetroBoard Pro" or similar |

---

## 6. Edge Cases and Security Tests

| # | Test case | Description | Expected |
|---|-----------|-------------|----------|
| E-SEC-01 | Stats API does not expose sensitive data | GET /api/stats | Response contains only counts, no team names, user emails, or card content |
| E-SEC-02 | Stats API handles database errors gracefully | Mock DB failure | Returns 500, does not crash server |
| E-SEC-03 | Stats API returns valid JSON on empty DB | Empty database | Returns `{"team_count":0,"retro_count":0,"card_count":0}` |
| E-SEC-04 | Landing page handles stats API timeout | Mock slow response (>5s) | Shows error message, page remains usable |
| E-SEC-05 | Landing page handles invalid JSON from stats API | Mock malformed JSON | Shows error message, does not crash |
| E-SEC-06 | Landing page handles unexpected stats shape | Mock response `{"foo":"bar"}` | Shows error message or defaults to 0 |
| E-SEC-07 | XSS in stats numbers | Mock response with `<script>` tag in number field | Rendered safely (numbers are not HTML-escaped in JSON) |
| E-SEC-08 | Very large stats numbers | Mock response with `team_count: 999999999` | Formatted as "999,999,999", no overflow |
| E-SEC-09 | Negative stats numbers (shouldn't happen) | Mock response with negative numbers | Displays with negative sign or shows error |
| E-SEC-10 | Router logic handles auth state loading | Auth state is loading | Shows spinner, does not flash landing page then redirect |

---

## 7. Accessibility Tests

| # | Test case | Description | Expected |
|---|-----------|-------------|----------|
| A11Y-01 | Hero heading is h1 | Check DOM | `<h1>` tag exists with tagline text |
| A11Y-02 | Feature icons have aria-hidden | Check DOM | Feature icons have `aria-hidden="true"` |
| A11Y-03 | Stats section has aria-label | Check DOM | Stats section has `aria-label="Statistics"` or similar |
| A11Y-04 | CTAs are accessible links/buttons | Check DOM | CTAs are `<a>` or `<button>` with proper focus styles |
| A11Y-05 | Loading skeleton has aria-live | Check DOM | Skeleton container has `aria-live="polite"` |
| A11Y-06 | Error message has role="alert" | Trigger error state | Error message has `role="alert"` |
| A11Y-07 | Color contrast meets WCAG AA | Visual check | All text meets 4.5:1 ratio (normal text) or 3:1 (large text) |
| A11Y-08 | Keyboard navigation works | Tab through page | All interactive elements are focusable and have visible focus states |
| A11Y-09 | Screen reader announces stats | Use screen reader | Stats numbers and labels are announced correctly |

---

## 8. Performance Tests

| # | Test case | Description | Expected |
|---|-----------|-------------|----------|
| PERF-01 | Landing page loads quickly | Measure First Contentful Paint | FCP < 1.5s on 4G connection |
| PERF-02 | Hero section renders before stats | Measure render timing | Hero visible before stats API response |
| PERF-03 | Stats API response time | Measure /api/stats latency | Response time < 50ms (empty DB) or < 100ms (seeded DB) |
| PERF-04 | Page bundle size is small | Check production build | Landing page chunk < 50KB gzipped |
| PERF-05 | No layout shift when stats load | Measure CLS | Cumulative Layout Shift < 0.1 |

---

## 9. Test Utilities

### Backend Test Helper: seedStatsData

```typescript
async function seedStatsData(teamCount: number, retroCount: number, cardCount: number) {
  // Create teams
  for (let i = 0; i < teamCount; i++) {
    await createTestTeam();
  }

  // Create sprints with boards (for retro count)
  for (let i = 0; i < retroCount; i++) {
    const sprint = await createTestSprint();
    await activateBoard(sprint.id);
  }

  // Create cards
  for (let i = 0; i < cardCount; i++) {
    await createTestCard();
  }
}
```

### Frontend Test Helper: mockStatsAPI

```typescript
function mockStatsAPI(data: StatsResponse | Error) {
  vi.spyOn(global, 'fetch').mockImplementation(() => {
    if (data instanceof Error) {
      return Promise.reject(data);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    } as Response);
  });
}
```

### E2E Test Helper: seedDatabaseForE2E

```typescript
async function seedDatabaseForE2E() {
  // Reset DB
  await sql`TRUNCATE cards, boards, sprints, team_members, teams, users CASCADE`;

  // Seed specific counts for predictable E2E tests
  await seedStatsData(3, 5, 20);
}
```

---

## 10. Test Coverage Targets

| Category | Target |
|----------|--------|
| Unit tests | 100% of stats service, number formatting utilities |
| Integration tests | 100% of /api/stats endpoint, all success and error paths |
| Component tests | 100% of landing page components (Hero, Features, SocialProof) |
| E2E tests | Full user journey: unauthenticated landing → click CTA → navigate to auth |
| Line coverage | > 90% across landing page feature files |
| Branch coverage | > 85% across landing page feature files |

---

## 11. Cross-Feature Integration Tests

| # | Test case | Description | Expected |
|---|-----------|-------------|----------|
| X-INT-01 | Landing page → Register → Dashboard | Navigate `/` → click "Get Started" → fill registration form → submit | Redirects to `/dashboard` after successful registration |
| X-INT-02 | Landing page → Login → Dashboard | Navigate `/` → click "Login" → fill login form → submit | Redirects to `/dashboard` after successful login |
| X-INT-03 | Dashboard → Logout → Landing page | Logged in, on `/dashboard` → logout → navigate to `/` | Landing page visible (not redirected) |

---

## 12. Test Execution Order

1. **Unit tests first** — Fast, no dependencies, validate core logic
2. **Integration tests** — Validate API endpoints with test database
3. **Component tests** — Validate frontend components in isolation
4. **E2E tests last** — Slowest, validate full user journeys

Run all tests on every commit. E2E tests can be optional for local development but mandatory for CI/CD.

---

## 13. CI/CD Test Gates

| Gate | Requirement |
|------|-------------|
| Pre-commit | Unit tests pass |
| PR approval | All tests pass (unit + integration + component + E2E) |
| Deployment | All tests pass, coverage > 85% |
