import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables, createTestTeam } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { sql } from '../../../src/db/connection.js';

describe('PUT /api/v1/teams/:id', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('I-UT-01: admin updates name', async () => {
    const { token, user } = await getAuthToken();
    const team = await createTestTeam(user.id);

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team.name).toBe('New Name');
  });

  it('I-UT-02: admin updates description', async () => {
    const { token, user } = await getAuthToken();
    const team = await createTestTeam(user.id);

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'New desc' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team.description).toBe('New desc');
  });

  it('I-UT-03: admin clears description', async () => {
    const { token, user } = await getAuthToken();
    const team = await createTestTeam(user.id);
    await sql`UPDATE teams SET description = 'old desc' WHERE id = ${team.id}`;

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team.description).toBeNull();
  });

  it('I-UT-04: slug does NOT change when name changes', async () => {
    const { token, user } = await getAuthToken();
    const team = await createTestTeam(user.id, { slug: 'original-slug' });

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Totally New Name' }),
    });

    const body = await res.json();
    expect(body.team.slug).toBe('original-slug');
  });

  it('I-UT-05: facilitator cannot update', async () => {
    const admin = await getAuthToken({ email: 'admin@test.com' });
    const fac = await getAuthToken({ email: 'fac@test.com' });
    const team = await createTestTeam(admin.user.id);
    await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${fac.user.id}, 'facilitator')`;

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${fac.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_INSUFFICIENT_ROLE');
  });

  it('I-UT-06: member cannot update', async () => {
    const admin = await getAuthToken({ email: 'admin@test.com' });
    const member = await getAuthToken({ email: 'member@test.com' });
    const team = await createTestTeam(admin.user.id);
    await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member.user.id}, 'member')`;

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${member.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });

    expect(res.status).toBe(403);
  });

  it('I-UT-07: non-member gets 403', async () => {
    const admin = await getAuthToken({ email: 'admin@test.com' });
    const outsider = await getAuthToken({ email: 'outsider@test.com' });
    const team = await createTestTeam(admin.user.id);

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${outsider.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_NOT_MEMBER');
  });

  it('I-UT-08: empty body returns 400', async () => {
    const { token, user } = await getAuthToken();
    const team = await createTestTeam(user.id);

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('I-UT-09: updated_at changes', async () => {
    const { token, user } = await getAuthToken();
    const team = await createTestTeam(user.id);

    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 10));

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });

    const body = await res.json();
    expect(new Date(body.team.updated_at).getTime()).toBeGreaterThan(
      new Date(team.updated_at).getTime(),
    );
  });
});
