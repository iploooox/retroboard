import { sql } from '../db/connection.js';

/**
 * Calculate sentiment score for a given text using the database function
 * Returns raw sentiment score (-5 to +5)
 */
export async function calculateSentiment(text: string): Promise<number> {
  const [result] = await sql`SELECT calculate_card_sentiment(${text}) AS score`;
  return Number(result.score) || 0;
}

/**
 * Normalize a raw sentiment score (-5 to +5) to 0-100 scale
 */
export function normalizeSentiment(rawScore: number): number {
  return ((rawScore + 5.0) / 10.0) * 100;
}

/**
 * Get top positive/negative cards for a sprint
 */
export async function getTopSentimentCards(
  sprintId: string,
  limit: number = 5,
): Promise<{
  topPositive: Array<{ cardId: string; text: string; sentiment: number; votes: number }>;
  topNegative: Array<{ cardId: string; text: string; sentiment: number; votes: number }>;
}> {
  const topPositive = await sql`
    SELECT
      c.id AS card_id,
      c.content AS text,
      calculate_card_sentiment(c.content) AS sentiment,
      COUNT(v.id)::int AS vote_count
    FROM cards c
    JOIN boards b ON c.board_id = b.id
    LEFT JOIN card_votes v ON v.card_id = c.id
    WHERE b.sprint_id = ${sprintId}
    GROUP BY c.id, c.content
    ORDER BY calculate_card_sentiment(c.content) DESC
    LIMIT ${limit}
  `;

  const topNegative = await sql`
    SELECT
      c.id AS card_id,
      c.content AS text,
      calculate_card_sentiment(c.content) AS sentiment,
      COUNT(v.id)::int AS vote_count
    FROM cards c
    JOIN boards b ON c.board_id = b.id
    LEFT JOIN card_votes v ON v.card_id = c.id
    WHERE b.sprint_id = ${sprintId}
    GROUP BY c.id, c.content
    ORDER BY calculate_card_sentiment(c.content) ASC
    LIMIT ${limit}
  `;

  return {
    topPositive: topPositive.map((r) => ({
      cardId: r.card_id as string,
      text: r.text as string,
      sentiment: Number(r.sentiment),
      votes: Number(r.vote_count),
    })),
    topNegative: topNegative.map((r) => ({
      cardId: r.card_id as string,
      text: r.text as string,
      sentiment: Number(r.sentiment),
      votes: Number(r.vote_count),
    })),
  };
}

/**
 * Get sentiment breakdown by column for a sprint
 */
export async function getSentimentByColumn(sprintId: string) {
  const rows = await sql`
    SELECT
      col.id AS column_id,
      col.name AS column_name,
      AVG(calculate_card_sentiment(c.content)) AS avg_sentiment,
      COUNT(*)::int AS card_count,
      COUNT(*) FILTER (WHERE calculate_card_sentiment(c.content) > 0.5)::int AS positive,
      COUNT(*) FILTER (WHERE calculate_card_sentiment(c.content) < -0.5)::int AS negative,
      COUNT(*) FILTER (WHERE calculate_card_sentiment(c.content) BETWEEN -0.5 AND 0.5)::int AS neutral
    FROM cards c
    JOIN columns col ON c.column_id = col.id
    JOIN boards b ON c.board_id = b.id
    WHERE b.sprint_id = ${sprintId}
    GROUP BY col.id, col.name
    ORDER BY col.position
  `;

  return rows.map((r) => ({
    columnId: r.column_id as string,
    columnName: r.column_name as string,
    averageSentiment: Number(r.avg_sentiment) || 0,
    cardCount: Number(r.card_count),
    positiveCards: Number(r.positive),
    negativeCards: Number(r.negative),
    neutralCards: Number(r.neutral),
  }));
}
