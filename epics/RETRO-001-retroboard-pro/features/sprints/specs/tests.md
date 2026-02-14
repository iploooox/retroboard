# Sprints Test Plan

**changed:** 2026-02-14 — Spec Review Gate

**Feature:** sprints
**Test framework:** Vitest + Supertest
**Test database:** Dedicated test PostgreSQL database, reset between test suites
**Depends on:** Auth feature, Teams feature (tests use `createTestUser` and `createTestTeam` helpers)

---

## 1. Test Structure

```
tests/
  unit/
    sprints/
      validation.test.ts       # Sprint input validation rules
      status-transition.test.ts # Status transition logic
  integration/
    sprints/
      create-sprint.test.ts    # POST /api/v1/teams/:teamId/sprints
      list-sprints.test.ts     # GET /api/v1/teams/:teamId/sprints
      get-sprint.test.ts       # GET /api/v1/teams/:teamId/sprints/:id
      update-sprint.test.ts    # PUT /api/v1/teams/:teamId/sprints/:id
      activate-sprint.test.ts  # PUT /api/v1/teams/:teamId/sprints/:id/activate
      complete-sprint.test.ts  # PUT /api/v1/teams/:teamId/sprints/:id/complete
      delete-sprint.test.ts    # DELETE /api/v1/teams/:teamId/sprints/:id
```

---

## 2. Unit Tests

### 2.1 Sprint Validation (`validation.test.ts`)

| # | Test case | Input | Expected |
|---|-----------|-------|----------|
| U-SV-01 | Valid sprint data passes | `{ name: "Sprint 1", start_date: "2026-03-01", end_date: "2026-03-14" }` | No errors |
| U-SV-02 | Missing name rejected | `{ start_date: "2026-03-01" }` | Error on `name` |
| U-SV-03 | Empty name rejected | `{ name: "", start_date: "2026-03-01" }` | Error on `name` |
| U-SV-04 | Name over 100 chars rejected | 101-char name | Error on `name` |
| U-SV-05 | Missing start_date rejected | `{ name: "Sprint 1" }` | Error on `start_date` |
| U-SV-06 | Invalid date format rejected | `{ start_date: "02-28-2026" }` | Error on `start_date` |
| U-SV-07 | Invalid date value rejected | `{ start_date: "2026-13-45" }` | Error on `start_date` |
| U-SV-08 | end_date before start_date rejected | `{ start_date: "2026-03-14", end_date: "2026-03-01" }` | Error: `SPRINT_DATE_INVALID` |
| U-SV-09 | end_date equal to start_date accepted | `{ start_date: "2026-03-01", end_date: "2026-03-01" }` | No errors |
| U-SV-10 | Null end_date accepted | `{ name: "Sprint 1", start_date: "2026-03-01", end_date: null }` | No errors |
| U-SV-11 | Goal over 500 chars rejected | 501-char goal | Error on `goal` |
| U-SV-12 | Goal is optional | `{ name: "Sprint 1", start_date: "2026-03-01" }` | No errors, goal = null |
| U-SV-13 | Name with only whitespace rejected | `{ name: "   " }` | Error on `name` (after trim, becomes empty) |
| U-SV-14 | Invalid date (non-leap-year Feb 29) rejected | `{ start_date: "2027-02-29" }` | Error on `start_date` (2027 is not a leap year) |
| U-SV-15 | ISO datetime format rejected (date-only required) | `{ start_date: "2026-03-01T00:00:00Z" }` | Error on `start_date` (must be YYYY-MM-DD only) |

### 2.2 Status Transitions (`status-transition.test.ts`)

| # | Test case | Current status | Target status | Expected |
|---|-----------|---------------|---------------|----------|
| U-ST-01 | Planning to active | `planning` | `active` | Allowed |
| U-ST-02 | Active to completed | `active` | `completed` | Allowed |
| U-ST-03 | Planning to completed | `planning` | `completed` | Rejected: SPRINT_INVALID_TRANSITION |
| U-ST-04 | Active to planning | `active` | `planning` | Rejected: SPRINT_INVALID_TRANSITION |
| U-ST-05 | Completed to active | `completed` | `active` | Rejected: SPRINT_INVALID_TRANSITION |
| U-ST-06 | Completed to planning | `completed` | `planning` | Rejected: SPRINT_INVALID_TRANSITION |
| U-ST-07 | Planning to planning (no-op) | `planning` | `planning` | Rejected: SPRINT_INVALID_TRANSITION |
| U-ST-08 | Active to active (no-op) | `active` | `active` | Rejected: SPRINT_INVALID_TRANSITION |
| U-ST-09 | Completed to completed (no-op) | `completed` | `completed` | Rejected: SPRINT_INVALID_TRANSITION |

---

## 3. Integration Tests

### 3.1 Create Sprint (`create-sprint.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-CS-01 | Successful sprint creation | Admin user, team exists | POST /teams/:tid/sprints with valid data | 201, sprint returned with status=planning |
| I-CS-02 | Facilitator can create | Facilitator user | POST /teams/:tid/sprints | 201, success |
| I-CS-03 | Member cannot create | Member user | POST /teams/:tid/sprints | 403, TEAM_INSUFFICIENT_ROLE |
| I-CS-04 | Non-member cannot create | User not in team | POST /teams/:tid/sprints | 403, TEAM_NOT_MEMBER |
| I-CS-05 | Sprint starts in planning | Create sprint | Check response | status = "planning" |
| I-CS-06 | created_by set to current user | Create sprint | Check response | created_by = authenticated user's ID |
| I-CS-07 | Goal is optional | Create without goal | Check response | goal = null |
| I-CS-08 | end_date is optional | Create without end_date | Check response | end_date = null |
| I-CS-09 | end_date before start_date returns 400 | Admin user | POST with invalid dates | 400, SPRINT_DATE_INVALID |
| I-CS-10 | Non-existent team returns 404 | -- | POST /teams/random-uuid/sprints | 404, TEAM_NOT_FOUND |
| I-CS-11 | Missing name returns 400 | Admin user | POST with `{}` | 400, VALIDATION_ERROR |
| I-CS-12 | Multiple planning sprints allowed | Create 3 sprints | All succeed | 201, 201, 201 |
| I-CS-13 | Unauthenticated returns 401 | -- | POST without token | 401 |

### 3.2 List Sprints (`list-sprints.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-LS-01 | List all sprints for team | Team with 3 sprints | GET /teams/:tid/sprints | 200, 3 sprints |
| I-LS-02 | Sorted by start_date descending | 3 sprints with different dates | GET /teams/:tid/sprints | Most recent first |
| I-LS-03 | Filter by status=active | 1 active, 2 completed | GET ?status=active | 1 sprint returned |
| I-LS-04 | Filter by status=completed | 1 active, 2 completed | GET ?status=completed | 2 sprints returned |
| I-LS-05 | Filter by status=planning | 2 planning, 1 active | GET ?status=planning | 2 sprints returned |
| I-LS-06 | No filter returns all statuses | Mixed statuses | GET /teams/:tid/sprints | All sprints returned |
| I-LS-07 | Pagination: page 1 | 15 sprints, per_page=5 | GET ?page=1&per_page=5 | 5 sprints, total=15, total_pages=3 |
| I-LS-08 | Pagination: page 3 | 15 sprints, per_page=5 | GET ?page=3&per_page=5 | 5 sprints |
| I-LS-09 | Pagination: beyond last page | 5 sprints | GET ?page=2&per_page=10 | 0 sprints, total=5 |
| I-LS-10 | Empty list for team with no sprints | Team exists, no sprints | GET /teams/:tid/sprints | 200, empty array |
| I-LS-11 | Does not return other team's sprints | Team A has 2, Team B has 3 | GET /teams/:teamA/sprints | 2 sprints (only Team A's) |
| I-LS-12 | Non-member cannot list | Non-member user | GET /teams/:tid/sprints | 403, TEAM_NOT_MEMBER |
| I-LS-13 | Member can list | Member user | GET /teams/:tid/sprints | 200, success |
| I-LS-14 | Invalid status filter returns 400 | -- | GET ?status=invalid | 400, VALIDATION_ERROR |
| I-LS-15 | per_page capped at 100 | -- | GET ?per_page=200 | per_page in response = 100 |
| I-LS-16 | page=0 returns 400 | -- | GET ?page=0 | 400, VALIDATION_ERROR |
| I-LS-17 | page=-1 returns 400 | -- | GET ?page=-1 | 400, VALIDATION_ERROR |

### 3.3 Get Sprint (`get-sprint.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-GS-01 | Get sprint as team member | Sprint exists, user is member | GET /teams/:tid/sprints/:sid | 200, sprint details |
| I-GS-02 | Sprint not found returns 404 | Team exists | GET /teams/:tid/sprints/random-uuid | 404, SPRINT_NOT_FOUND |
| I-GS-03 | Sprint from different team returns 404 | Sprint in team A | GET /teams/:teamB/sprints/:sid | 404, SPRINT_NOT_FOUND |
| I-GS-04 | Non-member cannot get | Non-member user | GET /teams/:tid/sprints/:sid | 403, TEAM_NOT_MEMBER |
| I-GS-05 | All fields present | Sprint with all fields | GET sprint | All fields in response including dates, status, goal |

### 3.4 Update Sprint (`update-sprint.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-US-01 | Update name (planning) | Planning sprint, admin | PUT with `{ name: "New Name" }` | 200, name updated |
| I-US-02 | Update goal (planning) | Planning sprint, admin | PUT with `{ goal: "New goal" }` | 200, goal updated |
| I-US-03 | Update dates (planning) | Planning sprint, admin | PUT with `{ start_date, end_date }` | 200, dates updated |
| I-US-04 | Clear goal (set null) | Sprint with goal, admin | PUT with `{ goal: null }` | 200, goal = null |
| I-US-05 | Clear end_date (set null) | Sprint with end_date, admin | PUT with `{ end_date: null }` | 200, end_date = null |
| I-US-06 | Update name (active) | Active sprint, admin | PUT with `{ name: "New Name" }` | 200, name updated |
| I-US-07 | Update goal (active) | Active sprint, admin | PUT with `{ goal: "New goal" }` | 200, goal updated |
| I-US-08 | Dates ignored for active sprint | Active sprint | PUT with `{ start_date, name }` | 200, name updated, start_date unchanged |
| I-US-09 | Cannot update completed sprint | Completed sprint, admin | PUT with `{ name: "New Name" }` | 400, SPRINT_NOT_EDITABLE |
| I-US-10 | Facilitator can update | Planning sprint, facilitator | PUT with valid data | 200, updated |
| I-US-11 | Member cannot update | Planning sprint, member | PUT with valid data | 403, TEAM_INSUFFICIENT_ROLE |
| I-US-12 | Empty body returns 400 | Admin user | PUT with `{}` | 400, VALIDATION_ERROR |
| I-US-13 | Invalid end_date returns 400 | Planning sprint | PUT with end_date < start_date | 400, SPRINT_DATE_INVALID |
| I-US-14 | updated_at changes | Admin user | PUT with valid data | updated_at is newer than before |
| I-US-15 | Update active sprint with only date fields | Active sprint, admin | PUT with `{ start_date: "2026-04-01" }` | 400, VALIDATION_ERROR (no updatable fields provided — dates are ignored for active sprints) |

### 3.5 Activate Sprint (`activate-sprint.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-AS-01 | Activate planning sprint | Planning sprint, no active sprint | PUT /:sid/activate | 200, status = active |
| I-AS-02 | Cannot activate active sprint | Active sprint | PUT /:sid/activate | 400, SPRINT_INVALID_TRANSITION |
| I-AS-03 | Cannot activate completed sprint | Completed sprint | PUT /:sid/activate | 400, SPRINT_INVALID_TRANSITION |
| I-AS-04 | Cannot activate when another is active | Sprint A active, Sprint B planning | PUT /:sprintB/activate | 409, SPRINT_ALREADY_ACTIVE |
| I-AS-05 | Error includes active sprint details | Sprint A active | Activate Sprint B | 409, details.active_sprint_id = Sprint A's ID |
| I-AS-06 | Facilitator can activate | Facilitator user | PUT /:sid/activate | 200, success |
| I-AS-07 | Member cannot activate | Member user | PUT /:sid/activate | 403, TEAM_INSUFFICIENT_ROLE |
| I-AS-08 | Non-member cannot activate | Non-member | PUT /:sid/activate | 403, TEAM_NOT_MEMBER |
| I-AS-09 | Sprint from wrong team returns 404 | Sprint in team A | PUT on team B | 404, SPRINT_NOT_FOUND |
| I-AS-10 | Activate after completing previous | Activate sprint A, complete it, create sprint B | Activate sprint B | 200, sprint B active |
| I-AS-11 | updated_at changes on activation | Sprint | PUT /:sid/activate | updated_at is newer |
| I-AS-12 | Activate sprint via wrong team URL | Sprint belongs to team A, user is member of both | PUT /teams/:teamB/sprints/:sid/activate | 404, SPRINT_NOT_FOUND (team_id mismatch) |

### 3.6 Complete Sprint (`complete-sprint.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-CO-01 | Complete active sprint | Active sprint | PUT /:sid/complete | 200, status = completed |
| I-CO-02 | Cannot complete planning sprint | Planning sprint | PUT /:sid/complete | 400, SPRINT_INVALID_TRANSITION |
| I-CO-03 | Cannot complete already completed sprint | Completed sprint | PUT /:sid/complete | 400, SPRINT_INVALID_TRANSITION |
| I-CO-04 | Facilitator can complete | Active sprint, facilitator | PUT /:sid/complete | 200, success |
| I-CO-05 | Member cannot complete | Active sprint, member | PUT /:sid/complete | 403, TEAM_INSUFFICIENT_ROLE |
| I-CO-06 | After completion, sprint is read-only | Complete sprint | PUT /:sid `{ name: "New" }` | 400, SPRINT_NOT_EDITABLE |
| I-CO-07 | After completion, new sprint can be activated | Complete sprint, create new one | Activate new sprint | 200, success |
| I-CO-08 | updated_at changes on completion | Sprint | PUT /:sid/complete | updated_at is newer |

### 3.7 Delete Sprint (`delete-sprint.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-DS-01 | Admin deletes planning sprint | Admin, planning sprint | DELETE /:sid | 200, deleted |
| I-DS-02 | Admin deletes active sprint | Admin, active sprint | DELETE /:sid | 200, deleted |
| I-DS-03 | Admin deletes completed sprint | Admin, completed sprint | DELETE /:sid | 200, deleted |
| I-DS-04 | Facilitator cannot delete | Facilitator user | DELETE /:sid | 403, TEAM_INSUFFICIENT_ROLE |
| I-DS-05 | Member cannot delete | Member user | DELETE /:sid | 403, TEAM_INSUFFICIENT_ROLE |
| I-DS-06 | Non-member cannot delete | Non-member | DELETE /:sid | 403, TEAM_NOT_MEMBER |
| I-DS-07 | Deleted sprint not in list | Delete sprint | GET list | Sprint not returned |
| I-DS-08 | Delete non-existent sprint returns 404 | -- | DELETE /random-uuid | 404, SPRINT_NOT_FOUND |
| I-DS-09 | Deleting active sprint frees slot | Delete active sprint, create new | Activate new sprint | 200, success |

---

## 4. Edge Cases and Security Tests

| # | Test case | Description | Expected |
|---|-----------|-------------|----------|
| E-SP-01 | Concurrent activation of two sprints | Two users simultaneously activate different planning sprints for same team | One succeeds, other gets 409 (DB unique index prevents both) |
| E-SP-02 | Cross-team sprint access | User in team A tries to access sprint in team B via URL manipulation | 403 or 404 (team membership check) |
| E-SP-03 | SQL injection in sprint name | Create sprint with `'; DROP TABLE sprints; --` as name | Safely stored (tagged template prevents injection) |
| E-SP-04 | Sprint with max-length fields | Name=100 chars, goal=500 chars | 201, all stored |
| E-SP-05 | Sprint with far-future dates | start_date: 2099-12-31 | 201, accepted |
| E-SP-06 | Sprint with past dates | start_date: 2020-01-01 | 201, accepted (dates are informational) |
| E-SP-07 | Team deletion cascades to sprints | Delete team with 5 sprints | All sprints deleted, no orphans |
| E-SP-08 | UUID format validation on team_id | Pass "abc" as teamId | 400, VALIDATION_ERROR (not 500) |
| E-SP-09 | UUID format validation on sprint_id | Pass "abc" as sprint id | 400, VALIDATION_ERROR (not 500) |
| E-SP-10 | Large number of sprints pagination | Team with 500 completed sprints | Paginated query returns in < 500ms |
| E-SP-11 | Concurrent sprint completion | Two facilitators complete same active sprint simultaneously | One succeeds (200), other gets 400 SPRINT_INVALID_TRANSITION |
| E-SP-12 | Sprint number auto-increments per team | Create 3 sprints in a team | Sprint numbers are 1, 2, 3 |
| E-SP-13 | Sprint number is returned in API response | Create sprint | Response includes `sprint_number` field |

---

## 5. Test Utilities

### Test Helper: createTestSprint

```typescript
async function createTestSprint(
  token: string,
  teamId: string,
  overrides?: Partial<CreateSprintInput>
): Promise<{ sprint: SprintResponse }> {
  const data = {
    name: `Sprint ${randomUUID().slice(0, 8)}`,
    goal: 'Test sprint goal',
    start_date: '2026-03-01',
    end_date: '2026-03-14',
    ...overrides,
  };
  const res = await request(app)
    .post(`/api/v1/teams/${teamId}/sprints`)
    .set('Authorization', `Bearer ${token}`)
    .send(data);
  return res.body;
}
```

### Test Helper: activateSprint

```typescript
async function activateSprint(
  token: string,
  teamId: string,
  sprintId: string
): Promise<{ sprint: SprintResponse }> {
  const res = await request(app)
    .put(`/api/v1/teams/${teamId}/sprints/${sprintId}/activate`)
    .set('Authorization', `Bearer ${token}`);
  return res.body;
}
```

### Test Helper: completeSprint

```typescript
async function completeSprint(
  token: string,
  teamId: string,
  sprintId: string
): Promise<{ sprint: SprintResponse }> {
  const res = await request(app)
    .put(`/api/v1/teams/${teamId}/sprints/${sprintId}/complete`)
    .set('Authorization', `Bearer ${token}`);
  return res.body;
}
```

### Database Reset

```typescript
beforeEach(async () => {
  await sql`TRUNCATE sprints, team_invitations, team_members, teams, refresh_tokens, users CASCADE`;
});
```

---

## 6. Test Coverage Targets

| Category | Target |
|----------|--------|
| Unit tests | 100% of validation and status transition logic |
| Integration tests | 100% of API endpoints, all success and error paths |
| Line coverage | > 90% across sprints feature files |
| Branch coverage | > 85% across sprints feature files |
