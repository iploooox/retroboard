# Security Code Review — Phase 1 Implementation

**Reviewer:** Security Researcher (Agent)
**Date:** 2026-02-15
**Scope:** Auth, Teams, Sprints, Templates — all implementation code under `services/retroboard-server/src/`
**Methodology:** OWASP Top 10 (2021) + cross-reference against spec security review findings

---

## Executive Summary

The Phase 1 implementation is **significantly more secure than the original specs**. The development team addressed **12 of 13 actionable findings** from the spec security review (S-01 through S-13). Rate limiting, atomic invite joins, CORS, security headers, JWT algorithm pinning, timing-attack mitigation, body size limits, avatar_url protocol restrictions, JWT_SECRET validation, revoke-all endpoint, and invite revocation are all implemented.

However, the code review identified **5 new or residual vulnerabilities**, ranging from a bypassable body size limit to a missing authorization check on templates. None require architectural redesign — all are targeted fixes.

**Overall posture: Strong implementation with targeted gaps to close.**

---

## Spec Review Cross-Reference

Status of each finding from the spec security review (`security-review.md`):

| # | Severity | Finding | Status | Notes |
|---|----------|---------|--------|-------|
| S-01 | CRITICAL | No rate limiting on auth endpoints | **FIXED** | IP-based (login 30/min, register 10/hr) + per-email (5/15min) + refresh per-user (30/min). PostgreSQL-backed via `rate_limits` table. |
| S-02 | HIGH | Invite join race condition | **FIXED** | `atomicJoin()` uses `UPDATE ... WHERE (max_uses IS NULL OR use_count < max_uses) RETURNING ...` — exactly as recommended. |
| S-03 | HIGH | No CORS configuration | **FIXED** | `server.ts:12-21` — restricted origins, explicit headers/methods, `credentials: true`. Production set to `[]` (no origins) — needs configuration before deploy but is fail-secure. |
| S-04 | HIGH | No HTTPS / HSTS | **PARTIAL** | Security headers present (CSP, X-Frame-Options, etc.) but **HSTS header missing**. See finding CR-04 below. |
| S-05 | HIGH | No revoke-all sessions | **FIXED** | `POST /revoke-all` at `routes/auth.ts:272-276`. |
| S-06 | MEDIUM | avatar_url protocol restriction | **PARTIAL** | Fixed in user profile (`validation/auth.ts:43-50`). **Missing in team schemas.** See finding CR-03 below. |
| S-07 | MEDIUM | Login timing attack | **FIXED** | `DUMMY_HASH` + constant-time compare at `routes/auth.ts:13-14,148`. |
| S-08 | MEDIUM | JWT algorithm pinning | **FIXED** | `jwt.ts:42-43` — `algorithms: ['HS256']` in verification. |
| S-09 | MEDIUM | Template IDOR | **NOT FIXED** | `template.repository.ts:57-59` — no team membership check. See finding CR-02 below. |
| S-10 | MEDIUM | Request body size limits | **PARTIAL** | Header-based check only. See finding CR-01 below. |
| S-11 | MEDIUM | Security headers | **FIXED** | `server.ts:27-33` — `nosniff`, `DENY`, `strict-origin-when-cross-origin`, CSP. |
| S-12 | MEDIUM | JWT_SECRET length validation | **FIXED** | `config/env.ts:5` — `z.string().min(32, ...)` with `process.exit(1)` on failure. |
| S-13 | MEDIUM | Invite revocation | **FIXED** | `DELETE /api/v1/teams/:id/invitations/:inviteId` at `teams.ts:327-335`. |

**Score: 10 fully fixed, 3 partially fixed, 0 regressed.**

---

## Vulnerability Findings

### Critical

None. All original critical findings have been properly addressed.

### High

#### CR-01: Body Size Limit is Bypassable — Header-Only Check (Confidence: 90)

**File:** `src/server.ts:36-42`
**OWASP:** A05:2021 Security Misconfiguration

```typescript
app.use('/api/*', async (c, next) => {
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
    return c.json(formatErrorResponse('PAYLOAD_TOO_LARGE', 'Request body too large'), 413);
  }
  await next();
});
```

**Problem:** This only checks the `Content-Length` HTTP header value. It does not measure actual bytes read. An attacker can bypass it in two ways:
1. **Omit Content-Length entirely** — HTTP/1.1 chunked transfer encoding sends no `Content-Length`. The check passes (`contentLength` is undefined), and `c.req.json()` in route handlers will buffer the full body into memory.
2. **Lie about Content-Length** — Send `Content-Length: 100` with a 100MB body. The header check passes, and the full body is still read.

Either bypass allows memory exhaustion via large request bodies across concurrent connections.

**Fix:** Replace with Hono's built-in `bodyLimit` middleware which monitors the actual byte stream:
```typescript
import { bodyLimit } from 'hono/body-limit';

app.use('/api/*', bodyLimit({
  maxSize: 1_048_576, // 1MB
  onError: (c) => c.json(formatErrorResponse('PAYLOAD_TOO_LARGE', 'Request body too large'), 413),
}));
```

---

#### CR-02: Template IDOR — Custom Templates Accessible Across Teams (Confidence: 85)

**Files:** `src/routes/templates.ts:18-33`, `src/repositories/template.repository.ts:57-59`
**OWASP:** A01:2021 Broken Access Control
**Spec ref:** S-09 (not addressed)

```typescript
// template.repository.ts:57-59
const [template] = await sql`
  SELECT * FROM templates WHERE id = ${id}
`;
```

**Problem:** `GET /api/v1/templates/:id` performs no team membership check. Any authenticated user who knows (or guesses) a custom template UUID can view templates belonging to teams they are not a member of. The database schema supports custom templates (`is_system = false`, `team_id IS NOT NULL`), and the code path has no guard.

Currently only system templates exist (seeded), but the query returns custom templates identically. If/when custom templates are created (Phase 2+), this becomes an immediate data leak.

**Fix:** Add a team membership check in the repository or route handler:
```typescript
// In template.repository.ts findById:
export async function findById(id: string, userId?: string): Promise<TemplateDetail | null> {
  const [template] = await sql`
    SELECT * FROM templates
    WHERE id = ${id}
      AND (is_system = true OR team_id IN (
        SELECT team_id FROM team_members WHERE user_id = ${userId}
      ))
  `;
  // ...
}
```

---

#### CR-03: Team `avatar_url` Missing Protocol Restriction (Confidence: 85)

**Files:** `src/validation/teams.ts:17-21` (create), `src/validation/teams.ts:39-42` (update)
**OWASP:** A03:2021 Injection (XSS)
**Spec ref:** S-06 (partially addressed — fixed in auth, missing in teams)

```typescript
// validation/teams.ts — createTeamSchema
avatar_url: z
  .string()
  .url('Must be a valid URL')       // <-- allows any protocol
  .max(500, '...')
  .nullable()
  .optional()
  .default(null),
```

**Problem:** User profile `avatar_url` validation (`validation/auth.ts:43-50`) correctly enforces `https://` and blocks `javascript:`, `data:`, `vbscript:`. But team `avatar_url` in both `createTeamSchema` and `updateTeamSchema` only validates `.url()` — accepting any protocol.

Zod's `.url()` uses the `URL` constructor, which accepts `javascript:alert(1)` and `data:text/html,...` as valid URLs. If the frontend renders a team avatar in a non-`<img>` context (e.g., `<a href>`, CSS `background-image`, or a link preview), this is an XSS vector.

**Fix:** Apply the same restriction as user profile validation:
```typescript
avatar_url: z
  .string()
  .url('Must be a valid URL')
  .max(500, '...')
  .refine((url) => url.startsWith('https://'), 'Must use https:// protocol')
  .refine(
    (url) => !url.startsWith('javascript:') && !url.startsWith('data:') && !url.startsWith('vbscript:'),
    'Unsafe URL protocol',
  )
  .nullable()
  .optional()
  .default(null),
```

---

#### CR-04: Missing HSTS Header (Confidence: 85)

**File:** `src/server.ts:27-33`
**OWASP:** A05:2021 Security Misconfiguration
**Spec ref:** S-04 (partially addressed)

```typescript
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Content-Security-Policy', "default-src 'self'");
  // Missing: Strict-Transport-Security
});
```

**Problem:** The spec review (S-04) explicitly recommended `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Without HSTS, a user's first visit (or any visit over an insecure network) can be intercepted by a man-in-the-middle attacker who downgrades the connection to HTTP, exposing JWT tokens in `Authorization` headers.

**Fix:** Add HSTS in the security headers middleware (conditionally for production):
```typescript
if (env.NODE_ENV === 'production') {
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}
```

---

### Important

#### CR-05: Refresh Endpoint Lacks IP-Based Rate Limiting for Invalid Tokens (Confidence: 80)

**File:** `src/routes/auth.ts:164-216`
**OWASP:** A07:2021 Identification & Auth Failures

**Problem:** The `/refresh` endpoint has per-user rate limiting (line 194-201: `refresh:user:${storedToken.user_id}`, 30/min), but this only activates **after** a valid token is found in the database. The execution flow for an invalid token is:

1. Parse body and hash token (fast)
2. Database lookup: `SELECT * FROM refresh_tokens WHERE token_hash = ...` (DB hit)
3. Token not found → return 401 immediately

No rate limiting is ever checked for invalid tokens. An attacker can flood the endpoint with random tokens, each causing a database query. While each individual query is fast (indexed), sustained high-volume requests can degrade database performance.

The login endpoint has both IP-based (line 75-82) and email-based rate limiting that triggers regardless of validity. The refresh endpoint should have analogous IP-based protection.

**Fix:** Add IP-based rate limiting to the refresh endpoint:
```typescript
const refreshIpRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (c) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1';
    return `refresh:ip:${ip}`;
  },
});

authRouter.post('/refresh', refreshIpRateLimit, async (c) => {
  // ... existing handler
});
```

---

## Positive Security Observations

The implementation demonstrates strong security practices in many areas:

1. **Parameterized SQL everywhere** — All queries use the `postgres` tagged template literal syntax (`sql\`...\``). Zero raw string concatenation found across all repositories. SQL injection is eliminated by design.

2. **Refresh token rotation with theft detection** — `routes/auth.ts:181-185` correctly revokes ALL tokens when a previously-revoked token is reused. This is best-practice and properly implemented.

3. **SHA-256 hashed refresh tokens** — `utils/token.ts:7-9` stores only the hash in the database. A database breach does not expose usable refresh tokens.

4. **bcrypt cost 12 with timing-attack mitigation** — `DUMMY_HASH` at `routes/auth.ts:14` ensures consistent response time for non-existent emails. Generic error messages prevent user enumeration on login.

5. **JWT algorithm pinning** — `jwt.ts:42-43` uses `algorithms: ['HS256']` in verification, preventing algorithm confusion attacks (`alg: "none"`, RS256 substitution).

6. **RBAC middleware with consistent pattern** — `requireTeamRole()` checks both team existence and membership in a single middleware. Team-scoped queries always include `team_id` in WHERE clauses, preventing IDOR on team resources.

7. **Atomic invite join** — `invitationRepository.atomicJoin()` uses a single `UPDATE ... WHERE ... RETURNING` to prevent race conditions on `max_uses` enforcement.

8. **Database-level constraints** — Partial unique index for one active sprint per team, composite PK on team_members preventing duplicates, CHECK constraints on invite use_count and template system/custom invariant.

9. **Zod validation on all inputs** — Every endpoint validates input before processing. `.strip()` removes unknown fields. Max lengths prevent storage abuse.

10. **No sensitive data in error responses** — Global error handler (`server.ts:59-68`) returns generic messages for unhandled errors. Stack traces are logged server-side only.

11. **Cryptographically secure token generation** — `crypto.randomBytes(64)` for refresh tokens (128 hex chars = 512 bits entropy), `crypto.randomBytes(12)` for invite codes.

12. **JWT_SECRET startup validation** — `config/env.ts:5` enforces minimum 32 characters with `process.exit(1)` on failure.

---

## Summary of Required Actions

| # | Severity | Finding | Effort |
|---|----------|---------|--------|
| CR-01 | **HIGH** | Replace Content-Length body check with Hono's `bodyLimit` middleware | 10 min |
| CR-02 | **HIGH** | Add team membership check to template detail endpoint | 15 min |
| CR-03 | **HIGH** | Add `https://` protocol restriction to team `avatar_url` validation | 5 min |
| CR-04 | **HIGH** | Add HSTS header to security headers middleware | 5 min |
| CR-05 | **IMPORTANT** | Add IP-based rate limiting to refresh endpoint | 10 min |

**Total estimated remediation effort: ~45 minutes.**

---

*Review complete. The implementation is well-architected with strong security foundations. The 5 findings are targeted fixes that do not require structural changes.*
