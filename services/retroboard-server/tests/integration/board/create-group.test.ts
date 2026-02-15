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

describe('POST /api/v1/boards/:id/groups — Create Group', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: { id: string };
  let columns: { id: string }[];

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

    // Board in group phase
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'group' });
    board = result.board;
    columns = result.columns;
  });

  it('2.9.1: Create group during group phase', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/groups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Communication Issues' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.title).toBe('Communication Issues');
    expect(body.data.board_id).toBe(board.id);
    expect(body.data.position).toBeTypeOf('number');
    expect(body.data.card_ids).toEqual([]);
  });

  it('2.9.2: Create group with initial cards', async () => {
    const card1 = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 1' });
    const card2 = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Card 2' });

    const res = await app.request(`/api/v1/boards/${board.id}/groups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Related Cards',
        card_ids: [card1.id, card2.id],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.card_ids).toHaveLength(2);
    expect(body.data.card_ids).toContain(card1.id);
    expect(body.data.card_ids).toContain(card2.id);
  });

  it('2.9.3: Create group during write phase', async () => {
    await setBoardPhase(board.id, 'write');

    const res = await app.request(`/api/v1/boards/${board.id}/groups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Should not be allowed' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.9.4: Create group as member (not facilitator)', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/groups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Member group' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('2.9.5: Create group with empty title', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/groups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: '' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('2.9.6: Create group with card from different board', async () => {
    // Create card on a different board
    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2' });
    const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'group' });
    const otherCard = await createTestCard(result2.board.id, result2.columns[0].id, adminUser.id, { content: 'Other' });

    const res = await app.request(`/api/v1/boards/${board.id}/groups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Cross-board group',
        card_ids: [otherCard.id],
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
