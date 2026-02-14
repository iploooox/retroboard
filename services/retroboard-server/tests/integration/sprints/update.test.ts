import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import { truncateTables, createTestTeam } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

async function addTeamMember(teamId: string, userId: string, role: string) {
  await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${teamId}, ${userId}, ${role})`;
}

async function createSprint(token: string, teamId: string, data: Record<string, unknown> = {}) {
  const res = await app.request(`/api/v1/teams/${teamId}/sprints`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sprint 1', start_date: '2026-03-01', end_date: '2026-03-14', ...data }),
  });
  return (await res.json()).sprint;
}

async function activateSprint(token: string, teamId: string, sprintId: string) {
  await app.request(`/api/v1/teams/${teamId}/sprints/${sprintId}/activate`, {
    method: 'PUT', headers: { 'Authorization': `Bearer ${token}` },
  });
}

async function completeSprint(token: string, teamId: string, sprintId: string) {
  await app.request(`/api/v1/teams/${teamId}/sprints/${sprintId}/complete`, {
    method: 'PUT', headers: { 'Authorization': `Bearer ${token}` },
  });
}

describe('PUT /api/v1/teams/:teamId/sprints/:id', () => {
  let adminToken: string;
  let adminUser: { id: string };
  let team: { id: string };

  beforeEach(async () => {
    await truncateTables();
    const auth = await getAuthToken();
    adminToken = auth.token;
    adminUser = auth.user;
    team = await createTestTeam(adminUser.id);
  });

  it('I-US-01: update name (planning)', async () => {
    const sprint = await createSprint(adminToken, team.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.name).toBe('New Name');
  });

  it('I-US-02: update goal (planning)', async () => {
    const sprint = await createSprint(adminToken, team.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: 'New goal' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.goal).toBe('New goal');
  });

  it('I-US-03: update dates (planning)', async () => {
    const sprint = await createSprint(adminToken, team.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: '2026-04-01', end_date: '2026-04-14' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.start_date).toBe('2026-04-01');
    expect(body.sprint.end_date).toBe('2026-04-14');
  });

  it('I-US-04: clear goal (set null)', async () => {
    const sprint = await createSprint(adminToken, team.id, { goal: 'Some goal' });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.goal).toBeNull();
  });

  it('I-US-05: clear end_date (set null)', async () => {
    const sprint = await createSprint(adminToken, team.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ end_date: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.end_date).toBeNull();
  });

  it('I-US-06: update name (active)', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await activateSprint(adminToken, team.id, sprint.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Active Name' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.name).toBe('New Active Name');
  });

  it('I-US-07: update goal (active)', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await activateSprint(adminToken, team.id, sprint.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: 'New active goal' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.goal).toBe('New active goal');
  });

  it('I-US-08: dates ignored for active sprint', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await activateSprint(adminToken, team.id, sprint.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: '2026-05-01', name: 'Updated Name' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.name).toBe('Updated Name');
    expect(body.sprint.start_date).toBe('2026-03-01'); // unchanged
  });

  it('I-US-09: cannot update completed sprint', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await activateSprint(adminToken, team.id, sprint.id);
    await completeSprint(adminToken, team.id, sprint.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_NOT_EDITABLE');
  });

  it('I-US-10: facilitator can update', async () => {
    const sprint = await createSprint(adminToken, team.id);
    const facAuth = await getAuthToken({ email: 'fac@example.com' });
    await addTeamMember(team.id, facAuth.user.id, 'facilitator');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${facAuth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated by Facilitator' }),
    });

    expect(res.status).toBe(200);
  });

  it('I-US-11: member cannot update', async () => {
    const sprint = await createSprint(adminToken, team.id);
    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    await addTeamMember(team.id, memberAuth.user.id, 'member');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${memberAuth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated by Member' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_INSUFFICIENT_ROLE');
  });

  it('I-US-12: empty body returns 400', async () => {
    const sprint = await createSprint(adminToken, team.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('I-US-13: invalid end_date returns 400', async () => {
    const sprint = await createSprint(adminToken, team.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ end_date: '2026-02-01' }), // before start_date (2026-03-01)
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_DATE_INVALID');
  });

  it('I-US-14: updated_at changes', async () => {
    const sprint = await createSprint(adminToken, team.id);

    // Small delay to ensure updated_at differs
    await new Promise((r) => setTimeout(r, 50));

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });

    const body = await res.json();
    expect(new Date(body.sprint.updated_at).getTime()).toBeGreaterThan(new Date(sprint.updated_at).getTime());
  });

  it('I-US-15: update active sprint with only date fields returns 400', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await activateSprint(adminToken, team.id, sprint.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: '2026-04-01' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
