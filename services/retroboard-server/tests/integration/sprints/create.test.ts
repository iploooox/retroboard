import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import { truncateTables,  createTestTeam } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

async function addTeamMember(teamId: string, userId: string, role: string) {
  await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${teamId}, ${userId}, ${role})`;
}

describe('POST /api/v1/teams/:teamId/sprints', () => {
  let adminUser: { id: string; email: string };
  let adminToken: string;
  let team: { id: string };

  beforeEach(async () => {
    await truncateTables();
    const auth = await getAuthToken();
    adminToken = auth.token;
    adminUser = auth.user;
    team = await createTestTeam(adminUser.id);
  });

  it('I-CS-01: successful sprint creation by admin', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Sprint 1',
        goal: 'Ship auth feature',
        start_date: '2026-03-01',
        end_date: '2026-03-14',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sprint).toBeDefined();
    expect(body.sprint.name).toBe('Sprint 1');
    expect(body.sprint.goal).toBe('Ship auth feature');
    expect(body.sprint.start_date).toBe('2026-03-01');
    expect(body.sprint.end_date).toBe('2026-03-14');
    expect(body.sprint.status).toBe('planning');
    expect(body.sprint.team_id).toBe(team.id);
    expect(body.sprint.created_by).toBe(adminUser.id);
    expect(body.sprint.sprint_number).toBe(1);
  });

  it('I-CS-02: facilitator can create', async () => {
    const facilitatorAuth = await getAuthToken({ email: 'fac@example.com' });
    await addTeamMember(team.id, facilitatorAuth.user.id, 'facilitator');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Sprint 1',
        start_date: '2026-03-01',
      }),
    });

    expect(res.status).toBe(201);
  });

  it('I-CS-03: member cannot create', async () => {
    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    await addTeamMember(team.id, memberAuth.user.id, 'member');

    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Sprint 1',
        start_date: '2026-03-01',
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_INSUFFICIENT_ROLE');
  });

  it('I-CS-04: non-member cannot create', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@example.com' });

    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${outsiderAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Sprint 1',
        start_date: '2026-03-01',
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_NOT_MEMBER');
  });

  it('I-CS-05: sprint starts in planning', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Sprint 1', start_date: '2026-03-01' }),
    });

    const body = await res.json();
    expect(body.sprint.status).toBe('planning');
  });

  it('I-CS-06: created_by set to current user', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Sprint 1', start_date: '2026-03-01' }),
    });

    const body = await res.json();
    expect(body.sprint.created_by).toBe(adminUser.id);
  });

  it('I-CS-07: goal is optional', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Sprint 1', start_date: '2026-03-01' }),
    });

    const body = await res.json();
    expect(body.sprint.goal).toBeNull();
  });

  it('I-CS-08: end_date is optional', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Sprint 1', start_date: '2026-03-01' }),
    });

    const body = await res.json();
    expect(body.sprint.end_date).toBeNull();
  });

  it('I-CS-09: end_date before start_date returns 400', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Sprint 1',
        start_date: '2026-03-14',
        end_date: '2026-03-01',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_DATE_INVALID');
  });

  it('I-CS-10: non-existent team returns 404', async () => {
    const res = await app.request(`/api/v1/teams/00000000-0000-4000-8000-000000099999/sprints`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Sprint 1', start_date: '2026-03-01' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_NOT_FOUND');
  });

  it('I-CS-11: missing name returns 400', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ start_date: '2026-03-01' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('I-CS-12: multiple planning sprints allowed', async () => {
    for (let i = 1; i <= 3; i++) {
      const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: `Sprint ${i}`, start_date: '2026-03-01' }),
      });
      expect(res.status).toBe(201);
    }
  });

  it('I-CS-13: unauthenticated returns 401', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sprint 1', start_date: '2026-03-01' }),
    });

    expect(res.status).toBe(401);
  });

  it('E-SP-12: sprint_number auto-increments per team', async () => {
    for (let i = 1; i <= 3; i++) {
      const res = await app.request(`/api/v1/teams/${team.id}/sprints`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: `Sprint ${i}`, start_date: '2026-03-01' }),
      });
      const body = await res.json();
      expect(body.sprint.sprint_number).toBe(i);
    }
  });
});
