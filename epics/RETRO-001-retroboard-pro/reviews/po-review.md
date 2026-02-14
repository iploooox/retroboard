# Product Owner Review: Phase 1 Specs

**Reviewer:** Product Owner (AI Agent)
**Date:** 2026-02-14
**Scope:** Phase 1 — Auth, Teams, Sprints, Templates
**Stories reviewed:** S-001, S-002, S-003, S-004, S-005, S-006, S-012

---

## Summary

**Verdict: APPROVED WITH CONDITIONS**

The Phase 1 specs are comprehensive and well-structured. The auth, teams, sprints, and templates features are thoroughly specified with clear API contracts, database schemas, and test plans. However, there are **3 critical** and **6 high-severity** findings that should be resolved before implementation begins. Most relate to story acceptance criteria not fully reflected in specs, scope creep in templates, and inconsistencies between specs.

**Confidence:** High (all specs, stories, and UI pages were reviewed in full)

---

## Findings

| # | Severity | Feature | Finding | Recommendation |
|---|----------|---------|---------|----------------|
| 1 | CRITICAL | auth | **`email_verified` column missing from DB spec.** S-001 acceptance criteria states "Email verification status is tracked (defaults to unverified)" but the auth database spec (`auth/specs/database.md`) does not include an `email_verified` column on the `users` table. The phase plan (`auth/phases/phase1.md`) task list references `email_verified` in the migration, confirming it was intended. Without it, there's no way to track verification status for future email verification flows. | Add `email_verified BOOLEAN NOT NULL DEFAULT false` to the `users` table in the DB spec. No verification endpoint needed in Phase 1, but the column must exist. |
| 2 | CRITICAL | teams | **Soft delete not implemented despite story requirement.** S-003 acceptance criteria: "Team admin can delete a team (soft delete)" and "Deleting a team archives all associated sprints and boards." The teams DB spec has no `deleted_at` column. The API spec `DELETE /api/v1/teams/:id` does a hard delete with CASCADE, permanently destroying all team data. This contradicts the story's explicit "soft delete" and "archives" language. | Add `deleted_at TIMESTAMPTZ NULL` to the `teams` table. Change DELETE endpoint to set `deleted_at = NOW()`. Add `WHERE deleted_at IS NULL` filters to all team queries. Hard delete can be a separate admin function later. |
| 3 | CRITICAL | auth | **Display name constraints contradict between story and spec.** S-001 says: "Display name is trimmed and must be between 2 and 50 characters." Auth API spec says: "Min 1 character. Max 100 characters." Auth DB spec uses `VARCHAR(100)`. These are fundamentally different validation rules — a 1-character display name should not be allowed per the story. | Align to story requirements: min 2, max 50 characters. Update API spec validation rules and DB column to `VARCHAR(50)`. Or, if the spec values are intentional, update the story to match and document the decision. |
| 4 | HIGH | templates | **Templates feature is over-scoped for Phase 1.** S-012 requires only 2 system templates (WWW/Delta and Start/Stop/Continue) that are read-only. The templates spec includes: (a) 6 system templates (4Ls, Mad/Sad/Glad, Sailboat, Starfish belong to S-025 in Phase 5), (b) full CRUD for custom templates (create, update, delete) which no Phase 1 story requires, (c) complex column update logic with full replacement strategy. This adds significant implementation scope without Phase 1 user value. | Reduce Phase 1 templates scope to: (a) 2 system templates per S-012, (b) GET endpoints only (list and detail), (c) No custom template CRUD — defer to Phase 5 with S-025. Seed the additional 4 templates in a later phase. |
| 5 | HIGH | teams | **Invite role assignment missing.** S-004 states: "Invite links can optionally set the role for joiners (default: member)." The invitations API spec (`POST /api/v1/teams/:id/invitations`) does not accept a `role` parameter. The join endpoint hardcodes `role = 'member'`. Users cannot create invite links that assign facilitator or admin roles. | Add optional `role` field (enum: member, facilitator) to the invitation creation request. Store it in `team_invitations.role` column (which doesn't exist yet — needs adding to DB spec). Apply this role when a user joins via the invite. Restrict: only admins can create admin-role invites. |
| 6 | HIGH | teams | **Max active invites per team not enforced.** S-004 states: "Maximum of 5 active invite links per team at any time." Neither the API spec nor the DB spec enforces this limit. Without it, a team could accumulate unlimited active invites, creating a management burden and potential abuse vector. | Add server-side validation in `POST /api/v1/teams/:id/invitations`: count active (non-expired) invitations for the team, reject with `TEAM_INVITE_LIMIT_REACHED` (400) if count >= 5. |
| 7 | HIGH | templates | **Inconsistent API response format.** All other features (auth, teams, sprints) use the pattern `{ "user": {...} }`, `{ "team": {...} }`, `{ "sprint": {...} }`. Templates uses `{ "ok": true, "data": {...} }`. This inconsistency will confuse frontend developers and makes the API client layer harder to build generically. | Standardize templates API to use the same response format as other features: `{ "template": {...} }` for detail, `{ "templates": [...] }` for list. Remove the `ok` wrapper. |
| 8 | HIGH | templates | **Inconsistent validation error HTTP status.** Auth, Teams, and Sprints specs use `400` for validation errors (`VALIDATION_ERROR`). Templates spec uses `422`. Both are valid HTTP statuses, but the inconsistency creates confusion. | Pick one status code for validation errors across all features. Recommend `400` (already used by 3 out of 4 features). Update templates spec to use `400`. |
| 9 | HIGH | all | **Phase plan migration references columns not in DB specs.** The phase plan (`auth/phases/phase1.md`) task list references `email_verified`, `onboarding_completed_at`, and `onboarding_data JSONB` in the users table migration, but none of these columns appear in the auth DB spec. Similarly, the phase plan references `deleted_at` for teams and `sprint_number` for sprints. These are either planned but unspecced, or leftover from an earlier design. | Reconcile the phase plan with the actual DB specs. Either add missing columns to the DB specs (where needed, like `email_verified`) or remove them from the phase plan to avoid implementation confusion. |
| 10 | HIGH | sprints | **Sprint number not returned in API response.** S-006 implementation notes mention "sprint number auto-increment per team" and the phase plan includes it. The sprints DB spec doesn't include a `sprint_number` column, and the sprint API response doesn't include it. Sprint numbers are valuable for users to quickly reference sprints ("Sprint 42" vs a UUID). | Add `sprint_number INTEGER NOT NULL` to the sprints table with a team-scoped auto-increment. Include it in the SprintResponse type. Consider a unique constraint on `(team_id, sprint_number)`. |
| 11 | MEDIUM | auth | **No password change endpoint.** Users can update `display_name` and `avatar_url` via `PUT /api/v1/auth/me`, but there's no way to change their password. While not in S-001's explicit acceptance criteria, this is a basic user expectation. Users who want to change their password are stuck until a future phase. | Add `POST /api/v1/auth/change-password` endpoint accepting `{ current_password, new_password }`. This is a small addition with high user value. Alternatively, explicitly document this as deferred. |
| 12 | MEDIUM | auth | **No password reset flow.** The login page UI spec shows a "Forgot password?" link that displays a "coming soon" toast. For an MVP that requires email/password auth, having no password reset means locked-out users require manual DB intervention. | At minimum, document this as a known limitation. Consider adding a basic email-based reset flow, or plan it for early Phase 2 rather than Phase 5. |
| 13 | MEDIUM | UI | **Dashboard references Phase 2+ features.** The dashboard UI spec includes "Recent Activity Feed" (requires completed retro boards) and "Action Items Due" (requires Phase 4 action items). Neither will have data in Phase 1. | Add a note in the dashboard spec about Phase 1 behavior: hide or show empty states for activity feed and action items sections. Focus the Phase 1 dashboard on the teams grid and "Create Team" CTA only. |
| 14 | MEDIUM | UI | **Team detail page tabs reference future phases.** The team detail page shows tabs for Action Items (Phase 4) and Analytics (Phase 4). These won't function in Phase 1. | Either hide these tabs in Phase 1 or show them as "Coming Soon" placeholder states. Document this in the UI spec. |
| 15 | MEDIUM | UI | **Invite flow for unauthenticated users underspecified.** S-004 states: "Clicking an invite link while logged out redirects to register/login, then auto-joins." The login page spec doesn't detail how the invite token is preserved through the auth flow. S-004 frontend tasks mention "store token, redirect after auth" but no UI spec describes this. | Add a section to the login page spec describing: (a) URL param `?invite=TOKEN` preserved through auth flow, (b) After successful login/register, auto-call join endpoint, (c) Success: redirect to team page with welcome message, (d) Failure: show error toast. |
| 16 | MEDIUM | teams | **Member email exposed to all team members.** `GET /teams/:id/members` returns full email addresses for all members. In some organizations, email addresses are considered sensitive. Regular members may not need to see other members' emails. | Consider returning emails only to admins and facilitators, or add a privacy setting. At minimum, document this as a deliberate design decision. |
| 17 | LOW | teams | **No "leave team" convenience endpoint.** `DELETE /api/v1/teams/:id/members/:userId` allows self-removal, but the user must know their own userId and construct the URL. A `POST /api/v1/teams/:id/leave` endpoint would be more intuitive. | Consider adding a convenience endpoint or documenting in the frontend spec that the leave action uses the existing remove-member endpoint with the current user's ID. |
| 18 | LOW | sprints | **Completed sprints cannot be reopened.** S-006 says "Completed sprints cannot be modified (except by admin)" implying admins should have some override. The API spec makes completion irreversible for everyone. | Consider allowing admins to transition completed -> active (reverse). This matches the story's "except by admin" clause. If intentionally irreversible, update the story text. |
| 19 | LOW | UI | **No "Forgot password?" placeholder in register form.** The register form doesn't show password requirements until the user makes an error. The UI spec does show a hint ("Min 8 chars, 1 upper, 1 lower, 1 digit") which is good. | Ensure the password hint is always visible (not just on error) as shown in the wireframe. This is already specified correctly — just confirming it should be implemented as shown. |
| 20 | LOW | templates | **Table naming inconsistency.** S-004 story references `team_invites` table; DB spec uses `team_invitations`. S-012 uses `templates` and `template_columns` which matches the spec. Minor, but the invite table name should be documented as `team_invitations` (the spec version) and the story updated. | Update S-004 to reference `team_invitations` to match the DB spec. Not a blocker but reduces confusion. |

---

## Story Coverage Matrix

| Story | Covered? | Notes |
|-------|----------|-------|
| S-001 | Partial | Missing `email_verified` column (#1). Display name constraints mismatch (#3). No password change (#11). |
| S-002 | Full | Token rotation, refresh, logout, middleware all well specified. |
| S-003 | Partial | Soft delete not implemented (#2). Otherwise comprehensive. |
| S-004 | Partial | Missing invite role assignment (#5). Missing max invites limit (#6). Unauthenticated invite flow underspecified (#15). |
| S-005 | Full | RBAC well defined with permissions matrix and middleware. |
| S-006 | Partial | Sprint number missing (#10). Completed sprint admin override unclear (#18). |
| S-012 | Over-scoped | 6 templates instead of 2. Custom CRUD not needed (#4). |

---

## Verdict

### APPROVED WITH CONDITIONS

The Phase 1 specs demonstrate thorough engineering design and are largely ready for implementation. However, the following conditions must be met before development begins:

**Must fix (CRITICAL — blocks implementation):**
1. Add `email_verified` column to users table DB spec (Finding #1)
2. Implement soft delete for teams as specified in S-003 (Finding #2)
3. Resolve display name constraint mismatch between story and spec (Finding #3)

**Should fix (HIGH — fix before or during implementation):**
4. Reduce templates scope to match Phase 1 stories (Finding #4)
5. Add invite role assignment per S-004 (Finding #5)
6. Add max active invites enforcement per S-004 (Finding #6)
7. Standardize API response format across all features (Finding #7)
8. Standardize validation error HTTP status code (Finding #8)
9. Reconcile phase plan with DB specs (Finding #9)
10. Add sprint_number to sprints spec (Finding #10)
