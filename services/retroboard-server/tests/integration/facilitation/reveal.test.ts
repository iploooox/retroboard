import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  createTestCard,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

describe('PUT /api/v1/boards/:id/reveal — Card Reveal', () => {
  let facilitatorToken: string;
  let facilitatorUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: Record<string, unknown>;
  let columns: Record<string, unknown>[];

  beforeEach(async () => {
    await truncateTables();
    await seed();

    const adminAuth = await getAuthToken({ displayName: 'Admin', email: 'admin@example.com' });
    team = await createTestTeam(adminAuth.user.id);
    sprint = await createTestSprint(team.id, adminAuth.user.id);
    // Create anonymous board
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminAuth.user.id, {
      anonymous_mode: true,
    });
    board = result.board;
    columns = result.columns;

    const facilitatorAuth = await getAuthToken({ displayName: 'Facilitator', email: 'facilitator@example.com' });
    facilitatorToken = facilitatorAuth.token;
    facilitatorUser = facilitatorAuth.user;
    await addTeamMember(team.id, facilitatorUser.id, 'facilitator');

    const memberAuth = await getAuthToken({ displayName: 'Member', email: 'member@example.com' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;
    await addTeamMember(team.id, memberUser.id, 'member');
  });

  it('3.5.1: Reveal cards on anonymous board', async () => {
    // Add some cards first
    await createTestCard(board.id as string, columns[0].id as string, memberUser.id, { content: 'Anonymous card' });

    const res = await app.request(`/api/v1/boards/${board.id}/reveal`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.cards_revealed).toBe(true);

    // Verify DB state
    const [dbBoard] = await sql`SELECT cards_revealed FROM boards WHERE id = ${board.id as string}`;
    expect(dbBoard.cards_revealed).toBe(true);
  });

  it('3.5.2: Non-anonymous board returns 400', async () => {
    // Create a non-anonymous board
    const sprint2 = await createTestSprint(team.id, facilitatorUser.id, { name: 'Sprint 2', status: 'planning' });
    const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, facilitatorUser.id, {
      anonymous_mode: false,
    });

    const res = await app.request(`/api/v1/boards/${result2.board.id}/reveal`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_ANONYMOUS');
  });

  it('3.5.3: Already revealed returns 400', async () => {
    await sql`UPDATE boards SET cards_revealed = true WHERE id = ${board.id as string}`;

    const res = await app.request(`/api/v1/boards/${board.id}/reveal`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('ALREADY_REVEALED');
  });

  it('3.5.4: After reveal, GET cards shows author info', async () => {
    const card = await createTestCard(board.id as string, columns[0].id as string, memberUser.id, { content: 'Secret card' });

    // Reveal
    await app.request(`/api/v1/boards/${board.id}/reveal`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
    });

    // GET the board to check cards include author info
    const res = await app.request(`/api/v1/boards/${board.id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { cards?: Array<Record<string, unknown>> } };
    const foundCard = body.data.cards?.find((c) => c.id === card.id);
    expect(foundCard).toBeDefined();
    expect(foundCard!.author_id).toBe(memberUser.id);
  });

  it('3.5.5: Member cannot reveal cards', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/reveal`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(res.status).toBe(403);
  });

  it('3.5.6: Reveal produces cards_revealed event in board_events', async () => {
    await createTestCard(board.id as string, columns[0].id as string, memberUser.id, { content: 'Card' });

    const res = await app.request(`/api/v1/boards/${board.id}/reveal`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(res.status).toBe(200);

    const events = await sql`
      SELECT * FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'cards_revealed'
      ORDER BY created_at DESC LIMIT 1
    `;
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('cards_revealed');
  });
});
