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
import { sql } from '../../../src/db/connection.js';
import { clearStatsCache } from '../../../src/routes/stats.js';

const app = createTestApp();

describe('GET /api/v1/stats — Public Stats API', () => {
  beforeEach(async () => {
    await truncateTables();
    await seed();
    clearStatsCache(); // Clear cache between tests
  });

  it('6.1.1: Returns stats with no data', async () => {
    await truncateTables();

    const res = await app.request('/api/v1/stats', {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      teams: 0,
      retros: 0,
      cards: 0,
      actionItems: 0,
    });
  });

  it('6.1.2: Returns correct stats with existing data', async () => {
    const auth = await getAuthToken({ displayName: 'Test User' });
    const team1 = await createTestTeam(auth.user.id, { name: 'Team 1' });
    const team2 = await createTestTeam(auth.user.id, { name: 'Team 2' });

    const sprint1 = await createTestSprint(team1.id, auth.user.id);
    const sprint2 = await createTestSprint(team2.id, auth.user.id);

    const board1 = await createTestBoard(sprint1.id, SYSTEM_TEMPLATE_WWD, auth.user.id, { phase: 'write' });
    const board2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, auth.user.id, { phase: 'action' });

    // Mark sprint2 as completed
    await sql`UPDATE sprints SET status = 'completed' WHERE id = ${sprint2.id}`;

    // Create cards
    await createTestCard(board1.board.id as string, board1.columns[0].id as string, auth.user.id, { content: 'Card 1' });
    await createTestCard(board1.board.id as string, board1.columns[0].id as string, auth.user.id, { content: 'Card 2' });
    await createTestCard(board2.board.id as string, board2.columns[0].id as string, auth.user.id, { content: 'Card 3' });

    // Create action items
    await sql`
      INSERT INTO action_items (board_id, title, assignee_id, created_by)
      VALUES (${board1.board.id}, 'Action 1', ${auth.user.id}, ${auth.user.id})
    `;
    await sql`
      INSERT INTO action_items (board_id, title, assignee_id, created_by)
      VALUES (${board2.board.id}, 'Action 2', ${auth.user.id}, ${auth.user.id})
    `;

    const res = await app.request('/api/v1/stats', {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      teams: 2,
      retros: 1, // Only board2 has status='completed'
      cards: 3,
      actionItems: 2,
    });
  });

  it('6.1.3: Does not require authentication', async () => {
    const res = await app.request('/api/v1/stats', {
      method: 'GET',
      // No Authorization header
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('6.1.4: Only counts completed retros, not active ones', async () => {
    const auth = await getAuthToken({ displayName: 'Test User' });
    const team = await createTestTeam(auth.user.id);

    // Create 3 boards in different sprints with explicit statuses
    const sprint1 = await createTestSprint(team.id, auth.user.id, { status: 'planning' });
    const sprint2 = await createTestSprint(team.id, auth.user.id, { name: 'Sprint 2', status: 'active' });
    const sprint3 = await createTestSprint(team.id, auth.user.id, { name: 'Sprint 3', status: 'planning' });

    await createTestBoard(sprint1.id, SYSTEM_TEMPLATE_WWD, auth.user.id, { phase: 'write' });
    await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, auth.user.id, { phase: 'action' });
    await createTestBoard(sprint3.id, SYSTEM_TEMPLATE_WWD, auth.user.id, { phase: 'discuss' });

    // Only mark sprint2 as completed
    await sql`UPDATE sprints SET status = 'completed' WHERE id = ${sprint2.id}`;

    const res = await app.request('/api/v1/stats', {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.retros).toBe(1);
  });
});
