# Auth API Specification

**Feature:** auth
**Base path:** `/api/v1/auth`
**Authentication:** Endpoints marked with a lock icon require a valid access token in the `Authorization: Bearer <token>` header.
**changed:** 2026-02-14 — Spec Review Gate

---

## Table of Contents

1. [POST /api/v1/auth/register](#1-post-apiv1authregister)
2. [POST /api/v1/auth/login](#2-post-apiv1authlogin)
3. [POST /api/v1/auth/refresh](#3-post-apiv1authrefresh)
4. [GET /api/v1/auth/me](#4-get-apiv1authme)
5. [PUT /api/v1/auth/me](#5-put-apiv1authme)
6. [POST /api/v1/auth/logout](#6-post-apiv1authlogout)
7. [POST /api/v1/auth/revoke-all](#7-post-apiv1authrevoke-all)
8. [Rate Limiting](#8-rate-limiting)
9. [Common Error Responses](#9-common-error-responses)
10. [Data Types](#10-data-types)

---

## 1. POST /api/v1/auth/register

Register a new user account.

**Authentication:** None (public)

### Request

```
POST /api/v1/auth/register
Content-Type: application/json
```

```json
{
  "email": "alice@example.com",
  "password": "s3cureP@ssw0rd!",
  "display_name": "Alice Johnson"
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| email | string | Yes | Valid email format (RFC 5322 simplified). Max 255 characters. Case-insensitive (stored lowercase). |
| password | string | Yes | Min 8 characters. Max 128 characters. Must contain at least one uppercase letter, one lowercase letter, and one digit. |
| display_name | string | Yes | Min 2 characters. Max 50 characters. Trimmed of leading/trailing whitespace. |

### Response: 201 Created

```json
{
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "alice@example.com",
    "display_name": "Alice Johnson",
    "avatar_url": null,
    "created_at": "2026-02-14T10:30:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "a3f8b2c1d4e5f6789012345678901234567890abcdef1234567890abcdef12345",
  "expires_in": 900
}
```

| Field | Type | Description |
|-------|------|-------------|
| user | object | The created user profile |
| access_token | string | JWT access token (15min expiry) |
| refresh_token | string | Opaque refresh token (7d expiry) |
| expires_in | number | Access token TTL in seconds (900 = 15 minutes) |

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing or invalid fields |
| 409 | `AUTH_EMAIL_EXISTS` | Email already registered |

**400 Example:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "password", "message": "Must be at least 8 characters" },
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

**409 Example:**

```json
{
  "error": {
    "code": "AUTH_EMAIL_EXISTS",
    "message": "A user with this email already exists"
  }
}
```

---

## 2. POST /api/v1/auth/login

Authenticate with email and password.

**Authentication:** None (public)

### Request

```
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "alice@example.com",
  "password": "s3cureP@ssw0rd!"
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| email | string | Yes | Valid email format. Max 255 characters. |
| password | string | Yes | Non-empty string. Max 128 characters. |

### Response: 200 OK

```json
{
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "alice@example.com",
    "display_name": "Alice Johnson",
    "avatar_url": "https://example.com/avatars/alice.jpg",
    "created_at": "2026-02-14T10:30:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "b4f9c3d2e5f6780123456789012345678901abcdef2345678901abcdef234567",
  "expires_in": 900
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing or invalid fields |
| 401 | `AUTH_INVALID_CREDENTIALS` | Email not found or password does not match |

**401 Example:**

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

**Important:** The error message must be identical whether the email does not exist or the password is wrong. This prevents user enumeration.

---

## 3. POST /api/v1/auth/refresh

Exchange a valid refresh token for a new access token and refresh token pair.

**Authentication:** None (public -- uses refresh token in body)

### Request

```
POST /api/v1/auth/refresh
Content-Type: application/json
```

```json
{
  "refresh_token": "a3f8b2c1d4e5f6789012345678901234567890abcdef1234567890abcdef12345"
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| refresh_token | string | Yes | Non-empty string. |

### Response: 200 OK

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "c5g0d4e3f6g7891234567890123456789012bcdefg3456789012bcdefg345678",
  "expires_in": 900
}
```

### Token Rotation Behavior

1. The server hashes the incoming refresh token with SHA-256.
2. Looks up the hash in `refresh_tokens`.
3. If the token is **not found**: return 401.
4. If the token is found but **already revoked** (`revoked_at IS NOT NULL`): this indicates potential token theft. Revoke ALL refresh tokens for the user. Return 401.
5. If the token is found but **expired** (`expires_at < NOW()`): return 401.
6. If the token is **valid**: revoke it (set `revoked_at = NOW()`), generate a new token pair, store the new refresh token hash, and return the new pair.

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing refresh_token field |
| 401 | `AUTH_REFRESH_TOKEN_INVALID` | Token not found or already revoked (theft detected) |
| 401 | `AUTH_REFRESH_TOKEN_EXPIRED` | Token is past its expiry |

**401 Example:**

```json
{
  "error": {
    "code": "AUTH_REFRESH_TOKEN_INVALID",
    "message": "Refresh token is invalid or has been revoked"
  }
}
```

---

## 4. GET /api/v1/auth/me

Get the authenticated user's profile.

**Authentication:** Required

### Request

```
GET /api/v1/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response: 200 OK

```json
{
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "alice@example.com",
    "display_name": "Alice Johnson",
    "avatar_url": "https://example.com/avatars/alice.jpg",
    "created_at": "2026-02-14T10:30:00.000Z",
    "updated_at": "2026-02-14T12:00:00.000Z"
  }
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_UNAUTHORIZED` | No token provided |
| 401 | `AUTH_TOKEN_INVALID` | Token is malformed or signature invalid |
| 401 | `AUTH_TOKEN_EXPIRED` | Token has expired |

---

## 5. PUT /api/v1/auth/me

Update the authenticated user's profile.

**Authentication:** Required

### Request

```
PUT /api/v1/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

```json
{
  "display_name": "Alice J.",
  "avatar_url": "https://example.com/avatars/alice-new.jpg"
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| display_name | string | No | Min 2 characters. Max 50 characters. Trimmed. |
| avatar_url | string \| null | No | Valid URL format, must use `https://` protocol. Reject `javascript:`, `data:`, `vbscript:` schemes. Or `null` to clear. Max 500 characters. |

At least one field must be provided. Unknown fields are ignored.

### Response: 200 OK

```json
{
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "alice@example.com",
    "display_name": "Alice J.",
    "avatar_url": "https://example.com/avatars/alice-new.jpg",
    "created_at": "2026-02-14T10:30:00.000Z",
    "updated_at": "2026-02-14T14:00:00.000Z"
  }
}
```

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | No valid fields provided, or field values invalid |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |

---

## 6. POST /api/v1/auth/logout

Revoke the current refresh token. The access token remains valid until it naturally expires (stateless).

**Authentication:** Required

### Request

```
POST /api/v1/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

```json
{
  "refresh_token": "a3f8b2c1d4e5f6789012345678901234567890abcdef1234567890abcdef12345"
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| refresh_token | string | Yes | Non-empty string. |

### Response: 200 OK

```json
{
  "message": "Logged out successfully"
}
```

### Behavior

1. Hash the provided refresh token.
2. Find it in `refresh_tokens` where `user_id` matches the authenticated user.
3. Set `revoked_at = NOW()`.
4. If the token is not found or already revoked, still return 200 (idempotent).

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing refresh_token field |
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |

---

## 7. POST /api/v1/auth/revoke-all

Revoke all refresh tokens for the authenticated user. This effectively logs out all sessions.

**Authentication:** Required

### Request

```
POST /api/v1/auth/revoke-all
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

No request body required.

### Response: 200 OK

```json
{
  "message": "All sessions revoked"
}
```

### Behavior

1. Revoke all refresh tokens for the authenticated user (`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`).
2. The current access token remains valid until it naturally expires (stateless).

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_UNAUTHORIZED` | Not authenticated |

---

## 8. Rate Limiting

Auth endpoints are rate limited to prevent brute-force and abuse. Rate limits are enforced using a PostgreSQL-backed sliding window counter (see `rate_limits` table in database spec).

### Limits

| Endpoint | Key | Limit | Window |
|----------|-----|-------|--------|
| POST /api/v1/auth/login | `login:email:{email}` | 5 requests | 15 minutes |
| POST /api/v1/auth/login | `login:ip:{ip}` | 30 requests | 1 minute |
| POST /api/v1/auth/register | `register:ip:{ip}` | 10 requests | 1 hour |
| POST /api/v1/auth/refresh | `refresh:user:{userId}` | 30 requests | 1 minute |

### Response: 429 Too Many Requests

When a rate limit is exceeded, the server returns:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  }
}
```

The response includes a `Retry-After` header with the number of seconds until the rate limit window resets.

---

## 9. Common Error Responses

All error responses follow this shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": []
  }
}
```

The `details` array is only present for `VALIDATION_ERROR` responses. Each entry contains:

```json
{
  "field": "email",
  "message": "Invalid email format"
}
```

### Global Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request body or params fail validation |
| 401 | `AUTH_UNAUTHORIZED` | No Authorization header present |
| 401 | `AUTH_TOKEN_INVALID` | JWT signature verification failed |
| 401 | `AUTH_TOKEN_EXPIRED` | JWT `exp` claim is in the past |
| 401 | `AUTH_INVALID_CREDENTIALS` | Email/password mismatch |
| 401 | `AUTH_REFRESH_TOKEN_INVALID` | Refresh token not found or revoked |
| 401 | `AUTH_REFRESH_TOKEN_EXPIRED` | Refresh token past expiry |
| 409 | `AUTH_EMAIL_EXISTS` | Registration with existing email |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests for this endpoint |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## 10. Data Types

### User Object

Returned in responses. Never includes `password_hash`.

```typescript
interface UserResponse {
  id: string;           // UUID v4
  email: string;        // lowercase
  display_name: string;
  avatar_url: string | null;
  created_at: string;   // ISO 8601
  updated_at: string;   // ISO 8601
}
```

### Token Pair

Returned on register, login, and refresh.

```typescript
interface TokenPair {
  access_token: string;   // JWT (HS256)
  refresh_token: string;  // opaque hex string (64 bytes = 128 hex chars)
  expires_in: number;     // seconds until access_token expires (900)
}
```

### JWT Access Token Payload

```typescript
interface JwtPayload {
  sub: string;    // user ID (UUID)
  email: string;  // user email
  iat: number;    // issued at (Unix timestamp)
  exp: number;    // expires at (Unix timestamp)
}
```

### Auth Context (set by middleware)

Available in all authenticated route handlers via `c.get('user')`.

```typescript
interface AuthUser {
  id: string;     // from JWT sub
  email: string;  // from JWT email
}
```
