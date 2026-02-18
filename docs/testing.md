# Testing

RetroBoard Pro has three levels of tests: unit, integration, and end-to-end browser tests. All tests require PostgreSQL.

## Quick Reference

```bash
cd services/retroboard-server

npm test                  # All backend tests (unit + integration)
npm run test:watch        # Watch mode
npm test --prefix client  # Frontend tests
npx tsc --noEmit          # Type check (server + client)
npm run lint              # ESLint
```

## Backend Tests (Vitest)

### Running

```bash
cd services/retroboard-server

# Run all tests once
npm test

# Watch mode — re-runs on file changes
npm run test:watch

# Run a specific test file
npx vitest run tests/integration/auth/login.test.ts

# Run tests matching a pattern
npx vitest run --grep "successful login"
```

### How It Works

**Global setup** (`tests/globalSetup.ts`):
1. Creates a `retroboard_test_template` database
2. Runs all migrations and seeds against it
3. Hashes migration files — skips rebuild if nothing changed (fast local iteration)

**Per-test setup** (`tests/setup.ts`):
1. Clones the template database: `CREATE DATABASE retroboard_test_{pid} TEMPLATE retroboard_test_template`
2. Sets `process.env.DATABASE_URL` to the test database
3. Tears down the test database after all tests in the file complete

This means every test file gets a clean, fully migrated database without running 34 migrations each time.

### Test Structure

```
tests/
├── globalSetup.ts          # One-time template DB creation
├── setup.ts                # Per-file DB clone + teardown
├── helpers/                # Shared test utilities
│   └── db.ts               # Helper for creating users, teams, boards in tests
├── unit/                   # Pure logic tests (no DB)
│   ├── board/
│   ├── facilitation/
│   ├── validation/
│   ├── export/
│   └── ws/
├── integration/            # API tests (HTTP requests against real DB)
│   ├── auth/
│   ├── board/
│   ├── teams/
│   ├── templates/
│   ├── icebreakers/
│   └── ...
└── e2e/                    # Full server-side E2E (multi-step scenarios)
    ├── happy-path.test.ts
    ├── phase2-happy-path.test.ts
    └── ...
```

### Writing Tests

Integration tests use `app.request()` from Hono:

```typescript
const res = await app.request('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
});

expect(res.status).toBe(200);
const body = await res.json();
expect(body.accessToken).toBeDefined();
```

## Frontend Tests (Vitest + jsdom)

```bash
cd services/retroboard-server/client

# Run all tests
npm test

# Watch mode
npm run test:watch
```

Frontend tests use jsdom environment to simulate the browser. Components are tested with React Testing Library patterns.

## E2E Browser Tests (Playwright)

### Prerequisites

Both the backend and frontend dev servers must be running:

```bash
# Terminal 1 — backend
cd services/retroboard-server
DATABASE_URL=postgres://localhost:5432/retroboard \
JWT_SECRET=dev-secret-must-be-at-least-32-characters-long \
DISABLE_RATE_LIMIT=true \
npm run dev

# Terminal 2 — frontend
cd services/retroboard-server/client
npm run dev
```

### Running

```bash
cd services/retroboard-server

# Run all browser tests
DISABLE_RATE_LIMIT=true \
PLAYWRIGHT_BASE_URL=http://localhost:5173 \
npx playwright test tests/e2e-browser/

# Run a specific test file
npx playwright test tests/e2e-browser/retro-flow.spec.ts

# Run with UI mode (interactive)
npx playwright test --ui

# Run headed (see the browser)
npx playwright test --headed
```

### Configuration

From `playwright.config.ts`:

| Setting | Value |
|---------|-------|
| Browser | Chromium (Desktop) |
| Workers | 4 (parallel) |
| Test timeout | 120 seconds |
| Base URL | `http://localhost:5173` (or `PLAYWRIGHT_BASE_URL`) |
| Report | HTML (`playwright-report/`) |

### Test Patterns

E2E tests use helper functions for common flows:

```typescript
// tests/e2e-browser/helpers.ts
import { generateUniqueEmail } from './helpers';

// Register + login flow
const email = generateUniqueEmail();
await page.goto('/register');
await page.fill('[name=email]', email);
// ...
```

Key patterns (from experience):
- Use `getByRole('button', { name: /^add card$/i })` for card submission, not keyboard Enter
- Dismiss icebreaker with `getByRole('button', { name: /start writing/i })` before board interaction
- Use `generateUniqueEmail()` with random suffix to prevent cross-worker collisions
- WebSocket timeouts should be 10-15s under parallel load, not 5s
- Phase transitions: click the phase name in the stepper, then "Change Phase"

## Type Checking

```bash
cd services/retroboard-server

# Check backend
npx tsc --noEmit

# Check frontend
cd client && npx tsc --noEmit
```

Both projects use `strict: true`. Zero errors is required — "pre-existing errors" is not an excuse.

## Linting

```bash
cd services/retroboard-server

# Lint
npm run lint

# Format
npm run format
```

ESLint 9 with TypeScript-ESLint. Prettier for formatting. Both enforced in CI.

## CI Pipeline

GitHub Actions runs on every push and PR to `main`:

1. **Lint + Typecheck** (parallel) — ESLint, TypeScript for server and client
2. **Backend tests** — Vitest against PostgreSQL
3. **Frontend tests** — Vitest with jsdom
4. **E2E tests** — Playwright against running servers

All four gates must pass. Zero tolerance for failures.
