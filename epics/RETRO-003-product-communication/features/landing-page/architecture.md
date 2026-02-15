# Landing Page Feature Architecture

**Feature:** landing-page
**Service:** retroboard-server
**Depends on:** auth
**Phase:** 1
**Status:** planning
**changed:** 2026-02-15 — Spec Creation

---

## 1. Overview

The landing page is the first thing visitors see when they navigate to RetroBoard Pro. It serves as both marketing material and entry point to the app. For unauthenticated users, it showcases features and provides social proof (team count, retro count, cards created). For authenticated users, it redirects to the dashboard. The landing page is a static React component that fetches public statistics from a dedicated stats API endpoint.

## 2. Current State

The root path `/` currently redirects all users to `/dashboard` via `<Navigate to="/dashboard" replace />` in router.tsx. This means unauthenticated users are immediately bounced to `/login`, and there is no landing page or marketing content visible.

## 3. Target State

| Capability | Detail |
|-----------|--------|
| Landing page component | React component at `client/src/pages/LandingPage.tsx` |
| Routing logic | Update router.tsx to show landing page at `/` for unauthenticated users, redirect authenticated users to `/dashboard` |
| Hero section | Tagline ("Retrospectives that actually drive improvement") + CTA buttons (Get Started, Login) |
| Feature showcase | Grid displaying 6 retro templates, real-time collaboration, analytics dashboard, facilitation tools, export options, and action items |
| Social proof | Stats section showing team count, retro count, and cards created (fetched from public API) |
| Footer | Links to Login and Register |
| Public stats API | `GET /api/stats` (no auth required) returns aggregated counts |
| Responsive design | Mobile-first, works on all screen sizes |
| Design system | Tailwind CSS 4, indigo-600 primary color, lucide-react icons |

## 4. Design Decisions

### 4.1 Public Stats API vs. Hardcoded Values

The landing page displays live statistics (team count, retro count, cards created) fetched from a public API endpoint. This provides authentic social proof and requires no manual updates.

**Trade-off:** The stats endpoint must be performant and not expose sensitive data. We use PostgreSQL aggregate queries with no per-user breakdown, making it safe and fast.

### 4.2 Client-Side Routing for Auth Check

The router checks authentication state via Zustand auth store and conditionally renders the landing page or redirects to dashboard. This keeps the landing page publicly accessible while providing seamless navigation for logged-in users.

### 4.3 No External UI Libraries

The landing page uses only Tailwind CSS and lucide-react icons, matching the existing design system. This keeps the bundle size small and maintains design consistency across the app.

### 4.4 Feature Showcase as Static Content

The feature list is hardcoded React JSX, not fetched from an API. This keeps the landing page fast (no additional API calls) and allows easy updates via code changes. If we add dynamic content in the future, we can move to a CMS.

### 4.5 Lightweight Stats Caching

The stats API endpoint calculates aggregates on every request (no caching). For Phase 1, this is acceptable given low traffic. In the future, we can add Redis or PostgreSQL-based caching if response time degrades.

## 5. Architecture Layers

```
Client Request
    |
    v
┌────────────────────────────────────┐
│  React Router (router.tsx)         │
│  ┌──────────────────────────────┐  │
│  │ Check isAuthenticated        │  │
│  │ ├─ true  → /dashboard        │  │
│  │ └─ false → LandingPage       │  │
│  └──────────────────────────────┘  │
└────────────────┬───────────────────┘
                 │
                 v (unauthenticated)
┌────────────────────────────────────┐
│  LandingPage Component             │
│  ┌──────────────────────────────┐  │
│  │ Hero Section                 │  │
│  │ Feature Showcase (static)    │  │
│  │ Social Proof (fetch stats)   │  │
│  │ Footer                       │  │
│  └──────────────────────────────┘  │
└────────────────┬───────────────────┘
                 │
                 | GET /api/stats
                 v
┌────────────────────────────────────┐
│  Hono Route: GET /api/stats        │
│  (no auth middleware)              │
└────────────────┬───────────────────┘
                 │
                 v
┌────────────────────────────────────┐
│  Stats Service                     │
│  - getPublicStats()                │
└────────────────┬───────────────────┘
                 │
                 v
┌────────────────────────────────────┐
│  Stats Repository                  │
│  - countTeams()                    │
│  - countSprints()                  │
│  - countCards()                    │
└────────────────┬───────────────────┘
                 │
                 v
┌────────────────────────────────────┐
│  PostgreSQL                        │
│  SELECT COUNT(*) FROM teams        │
│  SELECT COUNT(*) FROM sprints      │
│  SELECT COUNT(*) FROM cards        │
└────────────────────────────────────┘
```

## 6. File Structure

```
services/retroboard-server/
  client/src/
    pages/
      LandingPage.tsx              # Main landing page component
    components/
      landing/
        HeroSection.tsx            # Hero with tagline and CTAs
        FeatureShowcase.tsx        # Feature grid
        SocialProof.tsx            # Stats section
        LandingFooter.tsx          # Footer with auth links
  src/
    routes/
      stats.ts                     # Hono router for /api/stats
    services/
      stats.service.ts             # Business logic for stats
    repositories/
      stats.repository.ts          # SQL queries for aggregates
    types/
      stats.ts                     # TypeScript interfaces
```

## 7. Component Hierarchy

```
<LandingPage>
  <HeroSection>
    <h1>Retrospectives that actually drive improvement</h1>
    <p>Subheading about RetroBoard Pro...</p>
    <div>
      <Button variant="primary" href="/register">Get Started</Button>
      <Button variant="secondary" href="/login">Login</Button>
    </div>
  </HeroSection>

  <FeatureShowcase>
    <FeatureCard icon={...} title="6 Retro Templates" description="..." />
    <FeatureCard icon={...} title="Real-Time Collaboration" description="..." />
    <FeatureCard icon={...} title="Analytics Dashboard" description="..." />
    <FeatureCard icon={...} title="Facilitation Tools" description="..." />
    <FeatureCard icon={...} title="Export Options" description="..." />
    <FeatureCard icon={...} title="Action Items" description="..." />
  </FeatureShowcase>

  <SocialProof>
    {isLoading && <Skeleton />}
    {error && <ErrorMessage />}
    {stats && (
      <StatsGrid>
        <Stat value={stats.team_count} label="Teams using RetroBoard" />
        <Stat value={stats.retro_count} label="Retrospectives completed" />
        <Stat value={stats.card_count} label="Cards created" />
      </StatsGrid>
    )}
  </SocialProof>

  <LandingFooter>
    <Link to="/login">Login</Link>
    <Link to="/register">Register</Link>
  </LandingFooter>
</LandingPage>
```

## 8. Router Logic Update

Current routing (router.tsx line 71):
```typescript
{ path: '/', element: <Navigate to="/dashboard" replace /> }
```

New routing:
```typescript
{
  path: '/',
  element: <PublicOrDashboard />,
}

function PublicOrDashboard() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <Spinner className="h-8 w-8 text-indigo-600" />
    </div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}
```

## 9. Stats API Endpoint

**Endpoint:** `GET /api/stats`
**Auth:** Public (no middleware)
**Response:**
```json
{
  "team_count": 1247,
  "retro_count": 8932,
  "card_count": 45821
}
```

**SQL Queries:**
```sql
-- Team count
SELECT COUNT(*) FROM teams;

-- Retro count (sprints with activated boards)
SELECT COUNT(*) FROM sprints WHERE board_activated_at IS NOT NULL;

-- Card count
SELECT COUNT(*) FROM cards;
```

**Performance:** All three queries run in parallel. Expected response time: < 50ms for databases with < 100k rows.

## 10. Visual Design Notes

| Element | Specification |
|---------|---------------|
| Hero background | Gradient `bg-gradient-to-br from-indigo-50 via-white to-slate-50` |
| Tagline | `text-5xl font-bold text-slate-900` |
| Subheading | `text-xl text-slate-600` |
| Primary CTA | `bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg` |
| Secondary CTA | `border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-8 py-3 rounded-lg` |
| Feature cards | White background, `shadow-md rounded-xl p-6`, hover effect with `shadow-lg` |
| Stats section | Dark background `bg-slate-900`, white text, centered layout |
| Stats numbers | `text-5xl font-bold text-indigo-400` |
| Stats labels | `text-sm text-slate-300` |
| Footer | Light gray `bg-slate-100`, centered links |

## 11. Accessibility

| Element | ARIA / A11y Requirement |
|---------|------------------------|
| Hero heading | `<h1>` semantic tag, unique page title |
| CTA buttons | `<a>` tags with descriptive text, no "click here" |
| Feature cards | Icon with `aria-hidden="true"`, descriptive text visible |
| Stats section | `<section>` with `aria-label="Social proof statistics"` |
| Stats numbers | No `aria-label` needed (visible text is semantic) |
| Footer links | `<a>` tags with clear link text |
| Loading state | Spinner with `aria-live="polite"` |
| Error state | Error message with `role="alert"` |

## 12. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Bundle size | Landing page is lazy-loaded via React Router code splitting |
| Stats API latency | Fetch runs after page render, skeleton shown during load |
| Large stats numbers | Format with commas (e.g., "1,247" not "1247") for readability |
| Image optimization | No images in Phase 1 — icons only (lucide-react SVGs) |
| First Contentful Paint | Hero section renders immediately, stats load async |

## 13. Error Handling

| Scenario | Behavior |
|----------|----------|
| Stats API fails (500) | Show fallback message "Stats temporarily unavailable" |
| Stats API times out | Show fallback message after 5s timeout |
| Network error | Show fallback message "Check your internet connection" |
| Stats API returns invalid data | Log error to console, show fallback message |

## 14. Future Considerations (Not in Phase 1)

- **Animated stats counters:** Count up from 0 to actual value on scroll into view
- **Screenshots/videos:** Add product screenshots or demo video
- **Customer testimonials:** Quotes from users
- **Pricing page link:** Add pricing information (if app goes paid)
- **Blog/changelog link:** Link to feature announcements
- **SEO optimization:** Add meta tags, Open Graph tags, structured data
- **A/B testing:** Experiment with different taglines and CTAs
