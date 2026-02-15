import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  createTestSprint,
  createTestBoard,
  createTestCard,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('GET /api/v1/boards/:id/export (error cases)', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: Record<string, unknown>;
  let columns: Record<string, unknown>[];

  beforeEach(async () => {
    await truncateTables();
    await seed();
    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;
    team = await createTestTeam(adminUser.id);
    sprint = await createTestSprint(team.id, adminUser.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = result.board;
    columns = result.columns;
  });

  it('5.9.1: Missing format parameter', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_FORMAT');
  });

  it('5.9.2: Invalid format value (pdf)', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_FORMAT');
  });

  it('5.9.3: Invalid format value (csv)', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_FORMAT');
  });

  it('5.9.4: Board exceeds size limit', async () => {
    // Create 5001 cards
    for (let i = 0; i < 5001; i++) {
      await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
        content: `Card ${i}`,
      });
    }

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe('PAYLOAD_TOO_LARGE');
  });
});
