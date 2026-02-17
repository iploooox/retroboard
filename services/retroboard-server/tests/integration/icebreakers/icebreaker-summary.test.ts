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

describe('S-007: Icebreaker Summary Endpoint', () => {
  let adminToken: string;
  let adminUser: { id: string };
  let memberToken: string;
  let memberUser: { id: string };
  let member2Token: string;
  let member2User: { id: string };
  let nonMemberToken: string;
  let team: { id: string };
  let board: { id: string };
  let icebreakerId: string;

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

    const nonMemberAuth = await getAuthToken({ email: 'nonmember@example.com', displayName: 'Non Member' });
    nonMemberToken = nonMemberAuth.token;

    team = await createTestTeam(adminUser.id);
    await addTeamMember(team.id, memberUser.id, 'member');
    await addTeamMember(team.id, member2User.id, 'member');

    const sprint = await createTestSprint(team.id, adminUser.id);
    const { board: testBoard } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'icebreaker' });
    board = testBoard;

    // Set an icebreaker on the board
    icebreakerId = '00000000-0000-4000-9001-000000000001'; // Known seeded icebreaker
    await sql`UPDATE boards SET icebreaker_id = ${icebreakerId} WHERE id = ${board.id}`;
  });

  // --- GET /api/v1/boards/:boardId/icebreaker/summary ---

  describe('GET /boards/:boardId/icebreaker/summary', () => {
    it('7.01: returns zero stats when no responses exist', async () => {
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/summary`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data).toEqual({
        responseCount: 0,
        reactionCount: 0,
        topEmoji: null,
        participantCount: 0,
      });
    });

    it('7.02: counts responses correctly', async () => {
      // Insert 3 responses from 2 different users
      await sql`
        INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content)
        VALUES
          (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Response 1'),
          (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Response 2'),
          (${board.id}, ${icebreakerId}, ${member2User.id}, 'Response 3')
      `;

      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/summary`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${memberToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.responseCount).toBe(3);
      expect(body.data.participantCount).toBe(2);
    });

    it('7.03: excludes soft-deleted responses from counts', async () => {
      // Insert 2 responses, soft-delete 1
      const [r1] = await sql`
        INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content)
        VALUES (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Active response')
        RETURNING id
      `;
      await sql`
        INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content, deleted_at)
        VALUES (${board.id}, ${icebreakerId}, ${member2User.id}, 'Deleted response', NOW())
      `;

      // Add a reaction to the active response
      await sql`
        INSERT INTO icebreaker_response_reactions (response_id, user_id, emoji)
        VALUES (${r1.id}, ${member2User.id}, 'fire')
      `;

      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/summary`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.responseCount).toBe(1);
      expect(body.data.participantCount).toBe(1); // Only active response author
      expect(body.data.reactionCount).toBe(1);
    });

    it('7.04: counts reactions and identifies top emoji', async () => {
      // Insert a response
      const [r1] = await sql`
        INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content)
        VALUES (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Great response')
        RETURNING id
      `;

      // Add multiple reactions: 3 fire, 1 heart, 1 laugh
      await sql`
        INSERT INTO icebreaker_response_reactions (response_id, user_id, emoji)
        VALUES
          (${r1.id}, ${adminUser.id}, 'fire'),
          (${r1.id}, ${memberUser.id}, 'fire'),
          (${r1.id}, ${member2User.id}, 'fire'),
          (${r1.id}, ${adminUser.id}, 'heart'),
          (${r1.id}, ${memberUser.id}, 'laugh')
      `;

      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/summary`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.reactionCount).toBe(5);
      expect(body.data.topEmoji).toBe('fire');
    });

    it('7.05: returns zero stats when board has no icebreaker set', async () => {
      // Create a board without icebreaker_id
      await sql`UPDATE boards SET icebreaker_id = NULL WHERE id = ${board.id}`;

      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/summary`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual({
        responseCount: 0,
        reactionCount: 0,
        topEmoji: null,
        participantCount: 0,
      });
    });

    it('7.06: rejects non-team-members', async () => {
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/summary`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${nonMemberToken}` },
        },
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('7.07: rejects unauthenticated requests', async () => {
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/summary`,
        { method: 'GET' },
      );

      expect(res.status).toBe(401);
    });

    it('7.08: returns 404 for non-existent board', async () => {
      const res = await app.request(
        `/api/v1/boards/00000000-0000-4000-a000-000000000999/icebreaker/summary`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      expect(res.status).toBe(404);
    });

    it('7.09: returns 400 for invalid board ID format', async () => {
      const res = await app.request(
        '/api/v1/boards/not-a-uuid/icebreaker/summary',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      expect(res.status).toBe(400);
    });

    it('7.10: works in write phase (summary is available after transition)', async () => {
      // Insert responses during icebreaker
      await sql`
        INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content)
        VALUES (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Still visible after phase change')
      `;

      // Transition to write phase
      await sql`UPDATE boards SET phase = 'write' WHERE id = ${board.id}`;

      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/summary`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.responseCount).toBe(1);
      expect(body.data.participantCount).toBe(1);
    });

    it('7.11: does not count reactions on deleted responses', async () => {
      // Insert a response, react to it, then soft-delete
      const [r1] = await sql`
        INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content)
        VALUES (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Will be deleted')
        RETURNING id
      `;

      await sql`
        INSERT INTO icebreaker_response_reactions (response_id, user_id, emoji)
        VALUES (${r1.id}, ${adminUser.id}, 'fire')
      `;

      // Soft-delete
      await sql`UPDATE icebreaker_responses SET deleted_at = NOW() WHERE id = ${r1.id}`;

      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/summary`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.responseCount).toBe(0);
      expect(body.data.reactionCount).toBe(0);
      expect(body.data.topEmoji).toBe(null);
    });
  });
});
