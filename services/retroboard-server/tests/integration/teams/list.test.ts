import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables, createTestTeam } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { sql } from '../../../src/db/connection.js';

describe('GET /api/v1/teams', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('I-LT-01: returns user teams', async () => {
    const { token, user } = await getAuthToken();
    await createTestTeam(user.id, { name: 'Team 1', slug: 'team-1' });
    await createTestTeam(user.id, { name: 'Team 2', slug: 'team-2' });

    const res = await app.request('/api/v1/teams', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.teams).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
  });

  it('I-LT-02: does not return other users teams', async () => {
    const auth1 = await getAuthToken({ email: 'user1@test.com' });
    const auth2 = await getAuthToken({ email: 'user2@test.com' });
    await createTestTeam(auth1.user.id, { name: 'Team A', slug: 'team-a' });
    await createTestTeam(auth2.user.id, { name: 'Team B', slug: 'team-b' });

    const res = await app.request('/api/v1/teams', {
      headers: { Authorization: `Bearer ${auth1.token}` },
    });

    const body = await res.json();
    expect(body.teams).toHaveLength(1);
    expect(body.teams[0].name).toBe('Team A');
  });

  it('I-LT-03: returns correct your_role per team', async () => {
    const auth1 = await getAuthToken({ email: 'admin@test.com' });
    const auth2 = await getAuthToken({ email: 'other@test.com' });

    const team1 = await createTestTeam(auth1.user.id, { name: 'Admin Team', slug: 'admin-team' });
    const team2 = await createTestTeam(auth2.user.id, { name: 'Member Team', slug: 'member-team' });

    // Add auth1 as member to team2
    await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team2.id}, ${auth1.user.id}, 'member')`;

    const res = await app.request('/api/v1/teams', {
      headers: { Authorization: `Bearer ${auth1.token}` },
    });

    const body = await res.json();
    expect(body.teams).toHaveLength(2);
    const adminTeam = body.teams.find((t: { name: string }) => t.name === 'Admin Team');
    const memberTeam = body.teams.find((t: { name: string }) => t.name === 'Member Team');
    expect(adminTeam.your_role).toBe('admin');
    expect(memberTeam.your_role).toBe('member');
  });

  it('I-LT-04: pagination page 1', async () => {
    const { token, user } = await getAuthToken();
    for (let i = 0; i < 25; i++) {
      await createTestTeam(user.id, { name: `Team ${i}`, slug: `team-${i}` });
    }

    const res = await app.request('/api/v1/teams?page=1&per_page=10', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await res.json();
    expect(body.teams).toHaveLength(10);
    expect(body.pagination.total).toBe(25);
    expect(body.pagination.total_pages).toBe(3);
  });

  it('I-LT-05: pagination page 3', async () => {
    const { token, user } = await getAuthToken();
    for (let i = 0; i < 25; i++) {
      await createTestTeam(user.id, { name: `Team ${i}`, slug: `team-${i}` });
    }

    const res = await app.request('/api/v1/teams?page=3&per_page=10', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await res.json();
    expect(body.teams).toHaveLength(5);
  });

  it('I-LT-06: empty list for new user', async () => {
    const { token } = await getAuthToken();

    const res = await app.request('/api/v1/teams', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await res.json();
    expect(body.teams).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });

  it('I-LT-07: returns member_count', async () => {
    const auth1 = await getAuthToken({ email: 'u1@test.com' });
    const auth2 = await getAuthToken({ email: 'u2@test.com' });
    const auth3 = await getAuthToken({ email: 'u3@test.com' });

    const team = await createTestTeam(auth1.user.id, { name: 'Big Team', slug: 'big-team' });
    await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${auth2.user.id}, 'member')`;
    await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${auth3.user.id}, 'member')`;

    const res = await app.request('/api/v1/teams', {
      headers: { Authorization: `Bearer ${auth1.token}` },
    });

    const body = await res.json();
    expect(body.teams[0].member_count).toBe(3);
  });

  it('I-LT-08: per_page max 100', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams?per_page=200', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(400);
  });

  it('I-LT-09: negative page returns 400', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams?page=-1', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(400);
  });

  it('I-LT-10: zero per_page returns 400', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams?per_page=0', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(400);
  });
});
