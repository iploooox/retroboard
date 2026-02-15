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

### Phase 1: Foundation (Complete)

| Feature | Status | Description |
|---------|--------|-------------|
| User Authentication | ✓ Complete | Registration, login with JWT + refresh tokens |
| Team Management | ✓ Complete | CRUD operations with admin/facilitator/member roles |
| Sprint Management | ✓ Complete | Create, read, update, delete sprints |
| Invitation System | ✓ Complete | Generate unique join codes, invite users to teams |

**Routes:**
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `GET/POST /teams`, `GET/PATCH/DELETE /teams/:id`
- `POST /teams/:id/invite`, `POST /teams/join/:code`
- `GET/POST /teams/:teamId/sprints`, `GET/PATCH/DELETE /teams/:teamId/sprints/:id`

**Database:**
- Tables: users, teams, team_members, sprints, refresh_tokens
- Migrations: 001-005

### Phase 2: Core Board (Complete)

| Feature | Status | Description |
|---------|--------|-------------|
| Retro Boards | ✓ Complete | Customizable boards with multiple columns |
| Cards | ✓ Complete | Create, edit, delete cards (anonymous + named modes) |
| Voting | ✓ Complete | Configurable vote limits per user |
| Grouping | ✓ Complete | Cluster related cards into groups |
| Templates | ✓ Complete | 6 system templates (WWW, Start/Stop/Continue, 4Ls, Mad/Sad/Glad, Sailboat, Starfish) |

**Routes:**
- `GET /templates`, `GET /templates/:id`
- `POST /boards`, `GET/PATCH/DELETE /boards/:id`
- `POST /boards/:boardId/columns`
- `POST /boards/:boardId/columns/:columnId/cards`
- `PATCH/DELETE /cards/:cardId`
- `POST/DELETE /cards/:cardId/vote`
- `POST /boards/:boardId/groups`, `POST/DELETE /groups/:groupId/cards/:cardId`

**Database:**
- Tables: templates, template_columns, boards, columns, cards, votes, card_groups, card_group_members
- Migrations: 006-014

### Phase 3: Collaboration (Complete)

| Feature | Status | Description |
|---------|--------|-------------|
| Real-time Sync | ✓ Complete | WebSocket + LISTEN/NOTIFY for instant updates |
| Live Presence | ✓ Complete | Track active users, show live cursors |
| Facilitation Phases | ✓ Complete | write → group → vote → discuss → action |
| Timer | ✓ Complete | Countdown timer with pause/reset |
| Facilitator Controls | ✓ Complete | Lock board, reveal cards, phase transitions |

**Routes:**
- `PATCH /boards/:id/phase`
- `POST /boards/:boardId/timer/start|pause|reset`, `GET /boards/:boardId/timer`

**WebSocket Events:**
- `board:join`, `board:leave`, `card:create`, `card:update`, `card:delete`
- `vote:add`, `vote:remove`, `phase:change`, `timer:update`
- `cursor:move`, `presence:update`

**Database:**
- Tables: board_phases (enum), timer_state
- Migrations: 015-016

### Phase 4: Intelligence (Complete)

| Feature | Status | Description |
|---------|--------|-------------|
| Sprint Analytics | ✓ Complete | Dashboard with participation, sentiment, trends |
| Team Health | ✓ Complete | Materialized views for performance |
| Participation Metrics | ✓ Complete | Per-user contribution tracking |
| Sentiment Analysis | ✓ Complete | PostgreSQL word-score lexicon for card sentiment |
| Action Items | ✓ Complete | Assignee, due date, status tracking, carry-over |

**Routes:**
- `GET /boards/:id/analytics`
- `GET /teams/:teamId/analytics/health`
- `GET /teams/:teamId/analytics/participation`
- `GET /teams/:teamId/analytics/sentiment`
- `POST /boards/:boardId/action-items`, `GET /boards/:boardId/action-items`
- `PATCH/DELETE /action-items/:id`

**Database:**
- Tables: action_items, sentiment_lexicon, materialized views (team_health_trends)
- Migrations: 017-019

### Phase 5: Polish (Complete)

| Feature | Status | Description |
|---------|--------|-------------|
| Export | ✓ Complete | JSON, Markdown, HTML formatters |
| Emoji Reactions | ✓ Complete | 8 emojis with toggle pattern on cards |
| Board Themes | ✓ Complete | 8 themes per team (stored as preferences) |
| Icebreaker Generator | ✓ Complete | 55 system questions, 5 categories, custom icebreakers |
| Onboarding Flow | ✓ Complete | 5-step wizard with progress tracking |

**Routes:**
- `GET /boards/:id/export?format=json|markdown|html`
- `GET /teams/:teamId/report`
- `POST /cards/:cardId/reactions`
- `GET /icebreakers/random`, `POST /teams/:teamId/icebreakers/custom`
- `GET/POST /boards/:id/icebreaker`
- `GET/PATCH /users/me/onboarding`
- `POST /users/me/onboarding/complete|reset`

**Database:**
- Tables: card_reactions, icebreakers, icebreaker_categories, board_icebreakers, user_onboarding
- Migrations: 020-023

## Testing

RetroBoard Pro has comprehensive test coverage across all features:

```bash
# Run all tests (1100+ tests)
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**Test Structure:**
- `tests/unit/` - Unit tests for services, repositories, utils
- `tests/integration/` - Integration tests for API routes
- `tests/e2e/` - End-to-end tests for complete workflows
- `tests/helpers/` - Test utilities and factories
- `tests/setup.ts` - Per-process test database creation

**Coverage:**
- All 5 phases have comprehensive test suites
- Real-time WebSocket features tested with mock clients
- Database migrations tested with rollback scenarios
- Authentication and authorization tested for all routes

## API Design

All routes follow REST conventions with consistent patterns:

- **Authentication**: Bearer token in `Authorization` header
- **Versioning**: `/api/v1/` prefix for all endpoints
- **Error Format**: `{ error: string, details?: object }`
- **Success Format**: `{ data: object | array }`
- **Pagination**: `limit`, `offset`, `cursor` query params
- **Filtering**: Query params for search/filter operations

### Rate Limiting

PostgreSQL-backed rate limiting middleware:
- 100 requests per minute per user (authenticated)
- 20 requests per minute per IP (unauthenticated)
- Sliding window algorithm
- Automatic cleanup of expired entries

## Database Schema

### Core Tables
- `users` - User accounts (id, email, password_hash, created_at)
- `teams` - Team workspaces (id, name, slug, created_by, created_at)
- `team_members` - Team membership (team_id, user_id, role)
- `sprints` - Sprint periods (id, team_id, name, start_date, end_date)
- `boards` - Retro boards (id, sprint_id, template_id, phase, is_locked)
- `columns` - Board columns (id, board_id, title, order)
- `cards` - Retro cards (id, column_id, content, author_id, is_anonymous)
- `votes` - Card votes (user_id, card_id)
- `action_items` - Action items (id, board_id, content, assignee_id, due_date, status)

### Supporting Tables
- `templates` - System templates
- `template_columns` - Template column definitions
- `card_groups` - Card clustering
- `card_group_members` - Group membership
- `card_reactions` - Emoji reactions
- `icebreakers` - Icebreaker questions
- `user_onboarding` - Onboarding progress
- `refresh_tokens` - JWT refresh tokens
- `sentiment_lexicon` - Word-score sentiment mapping

### Materialized Views
- `team_health_trends` - Pre-aggregated team health metrics

### Indexes
- Composite indexes on (team_id, sprint_id), (board_id, column_id), etc.
- Full-text search indexes on card content
- Unique constraints on slugs, email, invitation codes

## WebSocket Protocol

### Connection
```typescript
ws://localhost:3000/ws?token=<jwt_token>&boardId=<board_id>
```

### Message Format
```typescript
{
  type: string,        // Event type
  payload: object,     // Event data
  timestamp: number    // Unix timestamp
}
```

### Client → Server Events
- `cursor:move` - Update cursor position
- `card:typing` - User is typing in card

### Server → Client Events
- `board:state` - Initial board state (on join)
- `card:created`, `card:updated`, `card:deleted` - Card changes
- `vote:added`, `vote:removed` - Voting changes
- `phase:changed` - Facilitation phase transition
- `timer:updated` - Timer state change
- `presence:joined`, `presence:left` - User presence
- `cursor:moved` - Cursor position update

## Migration Strategy

Migrations are numbered sequentially (001-023) and run in order:

```bash
# Run all pending migrations
npm run db:migrate

# Rollback last migration (if needed)
npm run db:rollback
```

Each migration file:
- Includes `up` (apply) and `down` (rollback) SQL
- Is idempotent where possible
- Includes comments for context
- Tests are run against migrated schema

## Deployment

RetroBoard Pro is a single-process application serving both API and WebSocket:

1. Build the application: `npm run build`
2. Set environment variables
3. Run migrations: `npm run db:migrate`
4. Start server: `npm start`

**Requirements:**
- Node.js 20+ runtime
- PostgreSQL 15+ database
- At least 512MB RAM
- Persistent storage for database

**Scaling:**
- Horizontal scaling: Use load balancer with sticky sessions for WebSocket
- Database scaling: PostgreSQL read replicas for analytics queries
- WebSocket scaling: LISTEN/NOTIFY ensures cross-process sync

## Security

- **Authentication**: JWT with short-lived access tokens (15 min) + refresh tokens
- **Password Hashing**: bcrypt with configurable rounds
- **Rate Limiting**: Per-user and per-IP limits stored in PostgreSQL
- **SQL Injection**: Parameterized queries via `postgres` driver
- **XSS Prevention**: Input sanitization and validation via Zod
- **RBAC**: Role-based access control enforced at middleware layer
- **CORS**: Configurable allowed origins
- **Secrets**: Environment variables only, never committed to version control

## Performance

- **Database Connection Pooling**: Lazy connection with configurable pool size
- **Materialized Views**: Pre-aggregated analytics for fast queries
- **Indexes**: Composite indexes on high-traffic queries
- **WebSocket Heartbeat**: 30-second ping/pong to detect dead connections
- **Rate Limiting**: Prevents abuse and ensures fair resource allocation
- **Query Optimization**: Pagination for large result sets, selective field loading

## Monitoring

Key metrics to track:
- WebSocket connection count
- Database connection pool utilization
- API request latency (p50, p95, p99)
- Error rate by endpoint
- Active board count
- Database query performance

Logs include:
- Request/response logs (with correlation IDs)
- WebSocket connection lifecycle
- Database query errors
- Authentication failures
- Rate limit violations
