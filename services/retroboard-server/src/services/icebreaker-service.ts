import { sql } from '../db/connection.js';

const VALID_CATEGORIES = ['fun', 'team-building', 'reflective', 'creative', 'quick'];
const EXCLUSION_LIMIT = 10;

export class IcebreakerService {
  async getRandom(teamId: string, category?: string) {
    // Get recently used icebreaker IDs for this team (last 10)
    const recentHistory = await sql`
      SELECT icebreaker_id
      FROM team_icebreaker_history
      WHERE team_id = ${teamId}
      ORDER BY used_at DESC
      LIMIT ${EXCLUSION_LIMIT}
    `;

    const excludedIds = recentHistory.map((h) => h.icebreaker_id as string);

    // Build query with optional category filter
    let query;
    if (category) {
      if (excludedIds.length > 0) {
        query = sql`
          SELECT id, question, category
          FROM icebreakers
          WHERE (is_system = true OR team_id = ${teamId})
            AND category = ${category}
            AND id != ALL(${excludedIds})
          ORDER BY RANDOM()
          LIMIT 1
        `;
      } else {
        query = sql`
          SELECT id, question, category
          FROM icebreakers
          WHERE (is_system = true OR team_id = ${teamId})
            AND category = ${category}
          ORDER BY RANDOM()
          LIMIT 1
        `;
      }
    } else {
      if (excludedIds.length > 0) {
        query = sql`
          SELECT id, question, category
          FROM icebreakers
          WHERE (is_system = true OR team_id = ${teamId})
            AND id != ALL(${excludedIds})
          ORDER BY RANDOM()
          LIMIT 1
        `;
      } else {
        query = sql`
          SELECT id, question, category
          FROM icebreakers
          WHERE (is_system = true OR team_id = ${teamId})
          ORDER BY RANDOM()
          LIMIT 1
        `;
      }
    }

    const results = await query;

    // Fallback: if all are excluded, just return any random one
    if (results.length === 0) {
      const fallback = await sql`
        SELECT id, question, category
        FROM icebreakers
        WHERE (is_system = true OR team_id = ${teamId})
          ${category ? sql`AND category = ${category}` : sql``}
        ORDER BY RANDOM()
        LIMIT 1
      `;
      return fallback[0] as { id: string; question: string; category: string };
    }

    return results[0] as { id: string; question: string; category: string };
  }

  async createCustom(teamId: string, question: string, category: string, createdBy: string) {
    const [icebreaker] = await sql`
      INSERT INTO icebreakers (question, category, is_system, team_id, created_by)
      VALUES (${question}, ${category}, false, ${teamId}, ${createdBy})
      RETURNING *
    `;

    return {
      id: icebreaker.id as string,
      question: icebreaker.question as string,
      category: icebreaker.category as string,
      is_system: icebreaker.is_system as boolean,
      team_id: icebreaker.team_id as string,
    };
  }

  async recordHistory(teamId: string, icebreakerId: string, boardId: string) {
    await sql`
      INSERT INTO team_icebreaker_history (team_id, icebreaker_id, board_id, used_at)
      VALUES (${teamId}, ${icebreakerId}, ${boardId}, NOW())
    `;
  }

  isValidCategory(category: string): boolean {
    return VALID_CATEGORIES.includes(category);
  }
}

export const icebreakerService = new IcebreakerService();
