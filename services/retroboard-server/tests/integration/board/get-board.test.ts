import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  createTestCard,
  createTestGroup,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { sql } from '../../../src/db/connection.js';

const app = createTestApp();

describe('GET /api/v1/sprints/:sprintId/board — Get Board', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: Record<string, unknown>;
  let columns: Record<string, unknown>[];

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
    sprint = await createTestSprint(team.id, adminUser.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = result.board;
    columns = result.columns;
  });

  it('2.2.1: Get board with no cards', async () => {
    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(board.id);
    expect(body.data.columns).toHaveLength(2);
    expect(body.data.columns[0].cards).toHaveLength(0);
    expect(body.data.columns[1].cards).toHaveLength(0);
  });

  it('2.2.2: Get board with cards in multiple columns', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Card A' });
    await createTestCard(board.id as string, columns[1].id as string, memberUser.id, { content: 'Card B' });

    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.columns[0].cards).toHaveLength(1);
    expect(body.data.columns[0].cards[0].content).toBe('Card A');
    expect(body.data.columns[1].cards).toHaveLength(1);
    expect(body.data.columns[1].cards[0].content).toBe('Card B');
  });

  it('2.2.3: Get board with votes', async () => {
    const card = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Voted card' });
    await sql`INSERT INTO card_votes (card_id, user_id, vote_number) VALUES (${card.id}, ${adminUser.id}, 1)`;
    await sql`INSERT INTO card_votes (card_id, user_id, vote_number) VALUES (${card.id}, ${memberUser.id}, 1)`;

    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.data.columns[0].cards[0].vote_count).toBe(2);
    expect(body.data.columns[0].cards[0].user_votes).toBe(1); // admin's votes
  });

  it('2.2.4: Get board with groups', async () => {
    const card1 = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Card 1' });
    const card2 = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Card 2' });
    await createTestGroup(board.id as string, 'Test Group', [card1.id, card2.id]);

    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.data.groups).toHaveLength(1);
    expect(body.data.groups[0].title).toBe('Test Group');
    expect(body.data.groups[0].card_ids).toHaveLength(2);
  });

  it('2.2.5: Get board with anonymous_mode=true as regular member', async () => {
    // Create board with anon mode
    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2', status: 'planning' });
    const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { anonymous_mode: true });
    await createTestCard(result2.board.id as string, result2.columns[0].id as string, adminUser.id, { content: 'Anon card' });

    const res = await app.request(`/api/v1/sprints/${sprint2.id}/board`, {
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    const body = await res.json();
    expect(body.data.columns[0].cards[0].author_id).toBeNull();
    expect(body.data.columns[0].cards[0].author_name).toBeNull();
  });

  it('2.2.6: Get board with anonymous_mode=true as admin', async () => {
    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2', status: 'planning' });
    const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { anonymous_mode: true });
    await createTestCard(result2.board.id as string, result2.columns[0].id as string, memberUser.id, { content: 'Anon card' });

    const res = await app.request(`/api/v1/sprints/${sprint2.id}/board`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    // Admin should see author info even in anon mode
    expect(body.data.columns[0].cards[0].author_id).toBe(memberUser.id);
    expect(body.data.columns[0].cards[0].author_name).toBe('Member User');
  });

  it('2.2.7: Get board with anonymous_mode=true as facilitator', async () => {
    const facAuth = await getAuthToken({ email: 'fac@example.com', displayName: 'Facilitator' });
    await addTeamMember(team.id, facAuth.user.id, 'facilitator');

    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2', status: 'planning' });
    const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id, { anonymous_mode: true });
    await createTestCard(result2.board.id as string, result2.columns[0].id as string, memberUser.id, { content: 'Anon card' });

    const res = await app.request(`/api/v1/sprints/${sprint2.id}/board`, {
      headers: { 'Authorization': `Bearer ${facAuth.token}` },
    });

    const body = await res.json();
    expect(body.data.columns[0].cards[0].author_id).toBe(memberUser.id);
  });

  it('2.2.8: Get board for sprint with no board', async () => {
    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2', status: 'planning' });

    const res = await app.request(`/api/v1/sprints/${sprint2.id}/board`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('BOARD_NOT_FOUND');
  });

  it('2.2.9: user_votes_remaining is correct', async () => {
    const card = await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Card' });
    await sql`INSERT INTO card_votes (card_id, user_id, vote_number) VALUES (${card.id}, ${adminUser.id}, 1)`;
    await sql`INSERT INTO card_votes (card_id, user_id, vote_number) VALUES (${card.id}, ${adminUser.id}, 2)`;

    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.data.user_total_votes_cast).toBe(2);
    expect(body.data.user_votes_remaining).toBe(3); // 5 - 2
  });

  it('2.2.10: Cards ordered by position within columns', async () => {
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'First', position: 0 });
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Second', position: 1 });
    await createTestCard(board.id as string, columns[0].id as string, adminUser.id, { content: 'Third', position: 2 });

    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    const cards = body.data.columns[0].cards;
    expect(cards[0].content).toBe('First');
    expect(cards[1].content).toBe('Second');
    expect(cards[2].content).toBe('Third');
  });

  it('2.2.11: Groups ordered by position', async () => {
    await createTestGroup(board.id as string, 'Group A');
    await createTestGroup(board.id as string, 'Group B');

    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const body = await res.json();
    expect(body.data.groups[0].title).toBe('Group A');
    expect(body.data.groups[1].title).toBe('Group B');
    expect(body.data.groups[0].position).toBeLessThan(body.data.groups[1].position);
  });

  it('2.2.12: Get board from different team', async () => {
    const otherAuth = await getAuthToken({ email: 'other@example.com' });
    const otherTeam = await createTestTeam(otherAuth.user.id, { slug: 'other-team' });

    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      headers: { 'Authorization': `Bearer ${otherAuth.token}` },
    });

    expect(res.status).toBe(403);
  });
});
