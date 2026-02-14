import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import { truncateTables, createTestUser, createTestTeam } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

async function addTeamMember(teamId: string, userId: string, role: string) {
  await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${teamId}, ${userId}, ${role})`;
}

async function createSprint(token: string, teamId: string, data: Record<string, unknown>) {
  const res = await app.request(`/api/v1/teams/${teamId}/sprints`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ start_date: '2026-03-01', ...data }),
  });
  return res.json();
}

async function activateSprint(token: string, teamId: string, sprintId: string) {
  const res = await app.request(`/api/v1/teams/${teamId}/sprints/${sprintId}/activate`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

async function completeSprint(token: string, teamId: string, sprintId: string) {
  const res = await app.request(`/api/v1/teams/${teamId}/sprints/${sprintId}/complete`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

describe('GET /api/v1/teams/:teamId/sprints', () => {
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

  it('I-LS-01: list all sprints for team', async () => {
    await createSprint(adminToken, team.id, { name: 'Sprint 1' });
    await createSprint(adminToken, team.id, { name: 'Sprint 2' });
    await createSprint(adminToken, team.id, { name: 'Sprint 3' });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprints).toHaveLength(3);
    expect(body.pagination.total).toBe(3);
  });

  it('I-LS-02: sorted by start_date descending', async () => {
    await createSprint(adminToken, team.id, { name: 'Early', start_date: '2026-01-01' });
    await createSprint(adminToken, team.id, { name: 'Mid', start_date: '2026-02-01' });
    await createSprint(adminToken, team.id, { name: 'Late', start_date: '2026-03-01' });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.sprints[0].name).toBe('Late');
    expect(body.sprints[1].name).toBe('Mid');
    expect(body.sprints[2].name).toBe('Early');
  });

  it('I-LS-03: filter by status=active', async () => {
    const { sprint: s1 } = await createSprint(adminToken, team.id, { name: 'Sprint 1' });
    await createSprint(adminToken, team.id, { name: 'Sprint 2' });
    await activateSprint(adminToken, team.id, s1.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints?status=active`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.sprints).toHaveLength(1);
    expect(body.sprints[0].status).toBe('active');
  });

  it('I-LS-04: filter by status=completed', async () => {
    const { sprint: s1 } = await createSprint(adminToken, team.id, { name: 'Sprint 1' });
    await createSprint(adminToken, team.id, { name: 'Sprint 2' });
    await activateSprint(adminToken, team.id, s1.id);
    await completeSprint(adminToken, team.id, s1.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints?status=completed`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.sprints).toHaveLength(1);
    expect(body.sprints[0].status).toBe('completed');
  });

  it('I-LS-05: filter by status=planning', async () => {
    const { sprint: s1 } = await createSprint(adminToken, team.id, { name: 'Sprint 1' });
    await createSprint(adminToken, team.id, { name: 'Sprint 2' });
    await createSprint(adminToken, team.id, { name: 'Sprint 3' });
    await activateSprint(adminToken, team.id, s1.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints?status=planning`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.sprints).toHaveLength(2);
    body.sprints.forEach((s: { status: string }) => expect(s.status).toBe('planning'));
  });

  it('I-LS-07: pagination page 1', async () => {
    for (let i = 1; i <= 15; i++) {
      await createSprint(adminToken, team.id, { name: `Sprint ${i}`, start_date: `2026-01-${String(i).padStart(2, '0')}` });
    }

    const res = await app.request(`/api/v1/teams/${team.id}/sprints?page=1&per_page=5`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.sprints).toHaveLength(5);
    expect(body.pagination.total).toBe(15);
    expect(body.pagination.total_pages).toBe(3);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.per_page).toBe(5);
  });

  it('I-LS-09: pagination beyond last page', async () => {
    for (let i = 1; i <= 5; i++) {
      await createSprint(adminToken, team.id, { name: `Sprint ${i}` });
    }

    const res = await app.request(`/api/v1/teams/${team.id}/sprints?page=2&per_page=10`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.sprints).toHaveLength(0);
    expect(body.pagination.total).toBe(5);
  });

  it('I-LS-10: empty list for team with no sprints', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.sprints).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });

  it('I-LS-11: does not return other teams sprints', async () => {
    const otherAuth = await getAuthToken({ email: 'other@example.com' });
    const teamB = await createTestTeam(otherAuth.user.id, { name: 'Team B', slug: `team-b-${Date.now()}` });

    await createSprint(adminToken, team.id, { name: 'Team A Sprint' });
    await createSprint(otherAuth.token, teamB.id, { name: 'Team B Sprint 1' });
    await createSprint(otherAuth.token, teamB.id, { name: 'Team B Sprint 2' });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.sprints).toHaveLength(1);
    expect(body.sprints[0].name).toBe('Team A Sprint');
  });

  it('I-LS-12: non-member cannot list', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@example.com' });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      headers: { 'Authorization': `Bearer ${outsiderAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_NOT_MEMBER');
  });

  it('I-LS-13: member can list', async () => {
    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    await addTeamMember(team.id, memberAuth.user.id, 'member');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      headers: { 'Authorization': `Bearer ${memberAuth.token}` },
    });

    expect(res.status).toBe(200);
  });

  it('I-LS-14: invalid status filter returns 400', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints?status=invalid`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('I-LS-15: per_page capped at 100', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints?per_page=200`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.pagination.per_page).toBe(100);
  });

  it('I-LS-16: page=0 returns 400', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints?page=0`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
  });
});
