---
id: ADR-002
title: "Single server monolith architecture"
status: accepted
date: 2026-02-14
---

# ADR-002: Single Server Monolith Architecture

## Context

The application needs HTTP API, WebSocket server, and static file serving. We could split these into separate services or combine them.

## Decision

Single TypeScript process serves everything:
- Hono HTTP server on one port
- WebSocket upgrade on the same port
- Static file serving for the React SPA from the same port
- All feature modules co-located in one codebase

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Single process monolith** (chosen) | Simple deployment, shared memory for WS state, one `npm start`, no CORS | Single point of failure, vertical scaling only |
| Separate API + WS servers | Independent scaling, isolation | Shared state needs Redis, CORS config, two processes |
| Serverless functions | Auto-scaling, pay-per-use | No WebSocket support, cold starts, complex |

## Consequences

- WebSocket connections live in server memory — if server restarts, clients must reconnect
- LISTEN/NOTIFY compensates: on reconnect, client gets current state from DB, no stale data
- Vertical scaling limits around ~10K concurrent WebSocket connections per process (adequate for our use case)
- Frontend build output goes to `dist/client/` and is served as static files
