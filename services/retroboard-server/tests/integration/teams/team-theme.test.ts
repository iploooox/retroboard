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

describe('S-027: Team Color Themes', () => {
  let adminToken: string;
  let adminUser: { id: string };
  let memberToken: string;
  let memberUser: { id: string };
  let team: { id: string };

  beforeEach(async () => {
    await truncateTables();
    await seed();

    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;

    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;

    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');
  });

  it('6.1: Default theme is "default" on new team', async () => {
    const [teamData] = await sql`SELECT theme FROM teams WHERE id = ${team.id}`;
    expect(teamData.theme).toBe('default');
  });

  it('6.2: Update team theme to "ocean" returns 200', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme: 'ocean' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team.theme).toBe('ocean');

    const [updated] = await sql`SELECT theme FROM teams WHERE id = ${team.id}`;
    expect(updated.theme).toBe('ocean');
  });

  it('6.3: Theme included in team detail response', async () => {
    await sql`UPDATE teams SET theme = 'sunset' WHERE id = ${team.id}`;

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team.theme).toBe('sunset');
  });

  it('6.4: Theme included in board detail response through team', async () => {
    await sql`UPDATE teams SET theme = 'forest' WHERE id = ${team.id}`;

    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);

    const res = await app.request(`/api/v1/boards/${board.id}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // Theme should be accessible through team data or directly
    expect(body.data.team?.theme || body.data.theme).toBe('forest');
  });

  it('6.5: Invalid theme value returns 400', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme: 'invalid_theme' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toMatch(/VALIDATION_ERROR|INVALID_THEME/i);
  });

  it('6.6: Only admin can change theme - member gets 403', async () => {
    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme: 'midnight' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TEAM_INSUFFICIENT_ROLE');
  });

  it('6.7: All 8 valid themes are accepted', async () => {
    const validThemes = ['default', 'ocean', 'sunset', 'forest', 'midnight', 'lavender', 'coral', 'monochrome'];

    for (const theme of validThemes) {
      const res = await app.request(`/api/v1/teams/${team.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.team.theme).toBe(theme);
    }
  });

  it('6.8: Theme persists after team update with other fields', async () => {
    await sql`UPDATE teams SET theme = 'lavender' WHERE id = ${team.id}`;

    const res = await app.request(`/api/v1/teams/${team.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Updated Team Name' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team.name).toBe('Updated Team Name');
    expect(body.team.theme).toBe('lavender'); // Theme should not change
  });
});
