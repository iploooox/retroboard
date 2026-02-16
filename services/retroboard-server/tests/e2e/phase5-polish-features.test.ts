import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../src/server.js';
import { truncateTables, refreshAnalyticsMaterializedViews, SYSTEM_TEMPLATE_WWD } from '../helpers/db.js';
import { seed } from '../../src/db/seed.js';

/**
 * E2E: Phase 5 Happy Path — Polish Features
 *
 * Full Phase 5 polish features flow:
 *  1. Setup: Register user, create team with sprint and board
 *  2. Export: Test JSON/Markdown/HTML export
 *  3. Advanced Templates: Verify all 6 templates, create board from Starfish
 *  4. Emoji Reactions: Add reaction → verify → toggle off → verify removed
 *  5. Board Themes: Update team theme → verify in team detail
 *  6. Icebreaker: Get random icebreaker → use on board → get another (should be different)
 *  7. Onboarding: Get state → complete steps → mark complete → verify
 *  8. Team Report: Generate team report with sprint data
 */
describe('E2E: Phase 5 Happy Path — Polish Features', () => {
  beforeAll(async () => {
    await truncateTables();
    await seed(process.env.DATABASE_URL);
  });

  it('runs complete Phase 5 polish features pipeline', async () => {
    // ========== SETUP: Register users, create team ==========

    // Register Alice (facilitator)
    const regA = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice-phase5@example.com',
        password: 'SecurePass1',
        display_name: 'Alice',
      }),
    });
    expect(regA.status).toBe(201);
    const userA = await regA.json();
    const tokenA = userA.access_token;
    const _aliceId = userA.user.id;

    // Register Bob (member)
    const regB = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob-phase5@example.com',
        password: 'SecurePass1',
        display_name: 'Bob',
      }),
    });
    expect(regB.status).toBe(201);
    const userB = await regB.json();
    const tokenB = userB.access_token;
    const bobId = userB.user.id;

    // Alice creates team
    const createTeamRes = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Phase 5 Polish Team' }),
    });
    expect(createTeamRes.status).toBe(201);
    const { team } = await createTeamRes.json();
    const teamId = team.id;

    // Alice invites Bob
    const inviteRes = await app.request(`/api/v1/teams/${teamId}/invitations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(inviteRes.status).toBe(201);
    const { invitation } = await inviteRes.json();

    const joinBRes = await app.request(`/api/v1/teams/join/${invitation.code}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(joinBRes.status).toBe(200);

    // Create sprint
    const createSprintRes = await app.request(`/api/v1/teams/${teamId}/sprints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sprint 1',
        goal: 'Polish features sprint',
        start_date: '2026-02-01',
        end_date: '2026-02-14',
      }),
    });
    expect(createSprintRes.status).toBe(201);
    const { sprint } = await createSprintRes.json();
    const sprintId = sprint.id;

    // Activate sprint
    const activateRes = await app.request(
      `/api/v1/teams/${teamId}/sprints/${sprintId}/activate`,
      { method: 'PUT', headers: { Authorization: `Bearer ${tokenA}` } },
    );
    expect(activateRes.status).toBe(200);

    // Create board from WWW/Delta template
    const createBoardRes = await app.request(`/api/v1/sprints/${sprintId}/board`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: SYSTEM_TEMPLATE_WWD,
        anonymous_mode: false,
        max_votes_per_user: 10,
        max_votes_per_card: 5,
      }),
    });
    expect(createBoardRes.status).toBe(201);
    const boardBody = await createBoardRes.json();
    const board = boardBody.data;
    const boardId = board.id;
    const wentWellCol = board.columns[0];
    const deltaCol = board.columns[1];

    // Add cards with votes and groups
    const card1Res = await app.request(`/api/v1/boards/${boardId}/cards`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        column_id: wentWellCol.id,
        content: 'Great teamwork this sprint',
      }),
    });
    expect(card1Res.status).toBe(201);
    const card1 = (await card1Res.json()).data;

    const card2Res = await app.request(`/api/v1/boards/${boardId}/cards`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        column_id: deltaCol.id,
        content: 'Need better documentation',
      }),
    });
    expect(card2Res.status).toBe(201);
    const card2 = (await card2Res.json()).data;

    // Change phase to vote
    const toVoteRes = await app.request(`/api/v1/boards/${boardId}/phase`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'vote' }),
    });
    expect(toVoteRes.status).toBe(200);

    // Cast votes
    await app.request(`/api/v1/boards/${boardId}/cards/${card1.id}/vote`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    await app.request(`/api/v1/boards/${boardId}/cards/${card2.id}/vote`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    // Change phase to group
    const toGroupRes = await app.request(`/api/v1/boards/${boardId}/phase`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'group' }),
    });
    expect(toGroupRes.status).toBe(200);

    // Create group
    const createGroupRes = await app.request(`/api/v1/boards/${boardId}/groups`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Team collaboration',
        card_ids: [card1.id],
      }),
    });
    expect(createGroupRes.status).toBe(201);

    // Change phase to action
    const toActionRes = await app.request(`/api/v1/boards/${boardId}/phase`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'action' }),
    });
    expect(toActionRes.status).toBe(200);

    // Create action items
    const createAIRes = await app.request(`/api/v1/boards/${boardId}/action-items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Improve documentation',
        assigneeId: bobId,
        dueDate: '2026-02-28',
      }),
    });
    expect(createAIRes.status).toBe(201);

    // ========== 1. EXPORT: JSON/Markdown/HTML ==========

    // Export as JSON
    const jsonExportRes = await app.request(`/api/v1/boards/${boardId}/export?format=json`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(jsonExportRes.status).toBe(200);
    expect(jsonExportRes.headers.get('content-type')).toContain('application/json');
    const jsonData = await jsonExportRes.json();
    expect(jsonData.board).toBeDefined();
    expect(jsonData.board.id).toBe(boardId);
    expect(jsonData.columns).toBeDefined();
    expect(jsonData.columns.length).toBe(2);
    expect(jsonData.columns[0].cards.length).toBeGreaterThan(0);
    expect(jsonData.groups).toBeDefined();
    expect(jsonData.groups.length).toBeGreaterThanOrEqual(1);
    expect(jsonData.actionItems).toBeDefined();
    expect(jsonData.actionItems.length).toBeGreaterThanOrEqual(1);

    // Export as Markdown
    const mdExportRes = await app.request(`/api/v1/boards/${boardId}/export?format=markdown`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(mdExportRes.status).toBe(200);
    expect(mdExportRes.headers.get('content-type')).toContain('text/markdown');
    const mdData = await mdExportRes.text();
    expect(mdData).toContain('# Retrospective:');
    expect(mdData).toContain('What Went Well');
    expect(mdData).toContain('Great teamwork this sprint');
    expect(mdData).toContain('Need better documentation');
    expect(mdData).toContain('## Action Items');

    // Export as HTML
    const htmlExportRes = await app.request(`/api/v1/boards/${boardId}/export?format=html`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(htmlExportRes.status).toBe(200);
    expect(htmlExportRes.headers.get('content-type')).toContain('text/html');
    const htmlData = await htmlExportRes.text();
    expect(htmlData).toContain('<!DOCTYPE html>');
    expect(htmlData).toContain('What Went Well');
    expect(htmlData).toContain('Great teamwork this sprint');
    expect(htmlData).toContain('Action Items');

    // ========== 2. ADVANCED TEMPLATES ==========

    // List all templates
    const templatesRes = await app.request('/api/v1/templates', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(templatesRes.status).toBe(200);
    const templatesData = await templatesRes.json();
    expect(templatesData.templates).toBeDefined();

    // Filter system templates only
    const systemTemplates = templatesData.templates.filter((t: { is_system: boolean }) => t.is_system);
    expect(systemTemplates.length).toBeGreaterThanOrEqual(6); // Should have at least 6 system templates

    // Verify template names
    const templateNames = systemTemplates.map((t: { name: string }) => t.name);
    expect(templateNames).toContain('What Went Well / Delta');
    expect(templateNames).toContain('Start / Stop / Continue');
    expect(templateNames).toContain('4Ls');
    expect(templateNames).toContain('Mad / Sad / Glad');
    expect(templateNames).toContain('Sailboat');
    expect(templateNames).toContain('Starfish');

    // Find Starfish template
    const starfishTemplate = systemTemplates.find((t: { name: string }) => t.name === 'Starfish');
    expect(starfishTemplate).toBeDefined();
    expect(starfishTemplate.id).toBe('00000000-0000-4000-8000-000000000006');

    // Create sprint 2 for Starfish board
    const createSprint2Res = await app.request(`/api/v1/teams/${teamId}/sprints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sprint 2',
        goal: 'Starfish sprint',
        start_date: '2026-02-15',
        end_date: '2026-02-28',
      }),
    });
    expect(createSprint2Res.status).toBe(201);
    const { sprint: sprint2 } = await createSprint2Res.json();

    // Complete sprint 1 so we can activate sprint 2
    await app.request(`/api/v1/teams/${teamId}/sprints/${sprintId}/complete`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    // Activate sprint 2
    await app.request(`/api/v1/teams/${teamId}/sprints/${sprint2.id}/activate`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    // Create board from Starfish template
    const starfishBoardRes = await app.request(`/api/v1/sprints/${sprint2.id}/board`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: starfishTemplate.id,
        anonymous_mode: false,
        max_votes_per_user: 10,
        max_votes_per_card: 5,
      }),
    });
    expect(starfishBoardRes.status).toBe(201);
    const starfishBoard = (await starfishBoardRes.json()).data;
    expect(starfishBoard.columns.length).toBe(5); // Starfish has 5 columns

    // Verify column names
    const columnNames = starfishBoard.columns.map((c: { name: string }) => c.name);
    expect(columnNames).toContain('Keep Doing');
    expect(columnNames).toContain('More Of');
    expect(columnNames).toContain('Less Of');
    expect(columnNames).toContain('Stop Doing');
    expect(columnNames).toContain('Start Doing');

    // ========== 3. EMOJI REACTIONS ==========

    // Add reaction to card1
    const addReactionRes = await app.request(`/api/v1/cards/${card1.id}/reactions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '👍' }),
    });
    expect(addReactionRes.status).toBe(200);
    const reactionData = await addReactionRes.json();
    expect(reactionData.ok).toBe(true);
    expect(reactionData.data.added).toBe(true);
    expect(reactionData.data.emoji).toBe('👍');
    expect(reactionData.data.reactions).toBeDefined();
    expect(reactionData.data.reactions.length).toBeGreaterThan(0);
    const thumbsUpReaction = reactionData.data.reactions.find((r: { emoji: string }) => r.emoji === '👍');
    expect(thumbsUpReaction).toBeDefined();
    expect(thumbsUpReaction.count).toBe(1);

    // Toggle off (remove reaction)
    const removeReactionRes = await app.request(`/api/v1/cards/${card1.id}/reactions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '👍' }),
    });
    expect(removeReactionRes.status).toBe(200);
    const removedData = await removeReactionRes.json();
    expect(removedData.ok).toBe(true);
    expect(removedData.data.added).toBe(false);
    const remainingReactions = removedData.data.reactions.filter((r: { emoji: string; count: number }) => r.emoji === '👍' && r.count > 0);
    expect(remainingReactions.length).toBe(0);

    // ========== 4. BOARD THEMES ==========

    // Update team theme
    const updateThemeRes = await app.request(`/api/v1/teams/${teamId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'midnight' }),
    });
    expect(updateThemeRes.status).toBe(200);

    // Verify theme in team detail
    const teamDetailRes = await app.request(`/api/v1/teams/${teamId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(teamDetailRes.status).toBe(200);
    const teamDetail = await teamDetailRes.json();
    expect(teamDetail.team.theme).toBe('midnight');

    // ========== 5. ICEBREAKER ==========

    // Get random icebreaker
    const icebreaker1Res = await app.request(`/api/v1/icebreakers/random?teamId=${teamId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(icebreaker1Res.status).toBe(200);
    const icebreaker1Body = await icebreaker1Res.json();
    expect(icebreaker1Body.ok).toBe(true);
    expect(icebreaker1Body.data).toBeDefined();
    expect(icebreaker1Body.data.question).toBeDefined();
    expect(typeof icebreaker1Body.data.question).toBe('string');
    expect(icebreaker1Body.data.question.length).toBeGreaterThan(0);

    // Get another icebreaker (should be different due to non-repeating logic)
    const icebreaker2Res = await app.request(`/api/v1/icebreakers/random?teamId=${teamId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(icebreaker2Res.status).toBe(200);
    const icebreaker2Body = await icebreaker2Res.json();
    expect(icebreaker2Body.ok).toBe(true);
    expect(icebreaker2Body.data).toBeDefined();
    expect(icebreaker2Body.data.question).toBeDefined();
    // Should be different (non-repeating logic)
    expect(icebreaker2Body.data.question).not.toBe(icebreaker1Body.data.question);

    // ========== 6. ONBOARDING ==========

    // Get onboarding state
    const onboardingStateRes = await app.request('/api/v1/users/me/onboarding', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(onboardingStateRes.status).toBe(200);
    const onboardingState = await onboardingStateRes.json();
    expect(onboardingState.ok).toBe(true);
    expect(onboardingState.data).toBeDefined();
    expect(onboardingState.data.currentStep).toBeDefined();
    expect(onboardingState.data.completedSteps).toBeDefined();
    expect(Array.isArray(onboardingState.data.completedSteps)).toBe(true);
    expect(onboardingState.data.skippedSteps).toBeDefined();
    expect(Array.isArray(onboardingState.data.skippedSteps)).toBe(true);

    // Complete a step using PATCH
    const completeStepRes = await app.request('/api/v1/users/me/onboarding', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'create_team', action: 'complete' }),
    });
    expect(completeStepRes.status).toBe(200);
    const completedStep = await completeStepRes.json();
    expect(completedStep.ok).toBe(true);
    expect(completedStep.data.completedSteps).toContain('create_team');

    // Mark onboarding as complete
    const completeOnboardingRes = await app.request('/api/v1/users/me/onboarding/complete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(completeOnboardingRes.status).toBe(200);

    // Verify onboarding is marked complete (should return null or indicate completion)
    const verifyOnboardingRes = await app.request('/api/v1/users/me/onboarding', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(verifyOnboardingRes.status).toBe(200);
    const verifiedOnboarding = await verifyOnboardingRes.json();
    expect(verifiedOnboarding.ok).toBe(true);
    // After completion, data is null
    expect(verifiedOnboarding.data).toBeNull();

    // ========== 7. TEAM REPORT ==========

    // Refresh materialized views for analytics
    await refreshAnalyticsMaterializedViews();

    // Generate team report
    const reportRes = await app.request(`/api/v1/teams/${teamId}/report?format=json`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(reportRes.status).toBe(200);
    const reportText = await reportRes.text();
    const reportData = JSON.parse(reportText);
    expect(reportData.team).toBeDefined();
    expect(reportData.team.id).toBe(teamId);
    expect(reportData.team.name).toBe('Phase 5 Polish Team');
    expect(reportData.sprintCount).toBeDefined();
    expect(reportData.healthTrend).toBeDefined();
    expect(Array.isArray(reportData.healthTrend)).toBe(true);
    expect(reportData.participation).toBeDefined();
    expect(reportData.actionItems).toBeDefined();
    expect(reportData.actionItems.totalCreated).toBeGreaterThan(0);

    // ========== SUCCESS ==========
    console.log('✅ Phase 5 E2E polish features completed successfully');
  });
});
