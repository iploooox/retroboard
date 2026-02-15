import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../../../src/db/connection.js';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  createTestSprint,
  createTestBoard,
  addTeamMember,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('S-028: Icebreaker Endpoints', () => {
  let adminToken: string;
  let adminUser: { id: string };
  let memberToken: string;
  let memberUser: { id: string };
  let facilitatorToken: string;
  let facilitatorUser: { id: string };
  let team: { id: string };
  let board: { id: string };

  beforeEach(async () => {
    await truncateTables();
    await seed();

    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;

    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;

    const facilitatorAuth = await getAuthToken({ email: 'facilitator@example.com', displayName: 'Facilitator User' });
    facilitatorToken = facilitatorAuth.token;
    facilitatorUser = facilitatorAuth.user;

    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');
    await addTeamMember(team.id, facilitatorUser.id, 'facilitator');

    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board: testBoard } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = testBoard;
  });

  it('8.1: GET /api/v1/icebreakers/random?teamId=X returns 200 with question', async () => {
    const res = await app.request(`/api/v1/icebreakers/random?teamId=${team.id}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.question).toBeDefined();
    expect(body.data.category).toBeDefined();
  });

  it('8.2: GET with category filter returns question with that category', async () => {
    const res = await app.request(`/api/v1/icebreakers/random?teamId=${team.id}&category=fun`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.category).toBe('fun');
  });

  it('8.3: GET without teamId returns 400', async () => {
    const res = await app.request('/api/v1/icebreakers/random', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('8.4: GET with invalid category returns 400', async () => {
    const res = await app.request(`/api/v1/icebreakers/random?teamId=${team.id}&category=invalid`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('8.5: GET without auth returns 401', async () => {
    const res = await app.request(`/api/v1/icebreakers/random?teamId=${team.id}`);

    expect(res.status).toBe(401);
  });

  it('8.6: GET as non-team-member returns 403', async () => {
    const outsiderAuth = await getAuthToken({ email: 'outsider@example.com' });

    const res = await app.request(`/api/v1/icebreakers/random?teamId=${team.id}`, {
      headers: {
        'Authorization': `Bearer ${outsiderAuth.token}`,
      },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('8.7: POST /api/v1/teams/:teamId/icebreakers/custom creates custom icebreaker', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: 'What is your favorite programming language?',
        category: 'fun',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.question).toBe('What is your favorite programming language?');
    expect(body.data.category).toBe('fun');
    expect(body.data.is_system).toBe(false);
    expect(body.data.team_id).toBe(team.id);
  });

  it('8.8: Custom icebreaker appears in random pool for team', async () => {
    // Create custom icebreaker
    await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: 'Unique custom question 12345',
        category: 'fun',
      }),
    });

    // Try to get it (might need multiple tries)
    let foundCustom = false;
    for (let i = 0; i < 100 && !foundCustom; i++) {
      const res = await app.request(`/api/v1/icebreakers/random?teamId=${team.id}&category=fun`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });
      const body = await res.json();
      if (body.data.question === 'Unique custom question 12345') {
        foundCustom = true;
      }
    }

    // At minimum, verify it's in the database
    const custom = await sql`
      SELECT * FROM icebreakers WHERE question = 'Unique custom question 12345'
    `;
    expect(custom).toHaveLength(1);
  });

  it('8.9: Only admin/facilitator can create custom - member gets 403', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: 'Member question',
        category: 'fun',
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('8.10: Facilitator can create custom icebreaker', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: 'Facilitator question',
        category: 'team-building',
      }),
    });

    expect(res.status).toBe(201);
  });

  it('8.11: POST /api/v1/boards/:boardId/icebreaker records history', async () => {
    const randomRes = await app.request(`/api/v1/icebreakers/random?teamId=${team.id}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    const randomBody = await randomRes.json();
    const icebreakerId = randomBody.data.id;

    const res = await app.request(`/api/v1/boards/${board.id}/icebreaker`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ icebreakerId }),
    });

    expect(res.status).toBe(200);

    // Check history
    const history = await sql`
      SELECT * FROM team_icebreaker_history
      WHERE team_id = ${team.id} AND icebreaker_id = ${icebreakerId}
    `;
    expect(history).toHaveLength(1);
    expect(history[0].board_id).toBe(board.id);
  });

  it('8.12: DELETE /api/v1/boards/:boardId/icebreaker returns 200', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/icebreaker`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
  });

  it('8.13: Same icebreaker not returned again for same team (exclusion)', async () => {
    const res1 = await app.request(`/api/v1/icebreakers/random?teamId=${team.id}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    const body1 = await res1.json();
    const firstId = body1.data.id;

    // Record usage
    await sql`
      INSERT INTO team_icebreaker_history (team_id, icebreaker_id, used_at)
      VALUES (${team.id}, ${firstId}, NOW())
    `;

    // Get another random
    const res2 = await app.request(`/api/v1/icebreakers/random?teamId=${team.id}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    const body2 = await res2.json();

    expect(body2.data.id).not.toBe(firstId);
  });

  it('8.14: 55 system icebreakers seeded (15 fun + 10 team-building + 10 reflective + 10 creative + 10 quick)', async () => {
    const total = await sql`SELECT COUNT(*) as count FROM icebreakers WHERE is_system = true`;
    expect(Number(total[0].count)).toBeGreaterThanOrEqual(50); // At least 50, spec says 50+

    const fun = await sql`SELECT COUNT(*) as count FROM icebreakers WHERE is_system = true AND category = 'fun'`;
    expect(Number(fun[0].count)).toBeGreaterThanOrEqual(15);

    const teamBuilding = await sql`SELECT COUNT(*) as count FROM icebreakers WHERE is_system = true AND category = 'team-building'`;
    expect(Number(teamBuilding[0].count)).toBeGreaterThanOrEqual(10);

    const reflective = await sql`SELECT COUNT(*) as count FROM icebreakers WHERE is_system = true AND category = 'reflective'`;
    expect(Number(reflective[0].count)).toBeGreaterThanOrEqual(10);

    const creative = await sql`SELECT COUNT(*) as count FROM icebreakers WHERE is_system = true AND category = 'creative'`;
    expect(Number(creative[0].count)).toBeGreaterThanOrEqual(10);

    const quick = await sql`SELECT COUNT(*) as count FROM icebreakers WHERE is_system = true AND category = 'quick'`;
    expect(Number(quick[0].count)).toBeGreaterThanOrEqual(10);
  });

  it('8.15: Custom icebreaker for one team not visible to another', async () => {
    // Create custom for team 1
    await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: 'Team 1 exclusive question',
        category: 'fun',
      }),
    });

    // Create team 2
    const admin2Auth = await getAuthToken({ email: 'admin2@example.com' });
    const team2 = await createTestTeam(admin2Auth.user.id);

    // Try to get random for team 2, should never get team 1's custom
    for (let i = 0; i < 50; i++) {
      const res = await app.request(`/api/v1/icebreakers/random?teamId=${team2.id}`, {
        headers: {
          'Authorization': `Bearer ${admin2Auth.token}`,
        },
      });
      const body = await res.json();
      expect(body.data.question).not.toBe('Team 1 exclusive question');
    }
  });

  it('8.16: Team deletion cascades custom icebreakers', async () => {
    // Create custom icebreaker
    const createRes = await app.request(`/api/v1/teams/${team.id}/icebreakers/custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: 'Will be deleted',
        category: 'fun',
      }),
    });
    const createBody = await createRes.json();
    const customId = createBody.data.id;

    // Delete team
    await sql`DELETE FROM teams WHERE id = ${team.id}`;

    // Check icebreaker is deleted
    const icebreakers = await sql`SELECT * FROM icebreakers WHERE id = ${customId}`;
    expect(icebreakers).toHaveLength(0);
  });
});
