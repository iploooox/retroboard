import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../src/server.js';
import { truncateTables } from '../helpers/db.js';
import { seed } from '../../src/db/seed.js';

describe('E2E: Phase 1 Happy Path', () => {
  beforeAll(async () => {
    await truncateTables();
    await seed(process.env.DATABASE_URL);
  });

  it('completes the full user journey', async () => {
    // ---- Step 1: Register User A ----
    const regA = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'SecurePass1',
        display_name: 'Alice Johnson',
      }),
    });

    expect(regA.status).toBe(201);
    const userA = await regA.json();
    expect(userA.user.email).toBe('alice@example.com');
    expect(userA.user.display_name).toBe('Alice Johnson');
    expect(userA.access_token).toBeDefined();
    expect(userA.refresh_token).toBeDefined();

    // ---- Step 2: Register User B ----
    const regB = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob@example.com',
        password: 'SecurePass1',
        display_name: 'Bob Smith',
      }),
    });

    expect(regB.status).toBe(201);
    const userB = await regB.json();
    expect(userB.user.email).toBe('bob@example.com');
    expect(userB.access_token).toBeDefined();

    // ---- Step 3: User A creates a team ----
    const createTeamRes = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userA.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Retro Squad', description: 'Our awesome retro team' }),
    });

    expect(createTeamRes.status).toBe(201);
    const { team } = await createTeamRes.json();
    expect(team.name).toBe('Retro Squad');
    expect(team.slug).toBe('retro-squad');
    expect(team.your_role).toBe('admin');
    expect(team.member_count).toBe(1);

    // ---- Step 4: User A creates an invite link ----
    const createInviteRes = await app.request(`/api/v1/teams/${team.id}/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userA.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(createInviteRes.status).toBe(201);
    const { invitation } = await createInviteRes.json();
    expect(invitation.code).toMatch(/^[a-zA-Z0-9]{12}$/);
    expect(invitation.team_id).toBe(team.id);
    expect(invitation.invite_url).toContain(invitation.code);

    // ---- Step 5: Invite validation ----
    // No separate GET /api/v1/invites/:token endpoint exists in Phase 1.
    // The invite is validated implicitly when User B joins in step 6.

    // ---- Step 6: User B joins the team via invite ----
    const joinRes = await app.request(`/api/v1/teams/join/${invitation.code}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.access_token}` },
    });

    expect(joinRes.status).toBe(200);
    const joinBody = await joinRes.json();
    expect(joinBody.team.id).toBe(team.id);
    expect(joinBody.team.name).toBe('Retro Squad');
    expect(joinBody.membership.role).toBe('member');

    // ---- Step 7: User A creates a sprint ----
    const createSprintRes = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userA.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Sprint 1',
        goal: 'Ship MVP features',
        start_date: '2026-03-01',
        end_date: '2026-03-14',
      }),
    });

    expect(createSprintRes.status).toBe(201);
    const { sprint } = await createSprintRes.json();
    expect(sprint.name).toBe('Sprint 1');
    expect(sprint.goal).toBe('Ship MVP features');
    expect(sprint.status).toBe('planning');
    expect(sprint.team_id).toBe(team.id);
    expect(sprint.sprint_number).toBe(1);

    // ---- Step 8: User A activates the sprint ----
    const activateRes = await app.request(
      `/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userA.access_token}` },
      },
    );

    expect(activateRes.status).toBe(200);
    const activateBody = await activateRes.json();
    expect(activateBody.sprint.status).toBe('active');

    // ---- Step 9: User A lists sprints — verify active sprint ----
    const listSprintsRes = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      headers: { Authorization: `Bearer ${userA.access_token}` },
    });

    expect(listSprintsRes.status).toBe(200);
    const listSprintsBody = await listSprintsRes.json();
    expect(listSprintsBody.sprints).toHaveLength(1);
    expect(listSprintsBody.sprints[0].status).toBe('active');
    expect(listSprintsBody.sprints[0].name).toBe('Sprint 1');

    // ---- Step 10: User B can see the team and sprint ----
    const teamDetailRes = await app.request(`/api/v1/teams/${team.id}`, {
      headers: { Authorization: `Bearer ${userB.access_token}` },
    });

    expect(teamDetailRes.status).toBe(200);
    const teamDetail = await teamDetailRes.json();
    expect(teamDetail.team.name).toBe('Retro Squad');
    expect(teamDetail.team.your_role).toBe('member');
    expect(teamDetail.team.member_count).toBe(2);

    const bSprintsRes = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      headers: { Authorization: `Bearer ${userB.access_token}` },
    });

    expect(bSprintsRes.status).toBe(200);
    const bSprintsBody = await bSprintsRes.json();
    expect(bSprintsBody.sprints).toHaveLength(1);
    expect(bSprintsBody.sprints[0].status).toBe('active');

    // ---- Step 11: User A lists templates — verify 6 system templates ----
    const listTemplatesRes = await app.request('/api/v1/templates', {
      headers: { Authorization: `Bearer ${userA.access_token}` },
    });

    expect(listTemplatesRes.status).toBe(200);
    const listTemplatesBody = await listTemplatesRes.json() as { templates: Array<Record<string, unknown>> };
    expect(listTemplatesBody.templates).toHaveLength(6);
    expect(listTemplatesBody.templates.every((t) => t.is_system === true)).toBe(true);

    // ---- Step 12: User A gets template detail — verify columns ----
    const templateDetailRes = await app.request(
      '/api/v1/templates/00000000-0000-4000-8000-000000000001',
      { headers: { Authorization: `Bearer ${userA.access_token}` } },
    );

    expect(templateDetailRes.status).toBe(200);
    const templateDetail = await templateDetailRes.json();
    expect(templateDetail.template.name).toBe('What Went Well / Delta');
    expect(templateDetail.template.columns).toHaveLength(2);
    expect(templateDetail.template.columns[0].name).toBe('What Went Well');
    expect(templateDetail.template.columns[1].name).toBe('Delta (What to Change)');

    // ---- Step 13: User A completes the sprint ----
    const completeRes = await app.request(
      `/api/v1/teams/${team.id}/sprints/${sprint.id}/complete`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userA.access_token}` },
      },
    );

    expect(completeRes.status).toBe(200);
    const completeBody = await completeRes.json();
    expect(completeBody.sprint.status).toBe('completed');

    // ---- Step 14: User A refreshes token ----
    // Tested before logout so the refresh token is still valid.
    const refreshRes = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: userA.refresh_token }),
    });

    expect(refreshRes.status).toBe(200);
    const refreshBody = await refreshRes.json();
    expect(refreshBody.access_token).toBeDefined();
    expect(refreshBody.refresh_token).toBeDefined();
    expect(refreshBody.expires_in).toBe(900);

    // Verify the new access token works
    const meRes = await app.request('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${refreshBody.access_token}` },
    });

    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.email).toBe('alice@example.com');

    // ---- Step 15: User A logs out ----
    const logoutRes = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refreshBody.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshBody.refresh_token }),
    });

    expect(logoutRes.status).toBe(200);
    const logoutBody = await logoutRes.json();
    expect(logoutBody.message).toBe('Logged out successfully');
  });
});
