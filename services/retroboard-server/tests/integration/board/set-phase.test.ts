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

describe('PUT /api/v1/boards/:id/phase — Set Phase', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: Record<string, unknown>;

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

  it('2.12.1: Advance write to group', async () => {
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
    expect(body.data.previous_phase).toBe('write');
  });

  it('2.12.2: Advance group to vote', async () => {
    await sql`UPDATE boards SET phase = 'group' WHERE id = ${board.id}`;

    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'vote' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.phase).toBe('vote');
    expect(body.data.previous_phase).toBe('group');
  });

  it('2.12.3: Advance vote to discuss', async () => {
    await sql`UPDATE boards SET phase = 'vote' WHERE id = ${board.id}`;

    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'discuss' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.phase).toBe('discuss');
  });

  it('2.12.4: Advance discuss to action', async () => {
    await sql`UPDATE boards SET phase = 'discuss' WHERE id = ${board.id}`;

    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'action' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.phase).toBe('action');
  });

  it('2.12.5: Go back group to write', async () => {
    await sql`UPDATE boards SET phase = 'group' WHERE id = ${board.id}`;

    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'write' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.phase).toBe('write');
    expect(body.data.previous_phase).toBe('group');
  });

  it('2.12.6: Skip write to vote', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'vote' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PHASE');
  });

  it('2.12.7: Set phase as member (not facilitator)', async () => {
    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    await addTeamMember(team.id, memberAuth.user.id, 'member');

    const res = await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${memberAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'group' }),
    });

    expect(res.status).toBe(403);
  });

  it('2.12.8: Set phase on non-existent board', async () => {
    const res = await app.request(`/api/v1/boards/00000000-0000-4000-8000-000000099999/phase`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'group' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('BOARD_NOT_FOUND');
  });
});
