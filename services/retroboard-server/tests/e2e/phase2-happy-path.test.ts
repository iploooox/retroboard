import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../src/server.js';
import { truncateTables } from '../helpers/db.js';
import { seed } from '../../src/db/seed.js';

/**
 * E2E: Phase 2 Happy Path
 *
 * Full retro ceremony flow:
 *  1. Register two users (Alice as admin, Bob as member)
 *  2. Create team, invite Bob, create & activate sprint
 *  3. Create board from template
 *  4. Add cards in write phase
 *  5. Edit a card
 *  6. Transition to group phase, group related cards
 *  7. Transition to vote phase, cast votes
 *  8. Transition to discuss phase, set focus on a card
 *  9. Transition to action phase, create action items
 * 10. Verify full board state
 * 11. Update action item status
 * 12. Verify team-wide action items
 */
describe('E2E: Phase 2 Happy Path — Full Retro Ceremony', () => {
  beforeAll(async () => {
    await truncateTables();
    await seed(process.env.DATABASE_URL);
  });

  it('runs a complete retro from board creation through action items', async () => {
    // ---- Step 1: Register Alice ----
    const regA = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice-e2e@example.com',
        password: 'SecurePass1',
        display_name: 'Alice E2E',
      }),
    });
    expect(regA.status).toBe(201);
    const userA = await regA.json();
    const tokenA = userA.access_token;

    // ---- Step 2: Register Bob ----
    const regB = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob-e2e@example.com',
        password: 'SecurePass1',
        display_name: 'Bob E2E',
      }),
    });
    expect(regB.status).toBe(201);
    const userB = await regB.json();
    const tokenB = userB.access_token;

    // ---- Step 3: Alice creates a team ----
    const createTeamRes = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Retro Team' }),
    });
    expect(createTeamRes.status).toBe(201);
    const { team } = await createTeamRes.json();

    // ---- Step 4: Alice invites Bob ----
    const inviteRes = await app.request(`/api/v1/teams/${team.id}/invitations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(inviteRes.status).toBe(201);
    const { invitation } = await inviteRes.json();

    const joinRes = await app.request(`/api/v1/teams/join/${invitation.code}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(joinRes.status).toBe(200);

    // ---- Step 5: Alice creates and activates a sprint ----
    const createSprintRes = await app.request(`/api/v1/teams/${team.id}/sprints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sprint 1',
        goal: 'Ship MVP',
        start_date: '2026-03-01',
        end_date: '2026-03-14',
      }),
    });
    expect(createSprintRes.status).toBe(201);
    const { sprint } = await createSprintRes.json();

    const activateRes = await app.request(
      `/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`,
      { method: 'PUT', headers: { Authorization: `Bearer ${tokenA}` } },
    );
    expect(activateRes.status).toBe(200);

    // ---- Step 6: Create board from "What Went Well / Delta" template ----
    const templateId = '00000000-0000-4000-8000-000000000001'; // WWW/Delta seed template

    const createBoardRes = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: templateId,
        max_votes_per_user: 5,
        max_votes_per_card: 3,
      }),
    });
    expect(createBoardRes.status).toBe(201);
    const boardBody = await createBoardRes.json();
    expect(boardBody.ok).toBe(true);
    const board = boardBody.data;
    expect(board.phase).toBe('write');
    expect(board.columns).toHaveLength(2);

    const boardId = board.id;
    const wwwColumnId = board.columns[0].id; // "What Went Well"
    const deltaColumnId = board.columns[1].id; // "Delta"

    // ---- Step 7: Alice adds cards to "What Went Well" column ----
    const addCard = async (token: string, columnId: string, content: string) => {
      const res = await app.request(`/api/v1/boards/${boardId}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: columnId, content }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      return body.data;
    };

    const cardA1 = await addCard(tokenA, wwwColumnId, 'Great team collaboration this sprint');
    const cardA2 = await addCard(tokenA, wwwColumnId, 'CI/CD pipeline improvements shipped');
    const cardA3 = await addCard(tokenA, deltaColumnId, 'Too many meetings');

    // ---- Step 8: Bob adds cards ----
    const cardB1 = await addCard(tokenB, wwwColumnId, 'Pair programming sessions were helpful');
    const cardB2 = await addCard(tokenB, deltaColumnId, 'Stand-ups running too long');
    const cardB3 = await addCard(tokenB, deltaColumnId, 'Need better documentation');

    expect(cardA1.content).toBe('Great team collaboration this sprint');
    expect(cardB2.content).toBe('Stand-ups running too long');

    // ---- Step 9: Alice edits a card ----
    const editRes = await app.request(`/api/v1/boards/${boardId}/cards/${cardA1.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Great team collaboration and communication this sprint' }),
    });
    expect(editRes.status).toBe(200);
    const editBody = await editRes.json();
    expect(editBody.data.content).toBe('Great team collaboration and communication this sprint');

    // ---- Step 10: Transition to group phase ----
    const toGroup = await app.request(`/api/v1/boards/${boardId}/phase`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'group' }),
    });
    expect(toGroup.status).toBe(200);
    const groupPhaseBody = await toGroup.json();
    expect(groupPhaseBody.data.phase).toBe('group');
    expect(groupPhaseBody.data.previous_phase).toBe('write');

    // ---- Step 11: Alice groups related "Delta" cards about meetings ----
    const createGroupRes = await app.request(`/api/v1/boards/${boardId}/groups`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Meeting Issues',
        card_ids: [cardA3.id, cardB2.id],
      }),
    });
    expect(createGroupRes.status).toBe(201);
    const groupBody = await createGroupRes.json();
    const group = groupBody.data;
    expect(group.title).toBe('Meeting Issues');
    expect(group.card_ids).toHaveLength(2);
    expect(group.card_ids).toContain(cardA3.id);
    expect(group.card_ids).toContain(cardB2.id);

    // ---- Step 12: Transition to vote phase ----
    const toVote = await app.request(`/api/v1/boards/${boardId}/phase`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'vote' }),
    });
    expect(toVote.status).toBe(200);
    const votePhaseBody = await toVote.json();
    expect(votePhaseBody.data.phase).toBe('vote');

    // ---- Step 13: Alice and Bob vote on cards ----
    const castVote = async (token: string, cardId: string) => {
      const res = await app.request(`/api/v1/boards/${boardId}/cards/${cardId}/vote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(201);
      return (await res.json()).data;
    };

    // Alice votes on collaboration card (2 votes) and pair programming
    await castVote(tokenA, cardA1.id);
    await castVote(tokenA, cardA1.id); // second vote on same card
    await castVote(tokenA, cardB1.id);

    // Bob votes on collaboration card and meeting issues
    await castVote(tokenB, cardA1.id);
    await castVote(tokenB, cardA3.id);
    await castVote(tokenB, cardB2.id);

    // ---- Step 14: Verify board state with vote counts ----
    const getBoardRes = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(getBoardRes.status).toBe(200);
    const fullBoard = (await getBoardRes.json()).data;

    expect(fullBoard.phase).toBe('vote');
    expect(fullBoard.columns).toHaveLength(2);
    expect(fullBoard.user_votes_remaining).toBe(2); // Alice used 3 of 5

    // Find collaboration card in the response and verify vote count
    const wwwCards = fullBoard.columns[0].cards;
    const collabCard = wwwCards.find((c: { id: string }) => c.id === cardA1.id);
    expect(collabCard.vote_count).toBe(3); // 2 from Alice + 1 from Bob

    // Verify group exists with cards
    expect(fullBoard.groups).toHaveLength(1);
    expect(fullBoard.groups[0].title).toBe('Meeting Issues');

    // ---- Step 15: Transition to discuss phase ----
    const toDiscuss = await app.request(`/api/v1/boards/${boardId}/phase`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'discuss' }),
    });
    expect(toDiscuss.status).toBe(200);
    expect((await toDiscuss.json()).data.phase).toBe('discuss');

    // ---- Step 16: Set focus on the top-voted card ----
    const setFocusRes = await app.request(`/api/v1/boards/${boardId}/focus`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ focus_item_id: cardA1.id, focus_item_type: 'card' }),
    });
    expect(setFocusRes.status).toBe(200);
    const focusBody = await setFocusRes.json();
    expect(focusBody.data.focus_item_id).toBe(cardA1.id);
    expect(focusBody.data.focus_item_type).toBe('card');

    // ---- Step 17: Transition to action phase ----
    const toAction = await app.request(`/api/v1/boards/${boardId}/phase`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'action' }),
    });
    expect(toAction.status).toBe(200);
    expect((await toAction.json()).data.phase).toBe('action');

    // ---- Step 18: Create action items ----
    const createAI = async (token: string, data: Record<string, unknown>) => {
      const res = await app.request(`/api/v1/boards/${boardId}/action-items`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      expect(res.status).toBe(201);
      return await res.json();
    };

    // Alice creates action item linked to the meeting card
    const ai1 = await createAI(tokenA, {
      title: 'Reduce stand-up to 10 minutes max',
      description: 'Use parking lot for long discussions',
      cardId: cardA3.id,
      assigneeId: userA.user.id,
      dueDate: '2026-03-20',
    });
    expect(ai1.title).toBe('Reduce stand-up to 10 minutes max');
    expect(ai1.status).toBe('open');
    expect(ai1.assigneeId).toBe(userA.user.id);

    // Bob creates action item for documentation
    const ai2 = await createAI(tokenB, {
      title: 'Create onboarding documentation',
      cardId: cardB3.id,
      assigneeId: userB.user.id,
      dueDate: '2026-03-25',
    });
    expect(ai2.title).toBe('Create onboarding documentation');

    // ---- Step 19: List action items for the board ----
    const listAIRes = await app.request(`/api/v1/boards/${boardId}/action-items`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(listAIRes.status).toBe(200);
    const listAIBody = await listAIRes.json();
    expect(listAIBody.items).toHaveLength(2);
    expect(listAIBody.total).toBe(2);

    // ---- Step 20: Update action item status to in_progress ----
    const updateAIRes = await app.request(`/api/v1/action-items/${ai1.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    expect(updateAIRes.status).toBe(200);
    const updatedAI = await updateAIRes.json();
    expect(updatedAI.status).toBe('in_progress');

    // ---- Step 21: Complete the action item ----
    const completeAIRes = await app.request(`/api/v1/action-items/${ai1.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    expect(completeAIRes.status).toBe(200);
    expect((await completeAIRes.json()).status).toBe('done');

    // ---- Step 22: Verify team-wide action items ----
    const teamAIRes = await app.request(`/api/v1/teams/${team.id}/action-items`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(teamAIRes.status).toBe(200);
    const teamAIBody = await teamAIRes.json();
    expect(teamAIBody.items).toHaveLength(2);
    expect(teamAIBody.summary).toBeDefined();

    // Verify summary counts
    const doneCount = teamAIBody.items.filter((i: { status: string }) => i.status === 'done').length;
    const openCount = teamAIBody.items.filter((i: { status: string }) => i.status === 'open').length;
    expect(doneCount).toBe(1);
    expect(openCount).toBe(1);

    // ---- Step 23: Final board state verification ----
    const finalBoardRes = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(finalBoardRes.status).toBe(200);
    const finalBoard = (await finalBoardRes.json()).data;

    expect(finalBoard.phase).toBe('action');
    expect(finalBoard.columns).toHaveLength(2);
    expect(finalBoard.groups).toHaveLength(1);

    // Total cards: 6 (3 from Alice, 3 from Bob)
    const totalCards = finalBoard.columns.reduce(
      (sum: number, col: { cards: unknown[] }) => sum + col.cards.length,
      0,
    );
    expect(totalCards).toBe(6);
  });
});
