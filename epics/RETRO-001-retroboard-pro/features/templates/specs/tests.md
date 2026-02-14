# Templates — Test Plan

## Test Framework

- **Unit tests**: Vitest
- **Integration tests**: Vitest + Supertest (HTTP) + postgres (test database)
- **Test database**: Isolated PostgreSQL database, migrated fresh per test suite, seeded with system templates

## Test Utilities

```typescript
// tests/helpers/factories.ts (extends existing factories)
createTemplate(teamId, overrides?) -> Template
createTemplateColumn(templateId, overrides?) -> TemplateColumn
getSystemTemplate(slug: 'www-delta' | 'start-stop-continue' | '4ls' | 'mad-sad-glad' | 'sailboat' | 'starfish') -> Template
```

---

## 1. Unit Tests

### 1.1 Template Validation Logic

**File:** `tests/unit/templates/validation.test.ts`

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1.1.1 | Valid template with 3 columns | Validation passes |
| 1.1.2 | Template with empty name | Validation error: name required |
| 1.1.3 | Template with name exceeding 100 chars | Validation error: name too long |
| 1.1.4 | Template with 0 columns | Validation error: at least 1 column required |
| 1.1.5 | Template with 11 columns | Validation error: max 10 columns |
| 1.1.6 | Template with duplicate column names | Validation error: column names must be unique |
| 1.1.7 | Template column with invalid hex color "#xyz" | Validation error: invalid color format |
| 1.1.8 | Template column with valid hex color "#ff5733" | Validation passes |
| 1.1.9 | Template column with empty name | Validation error: column name required |
| 1.1.10 | Template column with prompt_text exceeding 200 chars | Validation error: prompt too long |
| 1.1.11 | Template with non-sequential positions (0, 2, 3) | Validation error: positions must be sequential from 0 |
| 1.1.12 | Template with duplicate positions | Validation error: positions must be unique |
| 1.1.13 | Template description exceeding 500 chars | Validation error: description too long |
| 1.1.14 | Template with exactly 10 columns | Validation passes |
| 1.1.15 | Template with exactly 1 column | Validation passes |

### 1.2 Template Column Update Logic

**File:** `tests/unit/templates/column-update.test.ts`

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1.2.1 | Update with all existing columns (no changes) | All columns preserved |
| 1.2.2 | Update with one new column added | New column created, existing preserved |
| 1.2.3 | Update with one column removed | Column deleted, others preserved |
| 1.2.4 | Update with column renamed | Column name updated |
| 1.2.5 | Update with column color changed | Column color updated |
| 1.2.6 | Update with columns reordered | Positions updated |
| 1.2.7 | Full replacement with entirely new columns | All old columns deleted, new ones created |
| 1.2.8 | Update with invalid column ID (not in this template) | Validation error |

---

## 2. Integration Tests

### 2.1 GET /api/v1/templates — List Templates

**File:** `tests/integration/templates/list-templates.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.1.1 | List templates without team_id filter | 200 | All 6 system templates + user's team custom templates |
| 2.1.2 | List templates with team_id filter | 200 | 6 system + that team's custom templates only |
| 2.1.3 | List templates with include_system=false | 200 | Only custom templates, no system templates |
| 2.1.4 | List templates as unauthenticated user | 401 | UNAUTHORIZED |
| 2.1.5 | System templates listed first, then custom by created_at desc | 200 | Correct ordering |
| 2.1.6 | Each template includes column_count | 200 | column_count matches actual columns |
| 2.1.7 | Custom templates from other teams not visible | 200 | Only user's team templates returned |
| 2.1.8 | User in multiple teams sees custom templates from all teams | 200 | Templates from all user's teams included |

### 2.2 GET /api/v1/templates/:id — Get Template Detail

**File:** `tests/integration/templates/get-template.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.2.1 | Get system template (What Went Well / Delta) | 200 | Template with 2 columns, correct colors and prompts |
| 2.2.2 | Get system template (Starfish) | 200 | Template with 5 columns |
| 2.2.3 | Get custom template as team member | 200 | Full template with columns |
| 2.2.4 | Get custom template from another team | 404 | TEMPLATE_NOT_FOUND |
| 2.2.5 | Get non-existent template ID | 404 | TEMPLATE_NOT_FOUND |
| 2.2.6 | Columns ordered by position | 200 | Columns in ascending position order |
| 2.2.7 | Get template without authentication | 401 | UNAUTHORIZED |

### 2.3 POST /api/v1/teams/:teamId/templates — Create Custom Template

**File:** `tests/integration/templates/create-template.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.3.1 | Create template with valid data and 3 columns | 201 | Template created with columns |
| 2.3.2 | Create template with 1 column (minimum) | 201 | Template created |
| 2.3.3 | Create template with 10 columns (maximum) | 201 | Template created |
| 2.3.4 | Create template with 11 columns | 422 | VALIDATION_ERROR |
| 2.3.5 | Create template with 0 columns | 422 | VALIDATION_ERROR |
| 2.3.6 | Create template with duplicate name in team | 409 | TEMPLATE_NAME_TAKEN |
| 2.3.7 | Create template with same name as system template | 201 | Allowed (different namespace — team_id is not NULL) |
| 2.3.8 | Create template as team member (not admin) | 403 | FORBIDDEN |
| 2.3.9 | Create template as facilitator (not admin) | 403 | FORBIDDEN |
| 2.3.10 | Create template for non-existent team | 404 | TEAM_NOT_FOUND |
| 2.3.11 | Create template for team user doesn't belong to | 403 | FORBIDDEN |
| 2.3.12 | Create template with missing name | 422 | VALIDATION_ERROR |
| 2.3.13 | Create template with missing columns | 422 | VALIDATION_ERROR |
| 2.3.14 | Create template with duplicate column names | 422 | VALIDATION_ERROR |
| 2.3.15 | Create template with invalid column color | 422 | VALIDATION_ERROR |
| 2.3.16 | Response includes created_by set to current user | 201 | created_by matches JWT user |
| 2.3.17 | Response includes is_system = false | 201 | is_system is false |

### 2.4 PUT /api/v1/teams/:teamId/templates/:id — Update Custom Template

**File:** `tests/integration/templates/update-template.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.4.1 | Update template name | 200 | Name updated, columns unchanged |
| 2.4.2 | Update template description | 200 | Description updated |
| 2.4.3 | Update template columns (add new column) | 200 | New column added, existing preserved |
| 2.4.4 | Update template columns (remove a column) | 200 | Column removed, others preserved |
| 2.4.5 | Update template columns (full replacement) | 200 | All old columns replaced with new ones |
| 2.4.6 | Update template with name that conflicts with another custom template | 409 | TEMPLATE_NAME_TAKEN |
| 2.4.7 | Update system template | 403 | SYSTEM_TEMPLATE_IMMUTABLE |
| 2.4.8 | Update template as non-admin | 403 | FORBIDDEN |
| 2.4.9 | Update template from another team | 404 | TEMPLATE_NOT_FOUND |
| 2.4.10 | Update non-existent template | 404 | TEMPLATE_NOT_FOUND |
| 2.4.11 | Update with invalid data (empty name) | 422 | VALIDATION_ERROR |
| 2.4.12 | Update only name (no columns in body) | 200 | Name updated, columns unchanged |
| 2.4.13 | updated_at changes after update | 200 | updated_at is more recent |
| 2.4.14 | Existing boards unaffected after template update | 200 | Board columns remain as they were at creation time |

### 2.5 DELETE /api/v1/teams/:teamId/templates/:id — Delete Custom Template

**File:** `tests/integration/templates/delete-template.test.ts`

| # | Test Case | HTTP | Expected |
|---|-----------|------|----------|
| 2.5.1 | Delete unused custom template | 200 | Template and columns deleted |
| 2.5.2 | Delete custom template that has boards referencing it | 409 | TEMPLATE_IN_USE |
| 2.5.3 | Delete system template | 403 | SYSTEM_TEMPLATE_IMMUTABLE |
| 2.5.4 | Delete template as non-admin | 403 | FORBIDDEN |
| 2.5.5 | Delete template from another team | 404 | TEMPLATE_NOT_FOUND |
| 2.5.6 | Delete non-existent template | 404 | TEMPLATE_NOT_FOUND |
| 2.5.7 | After deletion, template columns also deleted (cascade) | 200 | No orphaned template_columns rows |
| 2.5.8 | After deletion, template no longer appears in list | 200 | GET /templates does not include deleted template |

---

## 3. System Template Seed Tests

**File:** `tests/integration/templates/system-templates.test.ts`

These tests verify the seed data is correct and complete.

| # | Test Case | Expected |
|---|-----------|----------|
| 3.1 | All 6 system templates exist after migration | 6 templates with is_system=true |
| 3.2 | What Went Well / Delta has 2 columns | Columns: "What Went Well" (#22c55e), "Delta (What to Change)" (#ef4444) |
| 3.3 | Start / Stop / Continue has 3 columns | Columns: "Start Doing" (#22c55e), "Stop Doing" (#ef4444), "Continue Doing" (#3b82f6) |
| 3.4 | 4Ls has 4 columns | Columns: "Liked" (#22c55e), "Learned" (#3b82f6), "Lacked" (#f59e0b), "Longed For" (#8b5cf6) |
| 3.5 | Mad / Sad / Glad has 3 columns | Columns: "Mad" (#ef4444), "Sad" (#6366f1), "Glad" (#22c55e) |
| 3.6 | Sailboat has 4 columns | Columns: "Wind (Helps Us)" (#22c55e), "Anchor (Holds Us Back)" (#ef4444), "Rocks (Risks)" (#f59e0b), "Island (Goals)" (#3b82f6) |
| 3.7 | Starfish has 5 columns | Columns: "Keep Doing" (#22c55e), "More Of" (#3b82f6), "Less Of" (#f59e0b), "Stop Doing" (#ef4444), "Start Doing" (#8b5cf6) |
| 3.8 | All system templates have team_id = NULL | All 6 have NULL team_id |
| 3.9 | All system templates have created_by = NULL | All 6 have NULL created_by |
| 3.10 | All system templates have non-empty descriptions | All 6 have description.length > 0 |
| 3.11 | All template columns have non-empty prompt_text | All columns across all system templates have prompt_text.length > 0 |
| 3.12 | Column positions are sequential starting from 0 | Verified for all 6 templates |
| 3.13 | Seed is idempotent (running twice does not create duplicates) | Still exactly 6 system templates after re-run |

---

## 4. Edge Cases

**File:** `tests/integration/templates/edge-cases.test.ts`

| # | Test Case | Expected |
|---|-----------|----------|
| 4.1 | Create custom template with same name as system template | 201 (allowed — different team_id namespace) |
| 4.2 | Two different teams create templates with same name | Both succeed (different team_id) |
| 4.3 | Delete team with custom templates | Templates cascade deleted with team |
| 4.4 | Delete user who created a custom template | Template persists, created_by set to NULL |
| 4.5 | Create board from custom template, then delete template | Delete blocked (TEMPLATE_IN_USE) |
| 4.6 | Create board from custom template, delete board, then delete template | Template deletion succeeds |
| 4.7 | Template with maximum length name (100 chars) | Created successfully |
| 4.8 | Template with maximum length description (500 chars) | Created successfully |
| 4.9 | Template column with maximum length prompt_text (200 chars) | Created successfully |
| 4.10 | Update template to have same name as itself | 200 OK (no conflict with self) |

---

## 5. Test Coverage Requirements

| Area | Minimum Coverage |
|------|-----------------|
| Template CRUD handlers | 95% |
| Template validation | 100% |
| Column update logic (full replacement) | 95% |
| System template protection | 100% |
| Authorization checks | 100% |
| Seed data correctness | 100% |
| Input validation | 90% |
| Database constraints | 85% |

## 6. Test Data Fixtures

### Standard Template Setup

```typescript
async function setupTemplates() {
  const admin = await createUser({ name: 'Admin' });
  const member = await createUser({ name: 'Member' });
  const team = await createTeam({ name: 'Test Team' });
  await createTeamMember(team.id, admin.id, 'admin');
  await createTeamMember(team.id, member.id, 'member');

  // System templates are already seeded by migration
  const systemTemplates = await listSystemTemplates();

  // Create a custom template for testing
  const customTemplate = await createTemplate(team.id, {
    name: 'Custom Test Template',
    description: 'A template for testing',
    columns: [
      { name: 'Column A', color: '#22c55e', prompt_text: 'Prompt A', position: 0 },
      { name: 'Column B', color: '#ef4444', prompt_text: 'Prompt B', position: 1 },
    ],
    created_by: admin.id,
  });

  return { admin, member, team, systemTemplates, customTemplate };
}
```

### Template With Board Reference

```typescript
async function setupTemplateWithBoard() {
  const { admin, team, customTemplate } = await setupTemplates();
  const sprint = await createSprint(team.id, { name: 'Sprint 1' });
  const board = await createBoard(sprint.id, customTemplate.id);

  return { admin, team, customTemplate, sprint, board };
}
```
