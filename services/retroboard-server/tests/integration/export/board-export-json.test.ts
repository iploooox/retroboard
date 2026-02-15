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
  createTestActionItem,
  createTestVote,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

describe('GET /api/v1/boards/:id/export?format=json', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let nonMemberToken: string;
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
    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;
    const nonMemberAuth = await getAuthToken({ email: 'nonmember@example.com', displayName: 'Non Member' });
    nonMemberToken = nonMemberAuth.token;
    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');
    sprint = await createTestSprint(team.id, adminUser.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = result.board;
    columns = result.columns;
  });

  it('5.6.1: Export board as JSON', async () => {
    const card = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Test card',
    });
    await createTestVote(card.id, adminUser.id);

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exportVersion).toBe('1.0');
    expect(body.board.id).toBe(board.id);
  });

  it('5.6.2: Content-Type header', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('5.6.3: Content-Disposition header', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
  });

  it('5.6.4: Filename format', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const disposition = res.headers.get('content-disposition');
    expect(disposition).toMatch(/filename="retro-.+-\d{4}-\d{2}-\d{2}\.json"/);
  });

  it('5.6.5: All sections present', async () => {
    const card = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Card 1',
    });
    await createTestVote(card.id, adminUser.id);
    await createTestGroup(board.id as string, 'Test Group', [card.id]);
    await createTestActionItem(board.id as string, adminUser.id, { title: 'Test Action' });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('board');
    expect(body).toHaveProperty('columns');
    expect(body).toHaveProperty('groups');
    expect(body).toHaveProperty('actionItems');
    expect(body).toHaveProperty('analytics');
  });

  it('5.6.6: Cards sorted by votes', async () => {
    const card1 = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Low votes',
    });
    const card2 = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'High votes',
    });
    await createTestVote(card1.id, adminUser.id);
    await createTestVote(card2.id, adminUser.id);
    await createTestVote(card2.id, memberUser.id);

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const col = body.columns.find((c: { id: string }) => c.id === columns[0].id);
    expect(col.cards[0].content).toBe('High votes');
    expect(col.cards[0].voteCount).toBe(2);
    expect(col.cards[1].content).toBe('Low votes');
    expect(col.cards[1].voteCount).toBe(1);
  });

  it('5.6.7: Anonymous cards hidden', async () => {
    await sql`UPDATE boards SET anonymous_mode = true, cards_revealed = false WHERE id = ${board.id}`;
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Anonymous card',
    });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const col = body.columns.find((c: { id: string }) => c.id === columns[0].id);
    expect(col.cards[0].authorId).toBeNull();
    expect(col.cards[0].authorName).toBeNull();
  });

  it('5.6.8: Anonymous cards shown after reveal', async () => {
    await sql`UPDATE boards SET anonymous_mode = true, cards_revealed = true WHERE id = ${board.id}`;
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Revealed card',
    });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const col = body.columns.find((c: { id: string }) => c.id === columns[0].id);
    expect(col.cards[0].authorId).toBe(adminUser.id);
    expect(col.cards[0].authorName).toBe('Admin User');
  });

  it('5.6.9: Board not found', async () => {
    const res = await app.request(`/api/v1/boards/550e8400-e29b-41d4-a716-446655440000/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
  });

  it('5.6.10: Not team member', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${nonMemberToken}` },
    });

    expect(res.status).toBe(403);
  });

  it('5.6.11: Unauthenticated', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`);

    expect(res.status).toBe(401);
  });

  it('5.6.12: Empty board', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.columns.every((c: { cards: unknown[] }) => c.cards.length === 0)).toBe(true);
  });

  it('5.6.13: Large board (1000 cards)', async () => {
    for (let i = 0; i < 1000; i++) {
      await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
        content: `Card ${i}`,
      });
    }

    const start = Date.now();
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    const body = await res.json();
    const col = body.columns.find((c: { id: string }) => c.id === columns[0].id);
    expect(col.cards.length).toBe(1000);
    expect(duration).toBeLessThan(2000);
  });
});
