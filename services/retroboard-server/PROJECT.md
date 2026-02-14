# RetroBoard Server

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.x (Node.js 20+) |
| Framework | Hono (lightweight, fast, TypeScript-first) |
| Database | PostgreSQL 15+ via `postgres` (porsager/postgres) |
| Real-time | WebSocket via `ws` + PostgreSQL LISTEN/NOTIFY |
| Auth | JWT via `jose` + bcrypt via `bcryptjs` |
| Frontend | React 19 + Vite (bundled, served as static) |
| Testing | Vitest + Supertest + @testing-library/react |
| Build | tsup (server) + Vite (client) |

## Key Paths

| Purpose | Path |
|---------|------|
| Server entry | `src/server.ts` |
| API routes | `src/routes/` |
| Services | `src/services/` |
| Database | `src/db/` |
| Migrations | `src/db/migrations/` |
| WebSocket | `src/ws/` |
| Middleware | `src/middleware/` |
| Types | `src/types/` |
| Frontend | `client/` |
| Static build | `dist/client/` |
| Tests | `tests/` |

## Architecture

```
┌─────────────────────────────────────────────┐
│              Browser (React SPA)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Board   │  │ Dashboard│  │  Teams   │  │
│  │   View   │  │   View   │  │   View   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │ HTTP/WS     │ HTTP        │ HTTP    │
└───────┼─────────────┼─────────────┼─────────┘
        │             │             │
┌───────┴─────────────┴─────────────┴─────────┐
│            Hono Server (single process)      │
│  ┌──────────────────────────────────────┐    │
│  │  Static File Serving (dist/client/)  │    │
│  ├──────────────────────────────────────┤    │
│  │  API Routes (/api/v1/*)              │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐   │    │
│  │  │  Auth  │ │ Teams  │ │ Boards │   │    │
│  │  └───┬────┘ └───┬────┘ └───┬────┘   │    │
│  ├──────┴──────────┴──────────┴─────────┤    │
│  │  Middleware (auth, rbac, validation)  │    │
│  ├──────────────────────────────────────┤    │
│  │  Services (business logic)           │    │
│  ├──────────────────────────────────────┤    │
│  │  Repositories (SQL queries)          │    │
│  ├──────────────────────────────────────┤    │
│  │  WebSocket Server                    │    │
│  │  ┌─────────────┐ ┌───────────────┐   │    │
│  │  │  Presence   │ │  Board Sync   │   │    │
│  │  └─────────────┘ └───────────────┘   │    │
│  └──────────────────────────────────────┘    │
│                    │                         │
│  ┌─────────────────┴────────────────────┐    │
│  │       postgres (porsager/postgres)   │    │
│  │       + LISTEN/NOTIFY channels       │    │
│  └─────────────────┬────────────────────┘    │
└────────────────────┼─────────────────────────┘
                     │
              ┌──────┴──────┐
              │ PostgreSQL  │
              │   15+       │
              │  ┌────────┐ │
              │  │ Tables  │ │
              │  │ Indexes │ │
              │  │ FTS     │ │
              │  │ NOTIFY  │ │
              │  └────────┘ │
              └─────────────┘
```

| Layer | Responsibility |
|-------|---------------|
| Static Serving | Serve React SPA from dist/client/ |
| Routes | URL mapping, request parsing, response formatting |
| Middleware | Auth verification, RBAC, input validation, error handling |
| Services | Business logic, orchestration, validation rules |
| Repositories | SQL queries, data access, query builders |
| WebSocket | Real-time connection management, message routing |
| PostgreSQL | Persistence, LISTEN/NOTIFY for pub/sub, full-text search |

## Local Development

```bash
# Install dependencies
npm install

# Start PostgreSQL (must be running)
# Create database
createdb retroboard

# Run migrations
npm run db:migrate

# Start dev server (API + client hot reload)
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production
npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| JWT_SECRET | Yes | Secret for JWT signing |
| PORT | No | Server port (default: 3000) |
| NODE_ENV | No | Environment (development/production) |

## Features

| Feature | Status | Docs |
|---------|--------|------|
| auth | planned | — |
| teams | planned | — |
| sprints | planned | — |
| retro-board | planned | — |
| templates | planned | — |
| facilitation | planned | — |
| action-items | planned | — |
| analytics | planned | — |
| real-time | planned | — |
| export | planned | — |
