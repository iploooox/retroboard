import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  SYSTEM_TEMPLATE_WWD,
  type TestBoard,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

describe('PUT /api/v1/boards/:id — Update Board Settings', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: TestBoard;

  beforeEach(async () => {
    await truncateTables();
    await seed();
    const auth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = auth.token;
    adminUser = auth.user;
    team = await createTestTeam(adminUser.id);
    sprint = await createTestSprint(team.id, adminUser.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = result.board;
  });

  it('2.3.1: Update anonymous_mode during write phase', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ anonymous_mode: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.anonymous_mode).toBe(true);
  });

  it('2.3.2: Update anonymous_mode during vote phase', async () => {
    // Advance to vote phase
    await sql`UPDATE boards SET phase = 'vote' WHERE id = ${board.id}`;

    const res = await app.request(`/api/v1/boards/${board.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ anonymous_mode: true }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.3.3: Update max_votes_per_user during write phase', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_votes_per_user: 10 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.max_votes_per_user).toBe(10);
  });

  it('2.3.4: Update max_votes_per_user during group phase', async () => {
    await sql`UPDATE boards SET phase = 'group' WHERE id = ${board.id}`;

    const res = await app.request(`/api/v1/boards/${board.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_votes_per_user: 8 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.max_votes_per_user).toBe(8);
  });

  it('2.3.5: Update max_votes_per_user during vote phase', async () => {
    await sql`UPDATE boards SET phase = 'vote' WHERE id = ${board.id}`;

    const res = await app.request(`/api/v1/boards/${board.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_votes_per_user: 10 }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.3.6: Update with invalid max_votes_per_user (0)', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_votes_per_user: 0 }),
    });

    expect(res.status).toBe(422);
  });

  it('2.3.7: Update with invalid max_votes_per_user (100)', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_votes_per_user: 100 }),
    });

    expect(res.status).toBe(422);
  });

  it('2.3.8: Update as regular member', async () => {
    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    await addTeamMember(team.id, memberAuth.user.id, 'member');

    const res = await app.request(`/api/v1/boards/${board.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ anonymous_mode: true }),
    });

    expect(res.status).toBe(403);
  });

  it('2.3.9: Update non-existent board', async () => {
    const res = await app.request(`/api/v1/boards/00000000-0000-4000-8000-000000099999`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ anonymous_mode: true }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('BOARD_NOT_FOUND');
  });
});
