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
import { clearResponseRateLimit } from '../../../src/routes/icebreakers.js';

const app = createTestApp();

describe('S-003: Icebreaker Response Wall', () => {
  let adminToken: string;
  let adminUser: { id: string };
  let memberToken: string;
  let memberUser: { id: string };
  let facilitatorToken: string;
  let facilitatorUser: { id: string };
  let team: { id: string };
  let board: { id: string };
  let icebreakerId: string;

  beforeEach(async () => {
    await truncateTables();
    await seed();
    clearResponseRateLimit();

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
    const { board: testBoard } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { phase: 'icebreaker' });
    board = testBoard;

    // Set an icebreaker on the board
    icebreakerId = '00000000-0000-4000-9001-000000000001'; // Known seeded icebreaker
    await sql`UPDATE boards SET icebreaker_id = ${icebreakerId} WHERE id = ${board.id}`;
  });

  // --- POST /api/v1/boards/:boardId/icebreaker/responses ---

  describe('POST /boards/:boardId/icebreaker/responses', () => {
    it('3.01: submits a response successfully', async () => {
      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'I love pizza!' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.content).toBe('I love pizza!');
      expect(body.data.created_at).toBeDefined();
      // No author_id in response
      expect(body.data.author_id).toBeUndefined();
    });

    it('3.02: rejects empty content', async () => {
      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: '' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('3.03: rejects whitespace-only content', async () => {
      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: '   \n\t  ' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('3.04: rejects content over 280 characters', async () => {
      const longContent = 'a'.repeat(281);
      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: longContent }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('3.05: rejects non-team-member', async () => {
      const outsiderAuth = await getAuthToken({ email: 'outsider@example.com' });

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${outsiderAuth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Outsider response' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('3.06: rejects when board is not in icebreaker phase', async () => {
      await setBoardPhase(board.id, 'write');

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Wrong phase' }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('INVALID_PHASE');
    });

    it('3.07: stores author_id in database but does not expose it', async () => {
      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Secret identity' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();

      // Check DB has author_id
      const [dbRow] = await sql`
        SELECT author_id FROM icebreaker_responses WHERE id = ${body.data.id}
      `;
      expect(dbRow.author_id).toBe(memberUser.id);

      // API response does NOT have author_id
      expect(body.data.author_id).toBeUndefined();
    });

    it('3.08: trims whitespace from content', async () => {
      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: '  Hello World!  ' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.content).toBe('Hello World!');
    });

    it('3.09: allows multiple responses from the same user (with rate limit clearance)', async () => {
      const res1 = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'First response' }),
      });
      expect(res1.status).toBe(201);

      // Clear rate limit for 2nd request
      clearResponseRateLimit();

      const res2 = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Second response' }),
      });
      expect(res2.status).toBe(201);
    });

    it('3.10: rate limits 2nd request within 2 seconds', async () => {
      const res1 = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'First response' }),
      });
      expect(res1.status).toBe(201);

      // Immediately submit a second response (no clearResponseRateLimit)
      const res2 = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Too fast!' }),
      });
      expect(res2.status).toBe(429);
      const body = await res2.json();
      expect(body.error.code).toBe('RATE_LIMITED');
    });

    it('3.11: rejects when no icebreaker is set on the board', async () => {
      await sql`UPDATE boards SET icebreaker_id = NULL WHERE id = ${board.id}`;

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'No question set' }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('NO_ICEBREAKER');
    });
  });

  // --- GET /api/v1/boards/:boardId/icebreaker/responses ---

  describe('GET /boards/:boardId/icebreaker/responses', () => {
    it('3.20: returns all non-deleted responses ordered by created_at', async () => {
      // Insert responses directly
      await sql`
        INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content, created_at)
        VALUES
          (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Response A', NOW() - interval '2 minutes'),
          (${board.id}, ${icebreakerId}, ${adminUser.id}, 'Response B', NOW() - interval '1 minute'),
          (${board.id}, ${icebreakerId}, ${facilitatorUser.id}, 'Response C', NOW())
      `;

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.responses).toHaveLength(3);
      expect(body.data.count).toBe(3);

      // Ordered by created_at ASC
      expect(body.data.responses[0].content).toBe('Response A');
      expect(body.data.responses[1].content).toBe('Response B');
      expect(body.data.responses[2].content).toBe('Response C');
    });

    it('3.21: does NOT include author_id in responses', async () => {
      await sql`
        INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content)
        VALUES (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Anonymous response')
      `;

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.responses).toHaveLength(1);

      const response = body.data.responses[0];
      expect(response.id).toBeDefined();
      expect(response.content).toBe('Anonymous response');
      expect(response.created_at).toBeDefined();
      expect(response.author_id).toBeUndefined();
    });

    it('3.22: excludes soft-deleted responses', async () => {
      await sql`
        INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content, deleted_at)
        VALUES
          (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Visible', NULL),
          (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Deleted', NOW())
      `;

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.responses).toHaveLength(1);
      expect(body.data.responses[0].content).toBe('Visible');
    });

    it('3.23: only returns responses for current icebreaker_id', async () => {
      const otherIcebreakerId = '00000000-0000-4000-9001-000000000002';

      await sql`
        INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content)
        VALUES
          (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Current question response'),
          (${board.id}, ${otherIcebreakerId}, ${memberUser.id}, 'Old question response')
      `;

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.responses).toHaveLength(1);
      expect(body.data.responses[0].content).toBe('Current question response');
    });

    it('3.24: rejects non-team-member', async () => {
      const outsiderAuth = await getAuthToken({ email: 'outsider2@example.com' });

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${outsiderAuth.token}` },
      });

      expect(res.status).toBe(403);
    });

    it('3.25: returns empty list when no icebreaker set', async () => {
      await sql`UPDATE boards SET icebreaker_id = NULL WHERE id = ${board.id}`;

      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.responses).toHaveLength(0);
      expect(body.data.count).toBe(0);
    });
  });

  // --- DELETE /api/v1/boards/:boardId/icebreaker/responses/:responseId ---

  describe('DELETE /boards/:boardId/icebreaker/responses/:responseId', () => {
    let responseId: string;

    beforeEach(async () => {
      const [inserted] = await sql`
        INSERT INTO icebreaker_responses (board_id, icebreaker_id, author_id, content)
        VALUES (${board.id}, ${icebreakerId}, ${memberUser.id}, 'Inappropriate content')
        RETURNING id
      `;
      responseId = inserted.id as string;
    });

    it('3.30: facilitator can soft-delete a response', async () => {
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${facilitatorToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe(responseId);
      expect(body.data.deleted).toBe(true);

      // Verify soft-deleted in DB
      const [dbRow] = await sql`
        SELECT deleted_at FROM icebreaker_responses WHERE id = ${responseId}
      `;
      expect(dbRow.deleted_at).not.toBeNull();
    });

    it('3.31: admin can soft-delete a response', async () => {
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` },
        },
      );

      expect(res.status).toBe(200);
    });

    it('3.32: regular member CANNOT delete a response', async () => {
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${memberToken}` },
        },
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('3.33: deleted response no longer appears in GET', async () => {
      // Delete it
      await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${facilitatorToken}` },
        },
      );

      // Fetch responses
      const res = await app.request(`/api/v1/boards/${board.id}/icebreaker/responses`, {
        headers: { 'Authorization': `Bearer ${memberToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.responses).toHaveLength(0);
    });

    it('3.34: returns 404 for non-existent response', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999';
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${fakeId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${facilitatorToken}` },
        },
      );

      expect(res.status).toBe(404);
    });

    it('3.35: double-delete returns 404 (already deleted)', async () => {
      // Delete once
      await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${facilitatorToken}` },
        },
      );

      // Delete again
      const res = await app.request(
        `/api/v1/boards/${board.id}/icebreaker/responses/${responseId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${facilitatorToken}` },
        },
      );

      expect(res.status).toBe(404);
    });
  });
});
