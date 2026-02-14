# Teams Feature Architecture

**Feature:** teams
**Service:** retroboard-server
**Depends on:** auth
**Phase:** 1
**Status:** planning
**Changed:** 2026-02-14 — Spec Review Gate

---

## 1. Overview

The teams feature enables users to create teams, invite members via shareable links, and manage membership with role-based access control. Teams are the organizational unit that owns sprints, retro boards, and all associated data. A user can belong to multiple teams, and each team has its own isolated data.

## 2. Current State

Nothing exists. The auth feature (users table) is a prerequisite. No teams, members, or invitations tables exist.

## 3. Target State

| Capability | Detail |
|-----------|--------|
| Team creation | Any authenticated user can create a team with name, slug, description, avatar. Creator becomes admin. |
| Team slug | URL-friendly unique identifier. Auto-generated from name, can be customized. Used in URLs. |
| Roles | Three roles: **admin** (full control), **facilitator** (run retros, manage sprints), **member** (participate). |
| Member management | Admins can change roles and remove members. Users can leave teams. |
| Invitations | Admin or facilitator creates a shareable invite link with unique code. No email sending -- just a URL. |
| Invite constraints | Invites can have expiry time and max usage count. |
| Multi-team | A user can be a member of multiple teams. Each team has independent data. |
| Team listing | Users see only teams they belong to. |

## 4. Design Decisions

### 4.1 Role Model

Three roles, ordered by privilege:

```
admin > facilitator > member
```

| Permission | admin | facilitator | member |
|-----------|-------|-------------|--------|
| View team details | Yes | Yes | Yes |
| Update team settings | Yes | No | No |
| Delete team | Yes | No | No |
| Create invite links | Yes | Yes | No |
| Change member roles | Yes | No | No |
| Remove members | Yes | No | No |
| Create sprints | Yes | Yes | No |
| Manage sprints | Yes | Yes | No |
| Participate in retros | Yes | Yes | Yes |
| Leave team | Yes* | Yes | Yes |

*If the last admin leaves, the team has no admin. The system prevents this -- the last admin cannot leave without promoting another member first.

### 4.2 Slug Generation

Slugs are auto-generated from the team name using the following rules:
1. Convert to lowercase.
2. Replace spaces and special characters with hyphens.
3. Remove consecutive hyphens.
4. Trim hyphens from start/end.
5. Truncate to 50 characters.
6. If slug already exists, append `-2`, `-3`, etc.

Slugs are immutable after creation in Phase 1 (simplifies URL stability). Can be made editable in a future phase.

### 4.3 Invitation Links (No Email)

Invitations work via shareable URLs, not email:
1. Admin/facilitator creates an invite via API, receiving a unique code. The invite can optionally specify a `role` (default: `member`, also `facilitator`; only admins can create `admin`-role invites).
2. The invite URL is `{app_url}/join/{code}`.
3. An authenticated user calls `POST /api/v1/teams/join/{code}` to accept.
4. The user is added with the **role specified by the invitation** (not hardcoded to `member`).
5. Invites can have an `expires_at` and `max_uses` limit.
6. Maximum **5 active invitations** per team at any time (active = non-expired, non-revoked, non-exhausted).

**Invite revocation:** Admins and facilitators can revoke an invite via `DELETE /api/v1/teams/:id/invitations/:inviteId`, which sets `revoked_at = NOW()`. Revoked invites cannot be used to join. This mitigates the risk of leaked invite links remaining valid until expiry.

**Atomic join guard:** The join flow uses an atomic `UPDATE ... WHERE use_count < max_uses RETURNING id` to prevent race conditions where concurrent requests could exceed `max_uses`. If no row is returned, the invite is exhausted.

This avoids the complexity of email delivery infrastructure.

### 4.4 Composite Primary Key for team_members

The `team_members` table uses a composite primary key `(team_id, user_id)`. This naturally enforces that a user can only have one role per team and makes the common query pattern (lookup by team + user) efficient without an additional index.

### 4.5 Team Deletion (Soft Delete)

Deleting a team is a **soft delete** — sets `deleted_at = NOW()` on the team row. All queries filter on `deleted_at IS NULL`, making the team and its associated data (sprints, boards, cards, invitations) inaccessible without physically destroying them. Only the team admin can delete a team. Hard delete (permanent data removal) is deferred to a future admin operation. A confirmation flow is a frontend concern.

## 5. Architecture Layers

```
Request Flow:

  Client
    |
    | Authorization: Bearer <token>
    v
┌──────────────────────────────────────────────────┐
│  Auth Middleware (from auth feature)              │
│  Extracts user → c.set('user', { id, email })    │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│  Route Handler (e.g., POST /api/v1/teams)        │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│  RBAC Middleware (per-route)                      │
│  Checks user's role in the target team           │
│  e.g., requireRole('admin') or                   │
│       requireRole('admin', 'facilitator')        │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│  Teams Service                                    │
│  - createTeam(userId, data)                       │
│  - getTeam(teamId)                                │
│  - updateTeam(teamId, data)                       │
│  - deleteTeam(teamId)                             │
│  - listUserTeams(userId)                          │
│  - listMembers(teamId)                            │
│  - updateMemberRole(teamId, userId, role)         │
│  - removeMember(teamId, userId)                   │
│  - createInvitation(teamId, createdBy, options)   │
│  - revokeInvitation(teamId, inviteId)             │
│  - joinViaInvite(code, userId)                    │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│  Teams Repository                                 │
│  SQL queries for teams, team_members,             │
│  team_invitations tables                          │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│  PostgreSQL                                       │
│  Tables: teams, team_members, team_invitations    │
└──────────────────────────────────────────────────┘
```

## 6. File Structure

```
src/
  middleware/
    rbac.ts                 # Role-based access control middleware
  routes/
    teams.ts                # Hono router for /api/v1/teams/*
  services/
    teams.service.ts        # Business logic for teams
  repositories/
    teams.repository.ts     # SQL queries for teams, members, invitations
  types/
    teams.ts                # TypeScript interfaces: Team, TeamMember, etc.
  utils/
    slug.ts                 # Slug generation utility
    invite-code.ts          # Random invite code generation
  db/
    migrations/
      003_create_teams.sql
      004_create_team_members.sql
      005_create_team_invitations.sql
```

## 7. RBAC Middleware Flow

```
  Authenticated Request (user extracted by auth middleware)
        |
        v
  ┌──────────────────────────────────────┐
  │ Extract team_id from route params    │
  │ (e.g., /api/v1/teams/:id/members)   │
  └───────────┬──────────────────────────┘
              │
              v
  ┌──────────────────────────────────────┐
  │ Query team_members for              │
  │ (team_id, user_id) pair             │
  └───────────┬──────────────────────────┘
              │
       ┌──────┴──────┐
       │ Member?      │
       └──┬───────┬───┘
          │ NO    │ YES
          v       v
     403 error  ┌─────────────────────────┐
                │ Check role against      │
                │ required roles          │
                └──┬──────────────┬───────┘
                   │ INSUFFICIENT  │ OK
                   v               v
              403 error       ┌──────────────────┐
                              │ Set team context: │
                              │ c.set('teamRole', │
                              │   role)            │
                              │ Call next()        │
                              └──────────────────┘
```

## 8. Team Creation Flow

```
  Client                         Server                            PostgreSQL
    |                              |                                   |
    |  POST /api/v1/teams          |                                   |
    |  { name, description }       |                                   |
    |----------------------------->|                                   |
    |                              |  Generate slug from name          |
    |                              |                                   |
    |                              |  BEGIN TRANSACTION                |
    |                              |                                   |
    |                              |  INSERT INTO teams               |
    |                              |  (name, slug, description,       |
    |                              |   created_by)                    |
    |                              |---------------------------------->|
    |                              |  team row                        |
    |                              |<----------------------------------|
    |                              |                                   |
    |                              |  INSERT INTO team_members        |
    |                              |  (team_id, user_id,              |
    |                              |   role='admin')                  |
    |                              |---------------------------------->|
    |                              |  OK                               |
    |                              |<----------------------------------|
    |                              |                                   |
    |                              |  COMMIT                           |
    |                              |                                   |
    |  201 Created                 |                                   |
    |  { team with members }       |                                   |
    |<-----------------------------|                                   |
```

## 9. Invitation Join Flow

```
  Client                         Server                            PostgreSQL
    |                              |                                   |
    |  POST /teams/join/ABC123     |                                   |
    |---------------------------->|                                   |
    |                              |  SELECT FROM team_invitations    |
    |                              |  JOIN teams                      |
    |                              |  WHERE code = 'ABC123'           |
    |                              |  AND revoked_at IS NULL          |
    |                              |  AND teams.deleted_at IS NULL    |
    |                              |---------------------------------->|
    |                              |  invitation row                  |
    |                              |<----------------------------------|
    |                              |                                   |
    |                              |  Validate:                       |
    |                              |  - invitation exists             |
    |                              |  - not expired                   |
    |                              |  - not revoked                   |
    |                              |  - user not already a member     |
    |                              |                                   |
    |                              |  BEGIN TRANSACTION               |
    |                              |                                   |
    |                              |  UPDATE team_invitations         |
    |                              |  SET use_count = use_count + 1   |
    |                              |  WHERE id = X AND                |
    |                              |  (max_uses IS NULL OR            |
    |                              |   use_count < max_uses)          |
    |                              |  RETURNING id, role              |
    |                              |---------------------------------->|
    |                              |  (atomic guard — if 0 rows,      |
    |                              |   invite exhausted, abort)       |
    |                              |<----------------------------------|
    |                              |                                   |
    |                              |  INSERT INTO team_members        |
    |                              |  (team_id, user_id,              |
    |                              |   role=invite.role)              |
    |                              |---------------------------------->|
    |                              |                                   |
    |                              |  COMMIT                          |
    |                              |                                   |
    |  200 OK                      |                                   |
    |  { team, membership }        |                                   |
    |<-----------------------------|                                   |
```

## 10. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Cross-team data access | RBAC middleware checks team membership on every team-scoped route |
| Privilege escalation | Role changes restricted to admin only. Cannot set role higher than admin. |
| Invite link brute force | Invite codes are 12-character alphanumeric (62^12 combinations). Rate limiting on join endpoint. |
| Invite link leakage | Admins/facilitators can revoke invites via DELETE endpoint, setting `revoked_at`. Join flow checks `revoked_at IS NULL`. |
| Invite join race condition | Atomic `UPDATE ... WHERE use_count < max_uses RETURNING id` prevents concurrent requests from exceeding `max_uses` (Security S-02). |
| Last admin leaving | Service layer prevents the last admin from leaving or being demoted. |
| Team deletion | Soft delete (`deleted_at = NOW()`) preserves data while making it inaccessible. Only admin can delete. |
| Unauthorized member removal | Only admin can remove members. Users can always leave voluntarily. |

## 11. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `TEAM_NOT_FOUND` | 404 | Team with given ID does not exist |
| `TEAM_SLUG_EXISTS` | 409 | A team with this slug already exists |
| `TEAM_MEMBER_EXISTS` | 409 | User is already a member of this team |
| `TEAM_NOT_MEMBER` | 403 | User is not a member of this team |
| `TEAM_INSUFFICIENT_ROLE` | 403 | User's role does not have permission for this action |
| `TEAM_LAST_ADMIN` | 400 | Cannot remove or demote the last admin |
| `TEAM_INVITE_NOT_FOUND` | 404 | Invite code does not exist |
| `TEAM_INVITE_EXPIRED` | 410 | Invite has expired |
| `TEAM_INVITE_EXHAUSTED` | 410 | Invite has reached its max usage limit |
| `TEAM_INVITE_LIMIT_REACHED` | 400 | Team already has 5 active invitations |
| `TEAM_CANNOT_REMOVE_SELF` | 400 | Use the leave endpoint instead of remove |
| `VALIDATION_ERROR` | 400 | Request body fails validation |

## 12. Future Considerations (Not in Phase 1)

- **Team search/discovery**: Currently teams are private and join-by-invite only. Public team directory could be added later.
- **Hard delete / purge**: Admin operation to permanently remove soft-deleted teams and cascade data.
- **Custom roles**: User-defined roles with granular permissions.
- **Transfer ownership**: Transfer admin role to another member.
- **Audit log**: Track who changed what in team settings and membership.
