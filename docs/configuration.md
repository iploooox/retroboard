# Configuration Reference

RetroBoard Pro is configured entirely through environment variables. Set them via `.env` file, shell exports, or your deployment platform's config.

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/retroboard` |
| `JWT_SECRET` | Signing key for authentication tokens. Must be at least 32 characters. Use a cryptographically random value in production. | `openssl rand -base64 48` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Environment: `development`, `production`, or `test` |
| `DB_SCHEMA` | _(none — uses `public`)_ | PostgreSQL schema name for table isolation. See [Schema Isolation](#schema-isolation). |
| `DISABLE_RATE_LIMIT` | `false` | Set to `true` to disable rate limiting. **Only for testing.** |

## Database Connection

RetroBoard Pro uses [porsager/postgres](https://github.com/porsager/postgres) as its PostgreSQL driver. The connection string follows standard PostgreSQL URI format:

```
postgres://[user[:password]@][host[:port]]/database[?options]
```

### Connection Pool Settings

These are set in the application code and not configurable via env vars:

| Setting | Development | Production | Test |
|---------|-------------|------------|------|
| Max connections | 20 | 20 | 3 |
| Idle timeout | 20s | 20s | 20s |
| Connect timeout | 10s | 10s | 10s |

### Platform-Specific Connection Strings

**macOS (Homebrew PostgreSQL):**
```bash
# Homebrew uses your OS username, no password needed
DATABASE_URL="postgres://localhost:5432/retroboard"
```

**Linux (peer authentication):**
```bash
DATABASE_URL="postgres://localhost:5432/retroboard"
```

**Linux (password authentication):**
```bash
DATABASE_URL="postgres://retroboard_user:secretpass@localhost:5432/retroboard"
```

**Docker:**
```bash
DATABASE_URL="postgres://postgres:postgres@localhost:5432/retroboard"
```

**Managed PostgreSQL (e.g. Supabase, Neon, RDS):**
```bash
DATABASE_URL="postgres://user:pass@your-host.cloud:5432/retroboard?sslmode=require"
```

## Schema Isolation

For environments where multiple applications share a single PostgreSQL database, use `DB_SCHEMA` to isolate each app's tables into its own schema:

```bash
DB_SCHEMA=retroboard
```

When set:
- `db:migrate` creates the schema if it doesn't exist, then creates all tables inside it
- All runtime queries operate within that schema
- The `public` schema remains accessible as a fallback (for extensions, shared functions)
- Each app gets its own `schema_migrations` tracking table

When not set:
- All tables go in `public` (default PostgreSQL behavior)
- Fully backward compatible

### Example: Two Apps on One Database

```bash
# App 1: RetroBoard
DB_SCHEMA=retroboard DATABASE_URL=postgres://localhost/shared_db npm run db:migrate
DB_SCHEMA=retroboard DATABASE_URL=postgres://localhost/shared_db npm start

# App 2: Some other service
DB_SCHEMA=other_app DATABASE_URL=postgres://localhost/shared_db ...
```

Verify isolation:
```sql
\dt retroboard.*   -- RetroBoard tables
\dt other_app.*    -- Other app's tables
```

## Authentication

RetroBoard Pro uses JWT-based authentication with refresh token rotation:

| Parameter | Value |
|-----------|-------|
| Access token lifetime | 15 minutes |
| Refresh token lifetime | 7 days |
| Algorithm | HS256 |
| Refresh rotation | On every refresh, old token is revoked and new pair issued |
| Theft detection | If a revoked refresh token is reused, all user sessions are revoked |

The `JWT_SECRET` signs both access and refresh tokens. Changing it invalidates all existing sessions.

### Generating a Secret

```bash
# 48 bytes of randomness, base64 encoded (64 characters)
openssl rand -base64 48

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

## Rate Limiting

Rate limits are stored in PostgreSQL (not in-memory), so they survive server restarts and work across multiple instances.

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/register` | 10 requests | per hour per IP |
| `POST /auth/login` | 30 requests | per minute per IP |
| `POST /auth/login` | 5 requests | per 15 min per email |
| `POST /auth/refresh` | 30 requests | per minute per IP |

Set `DISABLE_RATE_LIMIT=true` to turn off all rate limiting. This is intended for automated testing only — never use in production.

## Validation

Environment variables are validated at startup using [Zod](https://zod.dev). If a required variable is missing or invalid, the server prints a clear error and exits:

```
Invalid environment variables:
  DATABASE_URL: Required
  JWT_SECRET: String must contain at least 32 character(s)
```

This is intentional — fail fast rather than running with broken config.
