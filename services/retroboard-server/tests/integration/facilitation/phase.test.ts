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

describe('PUT /api/v1/boards/:id/phase — Facilitation Phase Management', () => {
  let facilitatorToken: string;
  let facilitatorUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: Record<string, unknown>;

  beforeEach(async () => {
    await truncateTables();
    await seed();

    // Create admin (team creator, gets admin role)
    const adminAuth = await getAuthToken({ displayName: 'Admin User', email: 'admin@example.com' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;
    team = await createTestTeam(adminUser.id);
    sprint = await createTestSprint(team.id, adminUser.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = result.board;

    // Create facilitator
    const facilitatorAuth = await getAuthToken({ displayName: 'Facilitator', email: 'facilitator@example.com' });
    facilitatorToken = facilitatorAuth.token;
    facilitatorUser = facilitatorAuth.user;
    await addTeamMember(team.id, facilitatorUser.id, 'facilitator');

    // Create member
    const memberAuth = await getAuthToken({ displayName: 'Member', email: 'member@example.com' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;
    await addTeamMember(team.id, memberUser.id, 'member');
  });

  it('3.3.1: Facilitator changes phase (write→group)', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'group' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.phase).toBe('group');
    expect(body.data.previous_phase).toBe('write');
  });

  it('3.3.2: Member cannot change phase', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'group' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('3.3.3: Admin can change phase', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'group' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.phase).toBe('group');
  });

  it('3.3.4: Invalid phase rejected', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'invalid' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('3.3.5: Phase change auto-stops running timer', async () => {
    // Insert a timer directly in DB
    await sql`
      INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
      VALUES (${board.id as string}, 'write', 300, 250, ${adminUser.id})
    `;

    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'group' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.timerStopped).toBe(true);

    // Timer should be removed
    const [timer] = await sql`SELECT * FROM board_timers WHERE board_id = ${board.id as string}`;
    expect(timer).toBeUndefined();
  });

  it('3.3.6: Phase change backwards (discuss→vote)', async () => {
    await sql`UPDATE boards SET phase = 'discuss' WHERE id = ${board.id as string}`;

    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'vote' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.phase).toBe('vote');
    expect(body.data.previous_phase).toBe('discuss');
  });

  it('3.3.7: Non-existent board', async () => {
    const res = await app.request(`/api/v1/boards/00000000-0000-4000-8000-000000099999/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'group' }),
    });

    expect(res.status).toBe(404);
  });

  it('3.3.8: Unauthenticated request', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'group' }),
    });

    expect(res.status).toBe(401);
  });
});
