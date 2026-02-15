import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  createTestCard,
  setBoardPhase,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('POST /api/v1/boards/:id/cards — Add Card', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: { id: string };
  let columns: { id: string; name: string }[];

  beforeEach(async () => {
    await truncateTables();
    await seed();
    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;
    team = await createTestTeam(adminUser.id);
    sprint = await createTestSprint(team.id, adminUser.id);

    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;
    await addTeamMember(team.id, memberUser.id, 'member');

    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = result.board;
    columns = result.columns;
  });

  it('2.4.1: Add card during write phase', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        column_id: columns[0].id,
        content: 'Great team communication!',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.content).toBe('Great team communication!');
    expect(body.data.column_id).toBe(columns[0].id);
    expect(body.data.board_id).toBe(board.id);
    expect(body.data.author_id).toBe(adminUser.id);
    expect(body.data.position).toBeTypeOf('number');
    expect(body.data.vote_count).toBe(0);
    expect(body.data.user_votes).toBe(0);
    expect(body.data.group_id).toBeNull();
  });

  it('2.4.2: Add card during group phase', async () => {
    await setBoardPhase(board.id, 'group');

    const res = await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        column_id: columns[0].id,
        content: 'Should not be allowed',
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.4.3: Add card during vote phase', async () => {
    await setBoardPhase(board.id, 'vote');

    const res = await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        column_id: columns[0].id,
        content: 'Should not be allowed',
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.4.4: Add card with missing content', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        column_id: columns[0].id,
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('2.4.5: Add card with missing column_id', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: 'Missing column',
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('2.4.6: Add card as any team member', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        column_id: columns[0].id,
        content: 'Member card',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.author_id).toBe(memberUser.id);
  });

  it('2.4.7: Card position auto-increments', async () => {
    // Create first card directly in DB
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'First card', position: 0 });

    const res = await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        column_id: columns[0].id,
        content: 'Second card',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.position).toBe(1);
  });

  it('2.4.8: Add card to non-existent board', async () => {
    const res = await app.request(`/api/v1/boards/00000000-0000-4000-8000-000000099999/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        column_id: columns[0].id,
        content: 'Orphan card',
      }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('BOARD_NOT_FOUND');
  });
});
