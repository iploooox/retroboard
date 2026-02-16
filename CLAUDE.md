# RetroBoard Pro

## Development Workflow

This project uses **Skills-Driven Development** (SDD). Load the SDD skill for all development workflows: epic creation, planning, implementation, bug investigation, and team coordination.

## Project Layout

- `epics/` — Active work: specs, plans, decisions, bugs
- `services/` — Source of truth (update after merge only)
- `docs/` — Project documentation

## Active Epics

See `epics/INDEX.md` for current status.

## Coding Standards

Read `docs/coding-standards.md` before writing any code. These rules are derived from real bugs and are non-negotiable.

## Bug Logging

When you find a bug during implementation or testing, log it in `bugs/{BUG-ID}/` following the structure in `bugs/README.md`. Map it to a coding standard category. If it's a new class of bug, add a new rule to `docs/coding-standards.md`.

## Tech Constraints

- **Database**: PostgreSQL only — no Redis, no SQLite, no other stores
- **Server**: Single TypeScript server — serves API, WebSocket, and static frontend
- **No microservices** — monolithic server architecture

## Agent Coordination Protocol

### Task Specificity (Non-Negotiable)
"Fix E2E tests" is NOT a valid task. Every agent task MUST include:
- **Exact file and line** of the failure
- **Root cause** (what's wrong and why)
- **Exact fix** (which file to change, what to change, how)
- **Verification command** (the specific playwright test command to run)

Bad task: "Fix analytics E2E failures"
Good task: "In ParticipationChart.tsx, add data-testid='participation-heading' to the h3 on line 42. This fixes analytics.spec.ts:539 where getByText('Participation') matches both the heading and the privacy notice. Verify: npx playwright test tests/e2e-browser/user-journey-analytics.spec.ts --grep 'participation'"

### Agent Model and Composition
- Use Opus for all dev agents. Sonnet is too slow and cuts corners.
- PO runs on Opus. PO does NOT write code. PO reads code and challenges.
- PO only checks code AFTER dev claims done — not constantly polling git status.
- ALL priority levels must be fixed — low priority ≠ skip or defer.

### Closed-Loop E2E Verification
The real bugs are integration cracks (PUT vs PATCH, CSS not applying, props passing UUIDs). Unit tests prove nothing about whether a feature works for a real user.

**Rule: If you can't show a Playwright test walking through the user journey from click to database and back, the feature is NOT done.**

Every dev agent MUST, for every feature:
1. Write a Playwright E2E test FIRST describing the happy path (RED)
2. Implement the feature full-stack (frontend → API → database)
3. Start the real server and run the E2E test against it
4. Test MUST pass (GREEN) — if it fails, fix and re-run until green
5. Paste the Playwright test output as PROOF of completion
6. Also run: `npx tsc --noEmit` — zero errors, BOTH frontend and backend. "Pre-existing" is not an excuse — fix them.
7. Also run: `npx eslint src/ tests/` — zero errors. **NEVER use `any` to fix a TS error.** Use the correct type or `unknown` with narrowing.

**Tests are the source of truth, NOT the code.** If a test fails, fix the application code — NEVER modify test assertions to make them pass. ALL non-skipped tests must be GREEN. "4 of 6 passing" is NOT done.

Every agent prompt MUST tell agents to read `docs/agent-protocol.md` for the full verification contract.

### "Blocked" Protocol
- Agent may ONLY declare "blocked" if the work is in a DIFFERENT repo/service they cannot access
- In a monolith, "backend not built yet" is NEVER blocked — it's YOUR job to build it
- PO must verify any "blocked" claim by reading the codebase themselves

### PO Challenge Rules
PO must NEVER accept without investigation: "backend-blocked", "out of scope", "good enough", "works on my machine". Demand E2E test output as proof.

### Communication Rules
- Agents coordinate via TaskList, not messages to orchestrator
- Only message orchestrator for: blockers, completion, or critical questions
- PO messages dev agents directly, not through orchestrator
