import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../../../src/db/connection.js';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  createTestSprint,
  createTestBoard,
  addTeamMember,
  setBoardPhase,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('S-005: Icebreaker Response Reactions', () => {
  let adminToken: string;
  let adminUser: { id: string };
  let memberToken: string;
  let memberUser: { id: string };
  let member2Token: string;
  let member2User: { id: string };
  let team: { id: string };
  let board: { id: string };
  let icebreakerId: string;
  let responseId: string;

  beforeEach(async () => {
    await truncateTables();
    await seed();

    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;

    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;

    const member2Auth = await getAuthToken({ email: 'member2@example.com', displayName: 'Member 2' });
    member2Token = member2Auth.token;
    member2User = member2Auth.user;

    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');
    await addTeamMember(team.id, member2User.id, 'member');

    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board: testBoard } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'icebreaker' });
    board = testBoard;

    // Set an icebreaker on the board
    icebreakerId = '00000000-0000-4000-9001-000000000001'; // Known seeded icebreaker
    await sql`UPDATE boards SET icebreaker_id = ${icebreakerId} WHERE id = ${board.id}`;

    // Insert a response for reactions
    const [inserted] = await sql`
      INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content)
      VALUES (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Test response for reactions')
      RETURNING id
    `;
    responseId = inserted.id as string;
  });

  // --- POST /api/v1/boards/:boardId/icebreaker/responses/:responseId/reactions ---

  describe('POST /boards/:boardId/icebreaker/responses/:responseId/reactions', () => {
    it('5.01: adds a reaction successfully (toggle on)', async () => {
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.action).toBe('added');
      expect(body.data.emoji).toBe('fire');
      expect(body.data.count).toBe(1);
    });

    it('5.02: removes a reaction on second toggle (toggle off)', async () => {
      // First: add reaction
      await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );

      // Second: remove reaction
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.action).toBe('removed');
      expect(body.data.emoji).toBe('fire');
      expect(body.data.count).toBe(0);
    });

    it('5.03: same emoji twice = toggle (unique constraint honored)', async () => {
      // Add
      const res1 = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'laugh' }),
        },
      );
      expect((await res1.json()).data.action).toBe('added');

      // Remove
      const res2 = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'laugh' }),
        },
      );
      expect((await res2.json()).data.action).toBe('removed');

      // Add again
      const res3 = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'laugh' }),
        },
      );
      expect((await res3.json()).data.action).toBe('added');
    });

    it('5.04: different emojis on same response both exist', async () => {
      // Add fire
      const res1 = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );
      expect((await res1.json()).data.action).toBe('added');

      // Add laugh
      const res2 = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'laugh' }),
        },
      );
      expect((await res2.json()).data.action).toBe('added');

      // Verify both exist in DB
      const reactions = await sql`
        SELECT emoji FROM icebreaker_response_reactions
        WHERE response_id = ${responseId} AND user_id = ${memberUser.id}
        ORDER BY emoji
      `;
      expect(reactions).toHaveLength(2);
      expect(reactions.map((r) => r.emoji)).toEqual(['fire', 'laugh']);
    });

    it('5.05: invalid emoji is rejected', async () => {
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'thumbsup' }),
        },
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('5.06: non-team-member is rejected', async () => {
      const outsiderAuth = await getAuthToken({ email: 'outsider-reactions@example.com' });

      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${outsiderAuth.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('5.07: wrong phase is rejected', async () => {
      await setBoardPhase(board.id, 'write');

      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('INVALID_PHASE');
    });

    it('5.08: reaction on deleted response returns 404', async () => {
      // Soft-delete the response
      await sql`UPDATE icebreaker_responses SET deleted_at = NOW() WHERE id = ${responseId}`;

      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );

      expect(res.status).toBe(404);
    });

    it('5.09: multiple users can react with same emoji, count is correct', async () => {
      // Member 1 reacts
      await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );

      // Member 2 reacts
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${member2Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.count).toBe(2);

      // Admin also reacts
      const res3 = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );

      expect(res3.status).toBe(200);
      const body3 = await res3.json();
      expect(body3.data.count).toBe(3);
    });
  });

  // --- GET /boards/:boardId/icebreaker/responses (with reactions) ---

  describe('GET /boards/:boardId/icebreaker/responses (reaction data)', () => {
    it('5.20: GET includes reaction counts per emoji', async () => {
      // Add reactions from multiple users
      await sql`
        INSERT INTO icebreaker_response_reactions (response_id, user_id, emoji) VALUES
          (${responseId}, ${memberUser.id}, 'fire'),
          (${responseId}, ${member2User.id}, 'fire'),
          (${responseId}, ${adminUser.id}, 'laugh')
      `;

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.responses).toHaveLength(1);

      const response = body.data.responses[0];
      expect(response.reactions).toEqual({ fire: 2, laugh: 1 });
    });

    it('5.21: GET includes myReactions for current user', async () => {
      // Member has reacted with fire and laugh
      await sql`
        INSERT INTO icebreaker_response_reactions (response_id, user_id, emoji) VALUES
          (${responseId}, ${memberUser.id}, 'fire'),
          (${responseId}, ${memberUser.id}, 'laugh'),
          (${responseId}, ${member2User.id}, 'heart')
      `;

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const response = body.data.responses[0];

      expect(response.myReactions).toHaveLength(2);
      expect(response.myReactions).toContain('fire');
      expect(response.myReactions).toContain('laugh');
    });

    it('5.22: GET returns empty reactions for response with no reactions', async () => {
      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const response = body.data.responses[0];

      expect(response.reactions).toEqual({});
      expect(response.myReactions).toEqual([]);
    });

    it('5.23: GET only shows emojis with count > 0', async () => {
      // Add then remove a reaction (no reactions left)
      await sql`
        INSERT INTO icebreaker_response_reactions (response_id, user_id, emoji)
        VALUES (${responseId}, ${memberUser.id}, 'fire')
      `;
      await sql`
        DELETE FROM icebreaker_response_reactions
        WHERE response_id = ${responseId} AND user_id = ${memberUser.id} AND emoji = 'fire'
      `;

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const response = body.data.responses[0];

      // No 'fire: 0' — just empty
      expect(response.reactions).toEqual({});
    });

    it('5.24: myReactions differ per user', async () => {
      await sql`
        INSERT INTO icebreaker_response_reactions (response_id, user_id, emoji) VALUES
          (${responseId}, ${memberUser.id}, 'fire'),
          (${responseId}, ${member2User.id}, 'heart')
      `;

      // Member 1 sees their own reactions
      const res1 = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });
      const body1 = await res1.json();
      expect(body1.data.responses[0].myReactions).toEqual(['fire']);

      // Member 2 sees their own reactions
      const res2 = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${member2Token}` },
      });
      const body2 = await res2.json();
      expect(body2.data.responses[0].myReactions).toEqual(['heart']);
    });
  });

  // --- Cascade delete ---

  describe('Cascade delete', () => {
    it('5.30: reactions are deleted when response is hard-deleted', async () => {
      // Add some reactions
      await sql`
        INSERT INTO icebreaker_response_reactions (response_id, user_id, emoji) VALUES
          (${responseId}, ${memberUser.id}, 'fire'),
          (${responseId}, ${member2User.id}, 'laugh')
      `;

      // Hard-delete the response (ON DELETE CASCADE on FK)
      await sql`DELETE FROM icebreaker_responses WHERE id = ${responseId}`;

      // Verify reactions are gone
      const reactions = await sql`
        SELECT * FROM icebreaker_response_reactions WHERE response_id = ${responseId}
      `;
      expect(reactions).toHaveLength(0);
    });
  });

  // --- Validation edge cases ---

  describe('Validation edge cases', () => {
    it('5.40: empty body is rejected', async () => {
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
      );

      expect(res.status).toBe(400);
    });

    it('5.41: non-existent response returns 404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999';
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${fakeId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );

      expect(res.status).toBe(404);
    });

    it('5.42: invalid board ID format is rejected', async () => {
      const res = await app.request(
        `/api/v1/boards/not-a-uuid/icebreaker/responses/${responseId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${memberToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'fire' }),
        },
      );

      expect(res.status).toBe(400);
    });

    it('5.43: all 6 valid emojis are accepted', async () => {
      const emojis = ['laugh', 'fire', 'heart', 'bullseye', 'clap', 'skull'];

      for (const emoji of emojis) {
        const res = await app.request(
          `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}/reactions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${memberToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ emoji }),
          },
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.action).toBe('added');
        expect(body.data.emoji).toBe(emoji);
      }

      // Verify all 6 exist in DB
      const reactions = await sql`
        SELECT emoji FROM icebreaker_response_reactions
        WHERE response_id = ${responseId} AND user_id = ${memberUser.id}
        ORDER BY emoji
      `;
      expect(reactions).toHaveLength(6);
    });
  });
});
