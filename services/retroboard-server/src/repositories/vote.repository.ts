import { sql } from '../db/connection.js';

export interface VoteResult {
  card_id: string;
  vote_count: number;
  user_votes: number;
  user_votes_remaining: number;
  user_total_votes_cast: number;
}

type VoteOutcome =
  | { ok: true; data: VoteResult }
  | { ok: false; code: string; message: string };

export async function castVote(
  cardId: string,
  userId: string,
  boardId: string,
): Promise<VoteOutcome> {
  return sql.begin(async (tx) => {
    // Lock the board row to prevent race conditions
    const [board] = await tx`
      SELECT max_votes_per_user, max_votes_per_card
      FROM boards WHERE id = ${boardId} FOR UPDATE
    `;
    if (!board) {
      return { ok: false as const, code: 'BOARD_NOT_FOUND', message: 'Board not found' };
    }

    const maxPerUser = Number(board.max_votes_per_user);
    const maxPerCard = Number(board.max_votes_per_card);

    // Count user's total votes on this board
    const [totalVotes] = await tx`
      SELECT COUNT(*)::int AS total
      FROM card_votes cv
      JOIN cards c ON c.id = cv.card_id
      WHERE c.board_id = ${boardId} AND cv.user_id = ${userId}
    `;
    if (totalVotes.total >= maxPerUser) {
      return { ok: false as const, code: 'VOTE_LIMIT_REACHED', message: 'You have used all your votes' };
    }

    // Count user's votes on this specific card
    const [cardVotes] = await tx`
      SELECT COUNT(*)::int AS count
      FROM card_votes WHERE card_id = ${cardId} AND user_id = ${userId}
    `;
    if (cardVotes.count >= maxPerCard) {
      return { ok: false as const, code: 'VOTE_LIMIT_REACHED', message: 'Maximum votes per card reached' };
    }

    // Insert vote with next vote_number
    const voteNumber = cardVotes.count + 1;
    await tx`
      INSERT INTO card_votes (card_id, user_id, vote_number)
      VALUES (${cardId}, ${userId}, ${voteNumber})
    `;

    // Get total vote count for this card
    const [voteCount] = await tx`
      SELECT COUNT(*)::int AS vote_count
      FROM card_votes WHERE card_id = ${cardId}
    `;

    const newTotal = totalVotes.total + 1;
    const userVotes = cardVotes.count + 1;

    return {
      ok: true as const,
      data: {
        card_id: cardId,
        vote_count: Number(voteCount.vote_count),
        user_votes: userVotes,
        user_votes_remaining: maxPerUser - newTotal,
        user_total_votes_cast: newTotal,
      },
    };
  });
}

export async function removeVote(
  cardId: string,
  userId: string,
  boardId: string,
): Promise<VoteOutcome> {
  return sql.begin(async (tx) => {
    // Find highest vote_number for this card/user (LIFO)
    const [highest] = await tx`
      SELECT vote_number FROM card_votes
      WHERE card_id = ${cardId} AND user_id = ${userId}
      ORDER BY vote_number DESC
      LIMIT 1
    `;

    if (!highest) {
      return { ok: false as const, code: 'VALIDATION_ERROR', message: 'No votes to remove' };
    }

    // Remove the highest vote
    await tx`
      DELETE FROM card_votes
      WHERE card_id = ${cardId} AND user_id = ${userId} AND vote_number = ${highest.vote_number}
    `;

    // Get updated counts
    const [voteCount] = await tx`
      SELECT COUNT(*)::int AS vote_count
      FROM card_votes WHERE card_id = ${cardId}
    `;

    const [userCardVotes] = await tx`
      SELECT COUNT(*)::int AS count
      FROM card_votes WHERE card_id = ${cardId} AND user_id = ${userId}
    `;

    const [board] = await tx`
      SELECT max_votes_per_user FROM boards WHERE id = ${boardId}
    `;

    const [totalVotes] = await tx`
      SELECT COUNT(*)::int AS total
      FROM card_votes cv
      JOIN cards c ON c.id = cv.card_id
      WHERE c.board_id = ${boardId} AND cv.user_id = ${userId}
    `;

    return {
      ok: true as const,
      data: {
        card_id: cardId,
        vote_count: Number(voteCount.vote_count),
        user_votes: Number(userCardVotes.count),
        user_votes_remaining: Number(board.max_votes_per_user) - Number(totalVotes.total),
        user_total_votes_cast: Number(totalVotes.total),
      },
    };
  });
}
