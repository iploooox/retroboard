import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import { truncateTables, createTestUser, createTestTeam } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

async function addTeamMember(teamId: string, userId: string, role: string) {
  await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${teamId}, ${userId}, ${role})`;
}

async function createSprint(token: string, teamId: string, data: Record<string, unknown> = {}) {
  const res = await app.request(`/api/v1/teams/${teamId}/sprints`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Sprint 1', start_date: '2026-03-01', ...data }),
  });
  return (await res.json()).sprint;
}

describe('GET /api/v1/teams/:teamId/sprints/:id', () => {
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

  it('I-GS-01: get sprint as team member', async () => {
    const sprint = await createSprint(adminToken, team.id);
    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    await addTeamMember(team.id, memberAuth.user.id, 'member');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      headers: { 'Authorization': `Bearer ${memberAuth.token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprint.id).toBe(sprint.id);
    expect(body.sprint.name).toBe('Sprint 1');
  });

  it('I-GS-02: sprint not found returns 404', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints/00000000-0000-4000-8000-000000099999`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_NOT_FOUND');
  });

  it('I-GS-03: sprint from different team returns 404', async () => {
    const sprint = await createSprint(adminToken, team.id);

    const otherAuth = await getAuthToken({ email: 'other@example.com' });
    const teamB = await createTestTeam(otherAuth.user.id, { name: 'Team B', slug: `team-b-${Date.now()}` });

    const res = await app.request(`/api/v1/teams/${teamB.id}/sprints/${sprint.id}`, {
      headers: { 'Authorization': `Bearer ${otherAuth.token}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_NOT_FOUND');
  });

  it('I-GS-04: non-member cannot get', async () => {
    const sprint = await createSprint(adminToken, team.id);
    const outsiderAuth = await getAuthToken({ email: 'outsider@example.com' });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      headers: { 'Authorization': `Bearer ${outsiderAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_NOT_MEMBER');
  });

  it('I-GS-05: all fields present', async () => {
    const sprint = await createSprint(adminToken, team.id, {
      name: 'Full Sprint',
      goal: 'Test goal',
      start_date: '2026-03-01',
      end_date: '2026-03-14',
    });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints/${sprint.id}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.sprint.id).toBeDefined();
    expect(body.sprint.team_id).toBe(team.id);
    expect(body.sprint.name).toBe('Full Sprint');
    expect(body.sprint.goal).toBe('Test goal');
    expect(body.sprint.sprint_number).toBeDefined();
    expect(body.sprint.start_date).toBe('2026-03-01');
    expect(body.sprint.end_date).toBe('2026-03-14');
    expect(body.sprint.status).toBe('planning');
    expect(body.sprint.created_by).toBe(adminUser.id);
    expect(body.sprint.created_at).toBeDefined();
    expect(body.sprint.updated_at).toBeDefined();
  });

  it('E-SP-08: UUID format validation on team_id', async () => {
    const res = await app.request(`/api/v1/teams/abc/sprints/00000000-0000-4000-8000-000000099999`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
  });

  it('E-SP-09: UUID format validation on sprint_id', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints/abc`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
  });
});
