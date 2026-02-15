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

/**
 * Custom sentiment lexicon CRUD operations
 */

export interface CustomSentimentWord {
  word: string;
  score: number;
  teamId: string;
  isCustom: boolean;
}

/**
 * List all custom sentiment words for a team
 */
export async function listCustomWords(teamId: string): Promise<CustomSentimentWord[]> {
  const rows = await sql`
    SELECT word, score, team_id, is_custom
    FROM sentiment_lexicon
    WHERE team_id = ${teamId}
    ORDER BY word ASC
  `;

  return rows.map((r) => ({
    word: r.word as string,
    score: Number(r.score),
    teamId: r.team_id as string,
    isCustom: r.is_custom as boolean,
  }));
}

/**
 * Add a custom sentiment word for a team
 */
export async function addCustomWord(
  teamId: string,
  word: string,
  score: number,
): Promise<CustomSentimentWord> {
  const normalizedWord = word.toLowerCase().trim();

  const [row] = await sql`
    INSERT INTO sentiment_lexicon (word, score, team_id, is_custom)
    VALUES (${normalizedWord}, ${score}, ${teamId}, true)
    RETURNING word, score, team_id, is_custom
  `;

  return {
    word: row.word as string,
    score: Number(row.score),
    teamId: row.team_id as string,
    isCustom: row.is_custom as boolean,
  };
}

/**
 * Update a custom sentiment word's score
 */
export async function updateCustomWord(
  teamId: string,
  word: string,
  score: number,
): Promise<CustomSentimentWord | null> {
  const normalizedWord = word.toLowerCase().trim();

  const [row] = await sql`
    UPDATE sentiment_lexicon
    SET score = ${score}
    WHERE word = ${normalizedWord}
      AND team_id = ${teamId}
      AND is_custom = true
    RETURNING word, score, team_id, is_custom
  `;

  if (!row) return null;

  return {
    word: row.word as string,
    score: Number(row.score),
    teamId: row.team_id as string,
    isCustom: row.is_custom as boolean,
  };
}

/**
 * Delete a custom sentiment word
 */
export async function deleteCustomWord(teamId: string, word: string): Promise<boolean> {
  const normalizedWord = word.toLowerCase().trim();

  const result = await sql`
    DELETE FROM sentiment_lexicon
    WHERE word = ${normalizedWord}
      AND team_id = ${teamId}
      AND is_custom = true
    RETURNING word
  `;

  return result.length > 0;
}
