import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  createTestCard,
  createTestGroup,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

describe('PUT /api/v1/boards/:id/focus — Set Focus', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: Record<string, unknown>;
  let columns: Record<string, unknown>[];

  beforeEach(async () => {
    await truncateTables();
    await seed();
    const auth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = auth.token;
    adminUser = auth.user;
    team = await createTestTeam(adminUser.id);
    sprint = await createTestSprint(team.id, adminUser.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'discuss' });
    board = result.board;
    columns = result.columns;
  });

  it('2.13.1: Focus on card during discuss phase', async () => {
    const card = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Focus me' });

    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: card.id, focus_item_type: 'card' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.focus_item_id).toBe(card.id);
    expect(body.data.focus_item_type).toBe('card');
  });

  it('2.13.2: Focus on group during discuss phase', async () => {
    const group = await createTestGroup(board.id as string, 'Focus Group');

    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: group.id, focus_item_type: 'group' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.focus_item_id).toBe(group.id);
    expect(body.data.focus_item_type).toBe('group');
  });

  it('2.13.3: Clear focus (null)', async () => {
    // Set focus first
    const card = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Card' });
    await sql`UPDATE boards SET focus_item_id = ${card.id}, focus_item_type = 'card' WHERE id = ${board.id}`;

    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: null, focus_item_type: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.focus_item_id).toBeNull();
    expect(body.data.focus_item_type).toBeNull();
  });

  it('2.13.4: Set focus during write phase', async () => {
    // Create a board in write phase
    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2', status: 'planning' });
    const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'write' });

    const res = await app.request(`/api/v1/boards/${result2.board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: null, focus_item_type: null }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.13.5: Focus on non-existent card', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        focus_item_id: '00000000-0000-4000-8000-000000099999',
        focus_item_type: 'card',
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('2.13.6: Focus on card from different board', async () => {
    // Create card on another board
    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2', status: 'planning' });
    const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'discuss' });
    const otherCard = await createTestCard(result2.board.id as string, result2.columns[0].id as string, adminUser.id, { content: 'Other card' });

    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: otherCard.id, focus_item_type: 'card' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('2.13.7: Set focus as member (not facilitator)', async () => {
    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    await addTeamMember(team.id, memberAuth.user.id, 'member');

    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: null, focus_item_type: null }),
    });

    expect(res.status).toBe(403);
  });

  it('2.13.8: Type mismatch: card ID with type=group', async () => {
    const card = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Card' });

    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: card.id, focus_item_type: 'group' }),
    });

    // The card.id won't be found in card_groups
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
