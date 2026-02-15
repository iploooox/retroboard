import { sql } from '../db/connection.js';
import { AppError } from '../utils/errors.js';

export class ReactionService {
  static readonly CURATED_EMOJIS = [
    '👍', // thumbsup
    '👎', // thumbsdown
    '❤️', // heart
    '🔥', // fire
    '🤔', // thinking
    '😂', // laughing
    '💯', // hundred
    '👀', // eyes
    '🎉', // party
    '✅', // check
    '😀', // smile
    '🚀', // rocket
  ];

  async toggle(cardId: string, userId: string, emoji: string) {
    // Validate emoji
    if (!ReactionService.CURATED_EMOJIS.includes(emoji)) {
      throw new AppError('INVALID_EMOJI', 400, 'Invalid emoji. Must be one of the curated set.');
    }

    // Check if board is locked
    const [board] = await sql`
      SELECT b.is_locked
      FROM boards b
      JOIN cards c ON c.board_id = b.id
      WHERE c.id = ${cardId}
    `;

    if (!board) {
      throw new AppError('CARD_NOT_FOUND', 404, 'Card not found');
    }

    if (board.is_locked) {
      throw new AppError('BOARD_LOCKED', 403, 'Cannot react to cards on a locked board');
    }

    // Toggle reaction using INSERT ON CONFLICT
    const result = await sql`
      INSERT INTO card_reactions (card_id, user_id, emoji)
      VALUES (${cardId}, ${userId}, ${emoji})
      ON CONFLICT (card_id, user_id, emoji) DO UPDATE
        SET card_id = EXCLUDED.card_id
      RETURNING (xmax = 0) AS inserted
    `;

    const added = result[0].inserted as boolean;

    // If not inserted, it was an update (conflict), so delete it
    if (!added) {
      await sql`
        DELETE FROM card_reactions
        WHERE card_id = ${cardId} AND user_id = ${userId} AND emoji = ${emoji}
      `;
    }

    // Get updated summary
    const summary = await this.getSummaryByCard(cardId, userId);

    return {
      added,
      emoji,
      summary,
    };
  }

  async getSummaryByCard(cardId: string, currentUserId?: string) {
    const reactions = await sql`
      SELECT
        emoji,
        COUNT(*)::int AS count,
        ARRAY_AGG(user_id) AS user_ids
      FROM card_reactions
      WHERE card_id = ${cardId}
      GROUP BY emoji
      ORDER BY count DESC, emoji
    `;

    return reactions.map((r) => ({
      emoji: r.emoji as string,
      count: Number(r.count),
      reacted: currentUserId ? (r.user_ids as string[]).includes(currentUserId) : false,
    }));
  }

  async getSummaryByBoard(boardId: string, currentUserId?: string) {
    const reactions = await sql`
      SELECT
        c.id AS card_id,
        cr.emoji,
        COUNT(*)::int AS count,
        ARRAY_AGG(cr.user_id) AS user_ids
      FROM cards c
      LEFT JOIN card_reactions cr ON cr.card_id = c.id
      WHERE c.board_id = ${boardId}
      GROUP BY c.id, cr.emoji
      ORDER BY c.id, count DESC, cr.emoji
    `;

    const cardReactions: Record<string, Array<{ emoji: string; count: number; reacted: boolean }>> = {};

    for (const r of reactions) {
      const cardId = r.card_id as string;
      if (!cardReactions[cardId]) {
        cardReactions[cardId] = [];
      }

      if (r.emoji) {
        cardReactions[cardId].push({
          emoji: r.emoji as string,
          count: Number(r.count),
          reacted: currentUserId ? (r.user_ids as string[]).includes(currentUserId) : false,
        });
      }
    }

    return cardReactions;
  }
}

export const reactionService = new ReactionService();
