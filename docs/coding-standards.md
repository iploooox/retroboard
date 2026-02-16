# Coding Standards

Standards derived from real bugs found during development. Each rule exists because we shipped a bug that violated it.

## 1. UI Text Must Be Unique Per Page

**Bug:** `getByText(teamName)` matched both a `<p>` tag and a `<Link>` element on the analytics page, causing Playwright strict mode violations.

**Rule:** Every visible text string that a test might target must appear exactly once in the rendered page, OR be scoped inside a unique container (`data-testid`).

**How to comply:**
- Before adding text to UI, search the component tree for the same string
- If the same text must appear twice (e.g. breadcrumb + heading), wrap at least one in a `data-testid` container
- Never put the same text in a standalone element AND inside an interactive element on the same page

**Bad:**
```tsx
<p>{teamName}</p>                    {/* standalone */}
<Link to={`/teams/${teamId}`}>{teamName}</Link>  {/* also has teamName */}
```

**Good:**
```tsx
<Link to={`/teams/${teamId}`}>Back to {teamName}</Link>  {/* unique text */}
```

---

## 2. API Response Shapes Must Match Frontend Types

**Bug:** Frontend expected `response.data.id` but backend returned `{ team: { id } }`. Crashed at runtime, passed TypeScript because the response was typed as `any`.

**Rule:** Every API call in the frontend must have its response type explicitly defined to match the backend's actual response shape. Never use `any` for API responses.

**How to comply:**
- Define response types in `client/src/lib/` next to the API call
- The type must match the backend route handler's return shape exactly
- When changing a backend response shape, grep the frontend for all callers and update types
- Never use `as any` or `eslint-disable` to suppress type errors on API responses

**Backend returns:**
```typescript
return c.json({ team: { id, name } });
```

**Frontend must type as:**
```typescript
const response = await api.post<{ team: { id: string; name: string } }>('/teams', body);
```

---

## 3. No eslint-disable Without ADR

**Bug:** 12 `eslint-disable @typescript-eslint/no-explicit-any` comments were added to suppress real type errors instead of fixing them.

**Rule:** `eslint-disable` comments are banned unless accompanied by an ADR explaining why the suppression is necessary. If you can't type it properly, that's a design problem to fix — not suppress.

**How to comply:**
- Fix the type error properly
- If genuinely impossible (e.g. third-party library with bad types), create an ADR in `epics/*/decisions/` explaining why
- Add the ADR reference as a comment: `// eslint-disable-next-line ... — see ADR-042`
- PO review gate checks for any new `eslint-disable` comments

---

## 4. Semantic HTML for Interactive Elements

**Bug:** PhaseBar rendered future phases as `<div>` instead of `<button>`, making them invisible to `getByRole('button')`. Also broke keyboard accessibility.

**Rule:** If a user can click it, it must be a `<button>` or `<a>`. Never attach click handlers to `<div>` or `<span>`.

**How to comply:**
- Clickable actions: `<button>`
- Navigation: `<a>` or framework `<Link>`
- Non-interactive display: `<div>`, `<span>`, `<p>`
- If something is conditionally clickable, use `<button disabled>` not a `<div>`

---

## 5. aria-label Must Match User-Facing Text

**Bug:** PhaseBar had `aria-label="${phase.number} ${phase.label}"` (e.g. "3 Vote"), but tests and screen readers expected just "Vote".

**Rule:** `aria-label` must contain the same text a user would see or expect. Don't prepend internal identifiers like indices or IDs.

**How to comply:**
- `aria-label` should match the visible text, or describe the action in plain language
- For buttons: `aria-label="Vote"`, `aria-label="Edit card"`, `aria-label="Next phase"`
- Never: `aria-label="3 Vote"`, `aria-label="btn-vote-123"`

---

## 6. Display Values Must Be Human-Readable

**Bug:** Vote count displayed as bare `{card.vote_count}` (just "1") — tests couldn't distinguish it from other "1" text on the page. Also poor UX.

**Rule:** Always include units or context with numeric displays. A bare number is never sufficient.

**How to comply:**
- Votes: `"3 votes"` not `"3"`
- Time: `"5 min"` not `"5"`
- Counts: `"12 cards"` not `"12"`
- If the number needs programmatic targeting, add `data-testid`

---

## 7. No Hardcoded Ports or URLs

**Bug:** `localhost:5173` hardcoded in playwright config, vite config, and test files. Made parallel testing impossible.

**Rule:** All host/port references must come from environment variables with sensible defaults.

**How to comply:**
```typescript
// Good
const port = parseInt(process.env.PORT || '3000');
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

// Bad
const port = 3000;
const baseURL = 'http://localhost:5173';
```

---

## 8. Database Functions Must Have Stable Signatures

**Bug:** `calculate_card_sentiment(text)` was called with 1 arg in repository code, but the DB function expected 2 args `(text, team_id)`. Crashed at runtime.

**Rule:** When adding/changing a DB function signature, grep all callers and update them. If a parameter is optional, give it a DEFAULT in the function definition — don't rely on callers passing NULL.

**How to comply:**
- `CREATE FUNCTION foo(text, team_id uuid DEFAULT NULL)` — callers with 1 arg still work
- After changing a function signature, run: `grep -r "function_name" src/` and update every caller
- Add an integration test that calls the function with the minimum number of args

---

## 9. Test Selectors Must Be Resilient

**Bug:** `getByText(/vote phase|voting/i)` matched both the "Vote Phase" badge AND "Test card for voting" content. Strict mode violation.

**Rule:** Prefer `data-testid` or scoped selectors over broad text matching. Text selectors are fragile — any UI text change breaks them.

**Selector priority (best to worst):**
1. `getByTestId('phase-badge')` — immune to text changes
2. `getByRole('button', { name: 'Vote' })` — semantic, accessible
3. `getByText('exact text')` — ok if text is unique (see Rule 1)
4. `getByText(/regex/i)` — fragile, avoid for anything that might match multiple elements

---

## 10. Icebreaker/Warmup UX Pattern

**Bug:** Icebreaker was rendered as an inline card during write phase, cluttering the board. Spec said "before entering write phase" — should be a fullscreen warmup that replaces the board temporarily.

**Rule:** Pre-phase activities (warmups, icebreakers, intros) must be fullscreen overlays that dismiss before the phase begins. They should NOT be inline elements competing with phase content.

---

## Enforcement

These standards are checked at two gates:

1. **PO Review (post-implementation):** PO diffs all changed files looking for violations. Any `eslint-disable`, `any` type, bare number display, or hardcoded port is flagged.
2. **Bug Logging:** When an agent finds a bug that maps to one of these categories, log it in `/bugs/` following the SDD bug template. Weekly review of `/bugs/` feeds back into this document.

## Adding New Standards

When you find a bug class not covered here:
1. Log the bug in `/bugs/{BUG-ID}/`
2. Add a new numbered rule to this file
3. Include: what the bug was, what the rule is, how to comply, bad/good examples
