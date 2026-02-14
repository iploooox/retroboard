---
phase: 1
name: "Foundation"
status: todo
stories: ["S-001", "S-002", "S-003", "S-004", "S-005", "S-006", "S-012"]
estimated_duration: "3-4 weeks"
changed: 2026-02-14 — Spec Review Gate
---

# Phase 1: Foundation -- Auth, Teams, Sprints, Database Setup

## Overview

Phase 1 establishes the foundational infrastructure for RetroBoard Pro. This includes project scaffolding, database schema, authentication system, team management, sprint lifecycle, and system template seeding. At the end of this phase, users can register, log in, create teams, invite members, manage roles, create sprints, and view available retro templates.

## Stories Included

| Story | Title | Priority |
|-------|-------|----------|
| S-001 | User Registration & Login | Critical |
| S-002 | Session Management with JWT | Critical |
| S-003 | Create and Manage Teams | Critical |
| S-004 | Invite Members via Shareable Link | High |
| S-005 | Team Roles and Permission Enforcement | Critical |
| S-006 | Sprint CRUD with Date Ranges and Status | High |
| S-012 | Basic Templates (WWW/Delta, Start/Stop/Continue) | High |

## Dependencies

- None (this is the foundational phase)

## Prerequisites

- PostgreSQL 15+ instance provisioned
- Node.js 20+ runtime
- Domain and hosting infrastructure planned

## Tasks

### 1. Project Scaffolding & Configuration

- [ ] **BE**: Initialize monorepo structure (pnpm workspaces or turborepo)
- [ ] **BE**: Set up backend project with Hono framework, TypeScript, and tsup build
- [ ] **BE**: Configure ESLint, Prettier, and TypeScript strict mode
- [ ] **BE**: Set up environment variable management (.env, validation with Zod)
- [ ] **BE**: Set up database connection pool (pg or postgres.js)
- [ ] **BE**: Set up migration runner (node-pg-migrate, drizzle-kit, or kysely migrations)
- [ ] **BE**: Set up test framework (Vitest) with test database configuration
- [ ] **BE**: Create Docker Compose file for local PostgreSQL development
- [ ] **BE**: Set up API error handling middleware with consistent error response format
- [ ] **BE**: Set up request logging middleware (pino or similar)
- [ ] **BE**: Set up CORS configuration
- [ ] **FE**: Initialize frontend project with Vite + React + TypeScript
- [ ] **FE**: Configure TailwindCSS and component library setup (shadcn/ui or similar)
- [ ] **FE**: Set up React Router for client-side routing
- [ ] **FE**: Set up state management (Zustand or Jotai)
- [ ] **FE**: Set up API client layer (Axios or fetch wrapper with interceptors)
- [ ] **FE**: Configure ESLint, Prettier for frontend
- [ ] **FE**: Set up Vitest + React Testing Library for frontend tests

### 2. Database Migrations

- [ ] **BE**: Create `users` table migration (id UUID PK, email, password_hash, display_name, avatar_url, email_verified, created_at, updated_at)
- [ ] **BE**: Create `refresh_tokens` table migration (id UUID PK, user_id FK, token_hash, expires_at, revoked_at, created_at)
- [ ] **BE**: Create `teams` table migration (id UUID PK, name, slug UNIQUE, description, theme, created_by FK, created_at, updated_at, deleted_at)
- [ ] **BE**: Create `team_members` table migration (id UUID PK, team_id FK, user_id FK, role ENUM, joined_at) with unique constraint on (team_id, user_id)
- [ ] **BE**: Create `team_invites` table migration (id UUID PK, team_id FK, token UNIQUE, role, created_by FK, expires_at, revoked_at, use_count, max_uses, created_at)
- [ ] **BE**: Create `sprints` table migration (id UUID PK, team_id FK, name, goal, start_date, end_date, status ENUM, sprint_number, created_by FK, created_at, updated_at)
- [ ] **BE**: Create `templates` table migration (id UUID PK, name, description, category, is_system, created_by FK, created_at)
- [ ] **BE**: Create `template_columns` table migration (id UUID PK, template_id FK, name, description, color, sort_order)
- [ ] **BE**: Create indexes on foreign keys and frequently queried columns
- [ ] **BE**: Create database seed runner infrastructure

### 3. Authentication Endpoints (S-001, S-002)

- [ ] **BE**: Implement password hashing utility (bcrypt, cost factor 12)
- [ ] **BE**: Implement JWT utility (sign, verify, decode) with configurable secrets and TTLs
- [ ] **BE**: Implement user repository (create, findByEmail, findById)
- [ ] **BE**: Implement refresh token repository (create, findByHash, revoke, revokeAllForUser)
- [ ] **BE**: Implement input validation schemas (Zod) for register, login, refresh
- [ ] **BE**: Create `POST /api/v1/auth/register` -- validate input, check duplicate email, hash password, create user, generate tokens, return profile + tokens
- [ ] **BE**: Create `POST /api/v1/auth/login` -- validate input, find user, compare password, generate tokens, return profile + tokens
- [ ] **BE**: Create `POST /api/v1/auth/refresh` -- validate refresh token, rotate tokens, return new pair
- [ ] **BE**: Create `POST /api/v1/auth/logout` -- revoke refresh token
- [ ] **BE**: Create `GET /api/v1/auth/me` -- return current user profile from JWT
- [ ] **BE**: Implement auth middleware (extract Bearer token, verify JWT, attach user to context)
- [ ] **BE**: Add rate limiting to auth endpoints (5 requests/minute per IP)
- [ ] **BE**: Write comprehensive unit tests for auth service
- [ ] **BE**: Write integration tests for all auth endpoints
- [ ] **FE**: Create auth pages layout (centered card with branding)
- [ ] **FE**: Build registration form with validation (email, password, confirm password, display name)
- [ ] **FE**: Build login form with validation (email, password)
- [ ] **FE**: Implement auth state store (tokens, user profile, isAuthenticated)
- [ ] **FE**: Implement API interceptor for auto token refresh
- [ ] **FE**: Implement protected route wrapper (redirect to login if unauthenticated)
- [ ] **FE**: Implement logout flow (API call, clear state, redirect)
- [ ] **FE**: Handle global 401 responses (token expired, force re-login)

### 4. Team Management Endpoints (S-003, S-004, S-005)

- [ ] **BE**: Implement team repository (create, findById, findBySlug, findByUserId, update, softDelete)
- [ ] **BE**: Implement team membership repository (addMember, removeMember, updateRole, findByTeam, findMembership)
- [ ] **BE**: Implement slug generation utility
- [ ] **BE**: Implement invite repository (create, findByToken, revoke, findActiveByTeam)
- [ ] **BE**: Define role permissions matrix and `requireTeamRole` middleware
- [ ] **BE**: Create `POST /api/v1/teams` -- create team, add creator as admin
- [ ] **BE**: Create `GET /api/v1/teams` -- list teams for authenticated user
- [ ] **BE**: Create `GET /api/v1/teams/:teamId` -- team details with member list
- [ ] **BE**: Create `PATCH /api/v1/teams/:teamId` -- update team (admin only)
- [ ] **BE**: Create `DELETE /api/v1/teams/:teamId` -- soft delete team (admin only)
- [ ] **BE**: Create `POST /api/v1/teams/:teamId/invites` -- generate invite link (admin/facilitator)
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/invites` -- list active invites (admin/facilitator)
- [ ] **BE**: Create `DELETE /api/v1/teams/:teamId/invites/:inviteId` -- revoke invite
- [ ] **BE**: Create `GET /api/v1/invites/:token` -- validate invite, return team info
- [ ] **BE**: Create `POST /api/v1/teams/join` -- accept invite token, add member
- [ ] **BE**: Create `PATCH /api/v1/teams/:teamId/members/:userId/role` -- change member role (admin only)
- [ ] **BE**: Create `DELETE /api/v1/teams/:teamId/members/:userId` -- remove member (admin only)
- [ ] **BE**: Write unit tests for team and invite services
- [ ] **BE**: Write integration tests for team and invite endpoints
- [ ] **FE**: Build teams list page with team cards
- [ ] **FE**: Build team creation modal/form
- [ ] **FE**: Build team detail page (members list, sprint list)
- [ ] **FE**: Build team settings page (edit, delete, invite management, member roles)
- [ ] **FE**: Build invite link generation and copy-to-clipboard UI
- [ ] **FE**: Build invite acceptance page (`/invite/:token`)
- [ ] **FE**: Build member management UI (role change dropdown, remove button)
- [ ] **FE**: Implement `usePermissions` hook for role-based UI rendering
- [ ] **FE**: Add team navigation sidebar/dropdown

### 5. Sprint Management Endpoints (S-006)

- [ ] **BE**: Implement sprint repository (create, findById, findByTeamId, update, updateStatus)
- [ ] **BE**: Implement sprint number auto-increment per team
- [ ] **BE**: Implement status transition validation (planned -> active -> completed)
- [ ] **BE**: Create `POST /api/v1/teams/:teamId/sprints` -- create sprint (facilitator+)
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/sprints` -- list sprints with pagination and sorting
- [ ] **BE**: Create `GET /api/v1/teams/:teamId/sprints/:sprintId` -- sprint detail
- [ ] **BE**: Create `PATCH /api/v1/teams/:teamId/sprints/:sprintId` -- update sprint (facilitator+)
- [ ] **BE**: Create `PATCH /api/v1/teams/:teamId/sprints/:sprintId/status` -- transition status (facilitator+)
- [ ] **BE**: Write unit tests for sprint service and status transitions
- [ ] **BE**: Write integration tests for sprint endpoints
- [ ] **FE**: Build sprint creation form/modal with date pickers
- [ ] **FE**: Build sprints list view with status badges
- [ ] **FE**: Build sprint detail page
- [ ] **FE**: Build sprint status transition buttons
- [ ] **FE**: Add sprint selector/navigator to team view

### 6. Template Seeding (S-012)

> **Scope:** Phase 1 seeds 2 system templates (read-only). Custom template CRUD is Phase 5 (S-025).

- [ ] **BE**: Implement template repository (findAll, findById, findSystemTemplates)
- [ ] **BE**: Create seed: "What Went Well / Delta" template with 2 columns (green "What Went Well", red "Delta / Changes")
- [ ] **BE**: Create seed: "Start / Stop / Continue" template with 3 columns (green "Start", red "Stop", blue "Continue")
- [ ] **BE**: Create `GET /api/v1/templates` -- list system templates
- [ ] **BE**: Create `GET /api/v1/templates/:templateId` -- template detail with columns
- [ ] **BE**: Write integration tests for template seeding and endpoints (2 templates)
- [ ] **FE**: Build template selection grid component (2 system templates)
- [ ] **FE**: Build template preview cards with column layout visualization

## Exit Criteria

- [ ] Users can register, log in, refresh tokens, and log out
- [ ] Users can create teams, invite members via link, and manage roles
- [ ] Facilitators can create sprints with date ranges and manage status
- [ ] System templates are seeded and retrievable via API
- [ ] All endpoints have unit and integration tests with >80% coverage
- [ ] Frontend pages are functional for auth, teams, sprints, and template browsing
- [ ] CI pipeline runs tests on every push

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Database schema changes later | Design with extensibility (JSONB settings fields, nullable FKs) |
| JWT security vulnerabilities | Use well-tested libraries, short access token TTL, token rotation |
| Invite link abuse | Rate limiting, max uses, expiration, team-level invite limits |
