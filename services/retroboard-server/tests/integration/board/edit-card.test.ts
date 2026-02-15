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

describe('PUT /api/v1/boards/:id/cards/:cardId — Edit Card', () => {
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

  it('2.5.1: Edit own card content during write phase', async () => {
    const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Original' });

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Updated content' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.content).toBe('Updated content');
  });

  it('2.5.2: Edit own card during group phase', async () => {
    const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Original' });
    await setBoardPhase(board.id, 'group');

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Updated in group phase' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.content).toBe('Updated in group phase');
  });

  it('2.5.3: Edit own card during vote phase', async () => {
    const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Original' });
    await setBoardPhase(board.id, 'vote');

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Should not be allowed' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.5.4: Edit another user\'s card as member', async () => {
    const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Admin card' });

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Edited by member' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('2.5.5: Edit another user\'s card as admin', async () => {
    const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Member card' });

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Edited by admin' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.content).toBe('Edited by admin');
  });

  it('2.5.6: Edit another user\'s card as facilitator', async () => {
    const facilitatorAuth = await getAuthToken({ email: 'facilitator@example.com', displayName: 'Facilitator' });
    await addTeamMember(team.id, facilitatorAuth.user.id, 'facilitator');

    const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Member card' });

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Edited by facilitator' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.content).toBe('Edited by facilitator');
  });

  it('2.5.7: Move card to different column', async () => {
    const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Moving card' });

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ column_id: columns[1].id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.column_id).toBe(columns[1].id);
  });

  it('2.5.8: Edit non-existent card', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/cards/00000000-0000-4000-8000-000000099999`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Ghost card' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('CARD_NOT_FOUND');
  });
});
