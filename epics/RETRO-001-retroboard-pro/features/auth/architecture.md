# Auth Feature Architecture

**Feature:** auth
**Service:** retroboard-server
**Depends on:** --
**Phase:** 1
**Status:** planning

---

## 1. Overview

The auth feature provides JWT-based authentication for RetroBoard Pro. It handles user registration, login, token lifecycle management, and user profile operations. Every protected API endpoint passes through auth middleware that extracts and validates the current user from the JWT access token.

## 2. Current State

Nothing exists. There is no auth system, no users table, no token handling, no middleware.

## 3. Target State

| Capability | Detail |
|-----------|--------|
| Registration | Email + password + display_name. Password hashed with bcrypt (cost 12). |
| Login | Email + password verification. Returns access token + refresh token. |
| Access tokens | JWT signed with HS256 via `jose`. 15-minute expiry. Contains `sub` (user ID), `email`, `iat`, `exp`. |
| Refresh tokens | Opaque random string, SHA-256 hashed before storage. 7-day expiry. Stored in `refresh_tokens` table. |
| Token refresh | Client sends refresh token, server validates, rotates (issues new pair, revokes old). |
| Auth middleware | Hono middleware on all `/api/v1/*` routes (except `/auth/register`, `/auth/login`, `/auth/refresh`). Extracts user from `Authorization: Bearer <token>` header. |
| Profile | Authenticated user can read and update their own profile (display_name, avatar_url). |
| Logout | Revokes the refresh token so it cannot be reused. Access token remains valid until expiry (stateless). |
| Password reset | Deferred to Phase 5. Not implemented in Phase 1. |

## 4. Design Decisions

### 4.1 Stateless Access Tokens, Stateful Refresh Tokens

Access tokens are stateless JWTs -- the server never stores them and validates purely by signature + expiry. This keeps the hot path (every API request) fast with zero database lookups for auth.

Refresh tokens are stateful -- stored as hashed values in the `refresh_tokens` table. This enables revocation (logout, compromise detection) without maintaining a token blacklist for access tokens.

**Trade-off:** A revoked user retains access for up to 15 minutes (until the access token expires). This is acceptable for a retro board application where the threat model does not require instant revocation.

### 4.2 Refresh Token Rotation

Every time a refresh token is used, the old token is revoked and a new pair (access + refresh) is issued. If a previously-revoked refresh token is presented, all refresh tokens for that user are revoked (compromise detection).

### 4.3 bcrypt Cost Factor 12

Cost factor 12 provides ~250ms hashing time on modern hardware. This balances security against brute-force with acceptable registration/login latency.

### 4.4 jose for JWT

The `jose` library is standards-compliant, supports all JWS/JWE algorithms, and is actively maintained. We use HS256 (symmetric) signing because there is a single server -- no need for asymmetric keys.

### 4.5 No Session Table

We do not maintain a "sessions" table. The refresh token table serves this purpose. If we need "active sessions" UI in the future, we can query `refresh_tokens WHERE revoked_at IS NULL AND expires_at > NOW()`.

## 5. Architecture Layers

```
Request Flow:

  Client
    |
    | Authorization: Bearer <access_token>
    v
┌──────────────────────────────────────────────┐
│  Hono Middleware: authMiddleware              │
│  ┌─────────────────────────────────────────┐ │
│  │ 1. Extract token from Authorization hdr │ │
│  │ 2. Verify JWT signature + expiry (jose) │ │
│  │ 3. Set c.set('user', { id, email })     │ │
│  │ 4. Call next()                          │ │
│  └─────────────────────────────────────────┘ │
└──────────────────┬───────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────┐
│  Route Handler (e.g., GET /api/v1/auth/me)   │
│  const user = c.get('user')                  │
└──────────────────┬───────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────┐
│  Auth Service                                │
│  - register(email, password, display_name)   │
│  - login(email, password)                    │
│  - refreshTokens(refreshToken)               │
│  - getProfile(userId)                        │
│  - updateProfile(userId, data)               │
│  - logout(refreshToken)                      │
└──────────────────┬───────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────┐
│  Auth Repository                             │
│  - createUser(data)                          │
│  - findUserByEmail(email)                    │
│  - findUserById(id)                          │
│  - updateUser(id, data)                      │
│  - storeRefreshToken(userId, tokenHash, exp) │
│  - findRefreshToken(tokenHash)               │
│  - revokeRefreshToken(id)                    │
│  - revokeAllUserTokens(userId)               │
└──────────────────┬───────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────┐
│  PostgreSQL                                  │
│  Tables: users, refresh_tokens               │
└──────────────────────────────────────────────┘
```

## 6. File Structure

```
src/
  middleware/
    auth.ts              # authMiddleware - JWT verification, user extraction
  routes/
    auth.ts              # Hono router for /api/v1/auth/*
  services/
    auth.service.ts      # Business logic: register, login, refresh, profile
  repositories/
    auth.repository.ts   # SQL queries for users and refresh_tokens
  types/
    auth.ts              # TypeScript interfaces: User, TokenPayload, etc.
  utils/
    jwt.ts               # JWT sign/verify helpers using jose
    password.ts          # bcrypt hash/compare helpers
  db/
    migrations/
      001_create_users.sql
      002_create_refresh_tokens.sql
```

## 7. Login Flow

```
  Client                        Server                           PostgreSQL
    |                             |                                  |
    |  POST /api/v1/auth/login    |                                  |
    |  { email, password }        |                                  |
    |---------------------------->|                                  |
    |                             |  SELECT * FROM users             |
    |                             |  WHERE email = $1                |
    |                             |--------------------------------->|
    |                             |  user row (id, password_hash)    |
    |                             |<---------------------------------|
    |                             |                                  |
    |                             |  bcrypt.compare(password,        |
    |                             |    user.password_hash)           |
    |                             |  => true                        |
    |                             |                                  |
    |                             |  Generate access_token (JWT,     |
    |                             |    15min, sub=user.id)           |
    |                             |                                  |
    |                             |  Generate refresh_token          |
    |                             |    (random 64 bytes, hex)        |
    |                             |                                  |
    |                             |  SHA-256 hash refresh_token      |
    |                             |                                  |
    |                             |  INSERT INTO refresh_tokens      |
    |                             |  (user_id, token_hash,           |
    |                             |   expires_at)                    |
    |                             |--------------------------------->|
    |                             |  OK                              |
    |                             |<---------------------------------|
    |                             |                                  |
    |  200 OK                     |                                  |
    |  { access_token,            |                                  |
    |    refresh_token,           |                                  |
    |    expires_in: 900,         |                                  |
    |    user: { id, email,       |                                  |
    |      display_name } }       |                                  |
    |<----------------------------|                                  |
```

## 8. Token Refresh Flow

```
  Client                        Server                           PostgreSQL
    |                             |                                  |
    |  POST /api/v1/auth/refresh  |                                  |
    |  { refresh_token }          |                                  |
    |---------------------------->|                                  |
    |                             |  SHA-256 hash the token          |
    |                             |                                  |
    |                             |  SELECT * FROM refresh_tokens    |
    |                             |  WHERE token_hash = $1           |
    |                             |--------------------------------->|
    |                             |  token row                       |
    |                             |<---------------------------------|
    |                             |                                  |
    |                             |  Validate:                       |
    |                             |  - token exists                  |
    |                             |  - revoked_at IS NULL            |
    |                             |  - expires_at > NOW()            |
    |                             |                                  |
    |                             |  If token was already revoked:   |
    |                             |    REVOKE ALL tokens for user    |
    |                             |    (potential token theft)       |
    |                             |    Return 401                    |
    |                             |                                  |
    |                             |  If valid:                       |
    |                             |  UPDATE refresh_tokens           |
    |                             |  SET revoked_at = NOW()          |
    |                             |  WHERE id = $1                   |
    |                             |--------------------------------->|
    |                             |                                  |
    |                             |  Generate NEW access_token       |
    |                             |  Generate NEW refresh_token      |
    |                             |  Store NEW refresh_token hash    |
    |                             |--------------------------------->|
    |                             |                                  |
    |  200 OK                     |                                  |
    |  { access_token,            |                                  |
    |    refresh_token,           |                                  |
    |    expires_in: 900 }        |                                  |
    |<----------------------------|                                  |
```

## 9. Auth Middleware Flow

```
  Incoming Request
        |
        v
  ┌─────────────────────────────────┐
  │ Is path in PUBLIC_PATHS?        │
  │ (/auth/register, /auth/login,   │
  │  /auth/refresh)                 │
  └───────┬──────────────┬──────────┘
          │ YES           │ NO
          v               v
     next()         ┌─────────────────────┐
                    │ Extract Bearer token │
                    │ from Authorization   │
                    │ header               │
                    └───────┬─────────────┘
                            │
                    ┌───────┴─────────────┐
                    │ Token present?       │
                    └───┬──────────┬──────┘
                        │ NO       │ YES
                        v          v
                   401 error  ┌──────────────────┐
                              │ Verify JWT with   │
                              │ jose (signature   │
                              │ + expiry)         │
                              └───┬──────────┬───┘
                                  │ FAIL     │ OK
                                  v          v
                             401 error  ┌────────────────┐
                                        │ Set user on    │
                                        │ Hono context:  │
                                        │ c.set('user',  │
                                        │  { id, email })│
                                        │ Call next()    │
                                        └────────────────┘
```

## 10. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Password brute force | bcrypt cost 12 makes each attempt ~250ms |
| Token theft (access) | 15-minute expiry limits window of exposure |
| Token theft (refresh) | Rotation detects reuse; all tokens revoked on reuse of revoked token |
| Token storage (server) | Refresh tokens stored as SHA-256 hashes, not plaintext |
| Token storage (client) | Client stores tokens in memory or httpOnly cookie (implementation choice for frontend) |
| JWT secret compromise | Single env var `JWT_SECRET`. Must be rotated via deployment. All tokens invalidated on rotation. |
| SQL injection | `postgres` driver uses tagged template literals -- parameterized by design |
| Timing attacks | bcrypt.compare is constant-time. JWT verification via jose is constant-time. |

## 11. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| JWT_SECRET | Yes | HMAC key for HS256 JWT signing. Minimum 32 characters. |
| JWT_ACCESS_EXPIRY | No | Access token lifetime (default: `15m`) |
| JWT_REFRESH_EXPIRY | No | Refresh token lifetime (default: `7d`) |
| BCRYPT_ROUNDS | No | bcrypt cost factor (default: `12`) |

## 12. Error Handling

All auth errors return standard JSON:

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

Error codes:
- `AUTH_INVALID_CREDENTIALS` -- wrong email or password (login)
- `AUTH_EMAIL_EXISTS` -- email already registered (register)
- `AUTH_TOKEN_EXPIRED` -- access token expired
- `AUTH_TOKEN_INVALID` -- malformed or tampered token
- `AUTH_REFRESH_TOKEN_INVALID` -- refresh token not found or revoked
- `AUTH_REFRESH_TOKEN_EXPIRED` -- refresh token past expiry
- `AUTH_UNAUTHORIZED` -- no token provided
- `VALIDATION_ERROR` -- request body fails validation

## 13. Future Considerations (Not in Phase 1)

- **Password reset flow** (Phase 5): Generate reset token, store hash, email link, reset endpoint.
- **OAuth providers**: Google/GitHub login. Would add an `oauth_accounts` table linking external IDs to users.
- **Rate limiting**: Limit login attempts per IP/email. Can be done with a PostgreSQL counter table.
- **Multi-device sessions**: UI to view and revoke active sessions (query refresh_tokens table).
