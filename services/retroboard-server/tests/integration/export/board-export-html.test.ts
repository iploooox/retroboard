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

describe('GET /api/v1/boards/:id/export?format=html', () => {
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

  it('5.8.1: Export board as HTML', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Test card',
    });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=html`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<!DOCTYPE html>');
    expect(body).toContain('</html>');
  });

  it('5.8.2: Content-Type header', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=html`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('content-type')).toContain('charset=utf-8');
  });

  it('5.8.3: No Content-Disposition', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=html`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBeNull();
  });

  it('5.8.4: Print CSS present', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=html`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('@media print');
  });

  it('5.8.5: Print banner present', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=html`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Use your browser's Print function");
    expect(body).toContain('Ctrl+P');
    expect(body).toContain('Cmd+P');
  });

  it('5.8.6: Script injection prevented', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: '<script>alert("xss")</script>Malicious card',
    });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=html`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain('<script>alert("xss")</script>');
    expect(body).toContain('&lt;script&gt;');
    expect(body).toContain('&lt;/script&gt;');
  });

  it('5.8.7: Board not found', async () => {
    const res = await app.request(`/api/v1/boards/550e8400-e29b-41d4-a716-446655440000/export?format=html`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
  });
});
