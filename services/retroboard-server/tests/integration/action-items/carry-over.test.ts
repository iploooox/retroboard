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
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

describe('POST /api/v1/boards/:id/action-items/carry-over — Carry Over Action Items', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let _memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let prevSprint: { id: string };
  let currentSprint: { id: string };
  let prevBoard: { id: string };
  let currentBoard: { id: string };

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

    // Create previous sprint (completed) and current sprint
    prevSprint = await createTestSprint(team.id, adminUser.id, {
      name: 'Sprint 14',
      startDate: '2026-01-01',
      status: 'completed',
    });
    // Mark previous sprint as ended
    await sql`UPDATE sprints SET end_date = '2026-01-14' WHERE id = ${prevSprint.id}`;

    currentSprint = await createTestSprint(team.id, adminUser.id, {
      name: 'Sprint 15',
      startDate: '2026-01-15',
    });

    const prevResult = await createTestBoard(prevSprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    prevBoard = prevResult.board;

    const currentResult = await createTestBoard(currentSprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    currentBoard = currentResult.board;
  });

  it('should carry over unresolved action items from previous sprint', async () => {
    await createTestActionItem(prevBoard.id, adminUser.id, {
      title: 'Open item',
      description: 'Still needs work',
      assigneeId: memberUser.id,
      dueDate: '2026-03-01',
      status: 'open',
    });
    await createTestActionItem(prevBoard.id, adminUser.id, {
      title: 'In progress item',
      status: 'in_progress',
    });

    const res = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const _body = await res.json();
    expect(_body.carriedOver).toHaveLength(2);
    expect(_body.sourceSprintName).toBe('Sprint 14');
    expect(_body.totalResolved).toBe(2);
  });

  it('should be idempotent — second call returns alreadyCarried', async () => {
    await createTestActionItem(prevBoard.id, adminUser.id, {
      title: 'Open item',
      status: 'open',
    });

    // First carry-over
    const res1 = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.carriedOver).toHaveLength(1);
    expect(body1.alreadyCarried).toHaveLength(0);

    // Second carry-over — should be idempotent
    const res2 = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.carriedOver).toHaveLength(0);
    expect(body2.alreadyCarried).toHaveLength(1);
    expect(body2.alreadyCarried[0].originalId).toBeDefined();
    expect(body2.alreadyCarried[0].existingId).toBeDefined();
  });

  it('should return 404 when there is no previous sprint', async () => {
    // Create a new team with only one sprint
    const soloAuth = await getAuthToken({ email: 'solo@test.com', displayName: 'Solo User' });
    const soloTeam = await createTestTeam(soloAuth.user.id, { slug: 'solo-team' });
    const soloSprint = await createTestSprint(soloTeam.id, soloAuth.user.id, { name: 'First Sprint' });
    const soloResult = await createTestBoard(soloSprint.id, SYSTEM_TEMPLATE_WWD, soloAuth.user.id);

    const res = await app.request(`/api/v1/boards/${soloResult.board.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${soloAuth.token}` },
    });

    expect(res.status).toBe(404);
    const _body = await res.json();
    expect(_body.error).toBe('NO_PREVIOUS_SPRINT');
  });

  it('should skip done items and include them in skipped array', async () => {
    await createTestActionItem(prevBoard.id, adminUser.id, {
      title: 'Open item',
      status: 'open',
    });
    await createTestActionItem(prevBoard.id, adminUser.id, {
      title: 'Done item',
      status: 'done',
    });

    const res = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const _body = await res.json();
    expect(_body.carriedOver).toHaveLength(1);
    expect(_body.carriedOver[0].title).toBe('Open item');
    expect(_body.skipped).toHaveLength(1);
    expect(_body.skipped[0].title).toBe('Done item');
    expect(_body.skipped[0].reason).toBe('already_done');
    expect(_body.totalSkipped).toBe(1);
  });

  it('should set carried items to target board', async () => {
    await createTestActionItem(prevBoard.id, adminUser.id, {
      title: 'To carry',
      status: 'open',
    });

    const res = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const _body = await res.json();

    // Verify the carried item belongs to the current board by listing
    const listRes = await app.request(`/api/v1/boards/${currentBoard.id}/action-items`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const listBody = await listRes.json();
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].boardId).toBe(currentBoard.id);
  });

  it('should reset carried items status to open', async () => {
    await createTestActionItem(prevBoard.id, adminUser.id, {
      title: 'Was in progress',
      status: 'in_progress',
    });

    const res = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const _body = await res.json();
    expect(_body.carriedOver).toHaveLength(1);
    expect(_body.carriedOver[0].status).toBe('open');
    expect(_body.carriedOver[0].originalStatus).toBe('in_progress');
  });

  it('should preserve title, description, assignee, and due date', async () => {
    await createTestActionItem(prevBoard.id, adminUser.id, {
      title: 'Important task',
      description: 'Detailed description here',
      assigneeId: memberUser.id,
      dueDate: '2026-03-01',
      status: 'open',
    });

    const res = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const _body = await res.json();
    expect(_body.carriedOver).toHaveLength(1);
    const carried = _body.carriedOver[0];
    expect(carried.title).toBe('Important task');
    expect(carried.description).toBe('Detailed description here');
    expect(carried.assigneeId).toBe(memberUser.id);
    expect(carried.assigneeName).toBe('Member User');
    expect(carried.dueDate).toBe('2026-03-01');
  });

  it('should set carried_from_id on the new item', async () => {
    const original = await createTestActionItem(prevBoard.id, adminUser.id, {
      title: 'Original',
      status: 'open',
    });

    const res = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const _body = await res.json();
    expect(_body.carriedOver).toHaveLength(1);
    expect(_body.carriedOver[0].originalId).toBe(original.id);
    expect(_body.carriedOver[0].originalSprintName).toBe('Sprint 14');
  });

  it('should return 403 when user is not a team member', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${outsiderAuth.token}` },
    });

    expect(res.status).toBe(403);
    const _body = await res.json();
    expect(_body.error).toBe('FORBIDDEN');
  });

  it('should return 401 when no auth token is provided', async () => {
    const res = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
    });

    expect(res.status).toBe(401);
  });

  it('should return 404 when board does not exist', async () => {
    const res = await app.request(`/api/v1/boards/00000000-0000-4000-8000-000000099999/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const _body = await res.json();
    expect(_body.error).toBe('NOT_FOUND');
  });

  it('should handle when all previous items are done', async () => {
    await createTestActionItem(prevBoard.id, adminUser.id, { title: 'Done 1', status: 'done' });
    await createTestActionItem(prevBoard.id, adminUser.id, { title: 'Done 2', status: 'done' });

    const res = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const _body = await res.json();
    expect(_body.carriedOver).toHaveLength(0);
    expect(_body.skipped).toHaveLength(2);
    expect(_body.totalResolved).toBe(0);
    expect(_body.totalSkipped).toBe(2);
  });

  it('should handle when previous sprint has no action items', async () => {
    const res = await app.request(`/api/v1/boards/${currentBoard.id}/action-items/carry-over`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const _body = await res.json();
    expect(_body.carriedOver).toHaveLength(0);
    expect(_body.skipped).toHaveLength(0);
    expect(_body.totalResolved).toBe(0);
  });
});
