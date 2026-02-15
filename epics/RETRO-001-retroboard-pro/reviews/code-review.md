# Phase 1 Code Review

**Reviewer:** Code Reviewer Agent
**Date:** 2026-02-15
**Scope:** All Phase 1 implementation — auth, teams, sprints, templates
**Base path:** `services/retroboard-server/src/`

---

## Summary

The Phase 1 implementation is **solid overall**. The codebase follows consistent patterns, uses tagged template literals correctly throughout (no raw SQL string concatenation), and covers all spec endpoints with the correct routes, methods, status codes, and response shapes. Validation, error handling, and the repository/route layering are clean. Security measures from the architecture spec are mostly in place (JWT algorithm pinning, timing attack mitigation, DUMMY_HASH, bcrypt cost 12, refresh token rotation with theft detection).

However, I found **1 high-severity spec deviation** (team join not transactional), **2 security gaps** (missing HSTS header, bypassable body size limit), and a few medium-severity code quality issues.

---

## Findings

| # | Severity | File | Finding | Recommendation |
|---|----------|------|---------|----------------|
| 1 | **HIGH** | `routes/teams.ts:158-166` | **Team join is not transactional (spec deviation).** The invite `atomicJoin` (incrementing `use_count`) and `addMember` are two separate queries, not wrapped in a DB transaction. Spec query 7.8 explicitly requires a single transaction. If `addMember` fails (e.g., unique constraint race), `use_count` is incremented without a member being added, consuming an invite use incorrectly. | Wrap both operations in `sql.begin()` transaction. Move `addMember` into the same transaction as `atomicJoin`. |
| 2 | **HIGH** | `server.ts:27-33` | **Missing HSTS header.** Architecture spec §15 requires `Strict-Transport-Security: max-age=31536000; includeSubDomains`. The security headers middleware sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and CSP, but omits HSTS entirely. | Add `c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')` in the security headers middleware, conditional on production environment. |
| 3 | **HIGH** | `server.ts:36-42` | **Body size limit bypassable via chunked transfer encoding.** The implementation manually checks `Content-Length` header, but chunked requests don't include this header. Architecture spec §17 specifies "Hono `bodyLimit` middleware." | Replace the manual content-length check with Hono's built-in `bodyLimit` middleware: `app.use('/api/*', bodyLimit({ maxSize: 1_048_576 }))`. |
| 4 | **MEDIUM** | `utils/errors.ts` | **Incomplete ErrorCode constant.** Multiple error codes used as string literals throughout the codebase are missing from the typed `ErrorCode` object: `RATE_LIMIT_EXCEEDED`, `TEAM_SLUG_EXISTS`, `TEAM_MEMBER_EXISTS`, `TEAM_INVITE_EXPIRED`, `TEAM_INVITE_LIMIT_REACHED`, `TEAM_LAST_ADMIN`, `PAYLOAD_TOO_LARGE`, `SPRINT_ALREADY_ACTIVE` (in errors.ts but not matching usage), etc. Also, `RATE_LIMITED` in the constant doesn't match `RATE_LIMIT_EXCEEDED` used in actual responses. | Add all error codes to the `ErrorCode` constant. Rename `RATE_LIMITED` to `RATE_LIMIT_EXCEEDED`. Use the constant everywhere instead of string literals. |
| 5 | **MEDIUM** | `utils/jwt.ts:31-38` | **Dead code: `signRefreshToken` function.** This creates a JWT-signed refresh token, which contradicts the spec (refresh tokens must be opaque hex strings). The function is exported but never used — the codebase correctly uses `generateRefreshToken()` from `utils/token.ts` instead. | Remove `signRefreshToken()` to avoid confusion. |

---

## Detailed Analysis

### Auth Feature
- All 7 endpoints match the API spec (routes, methods, request/response shapes, status codes, error codes).
- Token rotation with theft detection correctly implemented per spec (revoked token reuse triggers revoke-all).
- Rate limiting correctly implemented for login (per-email 5/15min, per-IP 30/1min), register (per-IP 10/1hr), and refresh (per-user 30/1min).
- JWT: HS256 pinned via `algorithms: ['HS256']` (§18). JWT_SECRET >= 32 chars enforced via Zod schema (§19).
- Timing attack mitigation: `DUMMY_HASH` with bcrypt cost 12 used when email not found during login (§20).
- CORS: Credentials enabled, specific origins in dev, strict in production (§14).
- Security headers: 4 of 5 required headers present (missing HSTS — Finding #2).

### Teams Feature
- All 11 endpoints implemented with correct routes, role authorization, and response shapes.
- Slug generation with collision retry logic works correctly.
- Invite system: 5-active-invite limit, facilitator can't create admin invites, atomic use_count increment with WHERE guard.
- Soft delete for teams with `deleted_at` filtering on all queries.
- **Critical gap:** Join flow lacks a wrapping transaction (Finding #1).

### Sprints Feature
- All 7 endpoints match the API spec.
- Auto-incrementing `sprint_number` per team via `COALESCE(MAX(...), 0) + 1` subquery.
- Partial unique index `sprints_team_active_idx` enforced with proper 23505 error handling and `SPRINT_ALREADY_ACTIVE` response with active sprint details.
- Status-based editability correctly silences date fields for active sprints and rejects all updates for completed sprints.
- Date formatting handles both Date objects and strings for cross-driver compatibility.

### Templates Feature
- Both read-only endpoints (list, detail) match the API spec.
- Seed data matches the spec examples exactly.
- Template columns ordered by position.

### Database Migrations
- All migrations are idempotent (`IF NOT EXISTS`), forward-only, and match the DB specs.
- All constraints, indexes, foreign keys, and check constraints from specs are present.
- Migration runner correctly tracks applied migrations in `schema_migrations` table and runs each in a transaction.

### Code Quality
- Consistent layered architecture: routes → validation → repositories → SQL (tagged templates).
- No raw SQL string concatenation anywhere — all queries use `postgres` tagged template literals.
- Proper use of `sql.begin()` for transactional team creation (though missing for join flow).
- Clean separation between auth middleware (`requireAuth`) and team role middleware (`requireTeamRole`).

---

## Verdict

**APPROVED WITH CONDITIONS**

The implementation is functionally complete and well-structured. The three conditions for full approval:

1. **Fix team join transaction** (Finding #1) — wrap `atomicJoin` + `addMember` in a single `sql.begin()` transaction.
2. **Add HSTS header** (Finding #2) — add `Strict-Transport-Security` to the security headers middleware.
3. **Fix body size limit** (Finding #3) — replace manual Content-Length check with Hono's `bodyLimit` middleware.

Findings #4 and #5 (ErrorCode consistency, dead code) are recommended improvements but not blocking.
