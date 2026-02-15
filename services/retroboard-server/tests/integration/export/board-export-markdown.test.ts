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

const app = createTestApp();

describe('GET /api/v1/boards/:id/export?format=markdown', () => {
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

  it('5.7.1: Export board as Markdown', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Test card',
    });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=markdown`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/^# Retrospective:/);
  });

  it('5.7.2: Content-Type header', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=markdown`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(res.headers.get('content-type')).toContain('charset=utf-8');
  });

  it('5.7.3: Content-Disposition header', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=markdown`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('content-disposition')).toContain('.md');
  });

  it('5.7.4: Markdown renders correctly', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Test card',
    });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=markdown`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('##');
    expect(body).toContain('**Team:**');
  });

  it('5.7.5: Sections present', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Card 1',
    });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=markdown`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('## Summary');
    expect(body).toContain(columns[0].name as string);
    expect(body).toContain('*Exported from RetroBoard Pro');
  });

  it('5.7.6: Pipe characters in card text', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Compare A | B options',
    });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=markdown`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('\\|');
  });

  it('5.7.7: Board not found', async () => {
    const res = await app.request(`/api/v1/boards/550e8400-e29b-41d4-a716-446655440000/export?format=markdown`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
  });
});
