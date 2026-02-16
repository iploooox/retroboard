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

describe('POST /api/v1/boards/:id/cards/:cardId/vote — Vote', () => {
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

    // Board in vote phase with max_votes_per_user=5, max_votes_per_card=3
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'vote' });
    board = result.board;
    columns = result.columns;
    card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Votable card' });
  });

  it('2.7.1: Vote on card during vote phase', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.card_id).toBe(card.id);
    expect(body.data.vote_count).toBeGreaterThanOrEqual(1);
    expect(body.data.user_votes).toBe(1);
    expect(body.data.user_votes_remaining).toBeTypeOf('number');
    expect(body.data.user_total_votes_cast).toBe(1);
  });

  it('2.7.2: Vote during write phase', async () => {
    await setBoardPhase(board.id, 'write');

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.7.3: Vote during group phase', async () => {
    await setBoardPhase(board.id, 'group');

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.7.4: Multiple votes on same card (within limit)', async () => {
    // First vote
    await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    // Second vote
    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.user_votes).toBe(2);
  });

  it('2.7.5: Exceed max_votes_per_card', async () => {
    // Board has max_votes_per_card=3, cast 3 votes first
    await createTestVote(card.id, memberUser.id, 1);
    await createTestVote(card.id, memberUser.id, 2);
    await createTestVote(card.id, memberUser.id, 3);

    // Try 4th vote on the same card
    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VOTE_LIMIT_REACHED');
  });

  it('2.7.6: Exceed max_votes_per_user', async () => {
    // Board has max_votes_per_user=5, spread votes across multiple cards
    const card2 = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 2' });
    const card3 = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 3' });

    // Cast 5 votes (max) across different cards: 3 on card, 2 on card2
    await createTestVote(card.id, memberUser.id, 1);
    await createTestVote(card.id, memberUser.id, 2);
    await createTestVote(card.id, memberUser.id, 3);
    await createTestVote(card2.id, memberUser.id, 1);
    await createTestVote(card2.id, memberUser.id, 2);

    // Try 6th vote on card3
    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card3.id}/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VOTE_LIMIT_REACHED');
  });

  it('2.7.7: Vote response includes remaining votes', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    // max_votes_per_user=5, cast 1 vote, so remaining=4
    expect(body.data.user_votes_remaining).toBe(4);
    expect(body.data.user_total_votes_cast).toBe(1);
  });

  it('2.7.8: Vote on non-existent card', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/cards/00000000-0000-4000-8000-000000099999/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('CARD_NOT_FOUND');
  });

  it('2.7.9: Vote on card from different board', async () => {
    // Create a second board with a card
    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2' });
    const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'vote' });
    const otherCard = await createTestCard(result2.board.id, result2.columns[0].id, adminUser.id, { content: 'Other board card' });

    // Try to vote using the first board's URL but the other board's card
    const res = await app.request(`/api/v1/boards/${board.id}/cards/${otherCard.id}/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('CARD_NOT_FOUND');
  });

  it('2.7.10: Vote as non-team member', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@example.com' });

    const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${outsiderAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
