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

describe('DELETE /api/v1/action-items/:id — Delete Action Item', () => {
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

    actionItem = await createTestActionItem(board.id, adminUser.id, { title: 'To be deleted' });
  });

  it('should delete an existing action item', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(204);
  });

  it('should return 404 when deleting non-existent action item', async () => {
    const res = await app.request(`/api/v1/action-items/00000000-0000-4000-8000-000000099999`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('should return 403 when user is not a team member', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${outsiderAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('should return 401 when no auth token is provided', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(401);
  });

  it('should confirm hard delete — GET after DELETE returns 404', async () => {
    // Delete the item
    await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    // Try to update the deleted item — should be 404
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Should not exist' }),
    });

    expect(res.status).toBe(404);
  });

  it('should allow member to delete action item', async () => {
    const res = await app.request(`/api/v1/action-items/${actionItem.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    expect(res.status).toBe(204);
  });
});
