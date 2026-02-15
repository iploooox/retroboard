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

describe('Export Security Tests', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: Record<string, unknown>;
  let columns: Record<string, unknown>[];
  let otherTeam: { id: string };
  let otherSprint: { id: string };
  let otherBoard: Record<string, unknown>;

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

    // Create another team the admin is NOT a member of
    const otherUser = await getAuthToken({ email: 'other@example.com', displayName: 'Other User' });
    otherTeam = await createTestTeam(otherUser.user.id, { name: 'Other Team', slug: 'other-team' });
    otherSprint = await createTestSprint(otherTeam.id, otherUser.user.id);
    const otherResult = await createTestBoard(otherSprint.id, SYSTEM_TEMPLATE_WWD, otherUser.user.id);
    otherBoard = otherResult.board;
  });

  it('5.12.1: XSS card text HTML', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: '<script>alert("xss")</script><img src=x onerror=alert("xss2")>',
    });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=html`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain('<script>alert("xss")</script>');
    expect(body).not.toContain('<img src=x onerror=alert("xss2")>');
    expect(body).toContain('&lt;script&gt;');
    expect(body).toContain('&lt;img');
  });

  it('5.12.2: XSS card text JSON', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: '<script>alert("xss")</script>',
    });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const cardContent = body.columns[0].cards[0].content;
    expect(cardContent).toBe('<script>alert("xss")</script>');
    // JSON format is safe - content type prevents script execution
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('5.12.3: SQL injection board ID', async () => {
    const maliciousId = "'; DROP TABLE boards--";
    const res = await app.request(`/api/v1/boards/${encodeURIComponent(maliciousId)}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBeOneOf([400, 404]);
  });

  it('5.12.4: Path traversal filename', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Normal card',
    });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const disposition = res.headers.get('content-disposition');
    expect(disposition).toBeDefined();
    expect(disposition).not.toContain('../');
    expect(disposition).not.toContain('..\\');
    expect(disposition).toMatch(/filename="retro-[^"]+\.json"/);
  });

  it('5.12.5: Cross-team export', async () => {
    const res = await app.request(`/api/v1/boards/${otherBoard.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(403);
  });

  it('5.12.6: Expired token', async () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj0uAa_sKk5TnEz5n9zKFTEqaXpjHXKnJf7WqbVU';

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    expect(res.status).toBe(401);
  });
});
