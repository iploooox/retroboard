# Security Review — Phase 1 Specs

**Reviewer:** Security Researcher (Agent)
**Date:** 2026-02-14
**Scope:** Auth, Teams, Sprints, Templates — architecture, API, database, and test specs
**Methodology:** OWASP Top 10 (2021) + application-specific threat modeling

---

## Executive Summary

The Phase 1 specs demonstrate **solid foundational security design** in several areas: stateless JWT with stateful refresh token rotation, bcrypt cost-12 password hashing, parameterized SQL via tagged template literals, consistent RBAC middleware, and team-scoped data isolation. The threat model for a retro board application is reasonable — this is not a banking app — but several gaps could be exploited by a moderately skilled attacker.

**The most critical gap is the complete absence of rate limiting on authentication endpoints.** Without it, credential stuffing and brute-force attacks are trivially executable despite bcrypt's 250ms latency. A second critical concern is the invite join race condition that can bypass the `max_uses` limit.

Overall posture: **Good foundation with addressable gaps.** No architectural redesign needed — the issues are additive (things to specify/add), not structural (things to redesign).

---

## Vulnerability Findings

| # | Severity | OWASP Category | Feature | Finding | Recommendation |
|---|----------|---------------|---------|---------|----------------|
| S-01 | **CRITICAL** | A07:2021 Identification & Auth Failures | Auth | **No rate limiting on any auth endpoint.** Login, register, and refresh endpoints have zero throttling. Architecture explicitly defers this to "Future Considerations." An attacker can attempt unlimited login attempts (~4/sec accounting for bcrypt latency) or create unlimited spam accounts. | Add rate limiting in Phase 1. Minimum: 5 failed logins per email per 15min, 3 failed logins per IP per minute, 10 registrations per IP per hour. Use a PostgreSQL counter table per ADR-001 (no Redis needed). Spec a `rate_limits` table with `(key, window_start, count)` pattern. |
| S-02 | **HIGH** | A01:2021 Broken Access Control | Teams | **Invite join race condition can exceed `max_uses`.** The join flow (query 7.8 in teams DB spec) runs `UPDATE SET use_count = use_count + 1` without a WHERE guard. Two concurrent requests when `use_count = max_uses - 1` will both succeed, producing `use_count > max_uses`. | Change the UPDATE to: `UPDATE team_invitations SET use_count = use_count + 1 WHERE id = $3 AND (max_uses IS NULL OR use_count < max_uses) RETURNING id`. If no row returned, the invite is exhausted. This makes the check atomic. |
| S-03 | **HIGH** | A05:2021 Security Misconfiguration | All | **No CORS configuration specified anywhere.** No architecture doc, API spec, or ADR mentions CORS headers. Without explicit CORS, a malicious site can make credentialed requests to the API from any origin. | Specify CORS in the architecture: `Access-Control-Allow-Origin` set to the app's domain only (not `*`), `Access-Control-Allow-Credentials: true` if cookies used, `Access-Control-Allow-Headers: Authorization, Content-Type`. Add a Hono CORS middleware section to the auth architecture or a new ADR. |
| S-04 | **HIGH** | A02:2021 Cryptographic Failures | Auth | **No HTTPS enforcement or HSTS specification.** Tokens travel in `Authorization: Bearer` headers. Without TLS, they are exposed in plaintext on the wire. No spec mentions HTTPS requirement, HSTS headers, or Secure cookie flags. | Add to architecture: server MUST listen on HTTPS in production (or be behind a TLS-terminating proxy). Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` header. If refresh tokens ever move to cookies, set `Secure; HttpOnly; SameSite=Strict`. |
| S-05 | **HIGH** | A07:2021 Identification & Auth Failures | Auth | **No "revoke all sessions" or password change capability in Phase 1.** If a user's account is compromised, they cannot: (1) change their password, (2) revoke all active sessions, (3) force re-authentication. The attacker retains access for up to 7 days (refresh token lifetime). | Add a `POST /api/v1/auth/revoke-all` endpoint that revokes all refresh tokens for the authenticated user. This is a simple `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`. Password change can remain Phase 5, but session revocation is essential for Phase 1. |
| S-06 | **MEDIUM** | A03:2021 Injection (XSS) | Auth, Teams | **`avatar_url` allows any valid URL with no protocol restriction.** The validation says "Valid URL format" but doesn't restrict to `https://`. A user could set `avatar_url` to `javascript:alert(1)` or `data:text/html,...`. When rendered in `<img src>` this is typically safe, but if rendered in `<a href>` or other contexts, it's XSS. | Restrict `avatar_url` to `https://` protocol only. Add validation: URL must start with `https://`. Reject `javascript:`, `data:`, `vbscript:`, and other non-HTTPS schemes. |
| S-07 | **MEDIUM** | A07:2021 Identification & Auth Failures | Auth | **Login timing attack not fully mitigated in spec.** The architecture mentions "bcrypt.compare is constant-time" but does not specify what happens when the email doesn't exist. If the server returns immediately for non-existent emails (skipping bcrypt), an attacker can enumerate valid accounts by measuring response time. Test E-SEC-09 checks this but the architecture doesn't prescribe the solution. | Add to architecture: "When email is not found, run `bcrypt.compare(password, DUMMY_HASH)` where DUMMY_HASH is a pre-computed bcrypt hash. This ensures consistent response timing regardless of email existence." |
| S-08 | **MEDIUM** | A04:2021 Insecure Design | Auth | **JWT algorithm not pinned in verification.** The spec says "HS256 via jose" for signing but doesn't explicitly require the verifier to reject tokens with `alg: "none"` or other algorithms. The `jose` library likely handles this correctly, but the spec should be explicit to prevent implementation errors. | Add to JWT verification spec: "Verify with `algorithms: ['HS256']` option. Reject any token using a different algorithm including `none`." |
| S-09 | **MEDIUM** | A01:2021 Broken Access Control | Templates | **Potential IDOR on template detail endpoint.** `GET /api/v1/templates/:id` says "Any authenticated user (must be member of the template's team for custom templates)" but the visibility check is not detailed in the database query. The query in DB spec (Get template with columns) does `WHERE t.id = $1` with no team membership filter. A user who knows a custom template UUID from another team can view it. | Modify the template detail query to check team membership: add `AND (t.is_system = true OR t.team_id IN (SELECT team_id FROM team_members WHERE user_id = $2))`. Or perform a separate membership check in the service layer. |
| S-10 | **MEDIUM** | A05:2021 Security Misconfiguration | All | **No request body size limits specified.** No endpoint specifies a maximum request body size. An attacker can send multi-gigabyte request bodies to exhaust server memory. | Add a global body size limit via Hono middleware: `app.use('*', bodyLimit({ maxSize: 1024 * 1024 }))` (1MB). For most API endpoints, 100KB is more than sufficient. Specify this in the architecture. |
| S-11 | **MEDIUM** | A05:2021 Security Misconfiguration | All | **No security headers specified.** No spec mentions `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, or `X-XSS-Protection` headers. | Add a security headers middleware to the architecture. Minimum set: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: default-src 'self'`. |
| S-12 | **MEDIUM** | A08:2021 Software & Data Integrity | Auth | **JWT_SECRET minimum length not enforced at startup.** The env var spec says "Minimum 32 characters" but there's no startup validation described. If someone deploys with `JWT_SECRET=secret`, all tokens are trivially forgeable. | Add to architecture: "On server startup, validate `JWT_SECRET.length >= 32`. If shorter, throw an error and refuse to start." |
| S-13 | **MEDIUM** | A01:2021 Broken Access Control | Teams | **No ability to revoke/delete invite links.** Once an invite is created, it cannot be deactivated. If an invite link is leaked to an unauthorized party, it remains valid until expiry (up to 30 days). | Add `DELETE /api/v1/teams/:id/invitations/:inviteId` endpoint (admin/facilitator only). Sets a `revoked_at` field on the invitation, and the join flow checks `revoked_at IS NULL`. |
| S-14 | **LOW** | A07:2021 Identification & Auth Failures | Auth | **Password policy lacks special character requirement.** Current: min 8 chars, upper + lower + digit. No special character or entropy check. This allows weak passwords like `Password1` that appear in breach lists. | Consider adding: require at least one special character, or better, check against a list of the top 10,000 breached passwords. Alternatively, increase minimum length to 10 characters and drop complexity requirements (NIST 800-63B approach). |
| S-15 | **LOW** | A01:2021 Broken Access Control | Auth | **Logout only revokes a specific token, no "logout everywhere."** If a user's device is stolen, they can only revoke the token they currently hold. Other sessions (from other devices/logins) remain active. | See S-05 above. A "revoke all sessions" endpoint addresses this. |
| S-16 | **LOW** | A04:2021 Insecure Design | Teams | **Team member list exposes email addresses to all members.** `GET /teams/:id/members` returns `email` for every member. Any team member can harvest all email addresses. | Consider: only expose email to admins. For members and facilitators, return `display_name` and `avatar_url` but mask or omit `email`. Alternatively, accept this as a design trade-off for team collaboration tools. |
| S-17 | **LOW** | A05:2021 Security Misconfiguration | All | **No Content-Type enforcement on request bodies.** API endpoints expect JSON but no spec requires `Content-Type: application/json` validation. Sending form-encoded data could cause unexpected parsing behavior. | Add middleware: reject requests with body that don't have `Content-Type: application/json`. Hono's JSON body parser likely handles this, but make it explicit. |
| S-18 | **LOW** | A09:2021 Security Logging & Monitoring | All | **No security event logging specified.** No spec mentions logging for failed login attempts, token theft detection events, role changes, team deletions, or other security-relevant actions. Without logging, incident response is blind. | Add a security events logging specification. At minimum, log: failed logins (email, IP, timestamp), refresh token theft detection events, role changes, team/sprint deletions, and invite creation. Store in a `security_events` table or structured log output. |

---

## Missing Security Test Cases

The following security-relevant tests should be added to the existing test plans:

### Auth Tests (add to `specs/tests.md`)

| # | Test Case | Why Missing |
|---|-----------|-------------|
| SEC-AUTH-01 | Rate limiting: 6th failed login within 15 minutes returns 429 | No rate limiting exists in spec |
| SEC-AUTH-02 | Rate limiting: registration from same IP after 10 attempts returns 429 | No rate limiting exists in spec |
| SEC-AUTH-03 | JWT with `alg: "none"` is rejected | Algorithm pinning not tested |
| SEC-AUTH-04 | JWT with RS256 (different algorithm) is rejected | Algorithm confusion attack |
| SEC-AUTH-05 | JWT_SECRET under 32 chars fails server startup | Env var validation not tested |
| SEC-AUTH-06 | Login with non-existent email takes same time as wrong password | Timing attack test E-SEC-09 exists but should verify the dummy-hash approach |
| SEC-AUTH-07 | `avatar_url` with `javascript:` protocol is rejected | URL scheme validation |
| SEC-AUTH-08 | `avatar_url` with `data:` protocol is rejected | URL scheme validation |
| SEC-AUTH-09 | Revoke all sessions endpoint invalidates all refresh tokens | No revoke-all endpoint exists |
| SEC-AUTH-10 | CORS: cross-origin request without proper origin is blocked | No CORS tests exist |

### Teams Tests (add to `specs/tests.md`)

| # | Test Case | Why Missing |
|---|-----------|-------------|
| SEC-TEAM-01 | Concurrent invite joins at `max_uses` limit — only correct number succeed | Race condition in invite join |
| SEC-TEAM-02 | Invite revocation: revoked invite returns 410 or 404 | No invite revocation mechanism |
| SEC-TEAM-03 | Team member list does not expose `password_hash` | Verify join query doesn't leak |
| SEC-TEAM-04 | Oversized request body (>1MB) returns 413 | No body size limit |

### Templates Tests (add to `specs/tests.md`)

| # | Test Case | Why Missing |
|---|-----------|-------------|
| SEC-TMPL-01 | User cannot view custom template of a team they are not a member of | IDOR on template detail endpoint |
| SEC-TMPL-02 | User cannot modify system template (returns 403, not 500) | Immutability enforcement |
| SEC-TMPL-03 | XSS in template column name is stored safely (no script execution context) | Input sanitization |

### Cross-Cutting Tests

| # | Test Case | Why Missing |
|---|-----------|-------------|
| SEC-CROSS-01 | Response includes `X-Content-Type-Options: nosniff` | No security headers spec |
| SEC-CROSS-02 | Response includes `X-Frame-Options: DENY` | No security headers spec |
| SEC-CROSS-03 | CORS preflight returns correct headers | No CORS spec |
| SEC-CROSS-04 | API responses do not include stack traces in production | Error verbosity not specified |
| SEC-CROSS-05 | Request body exceeding size limit returns 413 | No body limit spec |

---

## Positive Security Observations

Credit where due — these are well-designed:

1. **Refresh token rotation with theft detection** — revoking all tokens on reuse of a revoked token is best-practice and often missed.
2. **SHA-256 hashed refresh tokens in DB** — server-side token storage done correctly.
3. **Tagged template SQL (postgres driver)** — SQL injection eliminated by design, not by developer discipline.
4. **Team-scoped queries with `team_id` in WHERE clauses** — consistent IDOR prevention pattern.
5. **Generic login error messages** — `"Invalid email or password"` prevents user enumeration.
6. **Partial unique index for active sprint** — database-level constraint prevents business logic bugs that could cause data corruption.
7. **Composite PK on `team_members`** — naturally prevents duplicate memberships.
8. **bcrypt cost 12** — appropriate for the application's threat model.
9. **Template system/custom constraint (`chk_templates_system_no_team`)** — database-level enforcement of the invariant.
10. **Idempotent logout** — returning 200 even for already-revoked tokens prevents information leakage.

---

## Verdict

### APPROVED WITH CONDITIONS

Phase 1 specs may proceed to implementation **provided the following conditions are addressed before production deployment:**

**Must-fix before production (CRITICAL + HIGH):**
1. **S-01:** Implement rate limiting on auth endpoints (login, register, refresh)
2. **S-02:** Fix invite join race condition with atomic UPDATE WHERE guard
3. **S-03:** Specify and implement CORS configuration
4. **S-04:** Specify HTTPS enforcement and HSTS headers
5. **S-05:** Add a "revoke all sessions" endpoint

**Should-fix during Phase 1 implementation:**
6. **S-06:** Restrict `avatar_url` to `https://` protocol
7. **S-07:** Specify dummy-hash approach for login timing protection
8. **S-08:** Pin JWT algorithm to `['HS256']` in verification
9. **S-09:** Add team membership check on template detail endpoint
10. **S-10:** Add request body size limits
11. **S-11:** Add security response headers
12. **S-12:** Validate JWT_SECRET length at startup

**Can defer to later phases (LOW):**
- S-13 through S-18

---

*Review complete. No architectural redesign required — all findings are additive improvements to an otherwise solid design.*
