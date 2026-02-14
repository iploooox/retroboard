import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables, createTestTeam } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { sql } from '../../../src/db/connection.js';

async function createInvite(
  token: string,
  teamId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await app.request(`/api/v1/teams/${teamId}/invitations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(overrides),
  });
  return { res, body: await res.json() };
}

describe('Invitations', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  describe('POST /api/v1/teams/:id/invitations', () => {
    it('I-INV-01: admin creates invite', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const { res, body } = await createInvite(token, team.id);

      expect(res.status).toBe(201);
      expect(body.invitation.code).toMatch(/^[a-zA-Z0-9]{12}$/);
      expect(body.invitation.team_id).toBe(team.id);
      expect(body.invitation.invite_url).toContain(body.invitation.code);
    });

    it('I-INV-02: facilitator creates invite', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const fac = await getAuthToken({ email: 'fac@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${fac.user.id}, 'facilitator')`;

      const { res } = await createInvite(fac.token, team.id);
      expect(res.status).toBe(201);
    });

    it('I-INV-03: member cannot create invite', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const member = await getAuthToken({ email: 'member@test.com' });
      const team = await createTestTeam(admin.user.id);
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${member.user.id}, 'member')`;

      const { res, body } = await createInvite(member.token, team.id);
      expect(res.status).toBe(403);
      expect(body.error.code).toBe('TEAM_INSUFFICIENT_ROLE');
    });

    it('I-INV-04: invite code is 12 alphanumeric chars', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const { body } = await createInvite(token, team.id);
      expect(body.invitation.code).toMatch(/^[a-zA-Z0-9]{12}$/);
    });

    it('I-INV-05: custom expiry', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const { body } = await createInvite(token, team.id, { expires_in_hours: 24 });
      const expiresAt = new Date(body.invitation.expires_at);
      const now = new Date();
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(23);
      expect(diffHours).toBeLessThan(25);
    });

    it('I-INV-06: custom max_uses', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const { body } = await createInvite(token, team.id, { max_uses: 5 });
      expect(body.invitation.max_uses).toBe(5);
      expect(body.invitation.use_count).toBe(0);
    });

    it('I-INV-07: default expiry is 7 days', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const { body } = await createInvite(token, team.id, {});
      const expiresAt = new Date(body.invitation.expires_at);
      const now = new Date();
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(167);
      expect(diffHours).toBeLessThan(169);
    });

    it('I-INV-08: default unlimited uses', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const { body } = await createInvite(token, team.id, {});
      expect(body.invitation.max_uses).toBeNull();
    });

    it('I-INV-20: invalid expires_in_hours (0) returns 400', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const { res, body } = await createInvite(token, team.id, { expires_in_hours: 0 });
      expect(res.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('I-INV-21: invalid expires_in_hours (>720) returns 400', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const { res } = await createInvite(token, team.id, { expires_in_hours: 800 });
      expect(res.status).toBe(400);
    });

    it('I-INV-24: max 5 active invites enforced', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      for (let i = 0; i < 5; i++) {
        const { res } = await createInvite(token, team.id);
        expect(res.status).toBe(201);
      }

      const { res, body } = await createInvite(token, team.id);
      expect(res.status).toBe(400);
      expect(body.error.code).toBe('TEAM_INVITE_LIMIT_REACHED');
    });
  });

  describe('POST /api/v1/teams/join/:code', () => {
    it('I-INV-09: join via valid invite', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const joiner = await getAuthToken({ email: 'joiner@test.com' });
      const team = await createTestTeam(admin.user.id);

      const { body: invBody } = await createInvite(admin.token, team.id);
      const code = invBody.invitation.code;

      const res = await app.request(`/api/v1/teams/join/${code}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${joiner.token}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.team.id).toBe(team.id);
      expect(body.membership.role).toBe('member');
    });

    it('I-INV-10: joined user has member role by default', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const joiner = await getAuthToken({ email: 'joiner@test.com' });
      const team = await createTestTeam(admin.user.id);

      const { body: invBody } = await createInvite(admin.token, team.id);

      const res = await app.request(`/api/v1/teams/join/${invBody.invitation.code}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${joiner.token}` },
      });

      const body = await res.json();
      expect(body.membership.role).toBe('member');
    });

    it('I-INV-11: use_count incremented', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const joiner = await getAuthToken({ email: 'joiner@test.com' });
      const team = await createTestTeam(admin.user.id);

      const { body: invBody } = await createInvite(admin.token, team.id);

      await app.request(`/api/v1/teams/join/${invBody.invitation.code}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${joiner.token}` },
      });

      const [inv] = await sql`SELECT use_count FROM team_invitations WHERE id = ${invBody.invitation.id}`;
      expect(inv.use_count).toBe(1);
    });

    it('I-INV-12: already a member returns 409', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const team = await createTestTeam(admin.user.id);

      const { body: invBody } = await createInvite(admin.token, team.id);

      const res = await app.request(`/api/v1/teams/join/${invBody.invitation.code}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${admin.token}` },
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe('TEAM_MEMBER_EXISTS');
    });

    it('I-INV-13: expired invite returns 410', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const joiner = await getAuthToken({ email: 'joiner@test.com' });
      const team = await createTestTeam(admin.user.id);

      const { body: invBody } = await createInvite(admin.token, team.id);

      // Manually expire the invite
      await sql`UPDATE team_invitations SET expires_at = NOW() - interval '1 hour' WHERE id = ${invBody.invitation.id}`;

      const res = await app.request(`/api/v1/teams/join/${invBody.invitation.code}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${joiner.token}` },
      });

      expect(res.status).toBe(410);
      const body = await res.json();
      expect(body.error.code).toBe('TEAM_INVITE_EXPIRED');
    });

    it('I-INV-14: exhausted invite returns 410', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const joiner = await getAuthToken({ email: 'joiner@test.com' });
      const team = await createTestTeam(admin.user.id);

      const { body: invBody } = await createInvite(admin.token, team.id, { max_uses: 1 });

      // Manually set use_count to max
      await sql`UPDATE team_invitations SET use_count = 1 WHERE id = ${invBody.invitation.id}`;

      const res = await app.request(`/api/v1/teams/join/${invBody.invitation.code}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${joiner.token}` },
      });

      expect(res.status).toBe(410);
      const body = await res.json();
      expect(body.error.code).toBe('TEAM_INVITE_EXHAUSTED');
    });

    it('I-INV-15: invalid code returns 404', async () => {
      const { token } = await getAuthToken();

      const res = await app.request('/api/v1/teams/join/INVALID12345', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('TEAM_INVITE_NOT_FOUND');
    });

    it('I-INV-16: multiple users join same invite', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const team = await createTestTeam(admin.user.id);

      const { body: invBody } = await createInvite(admin.token, team.id, { max_uses: 3 });

      for (let i = 0; i < 3; i++) {
        const joiner = await getAuthToken({ email: `joiner${i}@test.com` });
        const res = await app.request(`/api/v1/teams/join/${invBody.invitation.code}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${joiner.token}` },
        });
        expect(res.status).toBe(200);
      }

      const [inv] = await sql`SELECT use_count FROM team_invitations WHERE id = ${invBody.invitation.id}`;
      expect(inv.use_count).toBe(3);
    });

    it('I-INV-17: 4th user on max_uses=3 invite fails', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const team = await createTestTeam(admin.user.id);

      const { body: invBody } = await createInvite(admin.token, team.id, { max_uses: 3 });

      for (let i = 0; i < 3; i++) {
        const joiner = await getAuthToken({ email: `joiner${i}@test.com` });
        await app.request(`/api/v1/teams/join/${invBody.invitation.code}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${joiner.token}` },
        });
      }

      const extraJoiner = await getAuthToken({ email: 'extra@test.com' });
      const res = await app.request(`/api/v1/teams/join/${invBody.invitation.code}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${extraJoiner.token}` },
      });

      expect(res.status).toBe(410);
      const body = await res.json();
      expect(body.error.code).toBe('TEAM_INVITE_EXHAUSTED');
    });

    it('I-INV-19: unauthenticated join returns 401', async () => {
      const res = await app.request('/api/v1/teams/join/someCode1234', {
        method: 'POST',
      });

      expect(res.status).toBe(401);
    });

    it('I-INV-23: revoked invite returns error on join', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const joiner = await getAuthToken({ email: 'joiner@test.com' });
      const team = await createTestTeam(admin.user.id);

      const { body: invBody } = await createInvite(admin.token, team.id);

      // Revoke
      await app.request(`/api/v1/teams/${team.id}/invitations/${invBody.invitation.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${admin.token}` },
      });

      const res = await app.request(`/api/v1/teams/join/${invBody.invitation.code}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${joiner.token}` },
      });

      expect(res.status).toBe(404);
    });

    it('I-INV-25: invite with role assigns correct role on join', async () => {
      const admin = await getAuthToken({ email: 'admin@test.com' });
      const joiner = await getAuthToken({ email: 'joiner@test.com' });
      const team = await createTestTeam(admin.user.id);

      const { body: invBody } = await createInvite(admin.token, team.id, { role: 'facilitator' });

      const res = await app.request(`/api/v1/teams/join/${invBody.invitation.code}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${joiner.token}` },
      });

      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.membership.role).toBe('facilitator');
    });
  });

  describe('GET /api/v1/teams/:id/invitations', () => {
    it('lists active invitations', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      await createInvite(token, team.id);
      await createInvite(token, team.id);

      const res = await app.request(`/api/v1/teams/${team.id}/invitations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.invitations).toHaveLength(2);
    });
  });

  describe('DELETE /api/v1/teams/:id/invitations/:inviteId', () => {
    it('revokes invitation', async () => {
      const { token, user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      const { body: invBody } = await createInvite(token, team.id);

      const res = await app.request(
        `/api/v1/teams/${team.id}/invitations/${invBody.invitation.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      expect(res.status).toBe(204);

      // Verify revoked
      const [inv] = await sql`SELECT revoked_at FROM team_invitations WHERE id = ${invBody.invitation.id}`;
      expect(inv.revoked_at).not.toBeNull();
    });
  });
});
