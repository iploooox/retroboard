# Parallel Agent Protocol

How to run multiple dev agents on the same RetroBoard codebase without conflicts.

## The Problem

When multiple agents work on the same repo simultaneously, they fight over:

1. **Files** -- editing the same source files, overwriting each other's changes
2. **Ports** -- server (3000) and frontend (5173) collide
3. **Database** -- E2E tests truncate tables, destroying each other's test data
4. **Playwright** -- all agents hit `localhost:5173`, stepping on each other's browser state

## Architecture Overview

```
retroboard/                          (shared origin repo)
  |
  +-- .worktrees/
  |     +-- agent-1/                 (git worktree, full copy)
  |     +-- agent-2/                 (git worktree, full copy)
  |     +-- agent-3/                 (git worktree, full copy)
  |
  +-- scripts/
        +-- setup-agent-env.sh       (creates worktree + DB + prints env)
        +-- teardown-agent-env.sh    (removes worktree + DB)
```

Each agent gets:
- Its own git worktree (isolated filesystem)
- Its own branch
- Its own PostgreSQL database
- Its own server port and frontend port

## 1. Filesystem Isolation: Git Worktrees

Each agent works in a separate git worktree. Worktrees share the same `.git` history but have independent working directories, so file edits never collide.

### Creating a worktree

```bash
cd /Users/patrykolejniczakorlowski/Development/retroboard

# Agent 1
git worktree add .worktrees/agent-1 -b agent-1/task-description main

# Agent 2
git worktree add .worktrees/agent-2 -b agent-2/task-description main

# Agent 3
git worktree add .worktrees/agent-3 -b agent-3/task-description main
```

### Branch naming convention

```
agent-{N}/{short-task-description}
```

Examples:
- `agent-1/fix-timer-sync`
- `agent-2/add-export-pdf`
- `agent-3/refactor-auth`

### Merging back

After an agent finishes, from the main repo:

```bash
cd /Users/patrykolejniczakorlowski/Development/retroboard

# Review and merge agent-1's work
git checkout main
git merge agent-1/fix-timer-sync

# Or if you prefer rebasing
git rebase main agent-1/fix-timer-sync
git checkout main
git merge agent-1/fix-timer-sync
```

### Important constraints

- Agents must NOT `cd` into each other's worktrees
- Agents must NOT run `git` commands that affect the shared `.git` directory (e.g., `git gc`, `git prune`)
- Each agent should only commit to its own branch

## 2. Port Allocation

Each agent gets a dedicated server port and frontend port. No overlap.

| Agent | Server Port | Frontend Port | WebSocket |
|-------|-------------|---------------|-----------|
| 1     | 3001        | 5174          | ws://localhost:3001/ws |
| 2     | 3002        | 5175          | ws://localhost:3002/ws |
| 3     | 3003        | 5176          | ws://localhost:3003/ws |

Reserved: port 3000 (default server) and 5173 (default frontend) are left free for manual development.

### How ports are passed

**Server** (Hono): The `PORT` env var is read by `src/config/env.ts` via Zod:
```bash
PORT=3001 DATABASE_URL=... JWT_SECRET=... npm run dev
```

**Frontend** (Vite): The `--port` flag overrides the default 5173. The API proxy target must also change:
```bash
cd client && npx vite --port 5174
```

But the Vite proxy target (`http://localhost:3000`) is hardcoded in `client/vite.config.ts`. The setup script patches this in each worktree, or you can use Vite's env override:

```bash
VITE_API_PORT=3001 npx vite --port 5174
```

This requires a one-line change to `vite.config.ts` (see Section 7 below).

**CORS**: The server's CORS config in `src/server.ts` hardcodes allowed origins. In development mode, it allows `localhost:5173` and `localhost:3000`. Each agent's worktree patches this to include its own frontend port, or the server should be updated to allow all localhost origins in development.

### Recommended CORS fix (apply once to main)

In `src/server.ts`, replace the static origin list with a dynamic localhost allowlist:

```typescript
origin: env.NODE_ENV === 'production'
  ? []
  : (origin) => {
      // Allow any localhost origin in development
      return origin && /^http:\/\/localhost:\d+$/.test(origin)
        ? origin
        : null;
    },
```

This lets any `localhost:NNNNN` origin through in development mode without needing per-agent patches.

## 3. Database Isolation

### Unit and integration tests (already safe)

The existing `tests/setup.ts` creates a per-process database (`retroboard_test_{pid}`), runs migrations and seeds, then drops it in `afterAll`. This means `vitest run` is already safe to run in parallel across agents -- each Vitest process gets its own ephemeral database. No changes needed.

### E2E browser tests (the danger zone)

Playwright E2E tests run against a live server with a real database. If two agents run E2E tests simultaneously against the same DB, they trash each other's data.

**Solution: one database per agent.**

| Agent | Database Name        | DATABASE_URL                                          |
|-------|----------------------|-------------------------------------------------------|
| 1     | `retroboard_agent_1` | `postgres://localhost:5432/retroboard_agent_1`        |
| 2     | `retroboard_agent_2` | `postgres://localhost:5432/retroboard_agent_2`        |
| 3     | `retroboard_agent_3` | `postgres://localhost:5432/retroboard_agent_3`        |

Each agent's database gets migrations and seeds applied at setup time.

### Creating agent databases

```bash
createdb retroboard_agent_1
DATABASE_URL=postgres://localhost:5432/retroboard_agent_1 npm run db:migrate
DATABASE_URL=postgres://localhost:5432/retroboard_agent_1 npm run db:seed
```

### Passing DATABASE_URL

Every command the agent runs must include its `DATABASE_URL`:

```bash
# Start server
DATABASE_URL=postgres://localhost:5432/retroboard_agent_1 \
  JWT_SECRET=dev-secret-must-be-at-least-32-characters-long \
  PORT=3001 \
  npm run dev

# Run unit/integration tests (setup.ts creates its own ephemeral DB,
# but DATABASE_URL must be set for the env schema validation)
DATABASE_URL=postgres://localhost:5432/retroboard_agent_1 \
  JWT_SECRET=dev-secret-must-be-at-least-32-characters-long \
  npm test

# Run E2E browser tests
PLAYWRIGHT_BASE_URL=http://localhost:5174 \
  npx playwright test
```

## 4. Playwright Configuration

The current `playwright.config.ts` hardcodes `baseURL: 'http://localhost:5173'`. Each agent needs a different base URL.

**Solution: use an environment variable with a fallback.**

The Playwright config should be updated (once, on main) to:

```typescript
use: {
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
  trace: 'on-first-retry',
},
```

The E2E browser test `retro-flow.spec.ts` also hardcodes `baseURL: 'http://localhost:5173'` in its `browser.newPage()` call. That should use the config's baseURL instead (remove the explicit `baseURL` override from the `newPage` call, since Playwright propagates the config's `baseURL` automatically).

Each agent then passes its frontend URL:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:5174 npx playwright test   # Agent 1
PLAYWRIGHT_BASE_URL=http://localhost:5175 npx playwright test   # Agent 2
PLAYWRIGHT_BASE_URL=http://localhost:5176 npx playwright test   # Agent 3
```

## 5. Vite Config Changes

The `client/vite.config.ts` hardcodes the proxy target to `localhost:3000`. Each agent's frontend must proxy to its own server port.

**Solution: read from an env var.**

```typescript
server: {
  port: parseInt(process.env.VITE_PORT || '5173'),
  proxy: {
    '/api': {
      target: `http://localhost:${process.env.VITE_API_PORT || '3000'}`,
      changeOrigin: true,
    },
    '/ws': {
      target: `http://localhost:${process.env.VITE_API_PORT || '3000'}`,
      ws: true,
    },
  },
},
```

Then each agent starts Vite with:

```bash
VITE_PORT=5174 VITE_API_PORT=3001 npx vite    # Agent 1
VITE_PORT=5175 VITE_API_PORT=3002 npx vite    # Agent 2
VITE_PORT=5176 VITE_API_PORT=3003 npx vite    # Agent 3
```

## 6. Setup and Teardown Scripts

The orchestrator runs these scripts once before spawning agents.

### Setup

```bash
# From the repo root
./scripts/setup-agent-env.sh 1 fix-timer-sync
./scripts/setup-agent-env.sh 2 add-export-pdf
./scripts/setup-agent-env.sh 3 refactor-auth
```

This creates the worktree, database, installs dependencies, runs migrations/seeds, and prints the env vars for the agent.

### Teardown

```bash
./scripts/teardown-agent-env.sh 1
./scripts/teardown-agent-env.sh 2
./scripts/teardown-agent-env.sh 3
```

Or tear down all agents:

```bash
./scripts/teardown-agent-env.sh --all
```

See the scripts themselves for full details: `scripts/setup-agent-env.sh` and `scripts/teardown-agent-env.sh`.

## 7. One-Time Codebase Changes

Before using this protocol, apply these small changes to `main` so that ports and URLs are configurable via environment variables. These changes are backward-compatible (all defaults match current hardcoded values).

### 7a. `playwright.config.ts` -- dynamic baseURL

```diff
 use: {
-  baseURL: 'http://localhost:5173',
+  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
   trace: 'on-first-retry',
 },
```

### 7b. `client/vite.config.ts` -- dynamic proxy target and port

```diff
 server: {
-  port: 5173,
+  port: parseInt(process.env.VITE_PORT || '5173'),
   proxy: {
     '/api': {
-      target: 'http://localhost:3000',
+      target: `http://localhost:${process.env.VITE_API_PORT || '3000'}`,
       changeOrigin: true,
     },
     '/ws': {
-      target: 'http://localhost:3000',
+      target: `http://localhost:${process.env.VITE_API_PORT || '3000'}`,
       ws: true,
     },
   },
 },
```

### 7c. `src/server.ts` -- dynamic CORS origins

```diff
 cors({
-  origin: env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:3000'],
+  origin: env.NODE_ENV === 'production'
+    ? []
+    : (origin, c) => {
+        if (origin && /^http:\/\/localhost:\d+$/.test(origin)) {
+          return origin;
+        }
+        return undefined;
+      },
   credentials: true,
```

### 7d. `tests/e2e-browser/retro-flow.spec.ts` -- remove hardcoded baseURL

```diff
 test.beforeAll(async ({ browser }) => {
-  page = await browser.newPage({ baseURL: 'http://localhost:5173' });
+  page = await browser.newPage();
```

Playwright's `newPage()` inherits `baseURL` from the config automatically.

## 8. Agent Instructions Template

When spawning an agent, include these instructions in its system prompt:

```
## Your Environment

You are Agent {N} working in an isolated environment.

**Working directory:** /Users/patrykolejniczakorlowski/Development/retroboard/.worktrees/agent-{N}
**Branch:** agent-{N}/{task-description}
**Database:** retroboard_agent_{N}

**Environment variables for ALL commands:**
```bash
export DATABASE_URL=postgres://localhost:5432/retroboard_agent_{N}
export JWT_SECRET=dev-secret-must-be-at-least-32-characters-long
export PORT={3000+N}
export NODE_ENV=development
```

**Starting the dev server:**
```bash
cd /Users/patrykolejniczakorlowski/Development/retroboard/.worktrees/agent-{N}/services/retroboard-server
DATABASE_URL=postgres://localhost:5432/retroboard_agent_{N} JWT_SECRET=dev-secret-must-be-at-least-32-characters-long PORT={3000+N} npm run dev
```

**Starting the frontend:**
```bash
cd /Users/patrykolejniczakorlowski/Development/retroboard/.worktrees/agent-{N}/services/retroboard-server/client
VITE_PORT={5173+N} VITE_API_PORT={3000+N} npx vite
```

**Running unit/integration tests:**
```bash
cd /Users/patrykolejniczakorlowski/Development/retroboard/.worktrees/agent-{N}/services/retroboard-server
DATABASE_URL=postgres://localhost:5432/retroboard_agent_{N} JWT_SECRET=dev-secret-must-be-at-least-32-characters-long npm test
```

**Running E2E browser tests:**
```bash
cd /Users/patrykolejniczakorlowski/Development/retroboard/.worktrees/agent-{N}/services/retroboard-server
PLAYWRIGHT_BASE_URL=http://localhost:{5173+N} npx playwright test
```

**IMPORTANT RULES:**
- NEVER cd into another agent's worktree
- NEVER connect to another agent's database
- NEVER use port 3000 or 5173 (reserved for manual development)
- Always include DATABASE_URL and PORT in every command
- Commit only to your branch: agent-{N}/{task-description}
```

## 9. Concrete Example: 3 Agents

### Orchestrator setup

```bash
cd /Users/patrykolejniczakorlowski/Development/retroboard

./scripts/setup-agent-env.sh 1 fix-timer-sync
./scripts/setup-agent-env.sh 2 add-export-pdf
./scripts/setup-agent-env.sh 3 refactor-auth
```

### Agent 1 works on timer sync

```bash
# Working dir: .worktrees/agent-1/services/retroboard-server
# Branch: agent-1/fix-timer-sync
# Server: localhost:3001, Frontend: localhost:5174, DB: retroboard_agent_1

DATABASE_URL=postgres://localhost:5432/retroboard_agent_1 \
  JWT_SECRET=dev-secret-must-be-at-least-32-characters-long \
  PORT=3001 npm run dev &

cd client && VITE_PORT=5174 VITE_API_PORT=3001 npx vite &

# Run tests
DATABASE_URL=postgres://localhost:5432/retroboard_agent_1 \
  JWT_SECRET=dev-secret-must-be-at-least-32-characters-long \
  npm test

# Run E2E
PLAYWRIGHT_BASE_URL=http://localhost:5174 npx playwright test
```

### After all agents finish

```bash
# Merge results
git checkout main
git merge agent-1/fix-timer-sync
git merge agent-2/add-export-pdf
git merge agent-3/refactor-auth

# Teardown
./scripts/teardown-agent-env.sh --all
```

## 10. What Stays Safe Without Changes

| Concern | Status | Why |
|---------|--------|-----|
| Unit tests (`vitest run`) | Already safe | `tests/setup.ts` creates per-PID databases |
| Integration tests | Already safe | Same per-PID database mechanism |
| File edits | Safe with worktrees | Each agent has its own working directory |
| `node_modules` | Safe with worktrees | Each worktree has its own `node_modules` after `npm install` |
| Git history | Safe | Worktrees share `.git` but use separate branches |

## 11. What Requires the One-Time Changes

| Concern | Change needed | Section |
|---------|---------------|---------|
| E2E browser tests (Playwright) | Env var for `baseURL` | 7a, 7d |
| Frontend proxy target | Env var for proxy port | 7b |
| CORS in dev mode | Allow any localhost origin | 7c |

These are backward-compatible -- defaults match current hardcoded values, so nothing breaks for developers who do not use the parallel protocol.
