---
id: ADR-003
title: "Tech stack selection"
status: accepted
date: 2026-02-14
---

# ADR-003: Tech Stack Selection

## Context

Need to choose specific libraries for the TypeScript server and React frontend within our PostgreSQL-only, single-server constraint.

## Decision

| Layer | Choice | Why |
|-------|--------|-----|
| HTTP Framework | **Hono** | Tiny, fast, TypeScript-first, middleware-based, works on Node.js |
| PostgreSQL Driver | **postgres** (porsager) | Zero-dependency, tagged template literals, connection pooling, LISTEN/NOTIFY built-in |
| Auth | **jose** + **bcryptjs** | jose is standards-compliant JWT, bcryptjs is pure JS (no native deps) |
| WebSocket | **ws** | Minimal, fast, integrates with Node HTTP server |
| Frontend | **React 19** + **Vite** | React for components, Vite for dev + build |
| State Management | **Zustand** | Tiny, simple, TypeScript-friendly |
| Styling | **Tailwind CSS 4** | Utility-first, fast to build UIs, consistent design |
| Testing | **Vitest** + **Supertest** | Vitest for unit/integration, Supertest for HTTP tests |
| Build (server) | **tsup** | Fast TypeScript bundler for Node.js |
| Build (client) | **Vite** | Already used for dev, builds to dist/client/ |

## Alternatives Considered

| Category | Alternative | Why Not |
|----------|------------|---------|
| Framework | Express | Older, less TypeScript-native, heavier |
| Framework | Fastify | Good but heavier than Hono for our needs |
| DB Driver | pg | Callback-based API, less ergonomic than postgres |
| DB Driver | Drizzle/Prisma | ORM adds complexity, we want direct SQL control |
| Frontend | Next.js | SSR unnecessary, adds server complexity |
| State | Redux | Overkill for our state needs |

## Consequences

- Hono serves both API and static files — no Express needed
- Tagged template SQL prevents injection by design: `sql\`SELECT * FROM users WHERE id = ${id}\``
- No ORM means writing SQL directly — more control, more SQL to maintain
- Vite dev server proxies to Hono in development for hot reload
