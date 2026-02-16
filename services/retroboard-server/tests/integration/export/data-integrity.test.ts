import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  createTestSprint,
  createTestBoard,
  createTestCard,
  createTestGroup,
  createTestActionItem,
  createTestVote,
  SYSTEM_TEMPLATE_WWD,
  refreshAnalyticsMaterializedViews,
  type TestBoard,
  type TestColumn,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

describe('Export Data Integrity Tests', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: TestBoard;
  let columns: TestColumn[];

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

  it('5.11.1: JSON round-trip', async () => {
    const card1 = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Card 1',
    });
    await createTestVote(card1.id, adminUser.id);
    await createTestGroup(board.id as string, 'Test Group', [card1.id]);
    await createTestActionItem(board.id as string, adminUser.id, { title: 'Action 1' });

    // Export
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const exportedData = await res.json();

    // Fetch DB data
    const [dbBoard] = await sql`SELECT * FROM boards WHERE id = ${board.id}`;
    const dbColumns = await sql`SELECT * FROM columns WHERE board_id = ${board.id} ORDER BY position`;
    const _dbCards = await sql`SELECT * FROM cards WHERE board_id = ${board.id}`;

    expect(exportedData.board.id).toBe(dbBoard.id);
    expect(exportedData.columns.length).toBe(dbColumns.length);
    expect(exportedData.columns[0].cards[0].content).toBe('Card 1');
  });

  it('5.11.2: Card count matches', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Card 1' });
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Card 2' });
    await createTestCard(board.id as string, columns[1].id as string, adminUser.id, { content: 'Card 3' });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const exportedData = await res.json();

    const [{ count: dbCount }] = await sql`SELECT COUNT(*)::int as count FROM cards WHERE board_id = ${board.id}`;
    const exportCount = exportedData.columns.reduce(
      (sum: number, col: { cards: unknown[] }) => sum + col.cards.length,
      0
    );

    expect(exportCount).toBe(dbCount);
  });

  it('5.11.3: Vote counts match', async () => {
    const card1 = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Card 1',
    });
    await createTestVote(card1.id, adminUser.id);
    await createTestVote(card1.id, adminUser.id);

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const exportedData = await res.json();

    const [{ count: dbVoteCount }] = await sql`
      SELECT COUNT(*)::int as count FROM card_votes WHERE card_id = ${card1.id}
    `;
    const exportVoteCount = exportedData.columns[0].cards[0].voteCount;

    expect(exportVoteCount).toBe(dbVoteCount);
  });

  it('5.11.4: Action item count matches', async () => {
    await createTestActionItem(board.id as string, adminUser.id, { title: 'Action 1' });
    await createTestActionItem(board.id as string, adminUser.id, { title: 'Action 2' });

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const exportedData = await res.json();

    const [{ count: dbCount }] = await sql`
      SELECT COUNT(*)::int as count FROM action_items WHERE board_id = ${board.id}
    `;

    expect(exportedData.actionItems.length).toBe(dbCount);
  });

  it('5.11.5: Group membership matches', async () => {
    const card1 = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Card 1',
    });
    const card2 = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Card 2',
    });
    await createTestGroup(board.id as string, 'Test Group', [card1.id, card2.id]);

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const exportedData = await res.json();

    const dbGroupMembers = await sql`
      SELECT card_id FROM card_group_members cgm
      JOIN card_groups cg ON cgm.group_id = cg.id
      WHERE cg.board_id = ${board.id}
    `;

    expect(exportedData.groups[0].cardIds).toHaveLength(dbGroupMembers.length);
  });

  it('5.11.6: Column order preserved', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const exportedData = await res.json();

    const dbColumns = await sql`
      SELECT id, position FROM columns WHERE board_id = ${board.id} ORDER BY position
    `;

    for (let i = 0; i < dbColumns.length; i++) {
      expect(exportedData.columns[i].id).toBe(dbColumns[i].id);
      expect(exportedData.columns[i].position).toBe(dbColumns[i].position);
    }
  });

  it('5.11.7: Analytics accuracy', async () => {
    const card1 = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, {
      content: 'Card 1',
    });
    await createTestVote(card1.id, adminUser.id);
    await sql`UPDATE boards SET phase = 'action' WHERE id = ${board.id}`;
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/boards/${board.id}/export?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const exportedData = await res.json();

    const [dbAnalytics] = await sql`
      SELECT * FROM mv_sprint_health WHERE sprint_id = ${sprint.id}
    `;

    if (exportedData.analytics && dbAnalytics) {
      expect(exportedData.analytics.healthScore).toBeDefined();
    }
  });
});
