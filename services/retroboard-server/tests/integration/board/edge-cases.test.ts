import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  createTestCard,
  createTestVote,
  createTestGroup,
  setBoardPhase,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('Edge Cases and Boundary Tests', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
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
    team = await createTestTeam(adminUser.id);
    sprint = await createTestSprint(team.id, adminUser.id);

    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;
    await addTeamMember(team.id, memberUser.id, 'member');

    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = result.board;
    columns = result.columns;
  });

  describe('3.1 Vote Limit Edge Cases', () => {
    it('3.1.1: Vote limit of 1 — cast one vote, try second', async () => {
      // Create board with max_votes_per_user=1
      const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint Limit1' });
      const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        phase: 'vote',
        max_votes_per_user: 1,
        max_votes_per_card: 1,
      });
      const card = await createTestCard(result2.board.id, result2.columns[0].id, adminUser.id, { content: 'Card' });
      const card2 = await createTestCard(result2.board.id, result2.columns[0].id, adminUser.id, { content: 'Card 2' });

      // First vote should succeed
      const res1 = await app.request(`/api/v1/boards/${result2.board.id}/cards/${card.id}/vote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(res1.status).toBe(201);

      // Second vote should fail
      const res2 = await app.request(`/api/v1/boards/${result2.board.id}/cards/${card2.id}/vote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(res2.status).toBe(422);
      const body = await res2.json();
      expect(body.error.code).toBe('VOTE_LIMIT_REACHED');
    });

    it('3.1.2: Remove vote then re-vote up to limit', async () => {
      const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint Revote' });
      const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        phase: 'vote',
        max_votes_per_user: 1,
        max_votes_per_card: 1,
      });
      const card = await createTestCard(result2.board.id, result2.columns[0].id, adminUser.id, { content: 'Card' });
      const card2 = await createTestCard(result2.board.id, result2.columns[0].id, adminUser.id, { content: 'Card 2' });

      // Vote on card
      await app.request(`/api/v1/boards/${result2.board.id}/cards/${card.id}/vote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      // Remove vote
      await app.request(`/api/v1/boards/${result2.board.id}/cards/${card.id}/vote`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      // Should be able to vote again on a different card
      const res = await app.request(`/api/v1/boards/${result2.board.id}/cards/${card2.id}/vote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(201);
    });

    it('3.1.5: Delete card that had votes, then vote on another card', async () => {
      const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint Delete Vote' });
      const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        phase: 'vote',
        max_votes_per_user: 1,
        max_votes_per_card: 1,
      });
      const card = await createTestCard(result2.board.id, result2.columns[0].id, memberUser.id, { content: 'Card to delete' });
      const card2 = await createTestCard(result2.board.id, result2.columns[0].id, adminUser.id, { content: 'Other card' });

      // Vote on card
      await createTestVote(card.id, memberUser.id, 1);

      // Delete the card (need write or group phase for deletion via API — do direct DB delete)
      // The spec says delete is allowed in write or group phase, but votes are cast in vote phase.
      // We need to use setBoardPhase to allow deletion, then switch back.
      await setBoardPhase(result2.board.id, 'write');
      await app.request(`/api/v1/boards/${result2.board.id}/cards/${card.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });
      await setBoardPhase(result2.board.id, 'vote');

      // Should be able to vote on card2 (freed vote slot)
      const res = await app.request(`/api/v1/boards/${result2.board.id}/cards/${card2.id}/vote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(201);
    });
  });

  describe('3.2 Anonymous Mode Edge Cases', () => {
    it('3.2.1: Anon mode — card creator sees their own author_id', async () => {
      // Create board with anonymous mode in write phase
      const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint Anon' });
      const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        anonymous_mode: true,
      });

      // Member creates a card
      const addRes = await app.request(`/api/v1/boards/${result2.board.id}/cards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          column_id: result2.columns[0].id,
          content: 'My anonymous card',
        }),
      });

      expect(addRes.status).toBe(201);
      const body = await addRes.json();
      // Creator should see their own author_id
      expect(body.data.author_id).toBe(memberUser.id);
    });

    it('3.2.2: Anon mode — other member sees null author_id on GET board', async () => {
      const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint Anon2' });
      const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        anonymous_mode: true,
      });
      await createTestCard(result2.board.id, result2.columns[0].id, adminUser.id, { content: 'Admin anon card' });

      // Member fetches board
      const res = await app.request(`/api/v1/sprints/${sprint2.id}/board`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const cards = body.data.columns[0].cards;
      expect(cards.length).toBeGreaterThanOrEqual(1);
      // Member should NOT see admin's author_id
      const adminCard = cards.find((c: any) => c.content === 'Admin anon card');
      expect(adminCard.author_id).toBeNull();
      expect(adminCard.author_name).toBeNull();
    });

    it('3.2.3: Anon mode — admin sees all author_ids on GET board', async () => {
      const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint Anon3' });
      const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, {
        anonymous_mode: true,
      });
      await createTestCard(result2.board.id, result2.columns[0].id, memberUser.id, { content: 'Member anon card' });

      // Admin fetches board
      const res = await app.request(`/api/v1/sprints/${sprint2.id}/board`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const cards = body.data.columns[0].cards;
      expect(cards.length).toBeGreaterThanOrEqual(1);
      // Admin should see all author_ids
      const memberCard = cards.find((c: any) => c.content === 'Member anon card');
      expect(memberCard.author_id).toBe(memberUser.id);
    });
  });

  describe('3.3 Phase Restriction Edge Cases', () => {
    it('3.3.1: Add card then advance to group — cards persist, no new card creation', async () => {
      // Add card in write phase
      const addRes = await app.request(`/api/v1/boards/${board.id}/cards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          column_id: columns[0].id,
          content: 'Card before group phase',
        }),
      });
      expect(addRes.status).toBe(201);

      // Advance to group
      await app.request(`/api/v1/boards/${board.id}/phase`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'group' }),
      });

      // Try adding a card in group phase — should fail
      const res = await app.request(`/api/v1/boards/${board.id}/cards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          column_id: columns[0].id,
          content: 'Card during group phase',
        }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('INVALID_PHASE');
    });

    it('3.3.3: Cast votes then go back to group then forward to vote — votes preserved', async () => {
      // Set up: create card, move to vote, cast vote
      const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Vote target' });
      await setBoardPhase(board.id, 'vote');
      await createTestVote(card.id, memberUser.id, 1);

      // Go back to group
      await app.request(`/api/v1/boards/${board.id}/phase`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'group' }),
      });

      // Back to vote
      await app.request(`/api/v1/boards/${board.id}/phase`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'vote' }),
      });

      // Fetch board and check votes preserved
      const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const cards = body.data.columns.flatMap((c: any) => c.cards);
      const votedCard = cards.find((c: any) => c.id === card.id);
      expect(votedCard.vote_count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3.4 Card Ownership Validation', () => {
    it('3.4.1: User edits card they authored', async () => {
      const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'My card' });

      const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'My edited card' }),
      });

      expect(res.status).toBe(200);
    });

    it('3.4.2: User edits card authored by another user', async () => {
      const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Admin card' });

      const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Hijacked' }),
      });

      expect(res.status).toBe(403);
    });

    it('3.4.3: Admin edits any card', async () => {
      const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Member card' });

      const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Admin override' }),
      });

      expect(res.status).toBe(200);
    });

    it('3.4.4: Facilitator edits any card', async () => {
      const facilitatorAuth = await getAuthToken({ email: 'facilitator@example.com', displayName: 'Facilitator' });
      await addTeamMember(team.id, facilitatorAuth.user.id, 'facilitator');
      const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Member card' });

      const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${facilitatorAuth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Facilitator override' }),
      });

      expect(res.status).toBe(200);
    });

    it('3.4.5: User deletes card they authored', async () => {
      const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'My card' });

      const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
    });

    it('3.4.6: User deletes card authored by another user', async () => {
      const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Admin card' });

      const res = await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(403);
    });
  });

  describe('3.6 Data Integrity', () => {
    it('3.6.3: Card in group that gets deleted — group_members row removed', async () => {
      await setBoardPhase(board.id, 'group');
      const card = await createTestCard(board.id, columns[0].id, memberUser.id, { content: 'Grouped card' });
      const group = await createTestGroup(board.id, 'Test Group', [card.id]);

      // Delete the card
      await setBoardPhase(board.id, 'write');
      await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      // Fetch the board to check group no longer references the card
      await setBoardPhase(board.id, 'group');
      const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const groupData = body.data.groups.find((g: any) => g.id === group.id);
      if (groupData) {
        expect(groupData.card_ids).not.toContain(card.id);
      }
    });
  });
});
