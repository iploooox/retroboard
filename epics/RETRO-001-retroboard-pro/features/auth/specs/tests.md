# Auth Test Plan

**Feature:** auth
**Test framework:** Vitest + Supertest
**Test database:** Dedicated test PostgreSQL database, reset between test suites

---

## 1. Test Structure

```
tests/
  unit/
    auth/
      password.test.ts      # bcrypt hash/compare
      jwt.test.ts            # JWT sign/verify
      validation.test.ts     # Input validation rules
  integration/
    auth/
      register.test.ts       # POST /api/v1/auth/register
      login.test.ts          # POST /api/v1/auth/login
      refresh.test.ts        # POST /api/v1/auth/refresh
      profile.test.ts        # GET/PUT /api/v1/auth/me
      logout.test.ts         # POST /api/v1/auth/logout
      middleware.test.ts      # Auth middleware behavior
```

---

## 2. Unit Tests

### 2.1 Password Hashing (`password.test.ts`)

| # | Test case | Input | Expected |
|---|-----------|-------|----------|
| U-PW-01 | Hash produces bcrypt string | `"testpassword"` | Result matches `$2a$12$` prefix, length 60 |
| U-PW-02 | Hash is non-deterministic | Hash same password twice | Two different hash strings |
| U-PW-03 | Compare returns true for correct password | password + its hash | `true` |
| U-PW-04 | Compare returns false for wrong password | `"wrong"` + hash of `"correct"` | `false` |
| U-PW-05 | Hash uses cost factor 12 | Any password | Hash contains `$2a$12$` |
| U-PW-06 | Hash handles empty string gracefully | `""` | Throws validation error or produces hash (depending on design -- we reject at validation layer) |
| U-PW-07 | Hash handles max-length password (128 chars) | 128-char string | Produces valid hash |

### 2.2 JWT Creation and Verification (`jwt.test.ts`)

| # | Test case | Input | Expected |
|---|-----------|-------|----------|
| U-JWT-01 | Sign creates valid JWT string | `{ sub: "user-id", email: "test@example.com" }` | String with 3 dot-separated base64url parts |
| U-JWT-02 | Verify returns payload for valid token | Signed token + correct secret | Payload with `sub`, `email`, `iat`, `exp` |
| U-JWT-03 | Verify rejects expired token | Token with `exp` in the past | Throws `AUTH_TOKEN_EXPIRED` error |
| U-JWT-04 | Verify rejects wrong secret | Token signed with secret A, verified with secret B | Throws `AUTH_TOKEN_INVALID` error |
| U-JWT-05 | Verify rejects malformed token | `"not-a-jwt"` | Throws `AUTH_TOKEN_INVALID` error |
| U-JWT-06 | Verify rejects tampered payload | Modify base64 payload in valid token | Throws `AUTH_TOKEN_INVALID` error |
| U-JWT-07 | Token contains correct expiry | Sign with 15-minute expiry | `exp - iat === 900` |
| U-JWT-08 | Token contains correct claims | User data | `sub` equals user ID, `email` equals user email |
| U-JWT-09 | Verify rejects token with no exp claim | Manually crafted token | Throws error |
| U-JWT-10 | Verify handles token at exact expiry boundary | Token where `exp === now` | Rejects (expired) |

### 2.3 Input Validation (`validation.test.ts`)

| # | Test case | Input | Expected |
|---|-----------|-------|----------|
| U-VAL-01 | Valid registration data passes | `{ email: "a@b.com", password: "Pass1234", display_name: "Bob" }` | No errors |
| U-VAL-02 | Rejects missing email | `{ password: "Pass1234", display_name: "Bob" }` | Error on `email` |
| U-VAL-03 | Rejects invalid email format | `{ email: "not-email" }` | Error on `email` |
| U-VAL-04 | Rejects email over 255 chars | 256-char email | Error on `email` |
| U-VAL-05 | Rejects password under 8 chars | `"Short1"` | Error on `password` |
| U-VAL-06 | Rejects password over 128 chars | 129-char password | Error on `password` |
| U-VAL-07 | Rejects password without uppercase | `"alllowercase1"` | Error on `password` |
| U-VAL-08 | Rejects password without lowercase | `"ALLUPPERCASE1"` | Error on `password` |
| U-VAL-09 | Rejects password without digit | `"NoDigitsHere"` | Error on `password` |
| U-VAL-10 | Rejects empty display_name | `""` | Error on `display_name` |
| U-VAL-11 | Rejects display_name over 100 chars | 101-char string | Error on `display_name` |
| U-VAL-12 | Trims display_name whitespace | `"  Bob  "` | Stored as `"Bob"` |
| U-VAL-13 | Normalizes email to lowercase | `"Alice@Example.COM"` | Stored as `"alice@example.com"` |
| U-VAL-14 | Valid avatar_url passes | `"https://example.com/avatar.png"` | No errors |
| U-VAL-15 | Rejects invalid avatar_url | `"not a url"` | Error on `avatar_url` |
| U-VAL-16 | Accepts null avatar_url (clear) | `null` | No errors |
| U-VAL-17 | Rejects avatar_url over 500 chars | 501-char URL | Error on `avatar_url` |

---

## 3. Integration Tests

### 3.1 Registration (`register.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-REG-01 | Successful registration | Empty DB | POST register with valid data | 201, user object returned, access_token and refresh_token present |
| I-REG-02 | Returns valid JWT | Empty DB | POST register, decode access_token | Token has correct `sub`, `email`, `exp` |
| I-REG-03 | Password is hashed in DB | Register user | Query users table directly | `password_hash` starts with `$2a$12$`, is not the raw password |
| I-REG-04 | Refresh token stored hashed | Register user | Query refresh_tokens table | Row exists, `token_hash` is 64-char hex, not the raw token |
| I-REG-05 | Duplicate email returns 409 | Register `alice@example.com` | Register `alice@example.com` again | 409, `AUTH_EMAIL_EXISTS` |
| I-REG-06 | Case-insensitive email duplicate | Register `Alice@Example.com` | Register `alice@example.com` | 409, `AUTH_EMAIL_EXISTS` |
| I-REG-07 | Invalid body returns 400 | -- | POST register with missing fields | 400, `VALIDATION_ERROR` with details |
| I-REG-08 | Empty body returns 400 | -- | POST register with `{}` | 400, `VALIDATION_ERROR` |
| I-REG-09 | Email stored lowercase | -- | Register with `Bob@EXAMPLE.com` | DB row has `bob@example.com` |
| I-REG-10 | Returned user has no password_hash | Register | Check response body | No `password_hash` field anywhere |

### 3.2 Login (`login.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-LOG-01 | Successful login | Registered user | POST login with correct credentials | 200, tokens returned |
| I-LOG-02 | Wrong password returns 401 | Registered user | POST login with wrong password | 401, `AUTH_INVALID_CREDENTIALS` |
| I-LOG-03 | Non-existent email returns 401 | Empty DB | POST login with unknown email | 401, `AUTH_INVALID_CREDENTIALS` |
| I-LOG-04 | Same error for wrong email and wrong password | -- | Compare error responses | Identical code and message |
| I-LOG-05 | Login returns user profile | Registered user | POST login | Response includes user object with id, email, display_name |
| I-LOG-06 | Each login creates new refresh token | Registered user | Login twice | Two rows in refresh_tokens for the user |
| I-LOG-07 | Invalid body returns 400 | -- | POST login with `{}` | 400, `VALIDATION_ERROR` |
| I-LOG-08 | Case-insensitive email | Register with `alice@example.com` | Login with `Alice@Example.com` | 200, success |

### 3.3 Token Refresh (`refresh.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-REF-01 | Successful refresh | Login, get refresh_token | POST refresh | 200, new token pair returned |
| I-REF-02 | Old refresh token is revoked after use | Refresh successfully | Check DB for old token | `revoked_at` is set |
| I-REF-03 | New refresh token is stored | Refresh successfully | Check DB | New refresh_tokens row exists |
| I-REF-04 | New access token is valid | Refresh successfully | Use new access_token on GET /me | 200, user profile returned |
| I-REF-05 | Old refresh token cannot be reused | Refresh once | Refresh again with the SAME old token | 401, `AUTH_REFRESH_TOKEN_INVALID` |
| I-REF-06 | Reuse of revoked token revokes ALL user tokens | Refresh once (rotates), then reuse old | Check DB | All refresh_tokens for user have revoked_at set |
| I-REF-07 | Expired refresh token returns 401 | Create token with past expiry (in DB directly) | POST refresh | 401, `AUTH_REFRESH_TOKEN_EXPIRED` |
| I-REF-08 | Unknown refresh token returns 401 | -- | POST refresh with random string | 401, `AUTH_REFRESH_TOKEN_INVALID` |
| I-REF-09 | Missing refresh_token field returns 400 | -- | POST refresh with `{}` | 400, `VALIDATION_ERROR` |
| I-REF-10 | New tokens have correct expiry | Refresh | Decode new access_token | `exp - iat === 900` |

### 3.4 Profile (`profile.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-PRF-01 | Get own profile | Authenticated user | GET /api/v1/auth/me | 200, user object with all fields |
| I-PRF-02 | Profile excludes password_hash | Authenticated user | GET /me | No `password_hash` in response |
| I-PRF-03 | Update display_name | Authenticated user | PUT /me `{ display_name: "New Name" }` | 200, updated user returned |
| I-PRF-04 | Update avatar_url | Authenticated user | PUT /me `{ avatar_url: "https://..." }` | 200, updated user returned |
| I-PRF-05 | Clear avatar_url | User with avatar | PUT /me `{ avatar_url: null }` | 200, avatar_url is null |
| I-PRF-06 | Update both fields | Authenticated user | PUT /me with both fields | 200, both updated |
| I-PRF-07 | Empty update body returns 400 | Authenticated user | PUT /me with `{}` | 400, `VALIDATION_ERROR` |
| I-PRF-08 | Cannot change email via PUT /me | Authenticated user | PUT /me `{ email: "new@example.com" }` | email is unchanged (field ignored) |
| I-PRF-09 | Cannot change password via PUT /me | Authenticated user | PUT /me `{ password: "newpass" }` | password_hash unchanged (field ignored) |
| I-PRF-10 | updated_at changes on update | Authenticated user | PUT /me with valid data | `updated_at` is later than `created_at` |
| I-PRF-11 | Unauthenticated GET /me returns 401 | -- | GET /me without Authorization header | 401, `AUTH_UNAUTHORIZED` |

### 3.5 Logout (`logout.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-OUT-01 | Successful logout | Login, get tokens | POST logout with refresh_token | 200, success message |
| I-OUT-02 | Refresh token is revoked after logout | Logout | Check DB | `revoked_at` is set |
| I-OUT-03 | Revoked token cannot be used to refresh | Logout | POST refresh with same token | 401, `AUTH_REFRESH_TOKEN_INVALID` |
| I-OUT-04 | Access token still works after logout | Logout | GET /me with access_token | 200 (stateless -- access token valid until expiry) |
| I-OUT-05 | Idempotent: double logout returns 200 | Logout once | Logout again with same token | 200 |
| I-OUT-06 | Unauthenticated logout returns 401 | -- | POST logout without Authorization | 401 |
| I-OUT-07 | Cannot logout another user's token | Login as user A and user B | User A sends logout with user B's refresh_token | 200 (but token not revoked -- user_id mismatch means no-op) |

### 3.6 Auth Middleware (`middleware.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-MW-01 | Valid token passes middleware | Login, get access_token | GET /me with valid token | 200 |
| I-MW-02 | Missing Authorization header | -- | GET /me without header | 401, `AUTH_UNAUTHORIZED` |
| I-MW-03 | Malformed Authorization header | -- | GET /me with `Authorization: NotBearer xyz` | 401, `AUTH_UNAUTHORIZED` |
| I-MW-04 | Empty Bearer token | -- | GET /me with `Authorization: Bearer ` | 401, `AUTH_TOKEN_INVALID` |
| I-MW-05 | Expired access token | Wait/mock expiry | GET /me with expired token | 401, `AUTH_TOKEN_EXPIRED` |
| I-MW-06 | Token signed with wrong secret | Sign token with different secret | GET /me with that token | 401, `AUTH_TOKEN_INVALID` |
| I-MW-07 | Tampered token payload | Modify base64 payload | GET /me | 401, `AUTH_TOKEN_INVALID` |
| I-MW-08 | Public routes skip middleware | -- | POST /auth/login without token | Not 401 (proceeds to handler) |
| I-MW-09 | Public routes: register | -- | POST /auth/register without token | Not 401 |
| I-MW-10 | Public routes: refresh | -- | POST /auth/refresh without token | Not 401 |

---

## 4. Edge Cases and Security Tests

| # | Test case | Description | Expected |
|---|-----------|-------------|----------|
| E-SEC-01 | SQL injection in email field | Register with `'; DROP TABLE users; --` as email | 400 (validation rejects) or safe query (tagged templates prevent injection) |
| E-SEC-02 | Very long password (128 chars) | Register with exactly 128-char password | 201, succeeds |
| E-SEC-03 | Password of 129 chars | Register with 129-char password | 400, validation error |
| E-SEC-04 | Unicode in display_name | Register with `"Alicja Zolkiewska"` | 201, stored correctly |
| E-SEC-05 | Unicode in email | Register with IDN email | 400, validation rejects (only ASCII emails accepted) |
| E-SEC-06 | Concurrent registration with same email | Two simultaneous register requests | One gets 201, the other gets 409 (UNIQUE constraint) |
| E-SEC-07 | Refresh token is cryptographically random | Generate 100 tokens | All unique, 128 hex chars each |
| E-SEC-08 | JWT secret from environment | Check token verification | Uses `JWT_SECRET` env var, not hardcoded |
| E-SEC-09 | Response timing for wrong email vs wrong password | Time both error paths | Similar timing (bcrypt compare on dummy hash for non-existent user) |
| E-SEC-10 | XSS in display_name | Register with `<script>alert('xss')</script>` | Stored as-is (API returns JSON, XSS is frontend concern). No HTML escaping in API. |

---

## 5. Test Utilities

### Test Helper: createTestUser

```typescript
async function createTestUser(overrides?: Partial<RegisterInput>): Promise<{
  user: UserResponse;
  access_token: string;
  refresh_token: string;
}> {
  const data = {
    email: `test-${randomUUID()}@example.com`,
    password: 'TestPass123',
    display_name: 'Test User',
    ...overrides,
  };
  const res = await request(app).post('/api/v1/auth/register').send(data);
  return res.body;
}
```

### Test Helper: authenticatedRequest

```typescript
function authenticatedRequest(token: string) {
  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  };
}
```

### Database Reset

Between each test suite, truncate `refresh_tokens` and `users` (in that order due to FK constraint). Use `TRUNCATE ... CASCADE`.

```typescript
beforeEach(async () => {
  await sql`TRUNCATE refresh_tokens, users CASCADE`;
});
```

---

## 6. Test Coverage Targets

| Category | Target |
|----------|--------|
| Unit tests | 100% of password, JWT, and validation utility functions |
| Integration tests | 100% of API endpoints, all success and error paths |
| Line coverage | > 90% across auth feature files |
| Branch coverage | > 85% across auth feature files |
