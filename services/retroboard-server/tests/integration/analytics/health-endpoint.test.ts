import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  createTestCard,
  createTestVote,
  refreshAnalyticsMaterializedViews,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('GET /api/v1/teams/:teamId/analytics/health — Team Health Analytics', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };

  beforeEach(async () => {
    await truncateTables();
    await seed();

    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;

    const memberAuth = await getAuthToken({ email: 'member@test.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;

    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');
  });

  it('6.1: Returns health scores for sprints with cards and votes', async () => {
    // Create 5 sprints with boards and cards
    for (let i = 1; i <= 5; i++) {
      const sprint = await createTestSprint(team.id, adminUser.id, {
        name: `Sprint ${i}`,
        status: i === 5 ? 'active' : 'completed',
        startDate: `2026-0${i < 10 ? `${i}` : i}-01`,
      });
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

      // Add cards with positive and negative sentiment
      const card1 = await createTestCard(board.id, columns[0].id, adminUser.id, {
        content: 'Great collaboration and teamwork',
      });
      const card2 = await createTestCard(board.id, columns[1].id, memberUser.id, {
        content: 'Deployment was terrible and broken',
      });

      // Add votes
      await createTestVote(card1.id, adminUser.id);
      await createTestVote(card1.id, memberUser.id);
      await createTestVote(card2.id, memberUser.id);
    }

    // Refresh materialized views after creating data
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprints).toHaveLength(5);
    expect(body.total).toBe(5);
  });

  it('6.2: All scores are between 0 and 100', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'excellent' });
    await createTestVote(card.id, adminUser.id);
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    for (const sprint of body.sprints) {
      expect(sprint.healthScore).toBeGreaterThanOrEqual(0);
      expect(sprint.healthScore).toBeLessThanOrEqual(100);
      expect(sprint.sentimentScore).toBeGreaterThanOrEqual(0);
      expect(sprint.sentimentScore).toBeLessThanOrEqual(100);
      expect(sprint.voteDistributionScore).toBeGreaterThanOrEqual(0);
      expect(sprint.voteDistributionScore).toBeLessThanOrEqual(100);
      expect(sprint.participationScore).toBeGreaterThanOrEqual(0);
      expect(sprint.participationScore).toBeLessThanOrEqual(100);
    }
  });

  it('6.3: Trend calculated for 6+ sprints', async () => {
    // Create 8 sprints with varying health
    for (let i = 1; i <= 8; i++) {
      const sprint = await createTestSprint(team.id, adminUser.id, {
        name: `Sprint ${i}`,
        status: i === 8 ? 'active' : 'completed',
        startDate: `2026-01-${i < 10 ? `0${i}` : i}`,
      });
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

      // Earlier sprints have negative sentiment, later sprints have positive
      const sentiment = i <= 4 ? 'terrible broken' : 'excellent amazing';
      const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: sentiment });
      await createTestVote(card.id, adminUser.id);
    }
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trend).toBeDefined();
    expect(['up', 'down', 'stable']).toContain(body.trend.direction);
  });

  it('6.4: Pagination works with limit and offset', async () => {
    // Create 5 sprints
    for (let i = 1; i <= 5; i++) {
      const sprint = await createTestSprint(team.id, adminUser.id, {
        name: `Sprint ${i}`,
        status: i === 5 ? 'active' : 'completed',
        startDate: `2026-0${i}-01`,
      });
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
      const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'good' });
      await createTestVote(card.id, adminUser.id);
    }
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/health?limit=2&offset=2`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprints).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(2);
  });

  it('6.5: Team not found returns 404', async () => {
    const res = await app.request('/api/v1/teams/00000000-0000-4000-8000-000000099999/analytics/health', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('6.6: Not team member returns 403', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${outsiderAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('6.7: Unauthenticated request returns 401', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/analytics/health`, {
      method: 'GET',
    });

    expect(res.status).toBe(401);
  });

  it('6.8: New team with no sprints returns empty array', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/analytics/health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprints).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('6.9: Response time under 200ms for 20 sprints (materialized view)', async () => {
    // Create 20 sprints (would be slow without materialized views)
    for (let i = 1; i <= 20; i++) {
      const day = i < 10 ? `0${i}` : `${i}`;
      const month = i <= 10 ? '01' : '02';
      const dayOfMonth = i <= 10 ? day : `${i - 10 < 10 ? '0' : ''}${i - 10}`;
      const sprint = await createTestSprint(team.id, adminUser.id, {
        name: `Sprint ${i}`,
        status: i === 20 ? 'active' : 'completed',
        startDate: `2026-${month}-${dayOfMonth}`,
      });
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
      const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'good work' });
      await createTestVote(card.id, adminUser.id);
    }
    await refreshAnalyticsMaterializedViews();

    const startTime = Date.now();
    const res = await app.request(`/api/v1/teams/${team.id}/analytics/health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const responseTime = Date.now() - startTime;

    expect(res.status).toBe(200);
    // This will likely fail until materialized views are implemented
    // but that's expected in RED state
    expect(responseTime).toBeLessThan(200);
  });
});
