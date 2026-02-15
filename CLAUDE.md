# RetroBoard Pro

## Development Workflow

This project uses **Skills-Driven Development** (SDD). Load the SDD skill for all development workflows: epic creation, planning, implementation, bug investigation, and team coordination.

## Project Layout

- `epics/` — Active work: specs, plans, decisions, bugs
- `services/` — Source of truth (update after merge only)
- `docs/` — Project documentation

## Active Epics

See `epics/INDEX.md` for current status.

## Tech Constraints

- **Database**: PostgreSQL only — no Redis, no SQLite, no other stores
- **Server**: Single TypeScript server — serves API, WebSocket, and static frontend
- **No microservices** — monolithic server architecture

## Team mode 
When the user says "send agent" you should always use the team mode instead of task mode.
Always use sonnet when spawning new agents unless user explicitly requests otherwise.
Exception: reviewer should use opus.
