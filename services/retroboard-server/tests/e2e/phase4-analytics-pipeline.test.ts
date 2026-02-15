import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../src/server.js';
import { truncateTables, refreshAnalyticsMaterializedViews, SYSTEM_TEMPLATE_WWD } from '../helpers/db.js';
import { seed } from '../../src/db/seed.js';
import { sql } from '../../src/db/connection.js';

/**
 * E2E: Phase 4 Happy Path — Analytics & Action Item Carry-over Pipeline
 *
 * Full analytics and carry-over flow:
 *  1. Setup: Register 3 users (Alice, Bob, Charlie), create team & 3 sprints
 *  2. For each sprint: create board, add cards with known sentiment, vote, create action items
 *  3. Refresh materialized views
 *  4. Test health analytics: GET /teams/:teamId/analytics/health
 *  5. Test participation analytics: GET /teams/:teamId/analytics/participation
 *  6. Test sentiment analytics: GET /teams/:teamId/analytics/sentiment
 *  7. Test word cloud: GET /teams/:teamId/analytics/word-cloud
 *  8. Test sprint summary: GET /sprints/:sprintId/analytics
 *  9. Create sprint 4 with new board
 * 10. Test carry-over: POST /boards/:newBoardId/action-items/carry-over
 * 11. Test carry-over idempotent: POST again
 * 12. Test team action items: GET /teams/:teamId/action-items
 */
describe('E2E: Phase 4 Happy Path — Analytics & Action Item Carry-over Pipeline', () => {
  beforeAll(async () => {
    await truncateTables();
    await seed(process.env.DATABASE_URL);
  });

  it('runs a complete analytics pipeline with carry-over', async () => {
    // ========== SETUP: Register users, create team ==========

    // Register Alice (facilitator)
    const regA = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice-phase4@example.com',
        password: 'SecurePass1',
        display_name: 'Alice',
      }),
    });
    expect(regA.status).toBe(201);
    const userA = await regA.json();
    const tokenA = userA.access_token;
    const aliceId = userA.user.id;

    // Register Bob (member)
    const regB = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob-phase4@example.com',
        password: 'SecurePass1',
        display_name: 'Bob',
      }),
    });
    expect(regB.status).toBe(201);
    const userB = await regB.json();
    const tokenB = userB.access_token;
    const bobId = userB.user.id;

    // Register Charlie (member)
    const regC = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'charlie-phase4@example.com',
        password: 'SecurePass1',
        display_name: 'Charlie',
      }),
    });
    expect(regC.status).toBe(201);
    const userC = await regC.json();
    const tokenC = userC.access_token;
    const charlieId = userC.user.id;

    // Alice creates team
    const createTeamRes = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Phase 4 Analytics Team' }),
    });
    expect(createTeamRes.status).toBe(201);
    const { team } = await createTeamRes.json();
    const teamId = team.id;

    // Alice invites Bob and Charlie
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

    const joinCRes = await app.request(`/api/v1/teams/join/${invitation.code}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    expect(joinCRes.status).toBe(200);

    // ========== CREATE 3 SPRINTS WITH BOARDS, CARDS, VOTES, ACTION ITEMS ==========

    const sprints: Array<{ id: string; boardId: string; name: string }> = [];

    for (let i = 1; i <= 3; i++) {
      // Create sprint
      const createSprintRes = await app.request(`/api/v1/teams/${teamId}/sprints`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Sprint ${i}`,
          goal: `Sprint ${i} goal`,
          start_date: `2026-02-${String(i).padStart(2, '0')}`,
          end_date: `2026-02-${String(i + 13).padStart(2, '0')}`,
        }),
      });
      expect(createSprintRes.status).toBe(201);
      const { sprint } = await createSprintRes.json();

      // Activate sprint
      const activateRes = await app.request(
        `/api/v1/teams/${teamId}/sprints/${sprint.id}/activate`,
        { method: 'PUT', headers: { Authorization: `Bearer ${tokenA}` } },
      );
      expect(activateRes.status).toBe(200);

      // Create board from WWW/Delta template
      const createBoardRes = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
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

      sprints.push({ id: sprint.id, boardId, name: `Sprint ${i}` });

      // WWW template has 2 columns: "What Went Well" (index 0) and "Delta" (index 1)
      const wentWellCol = board.columns[0];
      const deltaCol = board.columns[1];

      // Add cards with known sentiment
      // Positive cards (using positive sentiment words)
      const posCards = [
        'Excellent collaboration with the team',
        'Great deployment process this sprint',
        'Amazing progress on the new feature',
      ];

      // Negative cards (using negative sentiment words)
      const negCards = [
        'Terrible broken deploy on Friday',
        'Bad communication during standup',
        'Poor test coverage caused issues',
      ];

      // Neutral cards
      const neutralCards = [
        'Need to update documentation',
        'Review scheduled for next week',
      ];

      const cardIds: string[] = [];

      // Add positive cards to Went Well
      for (const content of posCards) {
        const res = await app.request(`/api/v1/boards/${boardId}/cards`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ column_id: wentWellCol.id, content }),
        });
        expect(res.status).toBe(201);
        const card = (await res.json()).data;
        cardIds.push(card.id);
      }

      // Add negative cards to Delta
      for (const content of negCards) {
        const res = await app.request(`/api/v1/boards/${boardId}/cards`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ column_id: deltaCol.id, content }),
        });
        expect(res.status).toBe(201);
        const card = (await res.json()).data;
        cardIds.push(card.id);
      }

      // Add neutral cards
      for (const content of neutralCards) {
        const res = await app.request(`/api/v1/boards/${boardId}/cards`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenC}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ column_id: deltaCol.id, content }),
        });
        expect(res.status).toBe(201);
        const card = (await res.json()).data;
        cardIds.push(card.id);
      }

      // Change phase to vote
      const toVoteRes = await app.request(`/api/v1/boards/${boardId}/phase`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'vote' }),
      });
      expect(toVoteRes.status).toBe(200);

      // Cast votes (each user votes on a few cards)
      for (let j = 0; j < 3; j++) {
        await app.request(`/api/v1/boards/${boardId}/cards/${cardIds[j]}/vote`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenA}` },
        });
        await app.request(`/api/v1/boards/${boardId}/cards/${cardIds[j + 1]}/vote`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenB}` },
        });
        await app.request(`/api/v1/boards/${boardId}/cards/${cardIds[j + 2]}/vote`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenC}` },
        });
      }

      // Change phase to action
      const toActionRes = await app.request(`/api/v1/boards/${boardId}/phase`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'action' }),
      });
      expect(toActionRes.status).toBe(200);

      // Create action items (mix of statuses)
      // Sprint 1: 2 open, 1 done
      // Sprint 2: 1 open, 1 in_progress, 1 done
      // Sprint 3: 2 open, 1 in_progress (will be carried over)

      const actionItems: Array<{ title: string; status: string; assigneeId: string }> = [];
      if (i === 1) {
        actionItems.push(
          { title: 'Fix deployment pipeline', status: 'open', assigneeId: aliceId },
          { title: 'Add integration tests', status: 'open', assigneeId: bobId },
          { title: 'Update README', status: 'done', assigneeId: charlieId },
        );
      } else if (i === 2) {
        actionItems.push(
          { title: 'Improve test coverage', status: 'open', assigneeId: bobId },
          { title: 'Refactor auth module', status: 'in_progress', assigneeId: aliceId },
          { title: 'Setup monitoring', status: 'done', assigneeId: charlieId },
        );
      } else if (i === 3) {
        actionItems.push(
          { title: 'Optimize database queries', status: 'open', assigneeId: aliceId },
          { title: 'Document API endpoints', status: 'open', assigneeId: bobId },
          { title: 'Implement caching layer', status: 'in_progress', assigneeId: charlieId },
        );
      }

      for (const item of actionItems) {
        const createAIRes = await app.request(`/api/v1/boards/${boardId}/action-items`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title,
            assigneeId: item.assigneeId,
            dueDate: `2026-03-0${i}`,
          }),
        });
        expect(createAIRes.status).toBe(201);
        const actionItem = await createAIRes.json();

        // Update status if not open
        if (item.status !== 'open') {
          const updateRes = await app.request(`/api/v1/action-items/${actionItem.id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: item.status }),
          });
          expect(updateRes.status).toBe(200);
        }
      }

      // Complete the sprint so we can activate the next one
      await sql`UPDATE sprints SET status = 'completed' WHERE id = ${sprint.id}`;
    }

    // ========== REFRESH MATERIALIZED VIEWS ==========

    await refreshAnalyticsMaterializedViews();

    // ========== TEST HEALTH ANALYTICS ==========

    const healthRes = await app.request(`/api/v1/teams/${teamId}/analytics/health`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(healthRes.status).toBe(200);
    const healthData = await healthRes.json();

    expect(healthData.teamId).toBe(teamId);
    expect(healthData.teamName).toBe('Phase 4 Analytics Team');
    expect(healthData.sprints).toBeDefined();
    expect(healthData.sprints.length).toBe(3);

    // Verify each sprint has health scores
    for (const sprintHealth of healthData.sprints) {
      expect(sprintHealth.healthScore).toBeGreaterThanOrEqual(0);
      expect(sprintHealth.healthScore).toBeLessThanOrEqual(100);
      expect(sprintHealth.sentimentScore).toBeGreaterThanOrEqual(0);
      expect(sprintHealth.sentimentScore).toBeLessThanOrEqual(100);
      expect(sprintHealth.voteDistributionScore).toBeGreaterThanOrEqual(0);
      expect(sprintHealth.voteDistributionScore).toBeLessThanOrEqual(100);
      expect(sprintHealth.participationScore).toBeGreaterThanOrEqual(0);
      expect(sprintHealth.participationScore).toBeLessThanOrEqual(100);
      expect(sprintHealth.cardCount).toBeGreaterThan(0);
      expect(sprintHealth.totalMembers).toBe(3);
      expect(sprintHealth.activeMembers).toBe(3);
    }

    expect(healthData.trend).toBeDefined();
    expect(['up', 'down', 'stable']).toContain(healthData.trend.direction);

    // ========== TEST PARTICIPATION ANALYTICS ==========

    const participationRes = await app.request(`/api/v1/teams/${teamId}/analytics/participation`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(participationRes.status).toBe(200);
    const participationData = await participationRes.json();

    expect(participationData.teamId).toBe(teamId);
    expect(participationData.members).toBeDefined();
    expect(participationData.members.length).toBe(3);

    // Verify each member has stats
    const aliceMember = participationData.members.find((m: { userId: string }) => m.userId === aliceId);
    expect(aliceMember).toBeDefined();
    expect(aliceMember.userName).toBe('Alice');
    expect(aliceMember.totals.cardsSubmitted).toBeGreaterThan(0);
    expect(aliceMember.totals.votesCast).toBeGreaterThan(0);
    expect(aliceMember.totals.actionItemsOwned).toBeGreaterThan(0);
    expect(aliceMember.perSprint).toBeDefined();
    expect(aliceMember.perSprint.length).toBe(3);

    expect(participationData.teamAverages).toBeDefined();
    expect(participationData.teamAverages.avgCardsPerMember).toBeGreaterThan(0);
    expect(participationData.teamAverages.avgVotesPerMember).toBeGreaterThan(0);

    // ========== TEST SENTIMENT ANALYTICS ==========

    const sentimentRes = await app.request(`/api/v1/teams/${teamId}/analytics/sentiment`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(sentimentRes.status).toBe(200);
    const sentimentData = await sentimentRes.json();

    expect(sentimentData.teamId).toBe(teamId);
    expect(sentimentData.sprints).toBeDefined();
    expect(sentimentData.sprints.length).toBe(3);

    // Verify sentiment scores
    for (const sprintSentiment of sentimentData.sprints) {
      expect(sprintSentiment.normalizedScore).toBeGreaterThanOrEqual(0);
      expect(sprintSentiment.normalizedScore).toBeLessThanOrEqual(100);
      expect(sprintSentiment.positiveCards).toBeGreaterThan(0); // We added 3 positive cards
      expect(sprintSentiment.negativeCards).toBeGreaterThan(0); // We added 3 negative cards
      expect(sprintSentiment.neutralCards).toBeGreaterThan(0); // We added 2 neutral cards
      expect(sprintSentiment.totalCards).toBe(8); // 3 + 3 + 2
      expect(sprintSentiment.sentimentByColumn).toBeDefined();
    }

    expect(sentimentData.overallTrend).toBeDefined();
    expect(['up', 'down', 'stable']).toContain(sentimentData.overallTrend.direction);

    // ========== TEST WORD CLOUD ==========

    const wordCloudRes = await app.request(
      `/api/v1/teams/${teamId}/analytics/word-cloud?sprintId=${sprints[0].id}&minFrequency=1`,
      { headers: { Authorization: `Bearer ${tokenA}` } },
    );
    expect(wordCloudRes.status).toBe(200);
    const wordCloudData = await wordCloudRes.json();

    expect(wordCloudData.teamId).toBe(teamId);
    expect(wordCloudData.sprintId).toBe(sprints[0].id);
    expect(wordCloudData.words).toBeDefined();
    expect(Array.isArray(wordCloudData.words)).toBe(true);

    // If words are present, verify structure
    if (wordCloudData.words.length > 0) {
      const firstWord = wordCloudData.words[0];
      expect(firstWord.word).toBeDefined();
      expect(firstWord.frequency).toBeGreaterThan(0);
      expect(firstWord.sentiment).toBeDefined();
    }

    // Verify word structure
    for (const wordEntry of wordCloudData.words.slice(0, 5)) {
      expect(wordEntry.word).toBeDefined();
      expect(wordEntry.frequency).toBeGreaterThan(0);
      expect(wordEntry.sentiment).toBeDefined();
    }

    // ========== TEST SPRINT SUMMARY ANALYTICS ==========

    const sprintSummaryRes = await app.request(`/api/v1/sprints/${sprints[0].id}/analytics`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(sprintSummaryRes.status).toBe(200);
    const sprintSummary = await sprintSummaryRes.json();

    expect(sprintSummary.sprintId).toBe(sprints[0].id);
    expect(sprintSummary.sprintName).toBe('Sprint 1');
    expect(sprintSummary.teamId).toBe(teamId);

    expect(sprintSummary.health).toBeDefined();
    expect(sprintSummary.health.healthScore).toBeGreaterThanOrEqual(0);
    expect(sprintSummary.health.healthScore).toBeLessThanOrEqual(100);

    expect(sprintSummary.cards).toBeDefined();
    expect(sprintSummary.cards.total).toBe(8);
    expect(sprintSummary.cards.byColumn).toBeDefined();

    expect(sprintSummary.sentiment).toBeDefined();
    expect(sprintSummary.sentiment.positiveCards).toBeGreaterThan(0);
    expect(sprintSummary.sentiment.negativeCards).toBeGreaterThan(0);
    expect(sprintSummary.sentiment.topPositiveCards).toBeDefined();
    expect(sprintSummary.sentiment.topNegativeCards).toBeDefined();

    expect(sprintSummary.participation).toBeDefined();
    expect(sprintSummary.participation.totalMembers).toBe(3);
    expect(sprintSummary.participation.activeMembers).toBe(3);
    expect(sprintSummary.participation.members.length).toBe(3);

    expect(sprintSummary.actionItems).toBeDefined();
    expect(sprintSummary.actionItems.total).toBe(3);

    expect(sprintSummary.wordCloud).toBeDefined();
    expect(Array.isArray(sprintSummary.wordCloud)).toBe(true);

    // ========== CREATE SPRINT 4 WITH NEW BOARD ==========

    const createSprint4Res = await app.request(`/api/v1/teams/${teamId}/sprints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sprint 4',
        goal: 'Sprint 4 goal',
        start_date: '2026-02-04',
        end_date: '2026-02-17',
      }),
    });
    expect(createSprint4Res.status).toBe(201);
    const { sprint: sprint4 } = await createSprint4Res.json();

    const activateSprint4Res = await app.request(
      `/api/v1/teams/${teamId}/sprints/${sprint4.id}/activate`,
      { method: 'PUT', headers: { Authorization: `Bearer ${tokenA}` } },
    );
    expect(activateSprint4Res.status).toBe(200);

    const createBoard4Res = await app.request(`/api/v1/sprints/${sprint4.id}/board`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: SYSTEM_TEMPLATE_WWD,
        anonymous_mode: false,
        max_votes_per_user: 10,
        max_votes_per_card: 5,
      }),
    });
    expect(createBoard4Res.status).toBe(201);
    const board4Body = await createBoard4Res.json();
    const board4Id = board4Body.data.id;

    // ========== TEST CARRY-OVER ==========

    const carryOverRes = await app.request(`/api/v1/boards/${board4Id}/action-items/carry-over`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(carryOverRes.status).toBe(200);
    const carryOverData = await carryOverRes.json();

    expect(carryOverData.carriedOver).toBeDefined();
    expect(carryOverData.carriedOver.length).toBe(3); // 2 open + 1 in_progress from Sprint 3
    expect(carryOverData.sourceSprintName).toBe('Sprint 3');
    expect(carryOverData.totalResolved).toBe(3);

    // Verify carried items have correct fields
    for (const item of carryOverData.carriedOver) {
      expect(item.id).toBeDefined();
      expect(item.originalId).toBeDefined();
      expect(item.originalSprintName).toBe('Sprint 3');
      expect(item.title).toBeDefined();
      expect(item.status).toBe('open'); // All carried items reset to open
      expect(['open', 'in_progress']).toContain(item.originalStatus);
    }

    // ========== TEST CARRY-OVER IDEMPOTENT ==========

    const carryOverAgainRes = await app.request(`/api/v1/boards/${board4Id}/action-items/carry-over`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(carryOverAgainRes.status).toBe(200);
    const carryOverAgainData = await carryOverAgainRes.json();

    expect(carryOverAgainData.carriedOver).toHaveLength(0);
    expect(carryOverAgainData.alreadyCarried).toBeDefined();
    expect(carryOverAgainData.alreadyCarried.length).toBe(3);
    expect(carryOverAgainData.totalAlreadyCarried).toBe(3);

    // ========== TEST TEAM ACTION ITEMS ==========

    const teamActionItemsRes = await app.request(`/api/v1/teams/${teamId}/action-items`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(teamActionItemsRes.status).toBe(200);
    const teamActionItems = await teamActionItemsRes.json();

    expect(teamActionItems.items).toBeDefined();
    expect(teamActionItems.total).toBeGreaterThan(0);
    expect(teamActionItems.summary).toBeDefined();
    expect(teamActionItems.summary.open).toBeGreaterThan(0);
    expect(teamActionItems.summary.done).toBeGreaterThan(0);

    // Verify items from different sprints are included
    const sprintIds = new Set(teamActionItems.items.map((item: { sprintId: string }) => item.sprintId));
    expect(sprintIds.size).toBeGreaterThan(1); // Should have items from multiple sprints

    // Verify carried-over items have carriedFromSprintName
    const carriedItems = teamActionItems.items.filter((item: { carriedFromSprintName: string | null }) => item.carriedFromSprintName !== null);
    expect(carriedItems.length).toBe(3);
    for (const item of carriedItems) {
      expect(item.carriedFromSprintName).toBe('Sprint 3');
      expect(item.sprintName).toBe('Sprint 4');
    }

    // ========== SUCCESS ==========
    console.log('✅ Phase 4 E2E analytics pipeline completed successfully');
  });
});
