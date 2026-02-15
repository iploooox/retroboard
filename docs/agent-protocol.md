# Agent Protocol — Verification Contract

Every agent on this project MUST follow this protocol. No exceptions.

## Definition of Done

A feature is done ONLY when ALL of these are true:

| Check | How to verify |
|-------|--------------|
| E2E test exists | Playwright test file with happy path user journey |
| E2E test PASSES | Run against real server, paste terminal output |
| TypeScript compiles | `npx tsc --noEmit` — zero errors |
| Every story AC addressed | List each AC with DONE / NOT DONE |
| Story file updated | Check off `[x]` completed acceptance criteria |
| Tracking docs updated | CHECKLIST.md, FRONTEND_GAPS.md, INDEX.md |

## E2E Test Requirements

E2E tests are the ONLY proof that a feature works. Unit tests don't count.

### What a good E2E test covers
- **Full pipeline**: UI interaction → API call → DB mutation → UI update
- **Persistence**: action → page reload → data still there
- **Real selectors**: read actual component code first, NEVER guess
- **Real server**: test runs against a running backend + frontend, not mocks

### What E2E catches that unit tests miss
- API contract mismatches (PUT vs PATCH, wrong payload shape)
- CSS not applying (theme selected but no visual change)
- Props not flowing (parent passes UUID instead of name)
- WebSocket events not arriving (server sends, client doesn't listen)
- Response shape mismatches (frontend expects `data.items`, API returns `data.results`)

### How to run E2E tests
```bash
# In separate terminals (or background):
DATABASE_URL=postgres://localhost:5432/retroboard JWT_SECRET=dev-secret-must-be-at-least-32-characters-long npx tsx src/server.ts &
cd client && npx vite --port 5173 &

# Run specific test:
npx playwright test tests/e2e-browser/<file>.spec.ts --grep "<test-name>"
```

### Minimum coverage per feature
- 1 happy path test per user-visible feature
- If feature has state changes: test the full round-trip (create → verify → modify → verify → reload → verify)
- If feature involves multiple users: use separate browser contexts

## Evidence Format

When reporting task completion, use this format:

```
## Task Completion Report

### Files Modified
- path/to/file1.tsx (created, 150 lines)
- path/to/file2.ts (modified, +30/-5 lines)

### E2E Test
- File: tests/e2e-browser/user-journey-xyz.spec.ts
- Test: "user can add custom sentiment word and see it on card"

### Test Output
[PASTE ACTUAL PLAYWRIGHT OUTPUT HERE]
✓ user can add custom sentiment word and see it on card (3.2s)
1 passed (5.1s)

### Acceptance Criteria
- [x] AC #1: Custom words can be added — DONE (E2E test line 45)
- [x] AC #2: Score range -5 to 5 validated — DONE (E2E test line 52)
- [ ] AC #3: Admin-only access — NOT DONE: RBAC middleware not yet applied to route
```

## "Blocked" Protocol

### Decision tree
1. Is the blocking code in THIS repository? → **BUILD IT.** You are full-stack.
2. Is it a third-party API/service you cannot access? → Document what's needed and escalate to orchestrator.
3. Is it a design decision with no clear answer? → Create an ADR and ask PO.

### What is NEVER a valid blocker
- "Backend endpoints don't exist" — in a monolith, build them
- "Database table doesn't have that column" — write a migration
- "WebSocket event not implemented" — add it to the WS handler
- "API returns wrong shape" — fix the API

### If you must declare something blocked
1. Show the EXACT file/line where the dependency should exist
2. Explain what you searched and didn't find
3. Explain why building it yourself is impossible (not just hard)
4. Wait for orchestrator confirmation before marking blocked

## Task Lifecycle

```
1. CLAIM    → TaskUpdate: set owner + status=in_progress
2. READ     → Read story ACs, specs, existing code patterns
3. TEST     → Write Playwright E2E test for happy path (RED — must fail)
4. BUILD    → Implement feature full-stack (GREEN — test passes)
5. VERIFY   → Run E2E against real server, paste output
6. REPORT   → Use Evidence Format above
7. COMPLETE → TaskUpdate: status=completed (ONLY after E2E passes)
```

If stuck for >10 minutes → message PO (not orchestrator).
If E2E test keeps failing → investigate the integration crack, don't give up.

## PO-Specific Rules

The PO does NOT write code. The PO:
1. Reads every story's acceptance criteria before devs start
2. Messages dev agents with hard questions (empty states, error handling, edge cases)
3. After devs claim completion, reads their actual code and E2E tests
4. Runs `npx playwright test` to verify E2E passes — does NOT trust agent claims
5. Checks every AC checkbox against the actual implementation
6. NEVER accepts "blocked" without reading the codebase to verify the claim
7. Updates all tracking docs (stories, checklist, index)

## Selector Reference

### Auth Forms
```typescript
// Login
page.getByLabel('Email')
page.locator('#password')
page.getByRole('button', { name: /log\s?in|sign in/i })

// Register
page.getByLabel('Display Name')
page.getByLabel('Email')
page.locator('#register-password')
page.getByRole('button', { name: /create account/i })

// Logout (dropdown)
page.locator('header button').filter({ has: page.locator('.rounded-full') }).click();
page.getByRole('button', { name: /log out/i }).click();
```

### Board
```typescript
page.getByRole('button', { name: /add a card/i })
page.getByPlaceholder("What's on your mind?")
page.getByRole('button', { name: /write|group|vote|discuss|action/i })
page.getByRole('button', { name: /lock board|unlock board/i })
```

### Test Helpers (`tests/e2e-browser/helpers.ts`)
- `registerUser(page, { email, password, displayName })`
- `loginUser(page, { email, password })`
- `logoutUser(page)`
- `generateUniqueEmail()`
- `createTeamAndBoard(page, { teamName })`
