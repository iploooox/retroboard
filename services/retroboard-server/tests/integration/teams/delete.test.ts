import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables, createTestTeam } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { sql } from '../../../src/db/connection.js';
import { randomUUID } from 'node:crypto';

describe('DELETE /api/v1/teams/:id', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('I-DT-01: admin soft-deletes team', async () => {
    const { token, user } = await getAuthToken();
    const team = await createTestTeam(user.id);

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(204);

    // Verify soft-deleted
    const [row] = await sql`SELECT deleted_at FROM teams WHERE id = ${team.id}`;
    expect(row.deleted_at).not.toBeNull();
  });

  it('I-DT-03: facilitator cannot delete', async () => {
    const admin = await getAuthToken({ email: 'admin@test.com' });
    const fac = await getAuthToken({ email: 'fac@test.com' });
    const team = await createTestTeam(admin.user.id);
    await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${fac.user.id}, 'facilitator')`;

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${fac.token}` },
    });

    expect(res.status).toBe(403);
  });

  it('I-DT-04: member cannot delete', async () => {
    const admin = await getAuthToken({ email: 'admin@test.com' });
    const member = await getAuthToken({ email: 'member@test.com' });
    const team = await createTestTeam(admin.user.id);
    await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member.user.id}, 'member')`;

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${member.token}` },
    });

    expect(res.status).toBe(403);
  });

  it('I-DT-05: non-member gets 403', async () => {
    const admin = await getAuthToken({ email: 'admin@test.com' });
    const outsider = await getAuthToken({ email: 'outsider@test.com' });
    const team = await createTestTeam(admin.user.id);

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${outsider.token}` },
    });

    expect(res.status).toBe(403);
  });

  it('I-DT-06: delete non-existent team returns 404', async () => {
    const { token } = await getAuthToken();
    const res = await app.request(`/api/v1/teams/${randomUUID()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
  });

  it('I-DT-07: deleted team not in list', async () => {
    const { token, user } = await getAuthToken();
    const team = await createTestTeam(user.id);

    await app.request(`/api/v1/teams/${team.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const listRes = await app.request('/api/v1/teams', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await listRes.json();
    expect(body.teams).toHaveLength(0);
  });
});
