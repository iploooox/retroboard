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

describe('PUT /api/v1/action-items/:id — Update Action Item', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: { id: string };
  let actionItem: { id: string };

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

    actionItem = await createTestActionItem(board.id, adminUser.id, {
      title: 'Original title',
      description: 'Original description',
      assigneeId: memberUser.id,
      dueDate: '2026-03-01',
    });
  });

  it('should update title', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Updated title' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated title');
    expect(body.description).toBe('Original description');
  });

  it('should update status to done', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'done' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('done');
  });

  it('should update multiple fields at once', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'New title',
        status: 'in_progress',
        assigneeId: adminUser.id,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('New title');
    expect(body.status).toBe('in_progress');
    expect(body.assigneeId).toBe(adminUser.id);
  });

  it('should clear description by setting to null', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.description).toBeNull();
  });

  it('should unassign by setting assigneeId to null', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assigneeId: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assigneeId).toBeNull();
    expect(body.assigneeName).toBeNull();
  });

  it('should clear due date by setting to null', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dueDate: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dueDate).toBeNull();
  });

  it('should transition status open -> in_progress', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('in_progress');
  });

  it('should transition status in_progress -> done', async () => {
    // First move to in_progress
    await createTestActionItem(board.id, adminUser.id, { title: 'In progress', status: 'in_progress' });
    const inProgressItem = await createTestActionItem(board.id, adminUser.id, { title: 'Another', status: 'in_progress' });

    const res = await app.request(`/api/v1/action-items/${inProgressItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'done' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('done');
  });

  it('should allow reopening a done item (done -> open)', async () => {
    const doneItem = await createTestActionItem(board.id, adminUser.id, { title: 'Done item', status: 'done' });

    const res = await app.request(`/api/v1/action-items/${doneItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'open' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('open');
  });

  it('should return 400 for invalid status value', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_STATUS');
  });

  it('should return 400 for empty title', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: '' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when assignee is not a team member', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assigneeId: outsiderAuth.user.id }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_ASSIGNEE');
  });

  it('should return 404 for non-existent action item', async () => {
    const res = await app.request(`/api/v1/action-items/00000000-0000-4000-8000-000000099999`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Not found' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('should return 403 when user is not a team member', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${outsiderAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Forbidden' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('should return 401 when no auth token is provided', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No auth' }),
    });

    expect(res.status).toBe(401);
  });

  it('should update updated_at timestamp', async () => {
    const originalUpdatedAt = actionItem.updated_at;

    // Small delay to ensure timestamp changes
    await new Promise(resolve => setTimeout(resolve, 10));

    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Timestamp check' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());
  });

  it('should preserve other fields when doing a partial update', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Only title changed' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Only title changed');
    expect(body.description).toBe('Original description');
    expect(body.assigneeId).toBe(memberUser.id);
    expect(body.dueDate).toBe('2026-03-01');
    expect(body.status).toBe('open');
  });
});
