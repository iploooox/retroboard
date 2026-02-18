# Getting Started

This guide walks you through setting up RetroBoard Pro from scratch — from prerequisites to running your first retrospective.

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | 20 or higher | `node --version` |
| npm | 10 or higher | `npm --version` |
| PostgreSQL | 15 or higher | `psql --version` |
| Git | Any recent | `git --version` |

### PostgreSQL Installation

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Docker:**
```bash
docker run -d --name retroboard-db \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15
```

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/iploooox/retroboard.git
cd retroboard
```

### 2. Install dependencies

```bash
cd services/retroboard-server

# Backend dependencies
npm install

# Frontend dependencies
npm install --prefix client
```

### 3. Create the database

```bash
createdb retroboard
```

### 4. Configure environment

Create a `.env` file in `services/retroboard-server/` or export the variables directly:

```bash
# Required
export DATABASE_URL="postgres://localhost:5432/retroboard"
export JWT_SECRET="$(openssl rand -base64 48)"

# Optional
export PORT=3000
export NODE_ENV=development
```

> **macOS note:** Homebrew PostgreSQL authenticates with your OS username — no user/password needed in the connection string. On Linux or Docker, include credentials: `postgres://user:password@localhost:5432/retroboard`

See the full [Configuration Reference](./configuration.md) for all available options.

### 5. Run database migrations

```bash
npm run db:migrate
```

This creates all tables, indexes, triggers, and materialized views (34 migrations). You'll see each one applied:

```
Applying migration: 001_create_extensions.sql
Applied: 001_create_extensions.sql
Applying migration: 002_create_users.sql
...
All migrations applied.
```

### 6. Seed initial data

```bash
npm run db:seed
```

This loads the 6 built-in retrospective templates and their column configurations. Without seeding, you can still create boards but won't have templates to start from.

## Running the Application

### Development Mode

You need two terminals — one for the backend, one for the frontend:

**Terminal 1 — Backend** (port 3000):
```bash
cd services/retroboard-server
npm run dev
```

Uses `tsx watch` for automatic restarts on file changes.

**Terminal 2 — Frontend** (port 5173):
```bash
cd services/retroboard-server/client
npm run dev
```

Uses Vite with hot module replacement — changes appear instantly without reload.

**Open http://localhost:5173** in your browser.

### Production Mode

Build and serve everything from a single process:

```bash
cd services/retroboard-server

# Build backend
npm run build

# Build frontend (output goes to dist/client/)
npm run build --prefix client

# Start production server
NODE_ENV=production npm start
```

In production, the server serves the React frontend as static files alongside the API and WebSocket — all on one port.

## Your First Retrospective

Once the app is running:

1. **Register an account** — create your user with email and password
2. **Create a team** — give it a name and description
3. **Invite your team** — generate an invite link and share it
4. **Create a sprint** — set a date range for the current iteration
5. **Start a retro** — pick a template (try "Start / Stop / Continue" for your first one)
6. **Run the ceremony** — walk through the phases: Icebreaker → Write → Group → Vote → Discuss → Action

The [Facilitation Guide](./facilitation.md) covers how to run each phase effectively.

## Running Tests

```bash
cd services/retroboard-server

# All backend tests (unit + integration)
npm test

# Frontend tests
npm test --prefix client

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

For E2E browser tests with Playwright, see [Testing](./testing.md).

## Next Steps

- [Configuration Reference](./configuration.md) — all environment variables and options
- [Self-Hosting Guide](./self-hosting.md) — production deployment and multi-tenant setup
- [Architecture Overview](./architecture.md) — how the system is built
- [API Reference](./api-reference.md) — complete endpoint documentation
- [Facilitation Guide](./facilitation.md) — how to run effective retros with RetroBoard Pro
