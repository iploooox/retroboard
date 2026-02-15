# RetroBoard Pro

## Development Workflow

This project uses **Skills-Driven Development** (SDD). Load the SDD skill for all development workflows: epic creation, planning, implementation, bug investigation, and team coordination.

## Project Layout

- `epics/` — Active work: specs, plans, decisions, bugs
- `services/` — Source of truth (update after merge only)
- `docs/` — Project documentation

## Active Epics

See `epics/INDEX.md` for current status.

## Tech Constraints

- **Database**: PostgreSQL only — no Redis, no SQLite, no other stores
- **Server**: Single TypeScript server — serves API, WebSocket, and static frontend
- **No microservices** — monolithic server architecture

## Agent Coordination Protocol

### Team Composition (Non-Negotiable)
- EVERY agent team MUST include: dev agents (Sonnet) + PO (Opus) + E2E tester (Sonnet)
- NEVER spawn dev agents alone. Sonnet cuts corners without oversight.
- PO runs on Opus. PO does NOT write code. PO reads code and challenges.
- Testers do NOT write implementation code. They only write E2E tests.
- ALL priority levels must be fixed — low priority ≠ skip or defer.
- NEVER use standalone Task agents. ALWAYS use TeamCreate.

### Closed-Loop E2E Verification
The real bugs are integration cracks (PUT vs PATCH, CSS not applying, props passing UUIDs). Unit tests prove nothing about whether a feature works for a real user.

**Rule: If you can't show a Playwright test walking through the user journey from click to database and back, the feature is NOT done.**

Every dev agent MUST, for every feature:
1. Write a Playwright E2E test FIRST describing the happy path (RED)
2. Implement the feature full-stack (frontend → API → database)
3. Start the real server and run the E2E test against it
4. Test MUST pass (GREEN) — if it fails, fix and re-run until green
5. Paste the Playwright test output as PROOF of completion
6. Also run: `npx tsc --noEmit` (zero errors) + check story ACs

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
