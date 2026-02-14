# Auth Database Specification

**Feature:** auth
**Database:** PostgreSQL 15+
**Driver:** postgres (porsager/postgres)

---

## 1. ER Diagram

```
┌──────────────────────────────────────┐
│              users                    │
├──────────────────────────────────────┤
│ id           UUID        PK          │
│ email        VARCHAR(255) UNIQUE     │
│ password_hash VARCHAR(60) NOT NULL   │
│ display_name VARCHAR(100) NOT NULL   │
│ avatar_url   VARCHAR(500) NULL       │
│ created_at   TIMESTAMPTZ  NOT NULL   │
│ updated_at   TIMESTAMPTZ  NOT NULL   │
└────────────────┬─────────────────────┘
                 │
                 │ 1:N
                 │
┌────────────────┴─────────────────────┐
│          refresh_tokens               │
├──────────────────────────────────────┤
│ id           UUID        PK          │
│ user_id      UUID        FK → users  │
│ token_hash   VARCHAR(64) NOT NULL    │
│ expires_at   TIMESTAMPTZ  NOT NULL   │
│ revoked_at   TIMESTAMPTZ  NULL       │
│ created_at   TIMESTAMPTZ  NOT NULL   │
└──────────────────────────────────────┘
```

## 2. Table: users

Stores registered user accounts.

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | `UUID` | NOT NULL | `gen_random_uuid()` | Primary key |
| email | `VARCHAR(255)` | NOT NULL | -- | User email, stored lowercase |
| password_hash | `VARCHAR(60)` | NOT NULL | -- | bcrypt hash ($2a$ format, 60 chars) |
| display_name | `VARCHAR(100)` | NOT NULL | -- | Display name shown in UI |
| avatar_url | `VARCHAR(500)` | NULL | `NULL` | URL to user avatar image |
| created_at | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Account creation timestamp |
| updated_at | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Last profile update timestamp |

### Constraints

| Name | Type | Columns | Description |
|------|------|---------|-------------|
| users_pkey | PRIMARY KEY | id | |
| users_email_key | UNIQUE | email | Prevents duplicate registrations |

### Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| users_pkey | id | B-tree (PK) | Primary key lookups |
| users_email_key | email | B-tree (UNIQUE) | Login lookups by email |

### Notes

- `email` is stored lowercase. The application normalizes email to lowercase before INSERT and before SELECT.
- `password_hash` uses bcrypt with cost factor 12. The output is always 60 characters in `$2a$12$...` format.
- `updated_at` is updated by the application on every `UPDATE` operation. No database trigger is used -- the service layer sets this explicitly.

## 3. Table: refresh_tokens

Stores hashed refresh tokens for session management and revocation.

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | `UUID` | NOT NULL | `gen_random_uuid()` | Primary key |
| user_id | `UUID` | NOT NULL | -- | FK to users.id |
| token_hash | `VARCHAR(64)` | NOT NULL | -- | SHA-256 hex hash of the raw refresh token |
| expires_at | `TIMESTAMPTZ` | NOT NULL | -- | Token expiry (7 days after creation) |
| revoked_at | `TIMESTAMPTZ` | NULL | `NULL` | When the token was revoked. NULL = active. |
| created_at | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Token creation timestamp |

### Constraints

| Name | Type | Columns | Description |
|------|------|---------|-------------|
| refresh_tokens_pkey | PRIMARY KEY | id | |
| refresh_tokens_user_id_fkey | FOREIGN KEY | user_id | References users(id) ON DELETE CASCADE |

### Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| refresh_tokens_pkey | id | B-tree (PK) | Primary key lookups |
| refresh_tokens_token_hash_idx | token_hash | B-tree | Token lookup during refresh |
| refresh_tokens_user_id_idx | user_id | B-tree | Find all tokens for a user (revoke all) |
| refresh_tokens_expires_at_idx | expires_at | B-tree | Cleanup job for expired tokens |

### Notes

- `token_hash` stores the SHA-256 hex digest (64 characters) of the raw refresh token. The raw token is never stored.
- `ON DELETE CASCADE` on `user_id` ensures that if a user is deleted, all their refresh tokens are also deleted.
- Expired and revoked tokens accumulate over time. A periodic cleanup job should delete rows where `expires_at < NOW() - INTERVAL '30 days'` or `revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days'`.

## 4. Migration SQL

### Migration 001: Create users table

```sql
-- Migration: 001_create_users
-- Description: Create the users table for authentication
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255)    NOT NULL,
    password_hash   VARCHAR(60)     NOT NULL,
    display_name    VARCHAR(100)    NOT NULL,
    avatar_url      VARCHAR(500),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_key UNIQUE (email)
);

-- Index on email is created implicitly by the UNIQUE constraint.
-- No additional indexes needed for this table at this stage.

COMMENT ON TABLE users IS 'Registered user accounts for RetroBoard Pro';
COMMENT ON COLUMN users.email IS 'User email address, stored lowercase';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash with cost factor 12';
COMMENT ON COLUMN users.display_name IS 'Display name shown in the UI';
COMMENT ON COLUMN users.avatar_url IS 'Optional URL to user avatar image';
```

### Migration 002: Create refresh_tokens table

```sql
-- Migration: 002_create_refresh_tokens
-- Description: Create the refresh_tokens table for JWT refresh token management
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL,
    token_hash      VARCHAR(64)     NOT NULL,
    expires_at      TIMESTAMPTZ     NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT refresh_tokens_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS refresh_tokens_token_hash_idx
    ON refresh_tokens (token_hash);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
    ON refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx
    ON refresh_tokens (expires_at);

COMMENT ON TABLE refresh_tokens IS 'Hashed refresh tokens for session management';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hex digest of the raw refresh token';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'NULL means active; non-NULL means revoked';
```

## 5. Query Patterns

### 5.1 Register (insert user)

```sql
INSERT INTO users (email, password_hash, display_name)
VALUES ($1, $2, $3)
RETURNING id, email, display_name, avatar_url, created_at, updated_at;
```

### 5.2 Login (find user by email)

```sql
SELECT id, email, password_hash, display_name, avatar_url, created_at, updated_at
FROM users
WHERE email = $1;
```

### 5.3 Get user by ID (profile)

```sql
SELECT id, email, display_name, avatar_url, created_at, updated_at
FROM users
WHERE id = $1;
```

### 5.4 Update user profile

```sql
UPDATE users
SET display_name = COALESCE($2, display_name),
    avatar_url = CASE WHEN $3::boolean THEN $4 ELSE avatar_url END,
    updated_at = NOW()
WHERE id = $1
RETURNING id, email, display_name, avatar_url, created_at, updated_at;
```

Note: The service layer builds the SET clause dynamically based on which fields were provided. The above is a conceptual example; actual implementation uses tagged template literals.

### 5.5 Store refresh token

```sql
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id;
```

### 5.6 Find refresh token by hash

```sql
SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
FROM refresh_tokens
WHERE token_hash = $1;
```

### 5.7 Revoke a refresh token

```sql
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE id = $1 AND revoked_at IS NULL;
```

### 5.8 Revoke all tokens for a user

```sql
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE user_id = $1 AND revoked_at IS NULL;
```

### 5.9 Cleanup expired/revoked tokens (maintenance)

```sql
DELETE FROM refresh_tokens
WHERE (expires_at < NOW() - INTERVAL '30 days')
   OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days');
```

## 6. Data Volume Estimates

| Table | Rows per user | Growth pattern |
|-------|--------------|----------------|
| users | 1 | Grows with registrations. Expected: hundreds to low thousands. |
| refresh_tokens | ~1-5 active, many historical | Each login/refresh creates a row. Cleanup removes old rows. |

At 1,000 users with average 10 historical tokens each: ~10,000 rows in refresh_tokens. Well within PostgreSQL comfort zone.

## 7. Migration Strategy

Migrations are stored in `src/db/migrations/` as numbered SQL files. They run in order at application startup (or via `npm run db:migrate`).

Each migration file:
- Uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for idempotency.
- Is forward-only (no down migrations in Phase 1).
- Runs inside a transaction.

Migration runner pseudocode:
1. Create `_migrations` table if not exists (tracks which migrations have run).
2. Read all `.sql` files from `src/db/migrations/` sorted by filename.
3. For each file not yet recorded in `_migrations`: run it in a transaction, record it.
