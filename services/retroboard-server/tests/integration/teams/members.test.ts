import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables, createTestTeam } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { sql } from '../../../src/db/connection.js';
import { randomUUID } from 'node:crypto';

describe('Members', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  describe('GET /api/v1/teams/:id/members', () => {
    it('I-MEM-01: list members', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const member1 = await getAuthToken({ email: 'member1@test.com' });
      const member2 = await getAuthToken({ email: 'member2@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member1.user.id}, 'facilitator')`;
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member2.user.id}, 'member')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members`, {
        headers: { Authorization: `Bearer ${admin.token}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.members).toHaveLength(3);
    });

    it('I-MEM-02: members sorted by role then joined_at', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const fac = await getAuthToken({ email: 'fac@test.com' });
      const member = await getAuthToken({ email: 'member@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member.user.id}, 'member')`;
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${fac.user.id}, 'facilitator')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members`, {
        headers: { Authorization: `Bearer ${admin.token}` },
      });

      const body = await res.json();
      expect(body.members[0].role).toBe('admin');
      expect(body.members[1].role).toBe('facilitator');
      expect(body.members[2].role).toBe('member');
    });

    it('I-MEM-03: non-member cannot list', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const outsider = await getAuthToken({ email: 'outsider@test.com' });
      const team = await createTestTeam(admin.user.id);

      const res = await app.request(`/api/v1/teams/${team.id}/members`, {
        headers: { Authorization: `Bearer ${outsider.token}` },
      });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/v1/teams/:id/members/:userId', () => {
    it('I-MEM-04: admin changes member to facilitator', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const member = await getAuthToken({ email: 'member@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member.user.id}, 'member')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members/${member.user.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'facilitator' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.member.role).toBe('facilitator');
    });

    it('I-MEM-05: admin promotes to admin', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const member = await getAuthToken({ email: 'member@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member.user.id}, 'member')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members/${member.user.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.member.role).toBe('admin');
    });

    it('I-MEM-06: admin demotes another admin (when multiple admins)', async () => {
      const admin1 = await getAuthToken({ email: 'admin1@test.com' });
      const admin2 = await getAuthToken({ email: 'admin2@test.com' });
      const team = await createTestTeam(admin1.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${admin2.user.id}, 'admin')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members/${admin2.user.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${admin1.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'member' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.member.role).toBe('member');
    });

    it('I-MEM-07: cannot demote last admin', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const res = await app.request(`/api/v1/teams/${team.id}/members/${user.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'member' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('TEAM_LAST_ADMIN');
    });

    it('I-MEM-08: facilitator cannot change roles', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const fac = await getAuthToken({ email: 'fac@test.com' });
      const member = await getAuthToken({ email: 'member@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${fac.user.id}, 'facilitator')`;
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member.user.id}, 'member')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members/${member.user.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${fac.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('TEAM_INSUFFICIENT_ROLE');
    });

    it('I-MEM-09: member cannot change roles', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const member = await getAuthToken({ email: 'member@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member.user.id}, 'member')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members/${member.user.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${member.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      });

      expect(res.status).toBe(403);
    });

    it('I-MEM-10: invalid role value returns 400', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const res = await app.request(`/api/v1/teams/${team.id}/members/${user.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'superadmin' }),
      });

      expect(res.status).toBe(400);
    });

    it('I-MEM-18: admin changes own role to member (when other admins exist)', async () => {
      const admin1 = await getAuthToken({ email: 'admin1@test.com' });
      const admin2 = await getAuthToken({ email: 'admin2@test.com' });
      const team = await createTestTeam(admin1.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${admin2.user.id}, 'admin')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members/${admin1.user.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${admin1.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'member' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.member.role).toBe('member');
    });
  });

  describe('DELETE /api/v1/teams/:id/members/:userId', () => {
    it('I-MEM-11: admin removes member', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const member = await getAuthToken({ email: 'member@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member.user.id}, 'member')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members/${member.user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${admin.token}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe('Member removed successfully');
    });

    it('I-MEM-12: member leaves team (self-remove)', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const member = await getAuthToken({ email: 'member@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member.user.id}, 'member')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members/${member.user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${member.token}` },
      });

      expect(res.status).toBe(200);
    });

    it('I-MEM-13: last admin cannot leave', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const res = await app.request(`/api/v1/teams/${team.id}/members/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('TEAM_LAST_ADMIN');
    });

    it('I-MEM-14: non-admin cannot remove others', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const member1 = await getAuthToken({ email: 'member1@test.com' });
      const member2 = await getAuthToken({ email: 'member2@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member1.user.id}, 'member')`;
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member2.user.id}, 'member')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members/${member2.user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${member1.token}` },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('TEAM_INSUFFICIENT_ROLE');
    });

    it('I-MEM-15: removed member cannot access team', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const member = await getAuthToken({ email: 'member@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member.user.id}, 'member')`;

      // Remove member
      await app.request(`/api/v1/teams/${team.id}/members/${member.user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${admin.token}` },
      });

      // Try to access team
      const res = await app.request(`/api/v1/teams/${team.id}`, {
        headers: { Authorization: `Bearer ${member.token}` },
      });

      expect(res.status).toBe(403);
    });

    it('I-MEM-16: remove non-existent member returns 404', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const res = await app.request(`/api/v1/teams/${team.id}/members/${randomUUID()}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(404);
    });

    it('I-MEM-17: admin removes another admin (not last admin)', async () => {
      const admin1 = await getAuthToken({ email: 'admin1@test.com' });
      const admin2 = await getAuthToken({ email: 'admin2@test.com' });
      const team = await createTestTeam(admin1.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${admin2.user.id}, 'admin')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members/${admin2.user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${admin1.token}` },
      });

      expect(res.status).toBe(200);
    });

    it('I-MEM-19: facilitator leaves team (self-remove)', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const fac = await getAuthToken({ email: 'fac@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${fac.user.id}, 'facilitator')`;

      const res = await app.request(`/api/v1/teams/${team.id}/members/${fac.user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${fac.token}` },
      });

      expect(res.status).toBe(200);
    });
  });
});
