# Teams Database Specification

**Feature:** teams
**Database:** PostgreSQL 15+
**Driver:** postgres (porsager/postgres)

---

## 1. ER Diagram

```
┌──────────────────────────────────────┐
│              users                    │
│         (from auth feature)          │
├──────────────────────────────────────┤
│ id           UUID        PK          │
│ email        VARCHAR(255) UNIQUE     │
│ ...                                  │
└───────┬──────────────┬───────────────┘
        │              │
        │ 1:N          │ 1:N
        │              │
        │    ┌─────────┴──────────────────────┐
        │    │          teams                   │
        │    ├────────────────────────────────┤
        │    │ id           UUID        PK     │
        │    │ name         VARCHAR(100)       │
        │    │ slug         VARCHAR(60) UNIQUE │
        │    │ description  VARCHAR(500) NULL  │
        │    │ avatar_url   VARCHAR(500) NULL  │
        │    │ created_by   UUID   FK → users  │
        │    │ created_at   TIMESTAMPTZ        │
        │    │ updated_at   TIMESTAMPTZ        │
        │    └───────┬──────────────┬──────────┘
        │            │              │
        │            │ 1:N          │ 1:N
        │            │              │
┌───────┴────────────┴───────┐  ┌───┴─────────────────────────────┐
│      team_members           │  │       team_invitations           │
├────────────────────────────┤  ├─────────────────────────────────┤
│ team_id   UUID  FK → teams │  │ id          UUID        PK      │
│ user_id   UUID  FK → users │  │ team_id     UUID   FK → teams   │
│ role      team_role ENUM   │  │ code        VARCHAR(12) UNIQUE  │
│ joined_at TIMESTAMPTZ      │  │ created_by  UUID   FK → users   │
│ (PK: team_id + user_id)   │  │ expires_at  TIMESTAMPTZ         │
└────────────────────────────┘  │ max_uses    INT NULL            │
                                 │ use_count   INT DEFAULT 0      │
                                 │ created_at  TIMESTAMPTZ         │
                                 └─────────────────────────────────┘
```

## 2. Enum Type: team_role

```sql
CREATE TYPE team_role AS ENUM ('admin', 'facilitator', 'member');
```

This PostgreSQL enum type enforces valid role values at the database level. The ordering in the ENUM definition does not imply privilege hierarchy -- privilege logic is enforced in the application layer.

## 3. Table: teams

Stores team records.

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | `UUID` | NOT NULL | `gen_random_uuid()` | Primary key |
| name | `VARCHAR(100)` | NOT NULL | -- | Team display name |
| slug | `VARCHAR(60)` | NOT NULL | -- | URL-friendly unique identifier |
| description | `VARCHAR(500)` | NULL | `NULL` | Team description |
| avatar_url | `VARCHAR(500)` | NULL | `NULL` | URL to team avatar image |
| created_by | `UUID` | NOT NULL | -- | FK to users.id (team creator) |
| created_at | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Team creation timestamp |
| updated_at | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Last update timestamp |

### Constraints

| Name | Type | Columns | Description |
|------|------|---------|-------------|
| teams_pkey | PRIMARY KEY | id | |
| teams_slug_key | UNIQUE | slug | Ensures globally unique slugs |
| teams_created_by_fkey | FOREIGN KEY | created_by | References users(id) ON DELETE SET NULL |

Note: `ON DELETE SET NULL` for `created_by` is not possible since the column is NOT NULL. Instead, we use `ON DELETE RESTRICT` -- a user cannot be deleted if they created teams. This is acceptable because user deletion is not a Phase 1 feature.

### Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| teams_pkey | id | B-tree (PK) | Primary key lookups |
| teams_slug_key | slug | B-tree (UNIQUE) | Slug lookups for URLs |
| teams_created_by_idx | created_by | B-tree | Find teams created by a user |

## 4. Table: team_members

Join table linking users to teams with roles. Uses a composite primary key.

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| team_id | `UUID` | NOT NULL | -- | FK to teams.id |
| user_id | `UUID` | NOT NULL | -- | FK to users.id |
| role | `team_role` | NOT NULL | `'member'` | Member's role in the team |
| joined_at | `TIMESTAMPTZ` | NOT NULL | `NOW()` | When the user joined |

### Constraints

| Name | Type | Columns | Description |
|------|------|---------|-------------|
| team_members_pkey | PRIMARY KEY | (team_id, user_id) | Composite PK -- one membership per user per team |
| team_members_team_id_fkey | FOREIGN KEY | team_id | References teams(id) ON DELETE CASCADE |
| team_members_user_id_fkey | FOREIGN KEY | user_id | References users(id) ON DELETE CASCADE |

### Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| team_members_pkey | (team_id, user_id) | B-tree (PK) | Membership lookups, role checks |
| team_members_user_id_idx | user_id | B-tree | List teams for a user |

Note: The composite PK already provides an efficient index for lookups by `(team_id, user_id)` and by `team_id` alone (leading column). The additional index on `user_id` covers the "list my teams" query.

## 5. Table: team_invitations

Stores invitation links for teams.

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | `UUID` | NOT NULL | `gen_random_uuid()` | Primary key |
| team_id | `UUID` | NOT NULL | -- | FK to teams.id |
| code | `VARCHAR(12)` | NOT NULL | -- | Unique invite code (12 alphanumeric chars) |
| created_by | `UUID` | NOT NULL | -- | FK to users.id (who created the invite) |
| expires_at | `TIMESTAMPTZ` | NOT NULL | -- | When the invitation expires |
| max_uses | `INT` | NULL | `NULL` | Max number of uses. NULL = unlimited. |
| use_count | `INT` | NOT NULL | `0` | How many times the invite has been used |
| created_at | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Invitation creation timestamp |

### Constraints

| Name | Type | Columns | Description |
|------|------|---------|-------------|
| team_invitations_pkey | PRIMARY KEY | id | |
| team_invitations_code_key | UNIQUE | code | Globally unique invite codes |
| team_invitations_team_id_fkey | FOREIGN KEY | team_id | References teams(id) ON DELETE CASCADE |
| team_invitations_created_by_fkey | FOREIGN KEY | created_by | References users(id) ON DELETE CASCADE |
| team_invitations_use_count_check | CHECK | use_count | `use_count >= 0` |
| team_invitations_max_uses_check | CHECK | max_uses | `max_uses IS NULL OR max_uses > 0` |

### Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| team_invitations_pkey | id | B-tree (PK) | Primary key lookups |
| team_invitations_code_key | code | B-tree (UNIQUE) | Invite code lookups during join |
| team_invitations_team_id_idx | team_id | B-tree | List invitations for a team |

## 6. Migration SQL

### Migration 003: Create teams table

```sql
-- Migration: 003_create_teams
-- Description: Create the teams table and team_role enum
-- Created: 2026-02-14

CREATE TYPE team_role AS ENUM ('admin', 'facilitator', 'member');

CREATE TABLE IF NOT EXISTS teams (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100)    NOT NULL,
    slug            VARCHAR(60)     NOT NULL,
    description     VARCHAR(500),
    avatar_url      VARCHAR(500),
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT teams_slug_key UNIQUE (slug),
    CONSTRAINT teams_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS teams_created_by_idx
    ON teams (created_by);

COMMENT ON TABLE teams IS 'Teams that organize retro boards and sprints';
COMMENT ON COLUMN teams.slug IS 'URL-friendly unique identifier, generated from name';
COMMENT ON COLUMN teams.created_by IS 'User who created the team (initial admin)';
```

### Migration 004: Create team_members table

```sql
-- Migration: 004_create_team_members
-- Description: Create the team_members join table
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS team_members (
    team_id         UUID            NOT NULL,
    user_id         UUID            NOT NULL,
    role            team_role       NOT NULL DEFAULT 'member',
    joined_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT team_members_pkey PRIMARY KEY (team_id, user_id),
    CONSTRAINT team_members_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT team_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS team_members_user_id_idx
    ON team_members (user_id);

COMMENT ON TABLE team_members IS 'Team membership with role-based access control';
COMMENT ON COLUMN team_members.role IS 'admin: full control, facilitator: run retros, member: participate';
```

### Migration 005: Create team_invitations table

```sql
-- Migration: 005_create_team_invitations
-- Description: Create the team_invitations table for invite links
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS team_invitations (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID            NOT NULL,
    code            VARCHAR(12)     NOT NULL,
    created_by      UUID            NOT NULL,
    expires_at      TIMESTAMPTZ     NOT NULL,
    max_uses        INT,
    use_count       INT             NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT team_invitations_code_key UNIQUE (code),
    CONSTRAINT team_invitations_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT team_invitations_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT team_invitations_use_count_check
        CHECK (use_count >= 0),
    CONSTRAINT team_invitations_max_uses_check
        CHECK (max_uses IS NULL OR max_uses > 0)
);

CREATE INDEX IF NOT EXISTS team_invitations_team_id_idx
    ON team_invitations (team_id);

COMMENT ON TABLE team_invitations IS 'Shareable invite links for team joining';
COMMENT ON COLUMN team_invitations.code IS '12-character alphanumeric invite code';
COMMENT ON COLUMN team_invitations.max_uses IS 'NULL means unlimited uses';
```

## 7. Query Patterns

### 7.1 Create team (with creator as admin)

```sql
-- Transaction: create team + add creator as admin
BEGIN;

INSERT INTO teams (name, slug, description, avatar_url, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

INSERT INTO team_members (team_id, user_id, role)
VALUES ($1, $2, 'admin');

COMMIT;
```

### 7.2 List user's teams

```sql
SELECT t.*, tm.role AS your_role,
       (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count
FROM teams t
INNER JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1
ORDER BY t.created_at DESC
LIMIT $2 OFFSET $3;
```

### 7.3 Get team by ID (with role check)

```sql
SELECT t.*, tm.role AS your_role,
       (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count
FROM teams t
INNER JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $2
WHERE t.id = $1;
```

### 7.4 Check user membership and role

```sql
SELECT role FROM team_members
WHERE team_id = $1 AND user_id = $2;
```

### 7.5 List team members

```sql
SELECT u.id, u.email, u.display_name, u.avatar_url,
       tm.role, tm.joined_at
FROM team_members tm
INNER JOIN users u ON u.id = tm.user_id
WHERE tm.team_id = $1
ORDER BY
    CASE tm.role
        WHEN 'admin' THEN 1
        WHEN 'facilitator' THEN 2
        WHEN 'member' THEN 3
    END,
    tm.joined_at ASC;
```

### 7.6 Count admins in team

```sql
SELECT COUNT(*) AS admin_count
FROM team_members
WHERE team_id = $1 AND role = 'admin';
```

### 7.7 Find invitation by code

```sql
SELECT * FROM team_invitations
WHERE code = $1;
```

### 7.8 Join via invitation (transaction)

```sql
BEGIN;

INSERT INTO team_members (team_id, user_id, role)
VALUES ($1, $2, 'member');

UPDATE team_invitations
SET use_count = use_count + 1
WHERE id = $3;

COMMIT;
```

### 7.9 Update member role

```sql
UPDATE team_members
SET role = $3
WHERE team_id = $1 AND user_id = $2
RETURNING *;
```

### 7.10 Remove member

```sql
DELETE FROM team_members
WHERE team_id = $1 AND user_id = $2;
```

## 8. Data Volume Estimates

| Table | Expected rows | Growth pattern |
|-------|--------------|----------------|
| teams | 10-500 | Grows with new team creation |
| team_members | 50-5000 | ~5-20 members per team |
| team_invitations | 10-1000 | ~1-5 invites per team, accumulates |

All within comfortable PostgreSQL range. No partitioning needed.

## 9. Cascade Behavior

| Parent deleted | Cascading effect |
|----------------|------------------|
| Team deleted | All team_members and team_invitations for that team are deleted |
| User deleted | All team_members entries for that user are deleted. Team invitations created by that user are deleted. Teams created by that user are RESTRICTED (cannot delete user if they created teams). |

## 10. Migration Dependencies

```
001_create_users           ← required by teams (created_by FK)
002_create_refresh_tokens
003_create_teams           ← creates team_role ENUM and teams table
004_create_team_members    ← depends on teams and users
005_create_team_invitations ← depends on teams and users
```
