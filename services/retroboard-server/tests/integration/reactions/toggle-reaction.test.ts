import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../../../src/db/connection.js';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  createTestSprint,
  createTestBoard,
  createTestCard,
  addTeamMember,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('S-026: POST /api/v1/cards/:cardId/reactions — Toggle Reaction', () => {
  let adminToken: string;
  let adminUser: { id: string };
  let memberToken: string;
  let memberUser: { id: string };
  let team: { id: string };
  let board: { id: string };
  let cardId: string;

  beforeEach(async () => {
    await truncateTables();
    await seed();

    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;

    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;

    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');

    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board: testBoard, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = testBoard;

    const card = await createTestCard(board.id, columns[0].id, adminUser.id);
    cardId = card.id;
  });

  it('5.1: Add reaction to card returns 200 with reaction added', async () => {
    const res = await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '👍' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.added).toBe(true);
    expect(body.data.emoji).toBe('👍');
    expect(body.data.reactions).toBeDefined();
    expect(body.data.reactions).toHaveLength(1);
    expect(body.data.reactions[0].emoji).toBe('👍');
    expect(body.data.reactions[0].count).toBe(1);
  });

  it('5.2: Toggle off - send same reaction again removes it', async () => {
    // Add reaction
    await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '❤️' }),
    });

    // Remove reaction
    const res = await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '❤️' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.added).toBe(false);
    expect(body.data.reactions).toHaveLength(0);
  });

  it('5.3: Invalid emoji returns 400', async () => {
    const res = await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '🦄' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toMatch(/VALIDATION_ERROR|INVALID_EMOJI/i);
  });

  it('5.4: Card not found returns 404', async () => {
    const res = await app.request('/api/v1/cards/00000000-0000-4000-8000-000000099999/reactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '👍' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('CARD_NOT_FOUND');
  });

  it('5.5: Not team member returns 403', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@example.com' });

    const res = await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${outsiderAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '👍' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('5.6: No auth returns 401', async () => {
    const res = await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '👍' }),
    });

    expect(res.status).toBe(401);
  });

  it('5.7: Board locked returns 403', async () => {
    await sql`UPDATE boards SET is_locked = true WHERE id = ${board.id}`;

    const res = await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '👍' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toMatch(/BOARD_LOCKED|FORBIDDEN/i);
  });

  it('5.8: Multiple users react with same emoji - count increases', async () => {
    await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '🔥' }),
    });

    const res = await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '🔥' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reactions[0].count).toBe(2);
  });

  it('5.9: Multiple emojis on same card - all returned', async () => {
    await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '👍' }),
    });

    const res = await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '❤️' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reactions).toHaveLength(2);
  });

  it('5.10: Card response includes reactions array with emoji, count, reacted', async () => {
    await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '👍' }),
    });

    const res = await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '👍' }),
    });

    const body = await res.json();
    expect(body.data.reactions[0]).toHaveProperty('emoji');
    expect(body.data.reactions[0]).toHaveProperty('count');
    expect(body.data.reactions[0]).toHaveProperty('reacted');
    expect(body.data.reactions[0].emoji).toBe('👍');
    expect(body.data.reactions[0].count).toBe(2);
    expect(body.data.reactions[0].reacted).toBe(true); // member reacted
  });

  it('5.11: Reaction survives card re-fetch - GET card includes reactions', async () => {
    await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '❤️' }),
    });

    const res = await app.request(`/api/v1/cards/${cardId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reactions).toBeDefined();
    expect(body.data.reactions).toHaveLength(1);
    expect(body.data.reactions[0].emoji).toBe('❤️');
  });

  it('5.12: Card delete cascades reactions', async () => {
    await app.request(`/api/v1/cards/${cardId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji: '👍' }),
    });

    // Delete card
    await sql`DELETE FROM cards WHERE id = ${cardId}`;

    // Check reactions are deleted
    const reactions = await sql`SELECT * FROM card_reactions WHERE card_id = ${cardId}`;
    expect(reactions).toHaveLength(0);
  });
});
