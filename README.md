<div align="center">

# RetroBoard Pro

**Run better retrospectives. Ship better software.**

The open-source retrospective platform for agile teams that actually want to improve — not just go through the motions.

[Quick Start](#quick-start) &bull; [Features](#features) &bull; [Documentation](#documentation) &bull; [Self-Hosting](#self-hosting) &bull; [Contributing](#contributing)

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

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | Prerequisites, installation, first run |
| [Configuration](docs/configuration.md) | All environment variables, database setup, schema isolation |
| [Self-Hosting](docs/self-hosting.md) | Production builds, Docker, reverse proxy, backups |
| [Architecture](docs/architecture.md) | System design, layers, real-time flow, database schema |
| [API Reference](docs/api-reference.md) | Every endpoint, request/response examples, WebSocket events |
| [Facilitation Guide](docs/facilitation.md) | How to run each phase, facilitator tools, anti-patterns |
| [Testing](docs/testing.md) | Unit, integration, E2E tests, CI pipeline |

## Self-Hosting

```bash
npm run build && npm run build --prefix client

DATABASE_URL="postgres://user:pass@db:5432/retroboard" \
JWT_SECRET="your-production-secret" \
NODE_ENV=production \
npm start
```

One process serves API + WebSocket + frontend on a single port. See the full [Self-Hosting Guide](docs/self-hosting.md) for Docker, Docker Compose, reverse proxy, backups, and multi-tenant setup.

## Architecture

```
Client (React 19 + Zustand + Tailwind CSS 4)
  │
  ├── REST ──► Hono Routes ──► Services ──► Repositories ──► PostgreSQL
  │
  └── WS ────► WebSocket Server ◄──── LISTEN/NOTIFY ────── PostgreSQL
```

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+, TypeScript 5.7 |
| HTTP | Hono |
| Real-time | WebSocket (ws) + PostgreSQL LISTEN/NOTIFY |
| Frontend | React 19, Zustand 5, Tailwind CSS 4, Vite 6 |
| Database | PostgreSQL 15+ — the only external dependency |
| Auth | JWT with refresh token rotation and theft detection |
| Tests | Vitest (1100+ tests) + Playwright (115 E2E tests) |

See [Architecture Overview](docs/architecture.md) for the full system design, layers, real-time flow, and database schema.

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Run the test suite (`npm test`)
4. Ensure zero TypeScript errors (`npx tsc --noEmit`) and zero lint errors (`npm run lint`)
5. Open a Pull Request

## License

MIT
