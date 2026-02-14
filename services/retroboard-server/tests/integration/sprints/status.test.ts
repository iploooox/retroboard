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

describe('PUT /api/v1/teams/:teamId/sprints/:id/activate', () => {
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

  it('I-AS-01: activate planning sprint', async () => {
    const sprint = await createSprint(adminToken, team.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.status).toBe('active');
  });

  it('I-AS-02: cannot activate active sprint', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_INVALID_TRANSITION');
  });

  it('I-AS-03: cannot activate completed sprint', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/complete`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_INVALID_TRANSITION');
  });

  it('I-AS-04: cannot activate when another is active', async () => {
    const sprint1 = await createSprint(adminToken, team.id, { name: 'Sprint 1' });
    const sprint2 = await createSprint(adminToken, team.id, { name: 'Sprint 2' });

    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint1.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint2.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_ALREADY_ACTIVE');
  });

  it('I-AS-05: error includes active sprint details', async () => {
    const sprint1 = await createSprint(adminToken, team.id, { name: 'Active Sprint' });
    const sprint2 = await createSprint(adminToken, team.id, { name: 'Sprint 2' });

    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint1.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint2.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.error.details.active_sprint_id).toBe(sprint1.id);
    expect(body.error.details.active_sprint_name).toBe('Active Sprint');
  });

  it('I-AS-06: facilitator can activate', async () => {
    const sprint = await createSprint(adminToken, team.id);
    const facAuth = await getAuthToken({ email: 'fac@example.com' });
    await addTeamMember(team.id, facAuth.user.id, 'facilitator');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${facAuth.token}` },
    });

    expect(res.status).toBe(200);
  });

  it('I-AS-07: member cannot activate', async () => {
    const sprint = await createSprint(adminToken, team.id);
    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    await addTeamMember(team.id, memberAuth.user.id, 'member');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${memberAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_INSUFFICIENT_ROLE');
  });

  it('I-AS-09: sprint from wrong team returns 404', async () => {
    const sprint = await createSprint(adminToken, team.id);

    const otherAuth = await getAuthToken({ email: 'other@example.com' });
    const teamB = await createTestTeam(otherAuth.user.id, { name: 'Team B', slug: `team-b-${Date.now()}` });

    const res = await app.request(`/api/v1/teams/${teamB.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${otherAuth.token}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_NOT_FOUND');
  });

  it('I-AS-10: activate after completing previous', async () => {
    const sprint1 = await createSprint(adminToken, team.id, { name: 'Sprint 1' });
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint1.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint1.id}/complete`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const sprint2 = await createSprint(adminToken, team.id, { name: 'Sprint 2' });
    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint2.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.status).toBe('active');
  });

  it('I-AS-11: updated_at changes on activation', async () => {
    const sprint = await createSprint(adminToken, team.id);

    await new Promise((r) => setTimeout(r, 50));

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(new Date(body.sprint.updated_at).getTime()).toBeGreaterThan(new Date(sprint.updated_at).getTime());
  });
});

describe('PUT /api/v1/teams/:teamId/sprints/:id/complete', () => {
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

  it('I-CO-01: complete active sprint', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/complete`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.status).toBe('completed');
  });

  it('I-CO-02: cannot complete planning sprint', async () => {
    const sprint = await createSprint(adminToken, team.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/complete`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_INVALID_TRANSITION');
  });

  it('I-CO-03: cannot complete already completed sprint', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/complete`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/complete`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_INVALID_TRANSITION');
  });

  it('I-CO-04: facilitator can complete', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const facAuth = await getAuthToken({ email: 'fac@example.com' });
    await addTeamMember(team.id, facAuth.user.id, 'facilitator');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/complete`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${facAuth.token}` },
    });

    expect(res.status).toBe(200);
  });

  it('I-CO-05: member cannot complete', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    await addTeamMember(team.id, memberAuth.user.id, 'member');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/complete`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${memberAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_INSUFFICIENT_ROLE');
  });

  it('I-CO-06: after completion, sprint is read-only', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/complete`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_NOT_EDITABLE');
  });

  it('I-CO-07: after completion, new sprint can be activated', async () => {
    const sprint1 = await createSprint(adminToken, team.id, { name: 'Sprint 1' });
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint1.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint1.id}/complete`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const sprint2 = await createSprint(adminToken, team.id, { name: 'Sprint 2' });
    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint2.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.status).toBe('active');
  });

  it('I-CO-08: updated_at changes on completion', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    await new Promise((r) => setTimeout(r, 50));

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/complete`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(new Date(body.sprint.updated_at).getTime()).toBeGreaterThan(new Date(sprint.updated_at).getTime());
  });
});
