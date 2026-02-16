import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  createTestCard,
  createTestActionItem,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('GET /api/v1/teams/:teamId/report', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let _memberToken: string;
  let memberUser: { id: string; email: string };
  let nonMemberToken: string;
  let team: { id: string };

  beforeEach(async () => {
    await truncateTables();
    await seed();
    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;
    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
      _memberToken = memberAuth.token;
    memberUser = memberAuth.user;
    const nonMemberAuth = await getAuthToken({ email: 'nonmember@example.com', displayName: 'Non Member' });
    nonMemberToken = nonMemberAuth.token;
    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');
  });

  it('5.10.1: JSON team report', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 1' });

    const res = await app.request(`/api/v1/teams/${team.id}/report?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exportVersion).toBe('1.0');
    expect(body.team.name).toBe('Test Team');
  });

  it('5.10.2: Markdown team report', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 1' });

    const res = await app.request(`/api/v1/teams/${team.id}/report?format=markdown`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/^# Team Report:/);
    expect(body).toContain('Test Team');
  });

  it('5.10.3: Default format is JSON', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/report`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('5.10.4: Default date range', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/report`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dateRange.from).toBeDefined();
    expect(body.dateRange.to).toBeDefined();
  });

  it('5.10.5: Custom date range', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/report?from=2025-01-01&to=2025-06-30`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dateRange.from).toBe('2025-01-01');
    expect(body.dateRange.to).toBe('2025-06-30');
  });

  it('5.10.6: Health trend data', async () => {
    for (let i = 0; i < 10; i++) {
      const monthNum = (i % 12) + 1;
      const sprint = await createTestSprint(team.id, adminUser.id, {
        name: `Sprint ${i + 1}`,
        startDate: `2025-${String(monthNum).padStart(2, '0')}-01`,
      });
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
      await createTestCard(board.id, columns[0].id, adminUser.id, { content: `Card ${i}` });
    }

    const res = await app.request(`/api/v1/teams/${team.id}/report`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.healthTrend).toBeDefined();
    expect(Array.isArray(body.healthTrend)).toBe(true);
  });

  it('5.10.7: Participation per member', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 1' });
    await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Card 2' });

    const res = await app.request(`/api/v1/teams/${team.id}/report`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.participation.members).toBeDefined();
    expect(Array.isArray(body.participation.members)).toBe(true);
  });

  it('5.10.8: Action item totals', async () => {
    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    await createTestActionItem(board.id, adminUser.id, { title: 'Task 1', status: 'open' });
    await createTestActionItem(board.id, adminUser.id, { title: 'Task 2', status: 'done' });

    const res = await app.request(`/api/v1/teams/${team.id}/report`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actionItems).toBeDefined();
    expect(body.actionItems.totalCreated).toBeDefined();
    expect(body.actionItems.totalCompleted).toBeDefined();
  });

  it('5.10.9: from after to', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/report?from=2026-01-01&to=2025-01-01`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_DATE_RANGE');
  });

  it('5.10.10: Invalid date format', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/report?from=not-a-date`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_DATE');
  });

  it('5.10.11: Team not found', async () => {
    const res = await app.request(`/api/v1/teams/550e8400-e29b-41d4-a716-446655440000/report`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
  });

  it('5.10.12: Not team member', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/report`, {
      headers: { Authorization: `Bearer ${nonMemberToken}` },
    });

    expect(res.status).toBe(403);
  });

  it('5.10.13: Team with no sprints', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/report`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sprintCount).toBe(0);
  });

  it('5.10.14: Response < 500ms', async () => {
    for (let i = 0; i < 20; i++) {
      const monthNum = (i % 12) + 1;
      const dayNum = Math.floor(i / 12) + 1;
      const sprint = await createTestSprint(team.id, adminUser.id, {
        name: `Sprint ${i + 1}`,
        startDate: `2025-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
      });
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
      for (let j = 0; j < 5; j++) {
        await createTestCard(board.id, columns[0].id, adminUser.id, { content: `Card ${j}` });
      }
    }

    const start = Date.now();
    const res = await app.request(`/api/v1/teams/${team.id}/report`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(500);
  });
});
