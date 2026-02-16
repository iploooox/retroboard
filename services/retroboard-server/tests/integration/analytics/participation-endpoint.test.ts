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
  refreshAnalyticsMaterializedViews,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('GET /api/v1/teams/:teamId/analytics/participation — Participation Analytics', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let user2: { id: string; email: string; token: string };
  let user3: { id: string; email: string; token: string };
  let team: { id: string };

  beforeEach(async () => {
    await truncateTables();
    await seed();

    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;

    const auth2 = await getAuthToken({ email: 'user2@test.com', displayName: 'User Two' });
    user2 = { ...auth2.user, token: auth2.token };

    const auth3 = await getAuthToken({ email: 'user3@test.com', displayName: 'User Three' });
    user3 = { ...auth3.user, token: auth3.token };

    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, user2.id, 'member');
    await addTeamMember(team.id, user3.id, 'member');
  });

  it('7.1: Returns per-member stats for 3 members across 2 sprints', async () => {
    // Sprint 1
    const sprint1 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 1', status: 'completed' });
    const { board: board1, columns: cols1 } = await createTestBoard(sprint1.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    const card1 = await createTestCard(board1.id, cols1[0].id, adminUser.id, { content: 'Admin card' });
    const card2 = await createTestCard(board1.id, cols1[0].id, user2.id, { content: 'User2 card' });
    await createTestVote(card1.id, user2.id);
    await createTestVote(card2.id, adminUser.id);

    // Sprint 2
    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2', status: 'active' });
    const { board: board2, columns: cols2 } = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    const card3 = await createTestCard(board2.id, cols2[0].id, user3.id, { content: 'User3 card' });
    await createTestVote(card3.id, adminUser.id);
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/participation`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(3);
  });

  it('7.2: Per-sprint breakdown shows activity in each sprint', async () => {
    const sprint1 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 1', status: 'completed' });
    const { board: board1, columns: cols1 } = await createTestBoard(sprint1.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board1.id, cols1[0].id, adminUser.id, { content: 'S1 card' });

    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2', status: 'completed' });
    const { board: board2, columns: cols2 } = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board2.id, cols2[0].id, adminUser.id, { content: 'S2 card' });

    const sprint3 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 3', status: 'active' });
    const { board: board3, columns: cols3 } = await createTestBoard(sprint3.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board3.id, cols3[0].id, adminUser.id, { content: 'S3 card' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/participation`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const adminMember = (body as { members: Array<{ userId: string; perSprint: unknown[]; totals: { cardsSubmitted: number; votesCast: number; completionRate: number } }> }).members.find((m) => m.userId === adminUser.id);
    expect(adminMember!.perSprint).toHaveLength(3);
  });

  it('7.3: Totals are aggregated across sprints', async () => {
    const sprint1 = await createTestSprint(team.id, adminUser.id, { status: 'completed' });
    const { board: board1, columns: cols1 } = await createTestBoard(sprint1.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board1.id, cols1[0].id, adminUser.id, { content: 'Card 1' });
    await createTestCard(board1.id, cols1[0].id, adminUser.id, { content: 'Card 2' });

    const sprint2 = await createTestSprint(team.id, adminUser.id, { status: 'active' });
    const { board: board2, columns: cols2 } = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board2.id, cols2[0].id, adminUser.id, { content: 'Card 3' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/participation`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const adminMember = (body as { members: Array<{ userId: string; perSprint: unknown[]; totals: { cardsSubmitted: number; votesCast: number; completionRate: number } }> }).members.find((m) => m.userId === adminUser.id);
    expect(adminMember!.totals.cardsSubmitted).toBe(3);
  });

  it('7.4: Completion rate calculated correctly (3/4 = 75%)', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    await createTestActionItem(board.id, adminUser.id, { assigneeId: adminUser.id, status: 'done' });
    await createTestActionItem(board.id, adminUser.id, { assigneeId: adminUser.id, status: 'done' });
    await createTestActionItem(board.id, adminUser.id, { assigneeId: adminUser.id, status: 'done' });
    await createTestActionItem(board.id, adminUser.id, { assigneeId: adminUser.id, status: 'open' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/participation`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const adminMember = (body as { members: Array<{ userId: string; perSprint: unknown[]; totals: { cardsSubmitted: number; votesCast: number; completionRate: number } }> }).members.find((m) => m.userId === adminUser.id);
    expect(adminMember!.totals.completionRate).toBe(75.0);
  });

  it('7.5: Team averages calculated correctly', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    // Admin: 2 cards, 2 votes
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Admin 1' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Admin 2' });

    // User2: 3 cards, 1 vote
    await createTestCard(board.id, columns[0].id, user2.id, { content: 'User2 1' });
    await createTestCard(board.id, columns[0].id, user2.id, { content: 'User2 2' });
    const card = await createTestCard(board.id, columns[0].id, user2.id, { content: 'User2 3' });

    await createTestVote(card.id, adminUser.id);
    await createTestVote(card.id, adminUser.id, 2);
    await createTestVote(card.id, user2.id);
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/participation`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.teamAverages).toBeDefined();
    expect(body.teamAverages.avgCardsPerMember).toBeGreaterThan(0);
    expect(body.teamAverages.avgVotesPerMember).toBeGreaterThan(0);
  });

  it('7.6: Filter by sprintId returns only that sprint', async () => {
    const sprint1 = await createTestSprint(team.id, adminUser.id, { status: 'completed' });
    const { board: board1, columns: cols1 } = await createTestBoard(sprint1.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board1.id, cols1[0].id, adminUser.id, { content: 'S1' });

    const sprint2 = await createTestSprint(team.id, adminUser.id, { status: 'active' });
    const { board: board2, columns: cols2 } = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board2.id, cols2[0].id, adminUser.id, { content: 'S2' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/participation?sprintId=${sprint1.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const adminMember = (body as { members: Array<{ userId: string; perSprint: Array<{ sprintId: string }>; totals: { cardsSubmitted: number; votesCast: number; completionRate: number } }> }).members.find((m) => m.userId === adminUser.id);
    expect(adminMember!.perSprint).toHaveLength(1);
    expect(adminMember!.perSprint[0].sprintId).toBe(sprint1.id);
  });

  it('7.7: Member with no activity shows all counts as 0', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/participation`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { members: Array<{ userId: string; totals: { cardsSubmitted: number; votesCast: number } }> };
    const inactiveMember = body.members.find((m) => m.userId === user3.id);
    expect(inactiveMember!.totals.cardsSubmitted).toBe(0);
    expect(inactiveMember!.totals.votesCast).toBe(0);
  });

  it('7.8: Team not found returns 404', async () => {
    const res = await app.request('/api/v1/teams/00000000-0000-4000-8000-000000099999/analytics/participation', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('7.9: Not team member returns 403', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/participation`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${outsiderAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });
});
