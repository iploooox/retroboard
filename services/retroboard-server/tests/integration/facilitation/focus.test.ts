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

describe('PUT /api/v1/boards/:id/focus — Facilitation Focus Management', () => {
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
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminAuth.user.id, { phase: 'discuss' });
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

  it('3.6.1: Set focus on card', async () => {
    const card = await createTestCard(board.id as string, columns[0].id as string, facilitatorUser.id, { content: 'Focus card' });

    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
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

  it('3.6.2: Set focus on group', async () => {
    const card = await createTestCard(board.id as string, columns[0].id as string, facilitatorUser.id, { content: 'Card in group' });
    const group = await createTestGroup(board.id as string, 'Discussion Group', [card.id]);

    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: group.id, focus_item_type: 'group' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.focus_item_id).toBe(group.id);
    expect(body.data.focus_item_type).toBe('group');
  });

  it('3.6.3: Clear focus', async () => {
    // Set focus first
    const card = await createTestCard(board.id as string, columns[0].id as string, facilitatorUser.id, { content: 'Card' });
    await sql`UPDATE boards SET focus_item_id = ${card.id}, focus_item_type = 'card' WHERE id = ${board.id as string}`;

    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: null, focus_item_type: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.focus_item_id).toBeNull();
    expect(body.data.focus_item_type).toBeNull();
  });

  it('3.6.4: Focus broadcasts event (check board_events)', async () => {
    const card = await createTestCard(board.id as string, columns[0].id as string, facilitatorUser.id, { content: 'Focus me' });

    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: card.id, focus_item_type: 'card' }),
    });

    expect(res.status).toBe(200);

    const events = await sql`
      SELECT * FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'focus_changed'
      ORDER BY created_at DESC LIMIT 1
    `;
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('focus_changed');
  });

  it('3.6.5: Focus on non-existent card', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        focus_item_id: '00000000-0000-4000-8000-000000099999',
        focus_item_type: 'card',
      }),
    });

    // Should return 404 for the focus target
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('FOCUS_TARGET_NOT_FOUND');
  });

  it('3.6.6: Member cannot set focus', async () => {
    const card = await createTestCard(board.id as string, columns[0].id as string, facilitatorUser.id, { content: 'Card' });

    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: card.id, focus_item_type: 'card' }),
    });

    expect(res.status).toBe(403);
  });

  it('3.6.7: Change focus between items', async () => {
    const card1 = await createTestCard(board.id as string, columns[0].id as string, facilitatorUser.id, { content: 'Card 1' });
    const card2 = await createTestCard(board.id as string, columns[0].id as string, facilitatorUser.id, { content: 'Card 2' });

    // Set focus on card1
    await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: card1.id, focus_item_type: 'card' }),
    });

    // Change to card2
    const res = await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_item_id: card2.id, focus_item_type: 'card' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.focus_item_id).toBe(card2.id);
  });
});
