# UI Page Spec: Landing Page

**Feature:** landing-page
**Page:** Landing Page
**URL:** `/`
**Auth:** Public (redirects to `/dashboard` if authenticated)
**Stories:** S-031, S-032

---

## 1. Overview

The landing page is the marketing entry point for RetroBoard Pro. It welcomes new visitors with a clear value proposition, showcases all major features, provides social proof through live statistics, and offers clear calls-to-action to get started or log in. The page is fully responsive and accessible, designed to convert visitors into registered users.

---

## 2. ASCII Wireframe

### 2.1 Desktop View (>= 1024px)

```
+================================================================================+
|                                                                                |
|                       Retrospectives that actually drive improvement           |
|                                                                                |
|                       Run effective retrospectives with your team              |
|                       using proven templates and real-time collaboration       |
|                                                                                |
|                    [ Get Started ]        [ Login ]                            |
|                                                                                |
+================================================================================+
|                                                                                |
|                              Why RetroBoard Pro?                               |
|                                                                                |
|  +---------------------+  +---------------------+  +---------------------+     |
|  | 📋                  |  | 👥                  |  | 📊                  |     |
|  | 6 Retro Templates   |  | Real-Time           |  | Analytics           |     |
|  | Choose from Start/  |  | Collaboration       |  | Dashboard           |     |
|  | Stop/Continue, Mad/ |  | See everyone's      |  | Track team          |     |
|  | Sad/Glad, 4Ls,      |  | cards update live   |  | progress with       |     |
|  | Sailboat, and more  |  | with WebSocket      |  | insights            |     |
|  +---------------------+  +---------------------+  +---------------------+     |
|                                                                                |
|  +---------------------+  +---------------------+  +---------------------+     |
|  | 🎯                  |  | 📤                  |  | ✅                  |     |
|  | Facilitation Tools  |  | Export Options      |  | Action Items        |     |
|  | Built-in timer,     |  | Export retro        |  | Track follow-up     |     |
|  | voting, grouping,   |  | results to PDF,     |  | tasks and ensure    |     |
|  | and phase           |  | CSV, or Markdown    |  | commitments are     |     |
|  | management          |  | for your records    |  | kept                |     |
|  +---------------------+  +---------------------+  +---------------------+     |
|                                                                                |
+================================================================================+
|                                                                                |
|                       ╔═══════════════════════════════════════╗               |
|                       ║  Dark Background (bg-slate-900)       ║               |
|                       ║                                       ║               |
|                       ║           1,247             8,932             45,821  ║
|                       ║           Teams using       Retrospectives    Cards   ║
|                       ║           RetroBoard        completed         created ║
|                       ║                                                       ║
|                       ╚═══════════════════════════════════════╝               |
|                                                                                |
+================================================================================+
|                          Login  •  Register                                    |
+================================================================================+
```

### 2.2 Mobile View (< 640px)

```
+====================================+
|                                    |
|   Retrospectives that actually     |
|   drive improvement                |
|                                    |
|   Run effective retrospectives     |
|   with your team using proven      |
|   templates and real-time          |
|   collaboration                    |
|                                    |
|   [ Get Started ]                  |
|   [ Login ]                        |
|                                    |
+====================================+
|                                    |
|   Why RetroBoard Pro?              |
|                                    |
|   +------------------------------+ |
|   | 📋                           | |
|   | 6 Retro Templates            | |
|   | Choose from Start/Stop/      | |
|   | Continue, Mad/Sad/Glad, 4Ls, | |
|   | Sailboat, and more           | |
|   +------------------------------+ |
|                                    |
|   +------------------------------+ |
|   | 👥                           | |
|   | Real-Time Collaboration      | |
|   | See everyone's cards update  | |
|   | live with WebSocket          | |
|   +------------------------------+ |
|                                    |
|   +------------------------------+ |
|   | 📊                           | |
|   | Analytics Dashboard          | |
|   | Track team progress with     | |
|   | insights                     | |
|   +------------------------------+ |
|                                    |
|   [... 3 more feature cards ...]  |
|                                    |
+====================================+
|   ╔════════════════════════════╗  |
|   ║  Dark Background           ║  |
|   ║                            ║  |
|   ║       1,247                ║  |
|   ║       Teams using          ║  |
|   ║       RetroBoard           ║  |
|   ║                            ║  |
|   ║       8,932                ║  |
|   ║       Retrospectives       ║  |
|   ║       completed            ║  |
|   ║                            ║  |
|   ║       45,821               ║  |
|   ║       Cards created        ║  |
|   ║                            ║  |
|   ╚════════════════════════════╝  |
+====================================+
|   Login  •  Register               |
+====================================+
```

### 2.3 Loading State

```
+====================================+
|                                    |
|   Retrospectives that actually     |
|   drive improvement                |
|                                    |
|   [... hero section renders ...]   |
|                                    |
+====================================+
|                                    |
|   [... features render ...]        |
|                                    |
+====================================+
|   ╔════════════════════════════╗  |
|   ║                            ║  |
|   ║   ┌─────┐  ┌─────┐  ┌────┐ ║  |
|   ║   │█████│  │█████│  │████│ ║  |
|   ║   └─────┘  └─────┘  └────┘ ║  |
|   ║   Skeleton loading...      ║  |
|   ║                            ║  |
|   ╚════════════════════════════╝  |
+====================================+
```

### 2.4 Error State

```
+====================================+
|   ╔════════════════════════════╗  |
|   ║                            ║  |
|   ║   ⚠️ Stats temporarily     ║  |
|   ║      unavailable           ║  |
|   ║                            ║  |
|   ╚════════════════════════════╝  |
+====================================+
```

---

## 3. Component Breakdown

### 3.1 Component Tree

```
<LandingPage>
  <HeroSection />
  <FeatureShowcase />
  <SocialProof />
  <LandingFooter />
</LandingPage>
```

### 3.2 Component Specifications

| Component | Description | Props | Notes |
|-----------|-------------|-------|-------|
| `LandingPage` | Page container | -- | Full-height viewport, scrollable |
| `HeroSection` | Hero with tagline and CTAs | -- | Gradient background, centered content |
| `FeatureShowcase` | Feature grid with 6 cards | -- | Responsive grid (1 col mobile, 2 col tablet, 3 col desktop) |
| `FeatureCard` | Single feature description | `icon: ReactNode`, `title: string`, `description: string` | Icon from lucide-react, white card with shadow |
| `SocialProof` | Stats section | -- | Fetches data from `/api/stats`, shows skeleton during load |
| `Stat` | Single statistic display | `value: number`, `label: string` | Large number, small label |
| `LandingFooter` | Footer with auth links | -- | Light gray background, centered links |

---

## 4. State Management

### 4.1 Local Component State

The landing page uses React `useState` and `useEffect` for stats fetching. No global state is needed.

```typescript
interface StatsData {
  team_count: number;
  retro_count: number;
  card_count: number;
}

function SocialProof() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => setError('Stats temporarily unavailable'))
      .finally(() => setIsLoading(false));
  }, []);

  // ... render logic
}
```

### 4.2 State Matrix

| State | `isLoading` | `error` | `stats` | UI Behavior |
|-------|-------------|---------|---------|-------------|
| Initial | `true` | `null` | `null` | Show skeleton loading |
| Success | `false` | `null` | `{...}` | Show stats with formatted numbers |
| Error | `false` | `string` | `null` | Show error message "Stats temporarily unavailable" |

---

## 5. User Interactions

| # | Action | Trigger | Result |
|---|--------|---------|--------|
| 1 | Click "Get Started" CTA | Click button in hero section | Navigate to `/register` |
| 2 | Click "Login" CTA | Click button in hero section | Navigate to `/login` |
| 3 | Click "Login" footer link | Click link in footer | Navigate to `/login` |
| 4 | Click "Register" footer link | Click link in footer | Navigate to `/register` |
| 5 | Scroll down | Scroll gesture | Smooth scroll, stats section comes into view |
| 6 | Load page when authenticated | Page load | Redirect to `/dashboard` (router logic) |

---

## 6. Data Requirements

### 6.1 API Endpoint

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/stats` | GET | Fetch public stats | `{ team_count: number, retro_count: number, card_count: number }` |

### 6.2 Expected Response

```json
{
  "team_count": 1247,
  "retro_count": 8932,
  "card_count": 45821
}
```

### 6.3 Number Formatting

| Raw Value | Formatted Display |
|-----------|-------------------|
| 1247 | "1,247" |
| 8932 | "8,932" |
| 45821 | "45,821" |
| 1000000 | "1,000,000" |

Use `Intl.NumberFormat('en-US').format(value)` for formatting.

---

## 7. Visual Design Notes

### 7.1 Hero Section

| Element | Specification |
|---------|---------------|
| Background | Gradient `bg-gradient-to-br from-indigo-50 via-white to-slate-50` |
| Tagline | `text-5xl font-bold text-slate-900 leading-tight` (mobile: `text-4xl`) |
| Subheading | `text-xl text-slate-600 max-w-2xl mx-auto` (mobile: `text-lg`) |
| CTA container | Flex row on desktop, stack on mobile, gap-4 |
| Primary CTA | `bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg shadow-md text-lg font-semibold` |
| Secondary CTA | `border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-8 py-3 rounded-lg text-lg font-semibold` |
| Padding | `py-20 px-4` (desktop: `py-32`) |

### 7.2 Feature Showcase

| Element | Specification |
|---------|---------------|
| Section heading | `text-3xl font-bold text-slate-900 text-center mb-12` |
| Grid layout | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` |
| Feature card | `bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6` |
| Icon | `h-12 w-12 text-indigo-600 mb-4` |
| Card title | `text-xl font-semibold text-slate-900 mb-2` |
| Card description | `text-sm text-slate-600 leading-relaxed` |

### 7.3 Social Proof Section

| Element | Specification |
|---------|---------------|
| Background | `bg-slate-900 py-16` |
| Stats grid | `grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto` |
| Stat number | `text-5xl font-bold text-indigo-400 mb-2` |
| Stat label | `text-sm text-slate-300` |
| Skeleton | `animate-pulse bg-slate-700 h-12 w-32 rounded` |
| Error message | `text-sm text-slate-400` |

### 7.4 Footer

| Element | Specification |
|---------|---------------|
| Background | `bg-slate-100 py-8` |
| Links | `text-slate-600 hover:text-indigo-600 transition-colors` |
| Separator | `•` character with `text-slate-400` |

---

## 8. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| `< 640px` (mobile) | Hero: single column, stack CTAs vertically. Features: 1 column grid. Stats: 1 column stacked. |
| `640px - 1023px` (tablet) | Hero: single column, CTAs side-by-side. Features: 2 column grid. Stats: 3 columns. |
| `>= 1024px` (desktop) | Hero: centered, max-width container. Features: 3 column grid. Stats: 3 columns. |

---

## 9. Accessibility

| Element | ARIA / A11y Requirement |
|---------|------------------------|
| Hero heading | `<h1>` tag, page title |
| Subheading | `<p>` tag, no ARIA needed |
| CTA buttons | `<Link>` components rendered as `<a>` tags with descriptive text |
| Feature section | `<section>` with `aria-label="Features"` |
| Feature cards | No special ARIA (semantic HTML) |
| Feature icons | `aria-hidden="true"` (decorative) |
| Stats section | `<section>` with `aria-label="Statistics"` |
| Stats loading | `aria-live="polite"` on skeleton container |
| Stats error | `role="alert"` on error message |
| Footer links | `<a>` tags with clear link text |
| Color contrast | All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text) |

---

## 10. Content Copy

### 10.1 Hero Section

- **Tagline:** "Retrospectives that actually drive improvement"
- **Subheading:** "Run effective retrospectives with your team using proven templates and real-time collaboration"
- **Primary CTA:** "Get Started"
- **Secondary CTA:** "Login"

### 10.2 Feature Showcase

**Section heading:** "Why RetroBoard Pro?"

| Feature | Icon | Title | Description |
|---------|------|-------|-------------|
| Templates | `LayoutDashboard` | 6 Retro Templates | Choose from Start/Stop/Continue, Mad/Sad/Glad, 4Ls, Sailboat, Rose/Thorn/Bud, and Icebreaker to fit your team's needs |
| Real-time | `Users` | Real-Time Collaboration | See everyone's cards update live with WebSocket-powered sync. No refreshing, no delays. |
| Analytics | `BarChart` | Analytics Dashboard | Track team progress with insights on participation, sentiment, and action item completion rates |
| Facilitation | `Target` | Facilitation Tools | Built-in timer, voting, grouping, and phase management to keep your retro focused and productive |
| Export | `Download` | Export Options | Export retro results to PDF, CSV, or Markdown for your records and stakeholder reports |
| Action Items | `CheckCircle` | Action Items | Track follow-up tasks and ensure commitments are kept with integrated action item management |

### 10.3 Social Proof

- **Stat 1 label:** "Teams using RetroBoard"
- **Stat 2 label:** "Retrospectives completed"
- **Stat 3 label:** "Cards created"

---

## 11. Error Handling

| Scenario | Behavior |
|----------|----------|
| Stats API returns 200 with data | Show stats normally |
| Stats API returns 500 | Show error message "Stats temporarily unavailable" |
| Stats API times out (>5s) | Abort fetch, show error message |
| Network error | Show error message "Check your internet connection" |
| Stats API returns invalid JSON | Catch JSON parse error, show error message |
| Stats API returns unexpected shape | Validate data, fallback to error message if validation fails |

---

## 12. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Page load time | Landing page is lazy-loaded via React Router, hero section renders immediately |
| Stats API latency | Fetch runs after initial render, skeleton shown during load, page is usable without stats |
| Bundle size | No extra dependencies, uses existing design system components |
| First Contentful Paint | Hero section with static content renders < 1s, stats load async |
| SEO (future) | Server-side rendering or static generation for better crawlability |

---

## 13. Testing Considerations

### 13.1 Component Tests

- Hero section renders with correct copy
- CTAs link to correct routes (`/register`, `/login`)
- Feature cards render with correct icons and text
- Stats section shows skeleton during loading
- Stats section shows formatted numbers on success
- Stats section shows error message on failure

### 13.2 E2E Tests (Playwright)

- Unauthenticated user visits `/` → sees landing page
- Authenticated user visits `/` → redirects to `/dashboard`
- Click "Get Started" → navigates to `/register`
- Click "Login" → navigates to `/login`
- Stats section fetches data from `/api/stats` → displays formatted numbers

---

## 14. Future Enhancements (Not in Phase 1)

- **Animated stats counters:** Count up from 0 to actual value on scroll into view
- **Screenshots/demo video:** Add product visuals
- **Customer testimonials:** Quotes from users
- **Newsletter signup:** Collect emails for product updates
- **FAQ section:** Answer common questions
- **SEO optimization:** Meta tags, Open Graph, structured data
- **Dark mode toggle:** Match user's system preference
