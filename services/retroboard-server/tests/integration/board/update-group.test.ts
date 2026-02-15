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

describe('PUT /api/v1/boards/:id/groups/:groupId — Update Group', () => {
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

    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'group' });
    board = result.board;
    columns = result.columns;
  });

  it('2.10.1: Rename group', async () => {
    const group = await createTestGroup(board.id, 'Original Title');

    const res = await app.request(`/api/v1/boards/${board.id}/groups/${group.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Renamed Group' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.title).toBe('Renamed Group');
  });

  it('2.10.2: Add cards to group', async () => {
    const card1 = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 1' });
    const card2 = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 2' });
    const group = await createTestGroup(board.id, 'My Group');

    const res = await app.request(`/api/v1/boards/${board.id}/groups/${group.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ add_card_ids: [card1.id, card2.id] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.card_ids).toContain(card1.id);
    expect(body.data.card_ids).toContain(card2.id);
  });

  it('2.10.3: Remove cards from group', async () => {
    const card1 = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 1' });
    const card2 = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 2' });
    const group = await createTestGroup(board.id, 'My Group', [card1.id, card2.id]);

    const res = await app.request(`/api/v1/boards/${board.id}/groups/${group.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ remove_card_ids: [card1.id] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.card_ids).not.toContain(card1.id);
    expect(body.data.card_ids).toContain(card2.id);
  });

  it('2.10.4: Add card already in another group (moves it)', async () => {
    const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Shared card' });
    const group1 = await createTestGroup(board.id, 'Group 1', [card.id]);
    const group2 = await createTestGroup(board.id, 'Group 2');

    const res = await app.request(`/api/v1/boards/${board.id}/groups/${group2.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ add_card_ids: [card.id] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.card_ids).toContain(card.id);
  });

  it('2.10.5: Update group during vote phase', async () => {
    const group = await createTestGroup(board.id, 'My Group');
    await setBoardPhase(board.id, 'vote');

    const res = await app.request(`/api/v1/boards/${board.id}/groups/${group.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Updated title' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.10.6: Update non-existent group', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/groups/00000000-0000-4000-8000-000000099999`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Ghost group' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('GROUP_NOT_FOUND');
  });
});
