import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  createTestCard,
  createTestVote,
  createTestGroup,
  setBoardPhase,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('DELETE /api/v1/boards/:id/cards/:cardId — Delete Card', () => {
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

  it('2.6.1: Delete own card during write phase', async () => {
    const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Delete me' });

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(card.id);
    expect(body.data.deleted).toBe(true);
  });

  it('2.6.2: Delete own card during vote phase', async () => {
    const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Card' });
    await setBoardPhase(board.id, 'vote');

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.6.3: Delete another user\'s card as member', async () => {
    const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Admin card' });

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('2.6.4: Delete another user\'s card as admin', async () => {
    const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Member card' });

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.deleted).toBe(true);
  });

  it('2.6.5: Delete card with votes (cascade)', async () => {
    const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Voted card' });
    await createTestVote(card.id, adminUser.id, 1);
    await createTestVote(card.id, memberUser.id, 1);

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.deleted).toBe(true);
  });

  it('2.6.6: Delete card in a group', async () => {
    const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Grouped card' });
    await createTestGroup(board.id, 'Test Group', [card.id]);

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.deleted).toBe(true);
  });

  it('2.6.7: Delete non-existent card', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/cards/00000000-0000-4000-8000-000000099999`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('CARD_NOT_FOUND');
  });
});
