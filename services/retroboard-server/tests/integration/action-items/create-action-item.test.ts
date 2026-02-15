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
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('POST /api/v1/boards/:id/action-items — Create Action Item', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: { id: string };
  let columns: { id: string }[];
  let card: { id: string };

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

    card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'CI keeps breaking' });
  });

  it('should create an action item with all fields', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Fix CI pipeline',
        description: 'The nightly build has been failing for 3 days.',
        cardId: card.id,
        assigneeId: memberUser.id,
        dueDate: '2026-03-01',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.boardId).toBe(board.id);
    expect(body.title).toBe('Fix CI pipeline');
    expect(body.description).toBe('The nightly build has been failing for 3 days.');
    expect(body.cardId).toBe(card.id);
    expect(body.cardText).toBe('CI keeps breaking');
    expect(body.assigneeId).toBe(memberUser.id);
    expect(body.assigneeName).toBe('Member User');
    expect(body.dueDate).toBe('2026-03-01');
    expect(body.status).toBe('open');
    expect(body.carriedFromId).toBeNull();
    expect(body.carriedFromSprintName).toBeNull();
    expect(body.createdBy).toBe(adminUser.id);
    expect(body.createdByName).toBe('Admin User');
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it('should create an action item with only title', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Simple task' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('Simple task');
    expect(body.description).toBeNull();
    expect(body.cardId).toBeNull();
    expect(body.cardText).toBeNull();
    expect(body.assigneeId).toBeNull();
    expect(body.assigneeName).toBeNull();
    expect(body.dueDate).toBeNull();
    expect(body.status).toBe('open');
  });

  it('should create an action item with card link and include cardText', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Fix broken CI',
        cardId: card.id,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.cardId).toBe(card.id);
    expect(body.cardText).toBe('CI keeps breaking');
  });

  it('should create an action item with assignee and include assigneeName', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Assigned task',
        assigneeId: memberUser.id,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.assigneeId).toBe(memberUser.id);
    expect(body.assigneeName).toBe('Member User');
  });

  it('should return 400 when title is missing', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description: 'No title provided' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when title is empty string', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
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

  it('should return 400 when title exceeds 500 characters', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'x'.repeat(501) }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when description exceeds 5000 characters', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Valid title', description: 'x'.repeat(5001) }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when card does not belong to this board', async () => {
    // Create a second board with its own card
    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2' });
    const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    const otherCard = await createTestCard(result2.board.id, result2.columns[0].id, adminUser.id);

    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Wrong card', cardId: otherCard.id }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_CARD');
  });

  it('should return 400 when assignee is not a team member', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Bad assignee', assigneeId: outsiderAuth.user.id }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_ASSIGNEE');
  });

  it('should return 400 when due date is invalid format', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Bad date', dueDate: 'not-a-date' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_DATE');
  });

  it('should return 404 when board does not exist', async () => {
    const res = await app.request(`/api/v1/boards/00000000-0000-4000-8000-000000099999/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'No board' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('should return 403 when user is not a team member', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@test.com' });

    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${outsiderAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Not a member' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('should return 401 when no auth token is provided', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No auth' }),
    });

    expect(res.status).toBe(401);
  });

  it('should set created_by to the current user', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Created by member' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.createdBy).toBe(memberUser.id);
    expect(body.createdByName).toBe('Member User');
  });

  it('should default status to open', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Check status default' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('open');
  });
});
