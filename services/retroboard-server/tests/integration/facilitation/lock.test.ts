import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

describe('PUT /api/v1/boards/:id/lock — Board Lock', () => {
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
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminAuth.user.id);
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

  it('3.4.1: Lock board', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/lock`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isLocked: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.is_locked).toBe(true);
  });

  it('3.4.2: Unlock board', async () => {
    // Lock first
    await sql`UPDATE boards SET is_locked = true WHERE id = ${board.id as string}`;

    const res = await app.request(`/api/v1/boards/${board.id}/lock`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isLocked: false }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.is_locked).toBe(false);
  });

  it('3.4.3: Lock broadcasts event (check board_events)', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/lock`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isLocked: true }),
    });

    expect(res.status).toBe(200);

    // Verify board_events has a board_locked event
    const events = await sql`
      SELECT * FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'board_locked'
      ORDER BY created_at DESC LIMIT 1
    `;
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('board_locked');
  });

  it('3.4.4: Locked board rejects card creation by member', async () => {
    await sql`UPDATE boards SET is_locked = true WHERE id = ${board.id as string}`;

    const res = await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        column_id: columns[0].id,
        content: 'Should be rejected',
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('3.4.5: Locked board allows facilitator to add cards', async () => {
    await sql`UPDATE boards SET is_locked = true WHERE id = ${board.id as string}`;

    const res = await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        column_id: columns[0].id,
        content: 'Facilitator card on locked board',
      }),
    });

    expect(res.status).toBe(201);
  });

  it('3.4.6: Member cannot lock board', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/lock`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isLocked: true }),
    });

    expect(res.status).toBe(403);
  });

  it('3.4.7: Unlock broadcasts event (check board_events)', async () => {
    await sql`UPDATE boards SET is_locked = true WHERE id = ${board.id as string}`;

    const res = await app.request(`/api/v1/boards/${board.id}/lock`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isLocked: false }),
    });

    expect(res.status).toBe(200);

    const events = await sql`
      SELECT * FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'board_unlocked'
      ORDER BY created_at DESC LIMIT 1
    `;
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('board_unlocked');
  });
});
