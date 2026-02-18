<div align="center">

# RetroBoard Pro

**Run better retrospectives. Ship better software.**

The open-source retrospective platform for agile teams that actually want to improve — not just go through the motions.

[Quick Start](#quick-start) &bull; [Features](#features) &bull; [Self-Hosting](#self-hosting) &bull; [Configuration](#configuration) &bull; [API](#api-reference) &bull; [Contributing](#contributing)

</div>

---

Most retro tools are glorified sticky-note boards. Teams paste cards, vote, forget. Nothing changes.

RetroBoard Pro is different. It gives your facilitator real control — timed phases, card locking, anonymous writing, focused discussion — and gives your team real insight with sentiment analysis, health trends, and action item tracking that carries over sprint to sprint.

One TypeScript server. One PostgreSQL database. No Redis, no microservices, no vendor lock-in. Deploy it in 5 minutes.

## Features

### Guided Ceremony Flow

Every retro follows 6 structured phases so your team stays focused:

| Phase | What happens |
|-------|-------------|
| **Icebreaker** | Random warmup question breaks the ice (55 built-in across 5 categories) |
| **Write** | Team adds cards anonymously or by name — no anchoring bias |
| **Group** | Facilitator clusters related cards into themes |
| **Vote** | Team votes on what matters most (configurable limits) |
| **Discuss** | Walk through top-voted items with focus mode |
| **Action** | Convert insights into assigned action items with due dates |

### Real-Time Collaboration

Built on WebSocket + PostgreSQL LISTEN/NOTIFY for instant sync:

- Cards appear live as teammates type — no refresh needed
- Presence indicators show who's online
- Emoji reactions on any card
- Works across multiple server instances

### Facilitation Toolkit

Tools that make the facilitator's job effortless:

- **Countdown timers** — keep phases on track
- **Board locking** — freeze input during discussions
- **Card reveal** — show anonymous cards at the right moment
- **Focus mode** — spotlight one card/group for discussion
- **Phase controls** — move forward, jump back, restart

### 6 Built-In Templates

Pick a format that fits your team:

- **What Went Well / Delta** — simple two-column classic
- **Start / Stop / Continue** — actionable behavioral feedback
- **4Ls** — Liked, Learned, Lacked, Longed For
- **Mad / Sad / Glad** — surface emotions, improve morale
- **Sailboat** — Wind, Anchor, Rocks, Island metaphor
- **Starfish** — five-column nuanced feedback

### Analytics Dashboard

Track team health across sprints, not just one meeting:

- **Health trend** — sentiment scores over time
- **Participation metrics** — who's contributing what
- **Sentiment analysis** — PostgreSQL-native word-score lexicon
- **Word frequency** — spot recurring themes
- **Action item tracking** — open, in-progress, done, carried-over

### Action Items That Actually Get Done

- Assign to team members with due dates
- Track status: Open → In Progress → Done
- **Carry-over**: unfinished items auto-transfer to the next retro
- Completion rates visible in analytics

### More

- **Team management** — roles (admin / facilitator / member), invite links, member directory
- **Sprint tracking** — define sprints, browse history, compare retros over time
- **Export** — JSON, Markdown, or HTML for sharing with stakeholders
- **Board themes** — 8 color schemes (Default, Ocean, Sunset, Forest, Midnight, Lavender, Coral, Monochrome)
- **Onboarding wizard** — guided first-time setup for new teams
- **Multi-tenant ready** — optional `DB_SCHEMA` isolates apps sharing one database

## Quick Start

### Prerequisites

- **Node.js 20+**
- **PostgreSQL 15+**

### 1. Clone & install

```bash
git clone https://github.com/iploooox/retroboard.git
cd retroboard/services/retroboard-server
npm install
npm install --prefix client
```

### 2. Set up the database

```bash
createdb retroboard

export DATABASE_URL="postgres://localhost:5432/retroboard"
export JWT_SECRET="$(openssl rand -base64 48)"

npm run db:migrate
npm run db:seed
```

### 3. Start

```bash
# Terminal 1 — backend
npm run dev

# Terminal 2 — frontend
npm run dev --prefix client
```

Open **http://localhost:5173** — you're running.

## Self-Hosting

### Production Build

```bash
npm run build
npm run build --prefix client

# Single server serves API + WebSocket + frontend
DATABASE_URL="postgres://user:pass@db:5432/retroboard" \
JWT_SECRET="your-production-secret" \
NODE_ENV=production \
npm start
```

The production server serves everything on a single port (default 3000) — API routes at `/api/v1/*`, WebSocket at `/ws`, and the React frontend as static files.

### Multi-App Database (Schema Isolation)

If you share one PostgreSQL instance across multiple applications, use schemas instead of separate databases:

```bash
DB_SCHEMA=retroboard DATABASE_URL="postgres://localhost:5432/shared_db" npm run db:migrate
DB_SCHEMA=retroboard DATABASE_URL="postgres://localhost:5432/shared_db" npm start
```

This creates all tables inside the `retroboard` schema. Each app gets its own namespace. When `DB_SCHEMA` is not set, tables go in `public` as usual.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Signing key for auth tokens (min 32 chars) |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `DB_SCHEMA` | No | `public` | PostgreSQL schema for table isolation |
| `DISABLE_RATE_LIMIT` | No | `false` | Disable rate limiting (testing only) |

### macOS (Homebrew PostgreSQL)

Homebrew PostgreSQL authenticates with your OS username, not `postgres`:

```bash
export DATABASE_URL="postgres://localhost:5432/retroboard"
```

## Architecture

Single TypeScript monolith — one process serves HTTP, WebSocket, and static frontend:

```
Client (React + Zustand + Tailwind CSS 4)
  │
  ├── REST ──► Hono Routes ──► Services ──► Repositories ──► PostgreSQL
  │
  └── WS ────► WebSocket Server ◄──── LISTEN/NOTIFY ────── PostgreSQL
```

| Layer | Purpose |
|-------|---------|
| **Routes** (`src/routes/`) | HTTP endpoints, request parsing |
| **Middleware** (`src/middleware/`) | JWT auth, RBAC, rate limiting, validation |
| **Services** (`src/services/`) | Business logic, orchestration |
| **Repositories** (`src/repositories/`) | Raw SQL via `postgres` driver |
| **WebSocket** (`src/ws/`) | Real-time sync, presence, cursors |
| **Database** | PostgreSQL — the only external dependency |

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+, TypeScript 5.7 |
| HTTP | Hono |
| WebSocket | ws |
| Frontend | React 19, Zustand 5, Tailwind CSS 4 |
| Database | PostgreSQL 15+ (porsager/postgres driver) |
| Auth | JWT (jose) + bcryptjs |
| Build | tsup (server), Vite 6 (client) |
| Tests | Vitest + Playwright |

## API Reference

All endpoints at `/api/v1`. Auth via `Authorization: Bearer <token>`.

<details>
<summary><strong>Authentication</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Sign in, receive JWT pair |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke refresh token |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/me` | Update profile |

</details>

<details>
<summary><strong>Teams</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/teams` | Create team |
| GET | `/teams` | List your teams |
| GET | `/teams/:id` | Team details |
| PUT | `/teams/:id` | Update team |
| POST | `/teams/:id/invitations` | Generate invite code |
| POST | `/teams/:id/join` | Join via invite code |
| PATCH | `/teams/:id/members/:userId` | Change member role |
| DELETE | `/teams/:id/members/:userId` | Remove member |

</details>

<details>
<summary><strong>Sprints & Boards</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/teams/:teamId/sprints` | Create sprint |
| GET | `/teams/:teamId/sprints` | List sprints |
| POST | `/sprints/:sprintId/board` | Create board from template |
| GET | `/boards/:id` | Full board state (columns, cards, groups, votes) |
| PATCH | `/boards/:id/phase` | Transition phase |
| PATCH | `/boards/:id/focus` | Set focus item |

</details>

<details>
<summary><strong>Cards & Voting</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/boards/:id/cards` | Add card |
| PATCH | `/boards/:id/cards/:cardId` | Edit card |
| DELETE | `/boards/:id/cards/:cardId` | Delete card |
| POST | `/boards/:id/cards/:cardId/vote` | Cast vote |
| DELETE | `/boards/:id/cards/:cardId/vote` | Remove vote |
| POST | `/cards/:cardId/reactions` | Add emoji reaction |

</details>

<details>
<summary><strong>Facilitation</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/boards/:id/timer/start` | Start countdown |
| POST | `/boards/:id/timer/pause` | Pause timer |
| POST | `/boards/:id/timer/resume` | Resume timer |
| POST | `/boards/:id/timer/stop` | Stop timer |
| POST | `/boards/:id/groups` | Create card group |
| DELETE | `/boards/:id/groups/:groupId` | Delete group |

</details>

<details>
<summary><strong>Action Items</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/boards/:id/action-items` | Create action item |
| GET | `/boards/:id/action-items` | List action items |
| PATCH | `/action-items/:id` | Update (status, assignee, due date) |
| DELETE | `/action-items/:id` | Delete |
| POST | `/boards/:id/action-items/carry-over` | Carry unresolved items to next sprint |

</details>

<details>
<summary><strong>Analytics & Export</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/teams/:teamId/analytics/health` | Health trend over time |
| GET | `/teams/:teamId/analytics/participation` | Participation metrics |
| GET | `/boards/:id/export?format=json\|markdown\|html` | Export board |

</details>

<details>
<summary><strong>WebSocket Events</strong></summary>

Connect to `/ws?token=JWT&boardId=UUID`. Events received:

| Event | Trigger |
|-------|---------|
| `card_created` / `card_updated` / `card_deleted` | Card changes |
| `vote_added` / `vote_removed` | Vote changes |
| `phase_changed` | Phase transition |
| `board_locked` / `board_unlocked` | Lock state |
| `cards_revealed` | Anonymous card reveal |
| `timer_started` / `timer_paused` / `timer_stopped` | Timer changes |
| `user_joined` / `user_left` | Presence |
| `focus_changed` | Discussion focus |

</details>

## Testing

```bash
cd services/retroboard-server

# Unit + integration (1100+ tests)
npm test

# Watch mode
npm run test:watch

# E2E (requires servers running)
DISABLE_RATE_LIMIT=true \
PLAYWRIGHT_BASE_URL=http://localhost:5173 \
npx playwright test tests/e2e-browser/

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Project Structure

```
services/retroboard-server/
├── src/
│   ├── server.ts              # Hono app entry point
│   ├── config/env.ts          # Environment validation (Zod)
│   ├── db/
│   │   ├── connection.ts      # PostgreSQL connection pool
│   │   ├── migrate.ts         # Migration runner
│   │   ├── seed.ts            # Seed templates & icebreakers
│   │   └── migrations/        # 34 SQL migration files
│   ├── routes/                # API endpoints
│   ├── services/              # Business logic
│   ├── repositories/          # Data access (raw SQL)
│   ├── middleware/             # Auth, RBAC, rate limiting
│   ├── validation/            # Zod schemas
│   ├── ws/                    # WebSocket server
│   └── formatters/            # Export formatters
├── client/
│   └── src/
│       ├── pages/             # React pages
│       ├── components/        # UI components
│       ├── stores/            # Zustand state
│       ├── hooks/             # Custom hooks
│       └── lib/               # API client, WS client
└── tests/
    ├── unit/                  # Unit tests
    ├── integration/           # API integration tests
    ├── e2e/                   # Server-side E2E
    └── e2e-browser/           # Playwright browser tests
```

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Run the test suite (`npm test`)
4. Ensure zero TypeScript errors (`npx tsc --noEmit`) and zero lint errors (`npm run lint`)
5. Open a Pull Request

## License

MIT
