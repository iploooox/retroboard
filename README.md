# RetroBoard Pro

A full-featured retrospective board application for agile teams, built with TypeScript, PostgreSQL, and real-time collaboration.

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript 5.x
- **Framework**: Hono (HTTP server) + ws (WebSocket)
- **Database**: PostgreSQL 15+ with raw SQL via `postgres` driver
- **Authentication**: JWT (jose) + bcryptjs for password hashing
- **Testing**: Vitest + Supertest (1100+ tests)
- **Build**: tsup

## Features

### Phase 1: Foundation
- User registration and authentication (JWT with refresh tokens)
- Team management with role-based access control (admin/facilitator/member)
- Sprint CRUD operations
- Team invitation system with unique join codes

### Phase 2: Core Board
- Retrospective boards with customizable columns
- Card creation (anonymous and named modes)
- Voting system with configurable vote limits per user
- Card grouping and clustering
- 6 built-in templates:
  - What Went Well / Delta (WWW)
  - Start / Stop / Continue
  - 4 Ls (Liked, Learned, Lacked, Longed For)
  - Mad / Sad / Glad
  - Sailboat
  - Starfish

### Phase 3: Collaboration
- Real-time synchronization via WebSocket and PostgreSQL LISTEN/NOTIFY
- Live cursors and presence indicators
- Facilitation phases (write → group → vote → discuss → action)
- Countdown timer with pause/reset controls
- Facilitator controls:
  - Lock/unlock board
  - Reveal cards (for anonymous mode)
  - Phase transitions

### Phase 4: Intelligence
- Sprint analytics dashboard
- Team health trends with materialized views
- Participation metrics per team member
- PostgreSQL-native sentiment analysis using word-score lexicon
- Action items with assignee, due date, and carry-over to next sprint

### Phase 5: Polish
- Export functionality (JSON, Markdown, HTML)
- Emoji reactions on cards (8 emojis with toggle pattern)
- Board themes (8 themes per team)
- Icebreaker generator (55 system questions across 5 categories)
- Onboarding flow (5-step wizard)

## Quick Start

### Prerequisites

- Node.js 20 or higher
- PostgreSQL 15 or higher
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd retroboard/services/retroboard-server
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/retroboard"
export JWT_SECRET="your-secret-key-at-least-32-characters-long"
export PORT=3000  # Optional, defaults to 3000
export NODE_ENV=development  # Optional
```

4. Create the database:
```bash
createdb retroboard
```

5. Run migrations:
```bash
npm run db:migrate
```

6. Seed initial data (optional):
```bash
npm run db:seed
```

### Run

Development mode (with hot reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

### Testing

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## API Overview

All API endpoints are prefixed with `/api/v1`.

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Log in and receive JWT
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Log out and invalidate refresh token

### Teams
- `GET /teams` - List user's teams
- `POST /teams` - Create a new team
- `GET /teams/:id` - Get team details
- `PATCH /teams/:id` - Update team
- `DELETE /teams/:id` - Delete team
- `POST /teams/:id/invite` - Generate invitation code
- `POST /teams/join/:code` - Join team via invitation code

### Sprints
- `GET /teams/:teamId/sprints` - List team sprints
- `POST /teams/:teamId/sprints` - Create sprint
- `GET /teams/:teamId/sprints/:id` - Get sprint details
- `PATCH /teams/:teamId/sprints/:id` - Update sprint
- `DELETE /teams/:teamId/sprints/:id` - Delete sprint

### Templates
- `GET /templates` - List available templates
- `GET /templates/:id` - Get template details

### Boards
- `POST /sprints/:sprintId/board` - Create board for a sprint
- `GET /sprints/:sprintId/board` - Get board by sprint (includes columns + cards)
- `GET /boards/:id` - Get board details
- `PATCH /boards/:id` - Update board settings
- `DELETE /boards/:id` - Delete board
- `PUT /boards/:id/phase` - Transition facilitation phase

### Cards
- `POST /boards/:id/cards` - Create card (with `column_id` in body)
- `GET /cards/:cardId` - Get card details
- `PATCH /boards/:id/cards/:cardId` - Update card
- `DELETE /boards/:id/cards/:cardId` - Delete card
- `POST /boards/:id/cards/:cardId/votes` - Vote on a card
- `DELETE /boards/:id/cards/:cardId/votes` - Remove vote
- `POST /cards/:cardId/reactions` - Add/remove emoji reaction

### Card Grouping
- `POST /boards/:id/groups` - Create card group (field: `title`, `card_ids`)
- `PUT /boards/:id/groups/:groupId` - Update group
- `DELETE /boards/:id/groups/:groupId` - Delete group

### Timer
- `POST /boards/:boardId/timer/start` - Start countdown timer
- `POST /boards/:boardId/timer/pause` - Pause timer
- `POST /boards/:boardId/timer/reset` - Reset timer
- `GET /boards/:boardId/timer` - Get timer state

### Action Items
- `POST /boards/:boardId/action-items` - Create action item
- `GET /boards/:boardId/action-items` - List action items
- `PATCH /action-items/:id` - Update action item
- `DELETE /action-items/:id` - Delete action item

### Analytics
- `GET /sprints/:sprintId/analytics` - Get sprint analytics (cards, sentiment, participation)
- `GET /teams/:teamId/analytics/health` - Get team health trends
- `GET /teams/:teamId/analytics/participation` - Get team participation metrics
- `GET /teams/:teamId/analytics/sentiment` - Get team sentiment trends
- `GET /teams/:teamId/analytics/word-cloud` - Get word frequency analysis

### Export
- `GET /boards/:id/export?format=json|markdown|html` - Export board
- `GET /teams/:teamId/report` - Generate team report

### Icebreakers
- `GET /icebreakers/random?teamId=...` - Get random icebreaker question (optional `category` filter)
- `POST /teams/:teamId/icebreakers/custom` - Create custom icebreaker
- `GET /boards/:id/icebreaker` - Get board icebreaker
- `POST /boards/:id/icebreaker` - Set board icebreaker

### User & Onboarding
- `GET /users/me/onboarding` - Get onboarding status
- `PATCH /users/me/onboarding` - Update onboarding progress
- `POST /users/me/onboarding/complete` - Mark onboarding as complete
- `POST /users/me/onboarding/reset` - Reset onboarding

## Architecture

RetroBoard Pro uses a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────┐
│         HTTP/WebSocket Client       │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│          Routes Layer               │
│  - URL mapping                      │
│  - Request parsing                  │
│  - Response formatting              │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│        Middleware Layer             │
│  - JWT authentication               │
│  - Role-based access control        │
│  - Input validation (Zod)           │
│  - Rate limiting                    │
│  - Error handling                   │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│         Services Layer              │
│  - Business logic                   │
│  - Orchestration                    │
│  - Validation rules                 │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│      Repositories Layer             │
│  - SQL query builders               │
│  - Data access                      │
│  - Transaction management           │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│        PostgreSQL Database          │
│  - Persistence                      │
│  - LISTEN/NOTIFY pub/sub            │
│  - Full-text search                 │
│  - Materialized views               │
└─────────────────────────────────────┘
```

### Key Components

**Routes** (`src/routes/`): Handle HTTP requests and delegate to services. Each route module corresponds to a domain (auth, teams, boards, etc.).

**Services** (`src/services/`): Implement business logic and orchestrate repository calls. Services are responsible for validation, authorization logic, and complex operations.

**Repositories** (`src/repositories/`): Execute SQL queries using raw SQL. Each repository focuses on a single table or closely related tables.

**Middleware** (`src/middleware/`):
- `auth.ts` - JWT token verification
- `team-auth.ts` - Team membership and role checks
- `rate-limit.ts` - PostgreSQL-backed rate limiting
- `phase-permission-guard.ts` - Facilitation phase permission enforcement

**Database** (`src/db/`):
- `connection.ts` - Lazy PostgreSQL connection pool
- `migrate.ts` - Migration runner
- `migrations/` - 23 SQL migration files (001-023)

## WebSocket Real-Time Features

RetroBoard Pro uses WebSocket for real-time collaboration features:

### Connection Management
- Per-board rooms for isolated collaboration
- Automatic heartbeat/ping-pong for connection health
- User presence tracking

### Real-Time Events
- **Card operations**: Create, update, delete, vote
- **Board state**: Phase transitions, timer updates, lock state
- **User presence**: Join/leave notifications, active user list
- **Cursors**: Live cursor positions for collaborative awareness

### PostgreSQL LISTEN/NOTIFY
WebSocket server subscribes to PostgreSQL NOTIFY channels for cross-process synchronization:
- `board_change` - Board state updates
- `card_change` - Card CRUD operations
- `vote_change` - Voting updates
- `timer_change` - Timer state changes

This architecture ensures all connected clients receive updates, even in multi-process deployments.

## Project Structure

```
retroboard/
├── CLAUDE.md                 # Project instructions
├── README.md                 # This file
├── epics/                    # SDD epic tracking
│   └── INDEX.md
├── services/
│   └── retroboard-server/
│       ├── src/
│       │   ├── server.ts           # Hono app + route registration
│       │   ├── config/
│       │   │   └── env.ts          # Environment validation
│       │   ├── db/
│       │   │   ├── connection.ts   # PostgreSQL pool
│       │   │   ├── migrate.ts      # Migration runner
│       │   │   ├── seed.ts         # Seed data
│       │   │   └── migrations/     # SQL migrations (001-023)
│       │   ├── middleware/
│       │   │   ├── auth.ts
│       │   │   ├── team-auth.ts
│       │   │   ├── rate-limit.ts
│       │   │   └── phase-permission-guard.ts
│       │   ├── repositories/       # Data access layer
│       │   ├── services/           # Business logic
│       │   ├── routes/             # HTTP route handlers
│       │   ├── formatters/         # Export formatters
│       │   ├── validation/         # Zod schemas
│       │   ├── utils/              # JWT, password, errors
│       │   └── ws/                 # WebSocket server
│       ├── tests/
│       │   ├── setup.ts            # Test database setup
│       │   ├── helpers/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
└── docs/                     # Project documentation
```

## Database

RetroBoard Pro uses PostgreSQL as its sole data store (no Redis, SQLite, or other databases).

### Key Features
- Raw SQL queries via `postgres` (porsager/postgres) driver
- 23 migrations covering all features
- LISTEN/NOTIFY for real-time pub/sub
- Materialized views for analytics performance
- Full-text search for cards and boards
- Composite indexes for query optimization

### Migrations
Located in `src/db/migrations/`, numbered 001-023:
- User authentication and teams (001-005)
- Sprints and boards (006-008)
- Templates and columns (009-011)
- Cards and voting (012-014)
- Real-time features (015-016)
- Analytics and action items (017-019)
- Export and reactions (020-021)
- Icebreakers and onboarding (022-023)

## Contributing

This project follows Skills-Driven Development (SDD). See `CLAUDE.md` for workflow guidelines.

## License

Proprietary
