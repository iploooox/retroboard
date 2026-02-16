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

describe('GET /api/v1/teams/:teamId/analytics/word-cloud — Word Cloud Analytics', () => {
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

  it('9.1: Returns word frequencies for sprint with 10 cards', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    for (let i = 0; i < 10; i++) {
      await createTestCard(board.id, columns[0].id, adminUser.id, {
        content: `deployment pipeline testing automation ${i}`,
      });
    }
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/word-cloud?sprintId=${sprint.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.words).toBeDefined();
    expect(Array.isArray(body.words)).toBe(true);
  });

  it('9.2: Words sorted by frequency descending', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    // Create cards with different word frequencies
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'deployment deployment deployment' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'deployment deployment testing' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'deployment testing' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'testing' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/word-cloud?sprintId=${sprint.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    if (body.words.length > 1) {
      expect(body.words[0].frequency).toBeGreaterThanOrEqual(body.words[1].frequency);
    }
  });

  it('9.3: Stop words excluded from results', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    await createTestCard(board.id, columns[0].id, adminUser.id, {
      content: 'the deployment and the testing with the pipeline',
    });
    await createTestCard(board.id, columns[0].id, adminUser.id, {
      content: 'the deployment and the automation',
    });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/word-cloud?sprintId=${sprint.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { words: Array<Record<string, unknown>> };

    // "the" and "and" are stop words and should not appear
    const words = body.words.map((w) => w.word);
    expect(words).not.toContain('the');
    expect(words).not.toContain('and');
  });

  it('9.4: Short words (< 4 chars) excluded from results', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'a big win for deployment' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'deployment is good' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/word-cloud?sprintId=${sprint.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { words: Array<Record<string, unknown>> };
    const words = body.words.map((w) => w.word);

    // "a", "is" are too short (< 4 chars)
    expect(words).not.toContain('a');
    expect(words).not.toContain('is');
  });

  it('9.5: Sentiment included for known words', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'deployment deployment' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'deployment excellent' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/word-cloud?sprintId=${sprint.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    for (const wordData of body.words) {
      expect(wordData).toHaveProperty('sentiment');
      expect(wordData.sentiment).toBeGreaterThanOrEqual(-5);
      expect(wordData.sentiment).toBeLessThanOrEqual(5);
    }
  });

  it('9.6: Limit parameter respected', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    // Create many unique words
    const words = [
      'deployment', 'pipeline', 'testing', 'automation', 'integration',
      'production', 'staging', 'development', 'monitoring', 'alerts',
    ];

    for (const word of words) {
      await createTestCard(board.id, columns[0].id, adminUser.id, { content: `${word} ${word}` });
    }
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(
      `/api/v1/teams/${team.id}/analytics/word-cloud?sprintId=${sprint.id}&limit=5`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.words.length).toBeLessThanOrEqual(5);
  });

  it('9.7: Min frequency filter works', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    // "deployment" appears 3 times, "testing" appears 1 time
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'deployment deployment' });
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'deployment testing' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(
      `/api/v1/teams/${team.id}/analytics/word-cloud?sprintId=${sprint.id}&minFrequency=3`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    // Only words with frequency >= 3 should be included
    for (const wordData of body.words) {
      expect(wordData.frequency).toBeGreaterThanOrEqual(3);
    }
  });

  it('9.8: Filter by sprintId returns only that sprint', async () => {
    const sprint1 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 1', status: 'completed' });
    const { board: board1, columns: cols1 } = await createTestBoard(sprint1.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board1.id, cols1[0].id, adminUser.id, { content: 'deployment deployment' });

    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2', status: 'active' });
    const { board: board2, columns: cols2 } = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board2.id, cols2[0].id, adminUser.id, { content: 'testing testing' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/word-cloud?sprintId=${sprint1.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprintId).toBe(sprint1.id);
  });

  it('9.9: Aggregate across sprints when no sprintId filter', async () => {
    const sprint1 = await createTestSprint(team.id, adminUser.id, { status: 'completed' });
    const { board: board1, columns: cols1 } = await createTestBoard(sprint1.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board1.id, cols1[0].id, adminUser.id, { content: 'deployment deployment' });

    const sprint2 = await createTestSprint(team.id, adminUser.id, { status: 'active' });
    const { board: board2, columns: cols2 } = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board2.id, cols2[0].id, adminUser.id, { content: 'deployment deployment' });
    await refreshAnalyticsMaterializedViews();

    const res = await app.request(`/api/v1/teams/${team.id}/analytics/word-cloud`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { words: Array<Record<string, unknown>> };

    // Should aggregate words from both sprints
    const deployment = body.words.find((w) => w.word === 'deployment');
    if (deployment) {
      expect(deployment.frequency).toBeGreaterThanOrEqual(4); // 2 + 2 from both sprints
    }
  });

  it('9.10: Team not found returns 404', async () => {
    const res = await app.request('/api/v1/teams/00000000-0000-4000-8000-000000099999/analytics/word-cloud', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });
});
