import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../../../src/db/connection.js';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  createTestSprint,
  addTeamMember,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('S-008: Team Icebreaker Settings', () => {
  let adminToken: string;
  let adminUser: { id: string };
  let memberToken: string;
  let memberUser: { id: string };
  let facilitatorToken: string;
  let facilitatorUser: { id: string };
  let team: { id: string };

  beforeEach(async () => {
    await truncateTables();
    await seed();

    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;

    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;

    const facilitatorAuth = await getAuthToken({ email: 'facilitator@example.com', displayName: 'Facilitator User' });
    facilitatorToken = facilitatorAuth.token;
    facilitatorUser = facilitatorAuth.user;

    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');
    await addTeamMember(team.id, facilitatorUser.id, 'facilitator');
  });

  // ---- Icebreaker Settings Endpoint ----

  describe('PATCH /api/v1/teams/:id/settings/icebreaker', () => {
    it('returns icebreaker settings in team GET response (defaults)', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.team.icebreaker_enabled).toBe(true);
      expect(body.team.icebreaker_default_category).toBeNull();
      expect(body.team.icebreaker_timer_seconds).toBeNull();
    });

    it('admin can update icebreaker_enabled to false', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.team.icebreaker_enabled).toBe(false);
    });

    it('admin can set default category', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ defaultCategory: 'fun' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.team.icebreaker_default_category).toBe('fun');
    });

    it('admin can clear default category with null', async () => {
      // Set it first
      await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ defaultCategory: 'fun' }),
      });

      // Clear it
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ defaultCategory: null }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.team.icebreaker_default_category).toBeNull();
    });

    it('admin can set timer seconds', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timerSeconds: 180 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.team.icebreaker_timer_seconds).toBe(180);
    });

    it('admin can clear timer with null', async () => {
      // Set first
      await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timerSeconds: 180 }),
      });

      // Clear
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timerSeconds: null }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.team.icebreaker_timer_seconds).toBeNull();
    });

    it('admin can set all fields at once', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: false,
          defaultCategory: 'team-building',
          timerSeconds: 300,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.team.icebreaker_enabled).toBe(false);
      expect(body.team.icebreaker_default_category).toBe('team-building');
      expect(body.team.icebreaker_timer_seconds).toBe(300);
    });

    it('rejects invalid category', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ defaultCategory: 'invalid-category' }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects timer below 30', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timerSeconds: 10 }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects timer above 600', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timerSeconds: 700 }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects empty body', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('member cannot update settings — 403', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(403);
    });

    it('facilitator cannot update settings — 403', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${facilitatorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(403);
    });

    it('unauthenticated returns 401', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/settings/icebreaker`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(401);
    });
  });

  // ---- Custom Questions CRUD ----

  describe('GET /api/v1/teams/:teamId/icebreakers/custom', () => {
    it('returns empty list when no custom questions', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.questions).toHaveLength(0);
      expect(body.data.count).toBe(0);
    });

    it('returns custom questions with creator info', async () => {
      // Create a custom question
      await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: 'Custom Q1?', category: 'fun' }),
      });

      const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.questions).toHaveLength(1);
      expect(body.data.questions[0].question).toBe('Custom Q1?');
      expect(body.data.questions[0].category).toBe('fun');
      expect(body.data.questions[0].created_by).toBe(adminUser.id);
      expect(body.data.questions[0].created_by_name).toBe('Admin User');
      expect(body.data.questions[0].created_at).toBeDefined();
    });

    it('member can view custom questions', async () => {
      await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: 'Visible to member?', category: 'fun' }),
      });

      const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
        headers: { Authorization: `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.questions).toHaveLength(1);
    });

    it('non-member gets 403', async () => {
      const outsiderAuth = await getAuthToken({ email: 'outsider@example.com' });

      const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
        headers: { Authorization: `Bearer ${outsiderAuth.token}` },
      });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/teams/:teamId/icebreakers/:icebreakerId', () => {
    it('admin can delete custom question', async () => {
      // Create custom question
      const createRes = await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: 'To be deleted', category: 'fun' }),
      });
      const createBody = await createRes.json();
      const customId = createBody.data.id;

      // Delete it
      const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/${customId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.deleted).toBe(true);

      // Verify it's gone
      const [row] = await sql`SELECT id FROM icebreakers WHERE id = ${customId}`;
      expect(row).toBeUndefined();
    });

    it('cannot delete system icebreaker', async () => {
      // Get a system icebreaker ID
      const [systemIb] = await sql`SELECT id FROM icebreakers WHERE is_system = true LIMIT 1`;

      const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/${systemIb.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(403);
    });

    it('facilitator cannot delete — 403', async () => {
      const createRes = await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${facilitatorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: 'Facilitator Q', category: 'fun' }),
      });
      const createBody = await createRes.json();
      const customId = createBody.data.id;

      const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/${customId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${facilitatorToken}` },
      });

      expect(res.status).toBe(403);
    });

    it('member cannot delete — 403', async () => {
      const createRes = await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: 'Admin Q', category: 'fun' }),
      });
      const createBody = await createRes.json();
      const customId = createBody.data.id;

      const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/${customId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent icebreaker', async () => {
      const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/00000000-0000-4000-8000-000000000099`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(404);
    });
  });

  // ---- Board Creation with icebreaker_enabled=false ----

  describe('Board creation respects icebreaker_enabled setting', () => {
    it('board starts in icebreaker phase when enabled (default)', async () => {
      const sprint = await createTestSprint(team.id, adminUser.id);

      const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.phase).toBe('icebreaker');
      expect(body.data.icebreaker).not.toBeNull();
    });

    it('board starts in write phase when icebreaker disabled', async () => {
      // Disable icebreaker
      await sql`UPDATE teams SET icebreaker_enabled = false WHERE id = ${team.id}`;

      const sprint = await createTestSprint(team.id, adminUser.id);

      const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.phase).toBe('write');
      expect(body.data.icebreaker).toBeNull();
    });

    it('board uses default category when set', async () => {
      // Set default category to 'fun'
      await sql`UPDATE teams SET icebreaker_default_category = 'fun' WHERE id = ${team.id}`;

      const sprint = await createTestSprint(team.id, adminUser.id);

      const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.phase).toBe('icebreaker');
      expect(body.data.icebreaker).not.toBeNull();
      expect(body.data.icebreaker.category).toBe('fun');
    });
  });
});
