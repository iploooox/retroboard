# Teams Test Plan

**Feature:** teams
**Test framework:** Vitest + Supertest
**Test database:** Dedicated test PostgreSQL database, reset between test suites
**Depends on:** Auth feature (tests use `createTestUser` helper)

---

## 1. Test Structure

```
tests/
  unit/
    teams/
      slug.test.ts            # Slug generation utility
      invite-code.test.ts     # Invite code generation
      rbac.test.ts            # RBAC middleware logic
  integration/
    teams/
      create-team.test.ts     # POST /api/v1/teams
      list-teams.test.ts      # GET /api/v1/teams
      get-team.test.ts        # GET /api/v1/teams/:id
      update-team.test.ts     # PUT /api/v1/teams/:id
      delete-team.test.ts     # DELETE /api/v1/teams/:id
      members.test.ts         # GET/PUT/DELETE members
      invitations.test.ts     # POST invitations, POST join
```

---

## 2. Unit Tests

### 2.1 Slug Generation (`slug.test.ts`)

| # | Test case | Input | Expected |
|---|-----------|-------|----------|
| U-SLG-01 | Simple name | `"Sprint Warriors"` | `"sprint-warriors"` |
| U-SLG-02 | Multiple spaces | `"My  Cool   Team"` | `"my-cool-team"` |
| U-SLG-03 | Special characters | `"Team @#$% 2026!"` | `"team-2026"` |
| U-SLG-04 | Leading/trailing spaces | `"  Team A  "` | `"team-a"` |
| U-SLG-05 | Already a slug | `"my-team"` | `"my-team"` |
| U-SLG-06 | Unicode characters | `"Team Zolkiewska"` | `"team-zolkiewska"` |
| U-SLG-07 | Max length truncation | 120-char name | Slug truncated to 50 chars at word boundary |
| U-SLG-08 | All special chars | `"@#$%^&*"` | Fallback to `"team"` or similar |
| U-SLG-09 | Numbers only | `"12345"` | `"12345"` |
| U-SLG-10 | Consecutive hyphens after cleanup | `"Team---Name"` | `"team-name"` |

### 2.2 Invite Code Generation (`invite-code.test.ts`)

| # | Test case | Input | Expected |
|---|-----------|-------|----------|
| U-INV-01 | Code is 12 characters | Generate code | Length 12 |
| U-INV-02 | Code is alphanumeric | Generate code | Matches `^[a-zA-Z0-9]{12}$` |
| U-INV-03 | Codes are unique | Generate 100 codes | All different |
| U-INV-04 | Code is cryptographically random | Generate many codes | Uniform distribution (statistical test) |

### 2.3 RBAC Logic (`rbac.test.ts`)

| # | Test case | Input | Expected |
|---|-----------|-------|----------|
| U-RBAC-01 | Admin passes admin check | `role: 'admin'`, required: `['admin']` | Passes |
| U-RBAC-02 | Facilitator fails admin check | `role: 'facilitator'`, required: `['admin']` | Rejects |
| U-RBAC-03 | Member fails admin check | `role: 'member'`, required: `['admin']` | Rejects |
| U-RBAC-04 | Facilitator passes admin-or-facilitator check | `role: 'facilitator'`, required: `['admin', 'facilitator']` | Passes |
| U-RBAC-05 | Member fails admin-or-facilitator check | `role: 'member'`, required: `['admin', 'facilitator']` | Rejects |
| U-RBAC-06 | Any role passes any-member check | `role: 'member'`, required: `['admin', 'facilitator', 'member']` | Passes |

---

## 3. Integration Tests

### 3.1 Create Team (`create-team.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-CT-01 | Successful team creation | Authenticated user | POST /teams with valid data | 201, team returned with slug, your_role = admin |
| I-CT-02 | Creator is admin | Create team | Query team_members | Row exists with role = 'admin' |
| I-CT-03 | Slug auto-generated from name | Create team "My Team" | Check response | slug = "my-team" |
| I-CT-04 | Slug uniqueness with suffix | Create two teams named "My Team" | Check slugs | First: "my-team", second: "my-team-2" |
| I-CT-05 | Missing name returns 400 | Authenticated user | POST /teams `{}` | 400, VALIDATION_ERROR |
| I-CT-06 | Empty name returns 400 | Authenticated user | POST /teams `{ name: "" }` | 400, VALIDATION_ERROR |
| I-CT-07 | Name over 100 chars returns 400 | Authenticated user | POST /teams with 101-char name | 400, VALIDATION_ERROR |
| I-CT-08 | Description is optional | Authenticated user | POST /teams without description | 201, description is null |
| I-CT-09 | member_count is 1 after creation | Create team | Check response | member_count = 1 |
| I-CT-10 | Unauthenticated request returns 401 | -- | POST /teams without token | 401 |

### 3.2 List Teams (`list-teams.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-LT-01 | Returns user's teams | User in 2 teams | GET /teams | 200, 2 teams returned |
| I-LT-02 | Does not return other users' teams | User A in team 1, User B in team 2 | User A: GET /teams | Only team 1 returned |
| I-LT-03 | Returns your_role per team | User is admin in team 1, member in team 2 | GET /teams | Correct roles per team |
| I-LT-04 | Pagination: page 1 | 25 teams, per_page=10 | GET /teams?page=1&per_page=10 | 10 teams, total=25, total_pages=3 |
| I-LT-05 | Pagination: page 3 | 25 teams, per_page=10 | GET /teams?page=3&per_page=10 | 5 teams |
| I-LT-06 | Empty list for new user | New user, no teams | GET /teams | 200, empty array |
| I-LT-07 | Returns member_count | Team with 3 members | GET /teams | member_count = 3 |
| I-LT-08 | per_page max 100 | -- | GET /teams?per_page=200 | Capped at 100 |

### 3.3 Get Team (`get-team.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-GT-01 | Get team as member | User is member of team | GET /teams/:id | 200, team details |
| I-GT-02 | Non-member gets 403 | User is NOT a member | GET /teams/:id | 403, TEAM_NOT_MEMBER |
| I-GT-03 | Non-existent team returns 404 | -- | GET /teams/random-uuid | 404, TEAM_NOT_FOUND |
| I-GT-04 | Invalid UUID format returns 400 | -- | GET /teams/not-a-uuid | 400, VALIDATION_ERROR |
| I-GT-05 | Returns your_role | User is facilitator | GET /teams/:id | your_role = "facilitator" |

### 3.4 Update Team (`update-team.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-UT-01 | Admin updates name | Admin user | PUT /teams/:id `{ name: "New Name" }` | 200, name updated |
| I-UT-02 | Admin updates description | Admin user | PUT /teams/:id `{ description: "New desc" }` | 200, description updated |
| I-UT-03 | Admin clears description | Admin user | PUT /teams/:id `{ description: null }` | 200, description is null |
| I-UT-04 | Slug does NOT change when name changes | Admin user | PUT /teams/:id `{ name: "New Name" }` | 200, slug unchanged |
| I-UT-05 | Facilitator cannot update | Facilitator user | PUT /teams/:id | 403, TEAM_INSUFFICIENT_ROLE |
| I-UT-06 | Member cannot update | Member user | PUT /teams/:id | 403, TEAM_INSUFFICIENT_ROLE |
| I-UT-07 | Non-member gets 403 | Non-member user | PUT /teams/:id | 403, TEAM_NOT_MEMBER |
| I-UT-08 | Empty body returns 400 | Admin user | PUT /teams/:id `{}` | 400, VALIDATION_ERROR |
| I-UT-09 | updated_at changes | Admin user | PUT /teams/:id with valid data | updated_at is newer |

### 3.5 Delete Team (`delete-team.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-DT-01 | Admin deletes team | Admin user | DELETE /teams/:id | 200, success |
| I-DT-02 | Team data cascaded | Delete team | Query team_members, team_invitations | No rows for this team |
| I-DT-03 | Facilitator cannot delete | Facilitator user | DELETE /teams/:id | 403, TEAM_INSUFFICIENT_ROLE |
| I-DT-04 | Member cannot delete | Member user | DELETE /teams/:id | 403, TEAM_INSUFFICIENT_ROLE |
| I-DT-05 | Non-member gets 403 | Non-member user | DELETE /teams/:id | 403, TEAM_NOT_MEMBER |
| I-DT-06 | Delete non-existent team returns 404 | -- | DELETE /teams/random-uuid | 404, TEAM_NOT_FOUND |
| I-DT-07 | Deleted team not in list | Delete team | GET /teams | Team not listed |

### 3.6 Members (`members.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-MEM-01 | List members | Team with 3 members | GET /teams/:id/members | 200, 3 members with roles |
| I-MEM-02 | Members sorted by role then joined_at | Team with mixed roles | GET /teams/:id/members | Admins first, then facilitators, then members |
| I-MEM-03 | Non-member cannot list | Non-member user | GET /teams/:id/members | 403 |
| I-MEM-04 | Admin changes member to facilitator | Admin, target is member | PUT /teams/:id/members/:userId `{ role: "facilitator" }` | 200, role updated |
| I-MEM-05 | Admin promotes to admin | Admin, target is member | PUT /teams/:id/members/:userId `{ role: "admin" }` | 200, role is admin |
| I-MEM-06 | Admin demotes admin | Two admins | PUT /teams/:id/members/:userId `{ role: "member" }` | 200, demoted |
| I-MEM-07 | Cannot demote last admin | Single admin | PUT to demote self | 400, TEAM_LAST_ADMIN |
| I-MEM-08 | Facilitator cannot change roles | Facilitator user | PUT /teams/:id/members/:userId | 403, TEAM_INSUFFICIENT_ROLE |
| I-MEM-09 | Member cannot change roles | Member user | PUT /teams/:id/members/:userId | 403, TEAM_INSUFFICIENT_ROLE |
| I-MEM-10 | Invalid role value returns 400 | Admin user | PUT with `{ role: "superadmin" }` | 400, VALIDATION_ERROR |
| I-MEM-11 | Admin removes member | Admin, target is member | DELETE /teams/:id/members/:userId | 200, member removed |
| I-MEM-12 | Member leaves team (self-remove) | Member user | DELETE /teams/:id/members/own-id | 200, left team |
| I-MEM-13 | Last admin cannot leave | Single admin | DELETE /teams/:id/members/own-id | 400, TEAM_LAST_ADMIN |
| I-MEM-14 | Non-admin cannot remove others | Member tries to remove another member | DELETE /teams/:id/members/:otherId | 403, TEAM_INSUFFICIENT_ROLE |
| I-MEM-15 | Removed member cannot access team | Remove member | GET /teams/:id as removed user | 403, TEAM_NOT_MEMBER |
| I-MEM-16 | Remove non-existent member returns 404 | Admin | DELETE /teams/:id/members/random-uuid | 404 |

### 3.7 Invitations (`invitations.test.ts`)

| # | Test case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| I-INV-01 | Admin creates invite | Admin user | POST /teams/:id/invitations | 201, invite with code and URL |
| I-INV-02 | Facilitator creates invite | Facilitator user | POST /teams/:id/invitations | 201, success |
| I-INV-03 | Member cannot create invite | Member user | POST /teams/:id/invitations | 403, TEAM_INSUFFICIENT_ROLE |
| I-INV-04 | Invite code is 12 alphanumeric chars | Create invite | Check response | code matches `^[a-zA-Z0-9]{12}$` |
| I-INV-05 | Custom expiry | Admin | POST with `{ expires_in_hours: 24 }` | expires_at is ~24 hours from now |
| I-INV-06 | Custom max_uses | Admin | POST with `{ max_uses: 5 }` | max_uses = 5, use_count = 0 |
| I-INV-07 | Default expiry (7 days) | Admin | POST with `{}` | expires_at is ~7 days from now |
| I-INV-08 | Default unlimited uses | Admin | POST with `{}` | max_uses = null |
| I-INV-09 | Join via valid invite | New user | POST /teams/join/:code | 200, team and membership returned |
| I-INV-10 | Joined user has member role | Join via invite | Check membership | role = "member" |
| I-INV-11 | use_count incremented | Join via invite | Check DB | use_count = 1 |
| I-INV-12 | Already a member returns 409 | Existing member | POST /teams/join/:code | 409, TEAM_MEMBER_EXISTS |
| I-INV-13 | Expired invite returns 410 | Invite with past expires_at | POST /teams/join/:code | 410, TEAM_INVITE_EXPIRED |
| I-INV-14 | Exhausted invite returns 410 | Invite with max_uses=1, use_count=1 | POST /teams/join/:code | 410, TEAM_INVITE_EXHAUSTED |
| I-INV-15 | Invalid code returns 404 | -- | POST /teams/join/INVALID | 404, TEAM_INVITE_NOT_FOUND |
| I-INV-16 | Multiple users join same invite | Invite with max_uses=3 | 3 users join | All succeed, use_count = 3 |
| I-INV-17 | 4th user on max_uses=3 invite | use_count = 3 | Join | 410, TEAM_INVITE_EXHAUSTED |
| I-INV-18 | Invite deleted with team | Delete team | Query team_invitations | No rows |
| I-INV-19 | Unauthenticated join returns 401 | -- | POST /teams/join/:code without token | 401 |
| I-INV-20 | Invalid expires_in_hours (0) returns 400 | Admin | POST with `{ expires_in_hours: 0 }` | 400, VALIDATION_ERROR |
| I-INV-21 | Invalid expires_in_hours (>720) returns 400 | Admin | POST with `{ expires_in_hours: 800 }` | 400, VALIDATION_ERROR |

---

## 4. Edge Cases and Security Tests

| # | Test case | Description | Expected |
|---|-----------|-------------|----------|
| E-TM-01 | Concurrent team creation with same name | Two users create "My Team" simultaneously | Both succeed with unique slugs |
| E-TM-02 | SQL injection in team name | Create team with `'; DROP TABLE teams; --` | Safely stored (tagged template prevents injection) |
| E-TM-03 | Team with max-length fields | All fields at maximum length | 201, all stored correctly |
| E-TM-04 | User deleted, team persists | Delete user who is a member (not creator) | Team still exists, member removed via CASCADE |
| E-TM-05 | Race condition: two users join same invite simultaneously | Concurrent join requests | Both succeed if under max_uses limit |
| E-TM-06 | Invite code brute force | Try 100 random codes | All return 404 (not 500 or other info leak) |
| E-TM-07 | Cross-team data isolation | User in team A tries to access team B | 403, TEAM_NOT_MEMBER |
| E-TM-08 | UUID format validation | Pass "abc" as team ID | 400, VALIDATION_ERROR (not 500) |

---

## 5. Test Utilities

### Test Helper: createTestTeam

```typescript
async function createTestTeam(
  token: string,
  overrides?: Partial<CreateTeamInput>
): Promise<{ team: TeamResponse }> {
  const data = {
    name: `Test Team ${randomUUID().slice(0, 8)}`,
    description: 'A test team',
    ...overrides,
  };
  const res = await request(app)
    .post('/api/v1/teams')
    .set('Authorization', `Bearer ${token}`)
    .send(data);
  return res.body;
}
```

### Test Helper: addTeamMember

```typescript
async function addTeamMember(
  teamId: string,
  userId: string,
  role: 'admin' | 'facilitator' | 'member' = 'member'
): Promise<void> {
  await sql`
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (${teamId}, ${userId}, ${role})
  `;
}
```

### Database Reset

```typescript
beforeEach(async () => {
  await sql`TRUNCATE team_invitations, team_members, teams, refresh_tokens, users CASCADE`;
});
```

---

## 6. Test Coverage Targets

| Category | Target |
|----------|--------|
| Unit tests | 100% of slug, invite code, and RBAC utility functions |
| Integration tests | 100% of API endpoints, all success and error paths |
| Line coverage | > 90% across teams feature files |
| Branch coverage | > 85% across teams feature files |
