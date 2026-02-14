# QA Review: Phase 1 Test Plans

**Reviewer:** QA Agent
**Date:** 2026-02-14
**Scope:** Auth, Teams, Sprints, Templates — test plans, API specs, DB specs
**Verdict:** APPROVED WITH CONDITIONS

---

## Summary

The Phase 1 test plans are **solid overall** — well-structured, with good coverage of happy paths, role-based access, and basic error handling. The auth test plan is the strongest, with thoughtful security edge cases (timing attacks, token theft detection). However, there are **42 missing test cases** across all features, including critical gaps in concurrency handling, input boundary validation, cross-feature cascade behavior, and API response consistency. The templates feature has the most gaps relative to its complexity.

**Key concerns:**
1. **API response format inconsistency** between templates (`{ ok, data }` + 422) and other features (`{ feature_object }` + 400) is untested and potentially a spec conflict
2. **No cross-feature integration tests** for end-to-end flows
3. **Rate limiting is mentioned in requirements (NFR-07) but has zero test cases** across all features
4. **Concurrency tests are too shallow** — only happy-path concurrent scenarios, no error-path races
5. **Missing negative input tests** — whitespace-only strings, negative numbers, zero-value pagination

---

## Missing Test Cases

### Auth

| # | Feature | Test Case Description | Why It Matters | Priority |
|---|---------|----------------------|----------------|----------|
| 1 | Auth/Login | Rate limiting: 10+ failed logins from same IP/email within 1 minute | Brute force protection is a security requirement. No rate limit tests exist for any auth endpoint. | P1 |
| 2 | Auth/Register | Rate limiting: rapid registration attempts from same IP | Prevents spam account creation. Requirements mention auth-protection (NFR-07) but no rate limit tests. | P1 |
| 3 | Auth/Refresh | Concurrent refresh: two simultaneous requests with the same valid refresh token | Both could read the token as valid before either revokes it. Tests must verify only one succeeds and the other triggers theft detection (revoke-all). | P1 |
| 4 | Auth/JWT | Token with `alg: none` header bypass attempt | Classic JWT vulnerability. Verify the server rejects tokens with algorithm=none. | P1 |
| 5 | Auth/Register | Request with extra/unknown fields in body (e.g., `{ email, password, display_name, role: "admin" }`) | Verify unknown fields are silently ignored and don't pollute the database or grant elevated access. | P2 |
| 6 | Auth/Validation | Email with leading/trailing whitespace: `" alice@example.com "` | Should be trimmed or rejected. Not specified in test plan. | P2 |
| 7 | Auth/Validation | Display name with only whitespace: `"   "` | U-VAL-10 tests empty string but not whitespace-only. After trimming, this becomes empty. | P2 |
| 8 | Auth/JWT | Token with future `iat` claim (issued-at in the future) | Should be rejected — could indicate clock skew attack. | P2 |
| 9 | Auth/Register | Unicode emoji in display_name: `"Alice 🚀"` | E-SEC-04 tests Polish characters but not emoji or CJK. Verify emoji stored/returned correctly. | P3 |
| 10 | Auth/All | Wrong Content-Type header (e.g., `text/plain` instead of `application/json`) | Should return 400/415 consistently, not 500. | P3 |
| 11 | Auth/Logout | Missing `refresh_token` field in body returns 400 | API spec says required, but test plan only has I-OUT-06 (unauthenticated). No test for missing field with valid auth. | P2 |

### Teams

| # | Feature | Test Case Description | Why It Matters | Priority |
|---|---------|----------------------|----------------|----------|
| 12 | Teams/Create | Team name with only whitespace: `"   "` | After trimming becomes empty. Should return 400, not create a team with empty name. | P1 |
| 13 | Teams/Create | Description over 500 chars returns 400 | API spec says max 500 chars for description. No validation test for this boundary. | P1 |
| 14 | Teams/Create | avatar_url validation: invalid URL format, URL over 500 chars | API spec lists avatar_url field with URL validation but no tests verify it. | P2 |
| 15 | Teams/Members | Admin removes another admin (not last admin) | I-MEM-06 tests demoting admin, I-MEM-11 tests removing member, but no test for removing an admin via DELETE. | P2 |
| 16 | Teams/Members | Admin changes own role to member (when other admins exist) | Should succeed since they're not the last admin. Not explicitly tested. | P2 |
| 17 | Teams/Members | Facilitator leaves team (self-remove) | I-MEM-12 tests member self-remove. Verify facilitator can also self-remove. | P2 |
| 18 | Teams/List | Negative page value: `?page=-1` | Should return 400 or default to page 1. Not tested. | P2 |
| 19 | Teams/List | `per_page=0` returns 400 | Zero items per page is invalid. No boundary test. | P2 |
| 20 | Teams/Cascade | Delete user who created a team | DB spec says `ON DELETE RESTRICT` on teams.created_by. Must verify this prevents user deletion with clear error, not 500. | P1 |
| 21 | Teams/Invitations | Concurrent join: two users join same invite simultaneously when only 1 use remains (max_uses=2, use_count=1) | Race condition: both could read use_count=1 < max_uses=2, both increment to 2. Need transactional check or optimistic locking test. | P1 |
| 22 | Teams/Update | Updating team with only unknown fields: `{ "foo": "bar" }` | Should return 400 (no valid fields) just like empty body. Currently only empty body tested (I-UT-08). | P3 |

### Sprints

| # | Feature | Test Case Description | Why It Matters | Priority |
|---|---------|----------------------|----------------|----------|
| 23 | Sprints/Create | Sprint name with only whitespace: `"   "` | After trimming becomes empty. No test for whitespace-only name. | P1 |
| 24 | Sprints/Create | Invalid date: `"2027-02-29"` (not a leap year) | 2027 is not a leap year. Should return 400 for invalid date, not 500 or silently adjust. | P2 |
| 25 | Sprints/Create | `start_date` in ISO datetime format: `"2026-03-01T00:00:00Z"` instead of `"2026-03-01"` | API spec requires YYYY-MM-DD. Verify datetime format is rejected. | P2 |
| 26 | Sprints/Update | Update active sprint with only date fields: `{ start_date: "2026-04-01" }` | Dates are silently ignored for active sprints. But if ONLY dates are sent, is it treated as "no valid fields" (400) or silent success (200 with no changes)? | P1 |
| 27 | Sprints/List | `page=0` and `page=-1` returns 400 or defaults to 1 | No negative/zero pagination tests. | P2 |
| 28 | Sprints/List | Multiple status filter values: `?status=active,completed` | Should return 400 if only single status supported. Undefined behavior. | P3 |
| 29 | Sprints/Delete | Deleting active sprint doesn't leave phantom "active" index entry | After deleting an active sprint, verify a new sprint can be activated (I-DS-09 covers this but should also verify DB index state). | P3 |
| 30 | Sprints/Activate | Activate sprint where team_id in URL doesn't match sprint's actual team_id | Sprint exists but belongs to different team. Must return 404, not 200. Important for security. | P1 |
| 31 | Sprints/Complete | Concurrent completion: two facilitators complete the same sprint simultaneously | One should succeed, other should get SPRINT_INVALID_TRANSITION (already completed). | P2 |

### Templates

| # | Feature | Test Case Description | Why It Matters | Priority |
|---|---------|----------------------|----------------|----------|
| 32 | Templates/Create | Column with 3-char hex color `"#fff"` (shorthand) | DB constraint requires `^#[0-9a-fA-F]{6}$`. Verify shorthand is rejected, not silently accepted. | P1 |
| 33 | Templates/Create | Column with negative position value: `position: -1` | Should be rejected. No test for negative positions. | P1 |
| 34 | Templates/Create | Column with position starting at 1 instead of 0: `[{position:1}, {position:2}]` | Test plan 1.1.11 tests non-sequential but not wrong starting point. | P2 |
| 35 | Templates/Create | Column name with only whitespace: `"   "` | DB has `CHECK (length(trim(name)) > 0)`. Verify API rejects this before it hits DB. | P2 |
| 36 | Templates/Create | Template name with only whitespace: `"   "` | Same CHECK constraint exists. Need API-level validation test. | P2 |
| 37 | Templates/Update | Update template columns with a column ID belonging to a different template | Test 1.2.8 in unit tests but no integration test verifying the API rejects this. | P2 |
| 38 | Templates/List | `include_system=false` AND `team_id` filter combined | Verify only that team's custom templates are returned. No combined filter test. | P3 |
| 39 | Templates/Create | Concurrent creation of templates with same name in same team | Both send simultaneously. One should get 201, other should get 409. DB UNIQUE constraint should handle this. | P2 |
| 40 | Templates/Delete | Delete template, then verify GET returns 404 | Test 2.5.8 checks list, but no test verifying GET /:id also returns 404 after deletion. | P3 |
| 41 | Templates/All | Unicode/emoji in template and column names | No test for CJK characters, emoji, RTL text in template names or column names. | P3 |

### Cross-Feature

| # | Feature | Test Case Description | Why It Matters | Priority |
|---|---------|----------------------|----------------|----------|
| 42 | Integration | End-to-end flow: register → create team → invite → join → create sprint → activate → complete | No cross-feature integration test exists. This is the core user journey. | P1 |
| 43 | Integration | Team deletion cascades to sprints: delete team with active sprint | DB spec says CASCADE but no test verifies sprints are actually cleaned up. | P1 |
| 44 | Integration | User deletion blocked when user created teams (RESTRICT) AND sprints (RESTRICT) | Two RESTRICT constraints. Need test confirming both block user deletion with correct error. | P2 |
| 45 | Integration | Template used by board (future Phase 2 FK): create template → verify TEMPLATE_IN_USE when boards exist | Test 4.5 exists in templates edge cases but depends on boards (Phase 2). Should be deferred or stubbed. | P3 |

---

## API Response Format Inconsistency

**This is a spec-level issue, not just a test gap.**

| Aspect | Auth / Teams / Sprints | Templates |
|--------|----------------------|-----------|
| Success envelope | `{ "user": {...} }` / `{ "team": {...} }` / `{ "sprint": {...} }` | `{ "ok": true, "data": {...} }` |
| Validation error HTTP status | 400 | 422 |
| Validation error code | `VALIDATION_ERROR` | `VALIDATION_ERROR` |

**Recommendation:** Resolve this inconsistency before implementation. Either standardize on one format or add explicit tests for both formats. An API consumer should not need to handle two different envelope patterns.

**Priority: P1** — this will confuse frontend developers and create inconsistent error handling.

---

## Existing Test Improvement Suggestions

### Auth Tests
- **E-SEC-04** uses `"Alicja Zolkiewska"` — these are ASCII-compatible characters, not truly testing Unicode. Replace with actual multibyte characters like `"Alice 李"` or `"Алиса"` to genuinely test UTF-8 handling.
- **I-OUT-07** (logout another user's token) — the expected behavior "200 but token not revoked" is ambiguous. Add an explicit DB check asserting the token remains active.

### Teams Tests
- **I-MEM-16** (remove non-existent member) — also test with a valid UUID that exists as a user but is NOT a team member. The current test uses `random-uuid` which may not exist as a user at all, testing a different code path.
- **E-TM-04** (user deleted, team persists) states "member removed via CASCADE" but the DB spec says `teams.created_by` uses `ON DELETE RESTRICT`. This edge case needs to distinguish between deleting a regular member (CASCADE on team_members) and deleting the team creator (RESTRICT blocks deletion). The current test description is misleading.

### Sprints Tests
- **I-US-08** (dates ignored for active sprint) — add assertion that `updated_at` is NOT changed if only ignored fields were sent, or clarify: does sending only ignored fields count as "empty update" (400)?
- **E-SP-06** (past dates) — good that it's accepted, but add a note about whether the API should warn. The test should verify no warning/error is returned.

### Templates Tests
- **Test 2.3.8 and 2.3.9** both test "forbidden" for member and facilitator. Consolidate description to clarify this is admin-only. Also confirm the error code: tests say `FORBIDDEN` but other features use `TEAM_INSUFFICIENT_ROLE`. Standardize.
- **Test 4.4** (delete user who created template) — needs to account for `ON DELETE SET NULL` FK behavior. Verify `created_by` becomes NULL, not just "template persists."

---

## Rate Limiting Gap

Requirements NFR-07 states "All endpoints auth-protected except login/register — 100% coverage." While this covers authentication, there is **zero specification** for rate limiting anywhere in the test plans. At minimum, the following need rate limit tests:

| Endpoint | Recommended Limit | Reason |
|----------|-------------------|--------|
| POST /auth/login | 10/min per email + 30/min per IP | Brute force prevention |
| POST /auth/register | 5/min per IP | Spam account prevention |
| POST /auth/refresh | 30/min per user | Token cycling abuse |
| POST /teams/join/:code | 10/min per IP | Invite code brute force |

**Recommendation:** Add rate limiting spec and tests before implementation, or explicitly document that rate limiting is deferred to a later phase. Either way, this must be a conscious decision, not an oversight.

---

## Concurrency Testing Gaps

The current concurrency tests are:
- E-SEC-06: concurrent registration (same email)
- E-TM-01: concurrent team creation (same name)
- E-TM-05: concurrent invite joins
- E-SP-01: concurrent sprint activation

**Missing concurrency scenarios:**
1. Concurrent refresh token rotation (same token used twice) — can lead to token theft false positive
2. Concurrent role changes on same member by two admins — can lead to inconsistent state
3. Concurrent invite join at max_uses boundary — race condition on use_count increment
4. Concurrent template creation with same name in same team — unique constraint race

**Recommendation:** Add explicit tests for all concurrency scenarios involving database write contention. Use parallel test requests (Promise.all) to simulate races.

---

## Verdict

### APPROVED WITH CONDITIONS

The test plans provide solid baseline coverage and can proceed to implementation with the following conditions:

**Must address before implementation (P1):**
1. Resolve API response format inconsistency (templates vs. other features) — decide on one envelope format
2. Add whitespace-only input validation tests for all name fields (auth display_name, team name, sprint name, template name, column name)
3. Add rate limiting spec and tests for auth endpoints (at minimum login and register)
4. Add concurrent refresh token rotation test (security-critical)
5. Add the end-to-end cross-feature integration test
6. Add team deletion cascade-to-sprints test
7. Clarify teams.created_by ON DELETE RESTRICT behavior with a test
8. Add negative position and shorthand hex color rejection tests for templates

**Should address during implementation (P2):** Items 5-6, 11, 14-19, 24-28, 31, 34-37, 39, 44

**Can address post-implementation (P3):** Items 9-10, 22, 28-29, 38, 40-41, 45
