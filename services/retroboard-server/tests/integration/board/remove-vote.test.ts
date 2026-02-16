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
  setBoardPhase,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('DELETE /api/v1/boards/:id/cards/:cardId/vote — Remove Vote', () => {
  let _adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: { id: string };
  let columns: { id: string }[];
  let card: { id: string };

  beforeEach(async () => {
    await truncateTables();
    await seed();
    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
      _adminToken = adminAuth.token;
    adminUser = adminAuth.user;
    team = await createTestTeam(adminUser.id);
    sprint = await createTestSprint(team.id, adminUser.id);

    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;
    await addTeamMember(team.id, memberUser.id, 'member');

    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'vote' });
    board = result.board;
    columns = result.columns;
    card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Votable card' });
  });

  it('2.8.1: Remove vote during vote phase', async () => {
    await createTestVote(card.id, memberUser.id, 1);

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.card_id).toBe(card.id);
    expect(body.data.user_votes).toBe(0);
  });

  it('2.8.2: Remove vote during write phase', async () => {
    await createTestVote(card.id, memberUser.id, 1);
    await setBoardPhase(board.id, 'write');

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.8.3: Remove vote when user has no votes on card', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('2.8.4: Remove second vote (leaves first)', async () => {
    await createTestVote(card.id, memberUser.id, 1);
    await createTestVote(card.id, memberUser.id, 2);

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Should have removed vote_number 2, leaving vote_number 1
    expect(body.data.user_votes).toBe(1);
  });

  it('2.8.5: user_votes_remaining increments after removal', async () => {
    // Cast 2 votes first
    await createTestVote(card.id, memberUser.id, 1);
    await createTestVote(card.id, memberUser.id, 2);

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // max_votes_per_user=5, had 2 votes, removed 1, so remaining=4
    expect(body.data.user_votes_remaining).toBe(4);
    expect(body.data.user_total_votes_cast).toBe(1);
  });
});
