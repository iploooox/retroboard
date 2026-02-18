import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

describe('S-002: Shared question display with facilitator picker', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let facilitatorToken: string;
  let facilitatorUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };

  beforeEach(async () => {
    await truncateTables();
    await seed();

    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;

    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;

    const facilitatorAuth = await getAuthToken({ email: 'facilitator@example.com', displayName: 'Facilitator' });
    facilitatorToken = facilitatorAuth.token;
    facilitatorUser = facilitatorAuth.user;

    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');
    await addTeamMember(team.id, facilitatorUser.id, 'facilitator');

    sprint = await createTestSprint(team.id, adminUser.id);
  });

  describe('Board creation auto-selects icebreaker', () => {
    it('creates board with icebreaker_id set (auto-selected)', async () => {
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
      expect(body.ok).toBe(true);
      expect(body.data.phase).toBe('icebreaker');
      // icebreaker_id should now be auto-selected (not null)
      expect(body.data.icebreaker_id).toBeTruthy();
      expect(typeof body.data.icebreaker_id).toBe('string');
    });

    it('records auto-selected icebreaker in team history', async () => {
      const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
      });

      const body = await res.json();
      const boardId = body.data.id as string;

      // Check history was recorded
      const history = await sql`
        SELECT * FROM team_icebreaker_history
        WHERE team_id = ${team.id} AND board_id = ${boardId}
      `;
      expect(history.length).toBe(1);
      expect(history[0].icebreaker_id).toBe(body.data.icebreaker_id);
    });
  });

  describe('PATCH /boards/:boardId/icebreaker — Reroll', () => {
    let boardId: string;

    beforeEach(async () => {
      const { board } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        phase: 'icebreaker',
      });
      boardId = board.id;

      // Set an initial icebreaker on the board
      const [icebreaker] = await sql`
        SELECT id FROM icebreakers WHERE is_system = true LIMIT 1
      `;
      await sql`UPDATE boards SET icebreaker_id = ${icebreaker.id} WHERE id = ${boardId}`;
    });

    it('facilitator can reroll icebreaker question', async () => {
      const res = await app.request(`/api/v1/boards/${boardId}/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${facilitatorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.question).toBeDefined();
      expect(body.data.category).toBeDefined();
    });

    it('admin can reroll icebreaker question', async () => {
      const res = await app.request(`/api/v1/boards/${boardId}/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.id).toBeDefined();
    });

    it('member cannot reroll icebreaker question', async () => {
      const res = await app.request(`/api/v1/boards/${boardId}/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('reroll with category filter returns question of that category', async () => {
      const res = await app.request(`/api/v1/boards/${boardId}/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'fun' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.category).toBe('fun');
    });

    it('reroll with invalid category returns 400', async () => {
      const res = await app.request(`/api/v1/boards/${boardId}/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'invalid-category' }),
      });

      expect(res.status).toBe(400);
    });

    it('reroll updates boards.icebreaker_id in database', async () => {
      const res = await app.request(`/api/v1/boards/${boardId}/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const body = await res.json();
      const newId = body.data.id;

      const [afterBoard] = await sql`SELECT icebreaker_id FROM boards WHERE id = ${boardId}`;
      expect(afterBoard.icebreaker_id).toBe(newId);
      // The new icebreaker should be different (with 55 questions, very likely)
      // But don't assert inequality since it could randomly pick the same one
      expect(afterBoard.icebreaker_id).toBeTruthy();
    });

    it('reroll records history entry', async () => {
      const res = await app.request(`/api/v1/boards/${boardId}/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const body = await res.json();
      const icebreakerId = body.data.id;

      const history = await sql`
        SELECT * FROM team_icebreaker_history
        WHERE team_id = ${team.id} AND board_id = ${boardId} AND icebreaker_id = ${icebreakerId}
      `;
      expect(history.length).toBe(1);
    });

    it('reroll for non-existent board returns 404', async () => {
      const fakeId = '00000000-0000-4000-a000-000000000099';
      const res = await app.request(`/api/v1/boards/${fakeId}/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(404);
    });

    it('non-team-member cannot reroll', async () => {
      const outsiderAuth = await getAuthToken({ email: 'outsider@example.com' });
      const res = await app.request(`/api/v1/boards/${boardId}/icebreaker`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${outsiderAuth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(403);
    });
  });

  describe('Board GET includes full icebreaker object', () => {
    it('sprint-scoped GET includes icebreaker object with question and category', async () => {
      // Create board via API (auto-selects icebreaker)
      await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
      });

      // Fetch board
      const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.icebreaker).toBeTruthy();
      expect(body.data.icebreaker.id).toBeDefined();
      expect(body.data.icebreaker.question).toBeDefined();
      expect(typeof body.data.icebreaker.question).toBe('string');
      expect(body.data.icebreaker.category).toBeDefined();
      expect(typeof body.data.icebreaker.category).toBe('string');
    });

    it('board-scoped GET includes icebreaker object', async () => {
      // Create board via API (auto-selects icebreaker)
      const createRes = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
      });

      const createBody = await createRes.json();
      const boardId = createBody.data.id as string;

      // Fetch board by ID
      const res = await app.request(`/api/v1/boards/${boardId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.icebreaker).toBeTruthy();
      expect(body.data.icebreaker.id).toBeDefined();
      expect(body.data.icebreaker.question).toBeDefined();
      expect(body.data.icebreaker.category).toBeDefined();
    });

    it('board GET with no icebreaker has icebreaker as null', async () => {
      // Create board directly (bypasses auto-select)
      const { board } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        phase: 'write',
      });

      const res = await app.request(`/api/v1/boards/${board.id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.icebreaker).toBeNull();
    });

    it('member can see icebreaker question (read-only)', async () => {
      // Create board via API (auto-selects icebreaker)
      await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
      });

      // Member fetches board
      const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${memberToken}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.icebreaker).toBeTruthy();
      expect(body.data.icebreaker.question).toBeDefined();
    });
  });

  describe('Multiple rerolls accumulate history', () => {
    it('each reroll adds a new history entry', async () => {
      const { board } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        phase: 'icebreaker',
      });

      // Reroll 3 times
      for (let i = 0; i < 3; i++) {
        await app.request(`/api/v1/boards/${board.id}/icebreaker`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
      }

      const history = await sql`
        SELECT * FROM team_icebreaker_history
        WHERE team_id = ${team.id} AND board_id = ${board.id}
        ORDER BY used_at
      `;
      expect(history.length).toBe(3);
    });
  });
});
