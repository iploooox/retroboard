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
  createTestActionItem,
  createTestGroup,
  SYSTEM_TEMPLATE_WWD,
  refreshAnalyticsMaterializedViews,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('GET /api/v1/sprints/:sprintId/analytics — Sprint Summary Analytics', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: { id: string };
  let columns: { id: string }[];

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

    sprint = await createTestSprint(team.id, adminUser.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = result.board;
    columns = result.columns;
  });

  it('10.1: Returns complete summary with all sections', async () => {
    const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'great work' });
    await createTestVote(card.id, adminUser.id);
    await createTestActionItem(board.id, adminUser.id, { title: 'Follow up' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty('sprintId');
    expect(body).toHaveProperty('sprintName');
    expect(body).toHaveProperty('teamId');
    expect(body).toHaveProperty('teamName');
    expect(body).toHaveProperty('dateRange');
    expect(body).toHaveProperty('health');
    expect(body).toHaveProperty('cards');
    expect(body).toHaveProperty('sentiment');
    expect(body).toHaveProperty('participation');
    expect(body).toHaveProperty('actionItems');
    expect(body).toHaveProperty('wordCloud');
  });

  it('10.2: Health section includes healthScore 0-100', async () => {
    const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'excellent' });
    await createTestVote(card.id, adminUser.id);
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.health.healthScore).toBeGreaterThanOrEqual(0);
    expect(body.health.healthScore).toBeLessThanOrEqual(100);
  });

  it('10.3: Cards section shows total and breakdown by column', async () => {
    // Create 16 cards across columns
    for (let i = 0; i < 10; i++) {
      await createTestCard(board.id, columns[0].id, adminUser.id, { content: `Card ${i}` });
    }
    for (let i = 0; i < 6; i++) {
      await createTestCard(board.id, columns[1].id, memberUser.id, { content: `Card ${i + 10}` });
    }
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.cards.total).toBe(16);
    expect(body.cards.byColumn).toHaveLength(2);
  });

  it('10.4: Sentiment section shows positive/negative/neutral counts', async () => {
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'excellent amazing' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'great teamwork' });
    await createTestCard(board.id, columns[1].id, memberUser.id, { content: 'terrible broken' });
    await createTestCard(board.id, columns[1].id, memberUser.id, { content: 'normal progress' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.sentiment).toHaveProperty('positiveCards');
    expect(body.sentiment).toHaveProperty('negativeCards');
    expect(body.sentiment).toHaveProperty('neutralCards');
  });

  it('10.5: Top positive cards ordered by sentiment DESC', async () => {
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'excellent amazing wonderful' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'great' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'good' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.sentiment.topPositiveCards).toBeDefined();
    if (body.sentiment.topPositiveCards.length > 1) {
      expect(body.sentiment.topPositiveCards[0].sentiment).toBeGreaterThanOrEqual(
        body.sentiment.topPositiveCards[1].sentiment
      );
    }
  });

  it('10.6: Top negative cards ordered by sentiment ASC', async () => {
    await createTestCard(board.id, columns[1].id, adminUser.id, { content: 'terrible awful horrible' });
    await createTestCard(board.id, columns[1].id, adminUser.id, { content: 'broken' });
    await createTestCard(board.id, columns[1].id, adminUser.id, { content: 'bad' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.sentiment.topNegativeCards).toBeDefined();
    if (body.sentiment.topNegativeCards.length > 1) {
      expect(body.sentiment.topNegativeCards[0].sentiment).toBeLessThanOrEqual(
        body.sentiment.topNegativeCards[1].sentiment
      );
    }
  });

  it('10.7: Participation section lists all team members', async () => {
    const user3Auth = await getAuthToken({ email: 'user3@test.com', displayName: 'User Three' });
    await addTeamMember(team.id, user3Auth.user.id, 'member');

    const user4Auth = await getAuthToken({ email: 'user4@test.com', displayName: 'User Four' });
    await addTeamMember(team.id, user4Auth.user.id, 'member');

    const user5Auth = await getAuthToken({ email: 'user5@test.com', displayName: 'User Five' });
    await addTeamMember(team.id, user5Auth.user.id, 'member');

    const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'test' });
    await createTestVote(card.id, adminUser.id);
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.participation.members).toHaveLength(5);
  });

  it('10.8: Action items section shows correct open/inProgress/done counts', async () => {
    await createTestActionItem(board.id, adminUser.id, { status: 'open' });
    await createTestActionItem(board.id, adminUser.id, { status: 'open' });
    await createTestActionItem(board.id, adminUser.id, { status: 'in_progress' });
    await createTestActionItem(board.id, adminUser.id, { status: 'in_progress' });
    await createTestActionItem(board.id, adminUser.id, { status: 'in_progress' });
    await createTestActionItem(board.id, adminUser.id, { status: 'done' });
    await createTestActionItem(board.id, adminUser.id, { status: 'done' });
    await createTestActionItem(board.id, adminUser.id, { status: 'done' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.actionItems.total).toBe(8);
    expect(body.actionItems.open).toBe(2);
    expect(body.actionItems.inProgress).toBe(3);
    expect(body.actionItems.done).toBe(3);
  });

  it('10.9: Word cloud section populated with words', async () => {
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'deployment deployment' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'deployment testing' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'testing automation' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.wordCloud)).toBe(true);
  });

  it('10.10: Previous sprint comparison included when previous sprint exists', async () => {
    const previousSprint = await createTestSprint(team.id, adminUser.id, {
      name: 'Previous Sprint',
      status: 'completed',
      startDate: '2026-02-01',
    });
    const { board: prevBoard, columns: prevCols } = await createTestBoard(
      previousSprint.id,
      SYSTEM_TEMPLATE_WWD,
      adminUser.id
    );
    const prevCard = await createTestCard(prevBoard.id, prevCols[0].id, adminUser.id, { content: 'good' });
    await createTestVote(prevCard.id, adminUser.id);

    const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'excellent' });
    await createTestVote(card.id, adminUser.id);
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.health).toHaveProperty('previousSprintHealthScore');
    expect(body.health).toHaveProperty('changeFromPrevious');
  });

  it('10.11: First sprint has previousSprintHealthScore as null', async () => {
    const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'test' });
    await createTestVote(card.id, adminUser.id);
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.health.previousSprintHealthScore).toBeNull();
  });

  it('10.12: Sprint not found returns 404', async () => {
    const res = await app.request('/api/v1/sprints/00000000-0000-4000-8000-000000099999/analytics', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('10.13: Not team member returns 403', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/sprints/${sprint.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${outsiderAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });
});
