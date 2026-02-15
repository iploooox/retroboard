import { sql } from '../db/connection.js';

/**
 * Get health trend data for a team from materialized view
 */
export async function getHealthTrend(teamId: string, limit: number = 20, offset: number = 0) {
  const rows = await sql`
    SELECT
      sprint_id,
      sprint_name,
      start_date,
      end_date,
      health_score,
      sentiment_score,
      vote_distribution_score,
      participation_score,
      card_count,
      total_members,
      active_members
    FROM mv_sprint_health
    WHERE team_id = ${teamId}
    ORDER BY start_date DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countRow] = await sql`
    SELECT COUNT(*)::int AS total
    FROM mv_sprint_health
    WHERE team_id = ${teamId}
  `;

  return {
    sprints: rows.map((r) => ({
      sprintId: r.sprint_id as string,
      sprintName: r.sprint_name as string,
      startDate: r.start_date ? (r.start_date as Date).toISOString().split('T')[0] : '',
      endDate: r.end_date ? (r.end_date as Date).toISOString().split('T')[0] : '',
      healthScore: Number(r.health_score),
      sentimentScore: Number(r.sentiment_score),
      voteDistributionScore: Number(r.vote_distribution_score),
      participationScore: Number(r.participation_score),
      cardCount: Number(r.card_count),
      totalMembers: Number(r.total_members),
      activeMembers: Number(r.active_members),
    })),
    total: Number(countRow.total),
  };
}

/**
 * Get participation stats for a team from materialized view
 */
export async function getParticipationStats(
  teamId: string,
  sprintId?: string,
) {
  const conditions = [sql`team_id = ${teamId}`];
  if (sprintId) {
    conditions.push(sql`sprint_id = ${sprintId}`);
  }
  const where = conditions.reduce((a, b) => sql`${a} AND ${b}`);

  const rows = await sql`
    SELECT
      user_id,
      user_name,
      sprint_id,
      sprint_name,
      start_date,
      cards_submitted,
      votes_cast,
      action_items_owned,
      action_items_completed
    FROM mv_participation_stats
    WHERE ${where}
    ORDER BY start_date DESC, user_name ASC
  `;

  // Group by user
  const memberMap = new Map<string, {
    userId: string;
    userName: string;
    totals: {
      cardsSubmitted: number;
      votesCast: number;
      actionItemsOwned: number;
      actionItemsCompleted: number;
      completionRate: number;
    };
    perSprint: Array<{
      sprintId: string;
      sprintName: string;
      cardsSubmitted: number;
      votesCast: number;
      actionItemsOwned: number;
      actionItemsCompleted: number;
    }>;
  }>();

  for (const row of rows) {
    const userId = row.user_id as string;
    const userName = row.user_name as string;

    if (!memberMap.has(userId)) {
      memberMap.set(userId, {
        userId,
        userName,
        totals: {
          cardsSubmitted: 0,
          votesCast: 0,
          actionItemsOwned: 0,
          actionItemsCompleted: 0,
          completionRate: 0,
        },
        perSprint: [],
      });
    }

    const member = memberMap.get(userId)!;
    const cardsSubmitted = Number(row.cards_submitted);
    const votesCast = Number(row.votes_cast);
    const actionItemsOwned = Number(row.action_items_owned);
    const actionItemsCompleted = Number(row.action_items_completed);

    member.totals.cardsSubmitted += cardsSubmitted;
    member.totals.votesCast += votesCast;
    member.totals.actionItemsOwned += actionItemsOwned;
    member.totals.actionItemsCompleted += actionItemsCompleted;

    member.perSprint.push({
      sprintId: row.sprint_id as string,
      sprintName: row.sprint_name as string,
      cardsSubmitted,
      votesCast,
      actionItemsOwned,
      actionItemsCompleted,
    });
  }

  // Calculate completion rates
  for (const member of memberMap.values()) {
    if (member.totals.actionItemsOwned > 0) {
      member.totals.completionRate =
        (member.totals.actionItemsCompleted / member.totals.actionItemsOwned) * 100;
    }
  }

  return Array.from(memberMap.values());
}

/**
 * Get word frequency data from materialized view
 */
export async function getWordFrequency(
  sprintId: string,
  limit: number = 100,
  minFrequency: number = 2,
) {
  const rows = await sql`
    SELECT
      word,
      frequency,
      sentiment
    FROM mv_word_frequency
    WHERE sprint_id = ${sprintId}
      AND frequency >= ${minFrequency}
    ORDER BY frequency DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    word: r.word as string,
    frequency: Number(r.frequency),
    sentiment: Number(r.sentiment),
  }));
}

/**
 * Get aggregated word frequency across multiple sprints for a team
 */
export async function getAggregatedWordFrequency(
  teamId: string,
  sprintCount: number = 5,
  limit: number = 100,
  minFrequency: number = 2,
) {
  const rows = await sql`
    SELECT
      word,
      SUM(frequency)::int AS frequency,
      AVG(sentiment) AS sentiment
    FROM mv_word_frequency
    WHERE sprint_id IN (
      SELECT id FROM sprints WHERE team_id = ${teamId}
      ORDER BY start_date DESC
      LIMIT ${sprintCount}
    )
    GROUP BY word
    HAVING SUM(frequency) >= ${minFrequency}
    ORDER BY frequency DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    word: r.word as string,
    frequency: Number(r.frequency),
    sentiment: Number(r.sentiment) || 0,
  }));
}

/**
 * Get sprint health score (single sprint)
 */
export async function getSprintHealth(sprintId: string) {
  const [row] = await sql`
    SELECT * FROM mv_sprint_health WHERE sprint_id = ${sprintId}
  `;

  if (!row) return null;

  return {
    sprintId: row.sprint_id as string,
    sprintName: row.sprint_name as string,
    healthScore: Number(row.health_score),
    sentimentScore: Number(row.sentiment_score),
    voteDistributionScore: Number(row.vote_distribution_score),
    participationScore: Number(row.participation_score),
    cardCount: Number(row.card_count),
    totalMembers: Number(row.total_members),
    activeMembers: Number(row.active_members),
  };
}

/**
 * Refresh all materialized views concurrently
 * Called after board completion
 */
export async function refreshMaterializedViews(): Promise<void> {
  await Promise.all([
    sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sprint_health`,
    sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_participation_stats`,
    sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_word_frequency`,
  ]);
}

/**
 * Check if team exists
 */
export async function teamExists(teamId: string): Promise<boolean> {
  const [row] = await sql`SELECT 1 FROM teams WHERE id = ${teamId}`;
  return !!row;
}

/**
 * Check if user is team member
 */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const [row] = await sql`
    SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}
  `;
  return !!row;
}

/**
 * Get team name
 */
export async function getTeamName(teamId: string): Promise<string | null> {
  const [row] = await sql`SELECT name FROM teams WHERE id = ${teamId}`;
  return row ? (row.name as string) : null;
}

/**
 * Get sprint info (for permission check)
 */
export async function getSprintInfo(sprintId: string): Promise<{
  sprintId: string;
  sprintName: string;
  teamId: string;
  teamName: string;
  startDate: string;
  endDate: string;
} | null> {
  const [row] = await sql`
    SELECT s.id, s.name, s.team_id, t.name AS team_name, s.start_date, s.end_date
    FROM sprints s
    JOIN teams t ON t.id = s.team_id
    WHERE s.id = ${sprintId}
  `;

  if (!row) return null;

  return {
    sprintId: row.id as string,
    sprintName: row.name as string,
    teamId: row.team_id as string,
    teamName: row.team_name as string,
    startDate: row.start_date ? (row.start_date as Date).toISOString().split('T')[0] : '',
    endDate: row.end_date ? (row.end_date as Date).toISOString().split('T')[0] : '',
  };
}
