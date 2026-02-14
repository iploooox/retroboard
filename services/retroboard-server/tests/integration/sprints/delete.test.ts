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
    body: JSON.stringify({ name: 'Sprint 1', start_date: '2026-03-01', ...data }),
  });
  return (await res.json()).sprint;
}

describe('DELETE /api/v1/teams/:teamId/sprints/:id', () => {
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

  it('I-DS-01: admin deletes planning sprint', async () => {
    const sprint = await createSprint(adminToken, team.id);

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Sprint deleted successfully');
  });

  it('I-DS-02: admin deletes active sprint', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
  });

  it('I-DS-03: admin deletes completed sprint', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}/complete`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
  });

  it('I-DS-04: facilitator cannot delete', async () => {
    const sprint = await createSprint(adminToken, team.id);
    const facAuth = await getAuthToken({ email: 'fac@example.com' });
    await addTeamMember(team.id, facAuth.user.id, 'facilitator');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${facAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_INSUFFICIENT_ROLE');
  });

  it('I-DS-05: member cannot delete', async () => {
    const sprint = await createSprint(adminToken, team.id);
    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    await addTeamMember(team.id, memberAuth.user.id, 'member');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_INSUFFICIENT_ROLE');
  });

  it('I-DS-06: non-member cannot delete', async () => {
    const sprint = await createSprint(adminToken, team.id);
    const outsiderAuth = await getAuthToken({ email: 'outsider@example.com' });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${outsiderAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_NOT_MEMBER');
  });

  it('I-DS-07: deleted sprint not in list', async () => {
    const sprint = await createSprint(adminToken, team.id);
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const listRes = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await listRes.json();
    expect(body.sprints).toHaveLength(0);
  });

  it('I-DS-08: delete non-existent sprint returns 404', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints/00000000-0000-4000-8000-000000099999`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_NOT_FOUND');
  });

  it('I-DS-09: deleting active sprint frees slot', async () => {
    const sprint1 = await createSprint(adminToken, team.id, { name: 'Sprint 1' });
    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint1.id}/activate`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    await app.request(`/api/v1/teams/${team.id}/sprints/${sprint1.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const sprint2 = await createSprint(adminToken, team.id, { name: 'Sprint 2' });
    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint2.id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
  });
});
