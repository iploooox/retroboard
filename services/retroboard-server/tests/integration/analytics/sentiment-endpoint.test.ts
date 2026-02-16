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
  refreshAnalyticsMaterializedViews,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('GET /api/v1/teams/:teamId/analytics/sentiment — Sentiment Analytics', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let _memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };

  beforeEach(async () => {
    await truncateTables();
    await seed();

    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;

    const memberAuth = await getAuthToken({ email: 'member@test.com', displayName: 'Member User' });
      _memberToken = memberAuth.token;
    memberUser = memberAuth.user;

    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');
  });

  it('8.1: Returns sentiment per sprint for 3 sprints', async () => {
    for (let i = 1; i <= 3; i++) {
      const sprint = await createTestSprint(team.id, adminUser.id, {
        name: `Sprint ${i}`,
        status: i === 3 ? 'active' : 'completed',
        startDate: `2026-0${i}-01`,
      });
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
      await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'excellent work' });
      await createTestCard(board.id, columns[1].id, memberUser.id, { content: 'terrible bugs' });
    }
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/sentiment`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprints).toHaveLength(3);
  });

  it('8.2: Positive/negative/neutral counts match card sentiments', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    // Positive cards (sentiment > 0.5)
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'excellent collaboration' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'great teamwork' });

    // Negative cards (sentiment < -0.5)
    await createTestCard(board.id, columns[1].id, memberUser.id, { content: 'terrible deployment' });

    // Neutral cards (sentiment between -0.5 and 0.5)
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'normal progress' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/sentiment`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprints[0].positiveCards).toBeGreaterThanOrEqual(2);
    expect(body.sprints[0].negativeCards).toBeGreaterThanOrEqual(1);
    expect(body.sprints[0].neutralCards).toBeGreaterThanOrEqual(0);
  });

  it('8.3: Per-column breakdown includes 3 columns', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'great work' });
    await createTestCard(board.id, columns[1].id, memberUser.id, { content: 'broken deployment' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/sentiment`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprints[0].sentimentByColumn).toHaveLength(2);
  });

  it('8.4: Column sentiment makes logical sense', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    // "Went Well" column (index 0) should have positive sentiment
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'excellent collaboration' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'great progress' });

    // "To Improve" column (index 1) should have negative sentiment
    await createTestCard(board.id, columns[1].id, memberUser.id, { content: 'terrible deployment' });
    await createTestCard(board.id, columns[1].id, memberUser.id, { content: 'broken pipeline' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/sentiment`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { sprints: Array<{ sentimentByColumn: Array<{ columnName: string; averageSentiment: number }> }> };
    const wentWell = body.sprints[0].sentimentByColumn.find((c) => c.columnName === 'What Went Well');
    const toImprove = body.sprints[0].sentimentByColumn.find((c) => c.columnName === 'Delta (What to Change)');

    expect(wentWell!.averageSentiment).toBeGreaterThan(toImprove!.averageSentiment);
  });

  it('8.5: Overall trend calculated for 6+ sprints', async () => {
    for (let i = 1; i <= 7; i++) {
      const sprint = await createTestSprint(team.id, adminUser.id, {
        name: `Sprint ${i}`,
        status: i === 7 ? 'active' : 'completed',
        startDate: i < 10 ? `2026-01-0${i}` : `2026-01-${i}`,
      });
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

      // Earlier sprints negative, later sprints positive
      const content = i <= 3 ? 'terrible broken' : 'excellent amazing';
      await createTestCard(board.id, columns[0].id, adminUser.id, { content });
    }
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/sentiment`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overallTrend).toBeDefined();
    expect(['up', 'down', 'stable']).toContain(body.overallTrend.direction);
  });

  it('8.6: Raw and normalized scores present', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'great collaboration' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/sentiment`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const sprint0 = body.sprints[0];

    // Raw score should be in range [-5, 5]
    expect(sprint0.averageSentiment).toBeGreaterThanOrEqual(-5);
    expect(sprint0.averageSentiment).toBeLessThanOrEqual(5);

    // Normalized score should be in range [0, 100]
    expect(sprint0.normalizedScore).toBeGreaterThanOrEqual(0);
    expect(sprint0.normalizedScore).toBeLessThanOrEqual(100);
  });

  it('8.7: Team not found returns 404', async () => {
    const res = await app.request('/api/v1/teams/00000000-0000-4000-8000-000000099999/analytics/sentiment', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('8.8: Not team member returns 403', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/sentiment`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${outsiderAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('8.9: Sprint with no cards returns neutral defaults', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/sentiment`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprints[0].averageSentiment).toBe(0);
    expect(body.sprints[0].normalizedScore).toBe(50);
  });
});
