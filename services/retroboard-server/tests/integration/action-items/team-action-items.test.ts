import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  createTestActionItem,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('GET /api/v1/teams/:teamId/action-items — Team Action Items', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let sprint1: { id: string };
  let sprint2: { id: string };
  let board1: { id: string };
  let board2: { id: string };

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

    // Create two sprints with boards
    sprint1 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 1', startDate: '2026-02-01' });
    sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2', startDate: '2026-02-15' });

    const result1 = await createTestBoard(sprint1.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board1 = result1.board;
    board2 = result2.board;
  });

  it('should list all action items across sprints', async () => {
    await createTestActionItem(board1.id, adminUser.id, { title: 'Sprint 1 item' });
    await createTestActionItem(board2.id, adminUser.id, { title: 'Sprint 2 item' });

    const res = await app.request(`/api/v1/teams/${team.id}/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('should filter by sprintId', async () => {
    await createTestActionItem(board1.id, adminUser.id, { title: 'Sprint 1 item' });
    await createTestActionItem(board2.id, adminUser.id, { title: 'Sprint 2 item' });

    const res = await app.request(`/api/v1/teams/${team.id}/action-items?sprintId=${sprint1.id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe('Sprint 1 item');
  });

  it('should filter by status', async () => {
    await createTestActionItem(board1.id, adminUser.id, { title: 'Open', status: 'open' });
    await createTestActionItem(board1.id, adminUser.id, { title: 'Done', status: 'done' });
    await createTestActionItem(board2.id, adminUser.id, { title: 'Also done', status: 'done' });

    const res = await app.request(`/api/v1/teams/${team.id}/action-items?status=done`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items.every((i: { status: string }) => i.status === 'done')).toBe(true);
  });

  it('should include summary counts', async () => {
    await createTestActionItem(board1.id, adminUser.id, { title: 'Open 1', status: 'open' });
    await createTestActionItem(board1.id, adminUser.id, { title: 'Open 2', status: 'open' });
    await createTestActionItem(board1.id, adminUser.id, { title: 'In progress', status: 'in_progress' });
    await createTestActionItem(board2.id, adminUser.id, { title: 'Done 1', status: 'done' });
    await createTestActionItem(board2.id, adminUser.id, { title: 'Done 2', status: 'done' });

    const res = await app.request(`/api/v1/teams/${team.id}/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBeDefined();
    expect(body.summary.open).toBe(2);
    expect(body.summary.inProgress).toBe(1);
    expect(body.summary.done).toBe(2);
  });

  it('should calculate overdue count correctly', async () => {
    // Overdue: open/in_progress with due date in the past
    await createTestActionItem(board1.id, adminUser.id, {
      title: 'Overdue open',
      status: 'open',
      dueDate: '2026-01-01', // in the past
    });
    await createTestActionItem(board1.id, adminUser.id, {
      title: 'Overdue in_progress',
      status: 'in_progress',
      dueDate: '2026-01-15', // in the past
    });
    // Done item with past due date should NOT be overdue
    await createTestActionItem(board1.id, adminUser.id, {
      title: 'Done but was overdue',
      status: 'done',
      dueDate: '2026-01-01',
    });
    // Open item with future due date should NOT be overdue
    await createTestActionItem(board1.id, adminUser.id, {
      title: 'Not yet due',
      status: 'open',
      dueDate: '2026-12-31',
    });

    const res = await app.request(`/api/v1/teams/${team.id}/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.overdue).toBe(2);
  });

  it('should include sprint name for each item', async () => {
    await createTestActionItem(board1.id, adminUser.id, { title: 'Sprint 1 item' });
    await createTestActionItem(board2.id, adminUser.id, { title: 'Sprint 2 item' });

    const res = await app.request(`/api/v1/teams/${team.id}/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const sprintNames = body.items.map((i: { sprintName: string }) => i.sprintName);
    expect(sprintNames).toContain('Sprint 1');
    expect(sprintNames).toContain('Sprint 2');
  });

  it('should filter by assigneeId', async () => {
    await createTestActionItem(board1.id, adminUser.id, { title: 'Admin task', assigneeId: adminUser.id });
    await createTestActionItem(board1.id, adminUser.id, { title: 'Member task', assigneeId: memberUser.id });

    const res = await app.request(`/api/v1/teams/${team.id}/action-items?assigneeId=${memberUser.id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].assigneeId).toBe(memberUser.id);
  });

  it('should return 403 when user is not a team member', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/teams/${team.id}/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${outsiderAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('should return 404 when team does not exist', async () => {
    const res = await app.request(`/api/v1/teams/00000000-0000-4000-8000-000000099999/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('should return 401 when no auth token is provided', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/action-items`, {
      method: 'GET',
    });

    expect(res.status).toBe(401);
  });
});
