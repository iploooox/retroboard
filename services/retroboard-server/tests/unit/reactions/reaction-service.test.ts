import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../../../src/db/connection.js';
import {
  truncateTables,
  createTestTeam,
  createTestSprint,
  createTestBoard,
  createTestCard,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { ReactionService } from '../../../src/services/reaction-service.js';

describe('S-026: Reaction Service (Unit)', () => {
  let reactionService: ReactionService;
  let cardId: string;
  let userId: string;
  let boardId: string;

  beforeEach(async () => {
    await truncateTables();
    await seed();

    reactionService = new ReactionService();

    const auth = await getAuthToken();
    userId = auth.user.id;

    const team = await createTestTeam(userId);
    const sprint = await createTestSprint(team.id, userId);
    const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, userId);
    boardId = board.id;

    const card = await createTestCard(board.id, columns[0].id, userId);
    cardId = card.id;
  });

  it('4.1: Toggle adds reaction when not exists', async () => {
    const result = await reactionService.toggle(cardId, userId, 'thumbsup');

    expect(result.added).toBe(true);
    expect(result.emoji).toBe('thumbsup');

    const reactions = await sql`
      SELECT * FROM card_reactions WHERE card_id = ${cardId} AND user_id = ${userId}
    `;
    expect(reactions).toHaveLength(1);
    expect(reactions[0].emoji).toBe('thumbsup');
  });

  it('4.2: Toggle removes reaction when already exists', async () => {
    // Add reaction first
    await reactionService.toggle(cardId, userId, 'thumbsup');

    // Toggle again to remove
    const result = await reactionService.toggle(cardId, userId, 'thumbsup');

    expect(result.added).toBe(false);
    expect(result.emoji).toBe('thumbsup');

    const reactions = await sql`
      SELECT * FROM card_reactions WHERE card_id = ${cardId} AND user_id = ${userId}
    `;
    expect(reactions).toHaveLength(0);
  });

  it('4.3: Validates emoji is in curated set', async () => {
    const validEmojis = ['thumbsup', 'thumbsdown', 'heart', 'fire', 'thinking', 'laughing', 'hundred', 'eyes'];

    for (const emoji of validEmojis) {
      const result = await reactionService.toggle(cardId, userId, emoji);
      expect(result.added).toBe(true);
    }
  });

  it('4.4: Rejects invalid emoji', async () => {
    await expect(
      reactionService.toggle(cardId, userId, 'invalid_emoji')
    ).rejects.toThrow(/invalid.*emoji/i);
  });

  it('4.5: Enforces board lock - no reactions when locked', async () => {
    // Lock the board
    await sql`UPDATE boards SET is_locked = true WHERE id = ${boardId}`;

    await expect(
      reactionService.toggle(cardId, userId, 'thumbsup')
    ).rejects.toThrow(/locked/i);
  });

  it('4.6: Returns updated reaction summary', async () => {
    const result = await reactionService.toggle(cardId, userId, 'heart');

    expect(result.summary).toBeDefined();
    expect(result.summary).toHaveLength(1);
    expect(result.summary[0].emoji).toBe('heart');
    expect(result.summary[0].count).toBe(1);
  });

  it('4.7: Multiple users react with same emoji increases count', async () => {
    const auth2 = await getAuthToken({ email: 'user2@example.com' });
    const userId2 = auth2.user.id;

    // Add user2 to team
    const [team] = await sql`SELECT team_id FROM team_members WHERE user_id = ${userId}`;
    await sql`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${team.team_id}, ${userId2}, 'member')
    `;

    await reactionService.toggle(cardId, userId, 'fire');
    await reactionService.toggle(cardId, userId2, 'fire');

    const summary = await reactionService.getSummaryByCard(cardId);
    expect(summary).toHaveLength(1);
    expect(summary[0].emoji).toBe('fire');
    expect(summary[0].count).toBe(2);
  });

  it('4.8: Multiple emojis on same card are all returned', async () => {
    await reactionService.toggle(cardId, userId, 'thumbsup');
    await reactionService.toggle(cardId, userId, 'heart');

    const summary = await reactionService.getSummaryByCard(cardId);
    expect(summary).toHaveLength(2);

    const emojis = summary.map(r => r.emoji).sort();
    expect(emojis).toEqual(['heart', 'thumbsup']);
  });

  it('4.9: Summary includes reacted flag for current user', async () => {
    const auth2 = await getAuthToken({ email: 'user2@example.com' });
    const userId2 = auth2.user.id;

    const [team] = await sql`SELECT team_id FROM team_members WHERE user_id = ${userId}`;
    await sql`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${team.team_id}, ${userId2}, 'member')
    `;

    await reactionService.toggle(cardId, userId, 'thumbsup');
    await reactionService.toggle(cardId, userId2, 'thumbsup');

    const summaryForUser1 = await reactionService.getSummaryByCard(cardId, userId);
    expect(summaryForUser1[0].reacted).toBe(true);

    const summaryForUser2 = await reactionService.getSummaryByCard(cardId, userId2);
    expect(summaryForUser2[0].reacted).toBe(true);

    const auth3 = await getAuthToken({ email: 'user3@example.com' });
    const summaryForUser3 = await reactionService.getSummaryByCard(cardId, auth3.user.id);
    expect(summaryForUser3[0].reacted).toBe(false);
  });

  it('4.10: Curated emoji set is correct', async () => {
    const expected = ['thumbsup', 'thumbsdown', 'heart', 'fire', 'thinking', 'laughing', 'hundred', 'eyes'];
    const curatedSet = ReactionService.CURATED_EMOJIS;

    expect(curatedSet).toEqual(expected);
  });
});
