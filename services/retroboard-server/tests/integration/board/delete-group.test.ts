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
  setBoardPhase,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('DELETE /api/v1/boards/:id/groups/:groupId — Delete Group', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
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

    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'group' });
    board = result.board;
    columns = result.columns;
  });

  it('2.11.1: Delete group with cards', async () => {
    const card1 = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 1' });
    const card2 = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 2' });
    const group = await createTestGroup(board.id, 'To Delete', [card1.id, card2.id]);

    const res = await app.request(`/api/v1/boards/${board.id}/groups/${group.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(group.id);
    expect(body.data.deleted).toBe(true);
    expect(body.data.ungrouped_card_ids).toHaveLength(2);
    expect(body.data.ungrouped_card_ids).toContain(card1.id);
    expect(body.data.ungrouped_card_ids).toContain(card2.id);
  });

  it('2.11.2: Delete empty group', async () => {
    const group = await createTestGroup(board.id, 'Empty Group');

    const res = await app.request(`/api/v1/boards/${board.id}/groups/${group.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.deleted).toBe(true);
    expect(body.data.ungrouped_card_ids).toEqual([]);
  });

  it('2.11.3: Delete group during vote phase', async () => {
    const group = await createTestGroup(board.id, 'My Group');
    await setBoardPhase(board.id, 'vote');

    const res = await app.request(`/api/v1/boards/${board.id}/groups/${group.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.11.4: Delete non-existent group', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/groups/00000000-0000-4000-8000-000000099999`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('GROUP_NOT_FOUND');
  });
});
