import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  
  SYSTEM_TEMPLATE_WWD,
  SYSTEM_TEMPLATE_SSC,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('POST /api/v1/sprints/:sprintId/board — Create Board', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };

  beforeEach(async () => {
    await truncateTables();
    await seed();
    const auth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = auth.token;
    adminUser = auth.user;
    team = await createTestTeam(adminUser.id);
    sprint = await createTestSprint(team.id, adminUser.id);
  });

  it('2.1.1: Create board with valid template_id', async () => {
    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.sprint_id).toBe(sprint.id);
    expect(body.data.template_id).toBe(SYSTEM_TEMPLATE_WWD);
    expect(body.data.phase).toBe('write');
    expect(body.data.anonymous_mode).toBe(false);
    expect(body.data.max_votes_per_user).toBe(5);
    expect(body.data.max_votes_per_card).toBe(3);
    expect(body.data.created_by).toBe(adminUser.id);
    expect(body.data.columns).toHaveLength(2); // WWD template has 2 columns
  });

  it('2.1.2: Create board for sprint that already has a board', async () => {
    // Create first board
    await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
    });

    // Try creating second board
    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('BOARD_ALREADY_EXISTS');
  });

  it('2.1.3: Create board for non-existent sprint', async () => {
    const res = await app.request(`/api/v1/sprints/00000000-0000-4000-8000-000000099999/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('SPRINT_NOT_FOUND');
  });

  it('2.1.4: Create board with invalid template_id', async () => {
    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_id: '00000000-0000-4000-8000-000000099999' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('2.1.5: Create board with custom vote limits', async () => {
    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: SYSTEM_TEMPLATE_WWD,
        max_votes_per_user: 10,
        max_votes_per_card: 5,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.max_votes_per_user).toBe(10);
    expect(body.data.max_votes_per_card).toBe(5);
  });

  it('2.1.6: Create board with anonymous_mode true', async () => {
    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: SYSTEM_TEMPLATE_WWD,
        anonymous_mode: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.anonymous_mode).toBe(true);
  });

  it('2.1.7: Create board as regular member (not admin/facilitator)', async () => {
    const memberAuth = await getAuthToken({ email: 'member@example.com' });
    await addTeamMember(team.id, memberAuth.user.id, 'member');

    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('2.1.8: Create board without authentication', async () => {
    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
    });

    expect(res.status).toBe(401);
  });

  it('2.1.9: Create board for sprint in a different team', async () => {
    const otherAuth = await getAuthToken({ email: 'other@example.com' });
    const _otherTeam = await createTestTeam(otherAuth.user.id, { slug: 'other-team' });

    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${otherAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_WWD }),
    });

    expect(res.status).toBe(403);
  });

  it('2.1.10: Response includes columns populated from template', async () => {
    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_id: SYSTEM_TEMPLATE_SSC }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    // SSC template has 3 columns: Start Doing, Stop Doing, Continue Doing
    expect(body.data.columns).toHaveLength(3);
    expect(body.data.columns[0].name).toBe('Start Doing');
    expect(body.data.columns[1].name).toBe('Stop Doing');
    expect(body.data.columns[2].name).toBe('Continue Doing');
    expect(body.data.columns[0].position).toBe(0);
    expect(body.data.columns[1].position).toBe(1);
    expect(body.data.columns[2].position).toBe(2);
  });
});
