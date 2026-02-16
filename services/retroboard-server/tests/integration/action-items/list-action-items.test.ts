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

describe('GET /api/v1/boards/:id/action-items — List Action Items', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let _memberToken: string;
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
      _memberToken = memberAuth.token;
    memberUser = memberAuth.user;

    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');

    sprint = await createTestSprint(team.id, adminUser.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = result.board;
    columns = result.columns;
  });

  it('should list all action items for a board', async () => {
    await createTestActionItem(board.id, adminUser.id, { title: 'Item 1' });
    await createTestActionItem(board.id, adminUser.id, { title: 'Item 2' });
    await createTestActionItem(board.id, adminUser.id, { title: 'Item 3' });
    await createTestActionItem(board.id, adminUser.id, { title: 'Item 4' });
    await createTestActionItem(board.id, adminUser.id, { title: 'Item 5' });

    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(5);
    expect(body.total).toBe(5);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it('should return empty items array for board with no action items', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('should filter by status=open', async () => {
    await createTestActionItem(board.id, adminUser.id, { title: 'Open 1', status: 'open' });
    await createTestActionItem(board.id, adminUser.id, { title: 'Open 2', status: 'open' });
    await createTestActionItem(board.id, adminUser.id, { title: 'Done', status: 'done' });

    const res = await app.request(`/api/v1/boards/${board.id}/action-items?status=open`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items.every((i: { status: string }) => i.status === 'open')).toBe(true);
  });

  it('should filter by assigneeId', async () => {
    await createTestActionItem(board.id, adminUser.id, { title: 'Admin item', assigneeId: adminUser.id });
    await createTestActionItem(board.id, adminUser.id, { title: 'Member item', assigneeId: memberUser.id });
    await createTestActionItem(board.id, adminUser.id, { title: 'Unassigned' });

    const res = await app.request(`/api/v1/boards/${board.id}/action-items?assigneeId=${memberUser.id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].assigneeId).toBe(memberUser.id);
  });

  it('should paginate with limit and offset', async () => {
    for (let i = 1; i <= 5; i++) {
      await createTestActionItem(board.id, adminUser.id, { title: `Item ${i}` });
    }

    const res = await app.request(`/api/v1/boards/${board.id}/action-items?limit=2&offset=2`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(2);
  });

  it('should sort by due_date ascending', async () => {
    await createTestActionItem(board.id, adminUser.id, { title: 'Later', dueDate: '2026-04-01' });
    await createTestActionItem(board.id, adminUser.id, { title: 'Sooner', dueDate: '2026-03-01' });
    await createTestActionItem(board.id, adminUser.id, { title: 'No date' });

    const res = await app.request(`/api/v1/boards/${board.id}/action-items?sort=due_date&order=asc`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].title).toBe('Sooner');
    expect(body.items[1].title).toBe('Later');
    // Null due dates should come last
    expect(body.items[2].title).toBe('No date');
  });

  it('should include assigneeName for assigned items', async () => {
    await createTestActionItem(board.id, adminUser.id, { title: 'Assigned', assigneeId: memberUser.id });

    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].assigneeName).toBe('Member User');
  });

  it('should include cardText for items linked to a card', async () => {
    const testCard = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Deploy pipeline' });
    await createTestActionItem(board.id, adminUser.id, { title: 'Fix deploy', cardId: testCard.id });

    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].cardText).toBe('Deploy pipeline');
  });

  it('should return 404 when board does not exist', async () => {
    const res = await app.request(`/api/v1/boards/00000000-0000-4000-8000-000000099999/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('should return 403 when user is not a team member', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${outsiderAuth.token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('should return 401 when no auth token is provided', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'GET',
    });

    expect(res.status).toBe(401);
  });
});
