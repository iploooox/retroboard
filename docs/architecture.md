# Architecture Overview

RetroBoard Pro is a monolithic TypeScript application. One server process handles HTTP, WebSocket, and static file serving. PostgreSQL is the only external dependency.

## System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│                                                              │
│  React 19 + Zustand + Tailwind CSS 4                         │
│  ├── REST calls (fetch) ──────────────────┐                  │
│  └── WebSocket connection ────────────┐   │                  │
└───────────────────────────────────────┼───┼──────────────────┘
                                        │   │
┌───────────────────────────────────────┼───┼──────────────────┐
│  Node.js Server (single process)      │   │                  │
│                                       │   │                  │
│  ┌────────────────────────────┐   ┌───┴───┴──────────────┐   │
│  │  WebSocket Server (ws)     │   │  HTTP Server (Hono)   │   │
│  │                            │   │                       │   │
│  │  • Room management         │   │  • REST API routes    │   │
│  │  • Presence tracking       │   │  • Static file serve  │   │
│  │  • Cursor broadcasting     │   │  • Middleware chain    │   │
│  │  • Event replay            │   │                       │   │
│  └──────────┬─────────────────┘   └───────────┬───────────┘   │
│             │                                 │               │
│  ┌──────────┴─────────────────────────────────┴───────────┐   │
│  │                    Services Layer                       │   │
│  │  FacilitationService · AnalyticsService · TimerService  │   │
│  │  IcebreakerService · SentimentService · ReactionService │   │
│  └────────────────────────┬───────────────────────────────┘   │
│                           │                                   │
│  ┌────────────────────────┴───────────────────────────────┐   │
│  │                  Repositories Layer                     │   │
│  │  Raw SQL via porsager/postgres tagged template literals │   │
│  └────────────────────────┬───────────────────────────────┘   │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────────────┐
│  PostgreSQL 15+                                               │
│                                                               │
│  • Tables, indexes, constraints                               │
│  • LISTEN/NOTIFY for real-time event broadcast                │
│  • Triggers on cards, votes, groups, boards → board_events    │
│  • Materialized views for analytics (health, participation)   │
│  • In-database rate limiting                                  │
└───────────────────────────────────────────────────────────────┘
```

## Layers

### Routes (`src/routes/`)

Hono route handlers. Each file covers one domain: `auth.ts`, `teams.ts`, `boards.ts`, `icebreakers.ts`, etc. Routes handle request parsing, call services, and format responses. No business logic here.

### Middleware (`src/middleware/`)

| Middleware | Purpose |
|-----------|---------|
| `auth.ts` | JWT verification, extracts user from `Authorization: Bearer` header |
| `team-auth.ts` | Team membership and role checks (admin/facilitator/member) |
| `rate-limit.ts` | PostgreSQL-backed rate limiting by IP, email, or user |
| `phase-permission-guard.ts` | Enforces what actions are allowed in each board phase |

### Services (`src/services/`)

Business logic and orchestration. Services validate inputs, enforce rules, and coordinate repository calls. Key services:

| Service | Responsibility |
|---------|---------------|
| `FacilitationService` | Phase transitions, vote limits, card reveal, board locking |
| `TimerService` | Countdown lifecycle — start, pause, resume, stop, tick broadcast |
| `AnalyticsService` | Health trends, participation metrics, sentiment scoring |
| `SentimentService` | Word-score lexicon-based sentiment analysis on card text |
| `IcebreakerService` | Random question selection, category filtering, team history |
| `ReactionService` | Emoji reactions with toggle pattern (add/remove) |

### Repositories (`src/repositories/`)

Data access layer. Each repository wraps SQL queries for a specific domain (users, teams, boards, cards, votes, etc.). Uses parameterized queries via `postgres` tagged template literals — no ORM, no query builder.

```typescript
// Example: card.repository.ts
const cards = await sql`
  SELECT c.*, u.display_name as author_name
  FROM cards c
  LEFT JOIN users u ON u.id = c.author_id
  WHERE c.board_id = ${boardId}
  ORDER BY c.position
`;
```

### WebSocket Server (`src/ws/`)

Real-time collaboration engine built on the `ws` library:

| Component | Purpose |
|-----------|---------|
| `index.ts` | Connection upgrade, JWT auth, board room join/leave |
| `message-router.ts` | Routes incoming client messages (cursor_move, ping, etc.) |
| `notify-listener.ts` | PostgreSQL LISTEN/NOTIFY — receives DB trigger events |
| `room-manager.ts` | Per-board client registry |
| `presence-tracker.ts` | Track active users and cursor positions per board |
| `heartbeat-manager.ts` | Ping/pong every 30s, drop stale connections after 45s |
| `cursor-throttle.ts` | Rate limit cursor broadcasts (20/sec per user) |

### Database (`src/db/`)

| File | Purpose |
|------|---------|
| `connection.ts` | Lazy-initialized PostgreSQL connection pool (singleton) |
| `migrate.ts` | Forward-only migration runner with `schema_migrations` tracking |
| `seed.ts` | Seeds built-in templates and icebreaker questions |
| `migrations/*.sql` | 34 numbered SQL files |

## Real-Time Architecture

RetroBoard Pro uses a hybrid approach for real-time updates:

```
User Action (e.g. create card)
  │
  ├── 1. HTTP POST /api/v1/boards/:id/cards
  │       └── INSERT INTO cards → triggers trg_cards_realtime()
  │
  ├── 2. PostgreSQL trigger fires
  │       ├── INSERT INTO board_events (audit log)
  │       └── pg_notify('board:{boardId}', payload)
  │
  ├── 3. NotifyListener receives NOTIFY
  │       └── Enriches event (fetch full card data)
  │
  └── 4. WebSocket broadcast to all board subscribers
          └── { type: 'card_created', payload: { card: {...} } }
```

This means:
- **Writes** go through the REST API (validated, authorized, transactional)
- **Reads** come via WebSocket push (instant, no polling)
- **Cross-process sync** works automatically via PostgreSQL NOTIFY (if running multiple instances behind a load balancer, they all receive the same events)

### Event Replay

When a client reconnects after a disconnection, it sends `lastEventId`. The server queries `board_events` for all events after that ID and replays them — no lost updates.

## Database Schema

Core tables and their relationships:

```
users ─────────┬──► team_members ◄──── teams
               │                        │
               │                    sprints
               │                        │
               │                     boards ──► columns
               │                        │          │
               │                        │        cards ──► card_votes
               │                        │          │
               │                        │     card_groups ◄── card_group_members
               │                        │          │
               │                        │     card_reactions
               │                        │
               │                   board_events (audit log)
               │                   board_timers
               │                   action_items
               │
          refresh_tokens
          rate_limits
```

### Key Design Decisions

**No ORM.** Raw SQL via `postgres` tagged template literals. Queries are explicit, optimized, and easy to debug. The driver handles parameterization and SQL injection prevention.

**PostgreSQL for everything.** Rate limiting, session management, event broadcasting (LISTEN/NOTIFY), sentiment analysis, analytics (materialized views). No Redis, no message queue, no external cache.

**Immutable event log.** `board_events` table stores every action as an immutable event. Used for WebSocket replay, analytics, and audit trail. Events are never updated or deleted.

**Forward-only migrations.** No rollback/down migrations. Each migration is idempotent where possible (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). Failed migrations roll back their transaction automatically.

## Authentication Flow

```
Register/Login
  │
  ├── Server returns: { accessToken (15min), refreshToken (7d) }
  │
  ├── Client stores refresh token, uses access token for API calls
  │
  ├── Access token expires → Client calls POST /auth/refresh
  │     └── Server: revokes old refresh token, issues new pair
  │
  └── Theft detection: if revoked token is reused
        └── Server: revokes ALL user sessions (nuclear option)
```

## Frontend Architecture

React 19 single-page application:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Routing | React Router | Page navigation |
| State | Zustand | Global state (board, auth, teams) |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| API | fetch wrapper | REST calls with auth header injection |
| WebSocket | Custom hook (`useBoardSync`) | Real-time board state sync |
| Build | Vite 6 | Dev server with HMR, production bundling |

Key frontend patterns:
- **Optimistic updates** — UI updates immediately, reconciles with server response
- **WebSocket store sync** — incoming WS events update Zustand store directly
- **Phase-gated UI** — components render differently based on current board phase
