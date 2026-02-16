# Agent Protocol — Verification Contract

Every agent on this project MUST follow this protocol. No exceptions.

## Definition of Done

A feature is done ONLY when ALL of these are true:

| Check | How to verify |
|-------|--------------|
| E2E test exists | Playwright test file with happy path user journey |
| E2E test PASSES | Run against real server, paste terminal output |
| TypeScript compiles (frontend) | `cd client && npx tsc --noEmit` — zero errors |
| TypeScript compiles (backend) | `npx tsc --noEmit` from server root — zero errors |
| Every story AC addressed | List each AC with DONE / NOT DONE |
| Story file updated | Check off `[x]` completed acceptance criteria |
| Tracking docs updated | CHECKLIST.md, FRONTEND_GAPS.md, INDEX.md |

## TDD Rules

### Tests are the source of truth, NOT the code.

If a test says "click Skip → navigate to /dashboard" and the app doesn't do that:
- **CORRECT**: Fix the application code so the app navigates to /dashboard
- **WRONG**: Change the test assertion to expect whatever the broken app does

**NEVER modify test assertions to make them pass.** Fix the code under test.

The only valid reasons to modify a test:
- The test has a genuine bug (wrong selector, missing setup step, race condition in test logic)
- The spec/AC changed and the PO approved the change
- The test is testing something that was explicitly removed from scope

When in doubt, ask the PO — do NOT silently weaken a test.

### ALL non-skipped tests must be GREEN

"4 of 6 passing" is NOT done. Failing tests are not "non-critical edge cases." Every non-skipped test describes expected user behavior. Fix until ALL are GREEN.

### Zero tolerance for TypeScript errors

`npx tsc --noEmit` must produce ZERO errors — both frontend (`cd client && npx tsc --noEmit`) and backend (from server root). "Pre-existing errors" is NOT an excuse to ignore them. If you find TS errors, fix them. If they're in files you didn't touch, fix them anyway. The codebase must compile clean.

### Zero tolerance for `any`

ESLint enforces `@typescript-eslint/no-explicit-any: error`. Run `npx eslint src/ tests/` — zero errors.

**NEVER use `any` to "fix" a TypeScript error.** If you don't know the type:
1. Read the library's type definitions (hover in IDE, check `node_modules/@types/`)
2. Read the source code that produces the value
3. Use the correct specific type
4. As last resort, use `unknown` with type narrowing — NEVER `any`

Using `any` is not fixing an error — it's hiding it. The orchestrator WILL reject PRs with `any`.

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
DISABLE_RATE_LIMIT=true DATABASE_URL=postgres://localhost:5432/retroboard JWT_SECRET=dev-secret-must-be-at-least-32-characters-long npx tsx src/server.ts &
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

## Plan Mode (Mandatory for Dev and E2E Tester Agents)

Dev agents and E2E testers MUST be spawned in plan mode (`"mode": "plan"`). This prevents wasted work by catching bad decisions before code is written.

### How it works
1. Agent spawns in **read-only mode** — can read files, search code, but CANNOT edit
2. Agent reads the spec, explores the codebase, writes a plan
3. Agent calls `ExitPlanMode` → orchestrator receives plan approval request
4. Orchestrator reviews the plan:
   - **Approve**: agent exits plan mode, gets edit access, starts implementing
   - **Reject with feedback**: agent stays in plan mode, revises plan, resubmits
5. PO does NOT need plan mode (read-only role by nature)

### What the orchestrator checks before approving
- Is the agent planning to modify test assertions? → **REJECT**
- Is the agent declaring something "blocked"? → **REJECT** (in a monolith, build it)
- Is the agent skipping any ACs or calling them "non-critical"? → **REJECT**
- Does the plan cover ALL non-skipped tests, not just the happy path? → Must be yes
- Does the plan match the spec/story ACs? → Must be yes

## Task Lifecycle

```
1. CLAIM    → TaskUpdate: set owner + status=in_progress
2. PLAN     → Read specs, explore code, write plan (plan mode — read-only)
3. APPROVE  → Orchestrator reviews and approves plan
4. TEST     → Write Playwright E2E test for happy path (RED — must fail)
5. BUILD    → Implement feature full-stack (GREEN — test passes)
6. VERIFY   → Run E2E against real server, paste output
7. REPORT   → Use Evidence Format above
8. COMPLETE → TaskUpdate: status=completed (ONLY after ALL non-skipped E2E tests pass)
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
