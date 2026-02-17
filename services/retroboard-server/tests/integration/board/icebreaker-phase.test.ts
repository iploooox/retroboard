import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  SYSTEM_TEMPLATE_WWD,
  type TestBoard,
  type TestColumn,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('Icebreaker phase — S-001', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };

  beforeEach(async () => {
    await truncateTables();
    await seed();
    const auth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = auth.token;
    adminUser = auth.user;
    team = await createTestTeam(adminUser.id);
    sprint = await createTestSprint(team.id, adminUser.id);

    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;
    await addTeamMember(team.id, memberUser.id, 'member');
  });

  describe('Board creation defaults to icebreaker phase', () => {
    it('creates board in icebreaker phase via API', async () => {
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
    });

    it('includes icebreaker_id and icebreaker_active in board response', async () => {
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
      expect(body.data.icebreaker_id).toBeNull();
      expect(body.data.icebreaker_active).toBe(true);
    });
  });

  describe('Phase transitions involving icebreaker', () => {
    let board: TestBoard;

    beforeEach(async () => {
      const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        phase: 'icebreaker',
      });
      board = result.board;
    });

    it('icebreaker -> write allowed', async () => {
      const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'write' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.phase).toBe('write');
      expect(body.data.previous_phase).toBe('icebreaker');
    });

    it('write -> icebreaker allowed (go back)', async () => {
      // First advance to write
      await app.request(`/api/v1/boards/${board.id}/phase`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'write' }),
      });

      // Go back to icebreaker
      const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'icebreaker' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.phase).toBe('icebreaker');
      expect(body.data.previous_phase).toBe('write');
    });

    it('member cannot change phase from icebreaker', async () => {
      const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'write' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Phase restrictions during icebreaker', () => {
    let board: TestBoard;
    let columns: TestColumn[];

    beforeEach(async () => {
      const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        phase: 'icebreaker',
      });
      board = result.board;
      columns = result.columns;
    });

    it('card creation rejected during icebreaker phase', async () => {
      const res = await app.request(`/api/v1/boards/${board.id}/cards`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          column_id: columns[0].id,
          content: 'Test card during icebreaker',
        }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('INVALID_PHASE');
    });

    it('card editing rejected during icebreaker phase', async () => {
      // Create board in write phase to add a card first
      const writeResult = await createTestBoard(
        (await createTestSprint(team.id, adminUser.id)).id,
        SYSTEM_TEMPLATE_WWD,
        adminUser.id,
        { phase: 'write' },
      );
      const writeBoard = writeResult.board;
      const writeColumns = writeResult.columns;

      // Add a card
      const addRes = await app.request(`/api/v1/boards/${writeBoard.id}/cards`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          column_id: writeColumns[0].id,
          content: 'Card to edit',
        }),
      });
      const card = (await addRes.json()).data;

      // Move to icebreaker phase
      await app.request(`/api/v1/boards/${writeBoard.id}/phase`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'icebreaker' }),
      });

      // Try editing — should be rejected
      const editRes = await app.request(`/api/v1/boards/${writeBoard.id}/cards/${card.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Edited during icebreaker' }),
      });

      expect(editRes.status).toBe(422);
      const editBody = await editRes.json();
      expect(editBody.error.code).toBe('INVALID_PHASE');
    });

    it('icebreaker is a valid phase value for the API', async () => {
      // Advance to write first, then transition back to icebreaker
      // to prove 'icebreaker' is accepted as a valid phase value
      await app.request(`/api/v1/boards/${board.id}/phase`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'write' }),
      });

      const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'icebreaker' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.phase).toBe('icebreaker');
    });

    it('icebreaker -> group is rejected as invalid transition', async () => {
      const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'group' }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('INVALID_TRANSITION');
    });
  });

  describe('GET board includes icebreaker fields', () => {
    it('board GET response includes icebreaker_id and icebreaker_active', async () => {
      await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        phase: 'icebreaker',
      });

      const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.phase).toBe('icebreaker');
      expect(body.data.icebreaker_id).toBeNull();
      expect(body.data.icebreaker_active).toBe(true);
    });
  });
});
