import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables, createTestTeam } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { randomUUID } from 'node:crypto';

describe('GET /api/v1/teams/:id', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('I-GT-01: returns team details for member', async () => {
    const { token, user } = await getAuthToken();
    const team = await createTestTeam(user.id, { name: 'My Team', slug: 'my-team' });

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team.name).toBe('My Team');
    expect(body.team.slug).toBe('my-team');
    expect(body.team.your_role).toBe('admin');
  });

  it('I-GT-02: non-member gets 403', async () => {
    const auth1 = await getAuthToken({ email: 'owner@test.com' });
    const auth2 = await getAuthToken({ email: 'other@test.com' });
    const team = await createTestTeam(auth1.user.id, { name: 'Private Team', slug: 'private-team' });

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      headers: { Authorization: `Bearer ${auth2.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_NOT_MEMBER');
  });

  it('I-GT-03: non-existent team returns 404', async () => {
    const { token } = await getAuthToken();
    const res = await app.request(`/api/v1/teams/${randomUUID()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_NOT_FOUND');
  });

  it('I-GT-04: invalid UUID format returns 400', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams/not-a-uuid', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(400);
  });

  it('I-GT-05: returns correct your_role', async () => {
    const auth1 = await getAuthToken({ email: 'admin@test.com' });
    const auth2 = await getAuthToken({ email: 'facilitator@test.com' });
    const team = await createTestTeam(auth1.user.id, { name: 'Role Team', slug: 'role-team' });

    const { sql } = await import('../../../src/db/connection.js');
    await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${auth2.user.id}, 'facilitator')`;

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      headers: { Authorization: `Bearer ${auth2.token}` },
    });

    const body = await res.json();
    expect(body.team.your_role).toBe('facilitator');
  });
});
