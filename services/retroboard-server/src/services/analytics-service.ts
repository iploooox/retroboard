import { sql } from '../db/connection.js';
import * as analyticsRepo from '../repositories/analytics.repository.js';
import * as sentimentRepo from '../repositories/sentiment.repository.js';

/**
 * Analytics Service
 * Handles complex analytics calculations, trends, and aggregations
 */
export class AnalyticsService {
  /**
   * Get health trend for a team with trend analysis
   */
  async getHealthTrend(teamId: string, limit: number = 20, offset: number = 0) {
    const { sprints, total } = await analyticsRepo.getHealthTrend(teamId, limit, offset);
    const teamName = await analyticsRepo.getTeamName(teamId);

    // Calculate trend (compare last 3 vs previous 3 sprints)
    const trend = this.calculateTrend(sprints);

    return {
      teamId,
      teamName: teamName || '',
      sprints,
      trend,
      total,
      limit,
      offset,
    };
  }

  /**
   * Calculate trend direction and stats
   */
  private calculateTrend(sprints: Array<{ healthScore: number; sprintId: string }>) {
    if (sprints.length === 0) {
      return {
        direction: 'stable' as const,
        changePercent: 0,
        averageHealthScore: 0,
        bestSprint: null,
        worstSprint: null,
      };
    }

    // Overall average
    const averageHealthScore =
      sprints.reduce((sum, s) => sum + s.healthScore, 0) / sprints.length;

    // Best and worst
    const best = sprints.reduce((max, s) => (s.healthScore > max.healthScore ? s : max));
    const worst = sprints.reduce((min, s) => (s.healthScore < min.healthScore ? s : min));

    // Trend direction (last 3 vs previous 3)
    if (sprints.length < 6) {
      return {
        direction: 'stable' as const,
        changePercent: 0,
        averageHealthScore,
        bestSprint: { sprintId: best.sprintId, score: best.healthScore },
        worstSprint: { sprintId: worst.sprintId, score: worst.healthScore },
      };
    }

    const last3 = sprints.slice(0, 3);
    const previous3 = sprints.slice(3, 6);

    const last3Avg = last3.reduce((sum, s) => sum + s.healthScore, 0) / 3;
    const previous3Avg = previous3.reduce((sum, s) => sum + s.healthScore, 0) / 3;

    const changePercent = previous3Avg > 0 ? ((last3Avg - previous3Avg) / previous3Avg) * 100 : 0;
    const threshold = 5; // within 5% is "stable"

    let direction: 'up' | 'down' | 'stable';
    if (Math.abs(changePercent) < threshold) {
      direction = 'stable';
    } else if (last3Avg > previous3Avg) {
      direction = 'up';
    } else {
      direction = 'down';
    }

    return {
      direction,
      changePercent,
      averageHealthScore,
      bestSprint: { sprintId: best.sprintId, score: best.healthScore },
      worstSprint: { sprintId: worst.sprintId, score: worst.healthScore },
    };
  }

  /**
   * Get participation stats for team
   */
  async getParticipation(teamId: string, sprintId?: string) {
    const members = await analyticsRepo.getParticipationStats(teamId, sprintId);
    const teamName = await analyticsRepo.getTeamName(teamId);

    // Calculate team averages
    let avgCardsPerMember = 0;
    let avgVotesPerMember = 0;
    let avgCompletionRate = 0;

    if (members.length > 0) {
      avgCardsPerMember =
        members.reduce((sum, m) => sum + m.totals.cardsSubmitted, 0) / members.length;
      avgVotesPerMember = members.reduce((sum, m) => sum + m.totals.votesCast, 0) / members.length;
      avgCompletionRate =
        members.reduce((sum, m) => sum + m.totals.completionRate, 0) / members.length;
    }

    return {
      teamId,
      teamName: teamName || '',
      members,
      teamAverages: {
        avgCardsPerMember,
        avgVotesPerMember,
        avgCompletionRate,
      },
      total: members.length,
      limit: 20,
      offset: 0,
    };
  }

  /**
   * Get sentiment trend for team
   */
  async getSentimentTrend(teamId: string, limit: number = 20, offset: number = 0) {
    const { sprints, total } = await analyticsRepo.getHealthTrend(teamId, limit, offset);
    const teamName = await analyticsRepo.getTeamName(teamId);

    // For each sprint, get sentiment breakdown by column
    const sprintsWithSentiment = await Promise.all(
      sprints.map(async (sprint) => {
        const sentimentByColumn = await sentimentRepo.getSentimentByColumn(sprint.sprintId);

        // Calculate overall sentiment stats
        const totalCards = sprint.cardCount;
        const positiveCards = sentimentByColumn.reduce((sum, col) => sum + col.positiveCards, 0);
        const negativeCards = sentimentByColumn.reduce((sum, col) => sum + col.negativeCards, 0);
        const neutralCards = sentimentByColumn.reduce((sum, col) => sum + col.neutralCards, 0);

        // Calculate raw average sentiment from normalized score
        const averageSentiment = ((sprint.sentimentScore - 50) / 10);
        const normalizedScore = sprint.sentimentScore;

        return {
          sprintId: sprint.sprintId,
          sprintName: sprint.sprintName,
          averageSentiment,
          normalizedScore,
          positiveCards,
          negativeCards,
          neutralCards,
          totalCards,
          sentimentByColumn,
        };
      }),
    );

    // Calculate overall trend
    const avgSentiment =
      sprintsWithSentiment.length > 0
        ? sprintsWithSentiment.reduce((sum, s) => sum + s.averageSentiment, 0) /
          sprintsWithSentiment.length
        : 0;
    const avgNormalizedScore =
      sprintsWithSentiment.length > 0
        ? sprintsWithSentiment.reduce((sum, s) => sum + s.normalizedScore, 0) /
          sprintsWithSentiment.length
        : 50;

    // Trend direction
    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (sprintsWithSentiment.length >= 6) {
      const last3 = sprintsWithSentiment.slice(0, 3);
      const previous3 = sprintsWithSentiment.slice(3, 6);
      const last3Avg =
        last3.reduce((sum, s) => sum + s.averageSentiment, 0) / 3;
      const previous3Avg =
        previous3.reduce((sum, s) => sum + s.averageSentiment, 0) / 3;

      if (Math.abs(last3Avg - previous3Avg) < 0.5) {
        direction = 'stable';
      } else if (last3Avg > previous3Avg) {
        direction = 'up';
      } else {
        direction = 'down';
      }
    }

    return {
      teamId,
      teamName: teamName || '',
      sprints: sprintsWithSentiment,
      overallTrend: {
        direction,
        averageSentiment: avgSentiment,
        averageNormalizedScore: avgNormalizedScore,
      },
      total,
      limit,
      offset,
    };
  }

  /**
   * Get word cloud data for sprint or team
   */
  async getWordCloud(
    teamId: string,
    sprintId?: string,
    limit: number = 100,
    minFrequency: number = 2,
  ) {
    let words;
    let totalCards = 0;
    let sprintName = null;

    if (sprintId) {
      // Single sprint
      words = await analyticsRepo.getWordFrequency(sprintId, limit, minFrequency);
      const sprintInfo = await analyticsRepo.getSprintInfo(sprintId);
      if (sprintInfo) {
        sprintName = sprintInfo.sprintName;
        // Get card count
        const [row] = await sql`
          SELECT COUNT(*)::int AS total
          FROM cards c
          JOIN boards b ON c.board_id = b.id
          WHERE b.sprint_id = ${sprintId}
        `;
        totalCards = Number(row.total);
      }
    } else {
      // Aggregated across recent sprints
      words = await analyticsRepo.getAggregatedWordFrequency(teamId, 5, limit, minFrequency);
      // Get total cards across recent sprints
      const [row] = await sql`
        SELECT COUNT(*)::int AS total
        FROM cards c
        JOIN boards b ON c.board_id = b.id
        JOIN sprints s ON b.sprint_id = s.id
        WHERE s.team_id = ${teamId}
          AND s.id IN (
            SELECT id FROM sprints WHERE team_id = ${teamId}
            ORDER BY start_date DESC
            LIMIT 5
          )
      `;
      totalCards = Number(row.total);
    }

    return {
      teamId,
      sprintId: sprintId || null,
      sprintName,
      words,
      totalUniqueWords: words.length,
      totalCards,
    };
  }

  /**
   * Get comprehensive analytics summary for a single sprint
   */
  async getSprintAnalytics(sprintId: string) {
    // Get sprint info
    const sprintInfo = await analyticsRepo.getSprintInfo(sprintId);
    if (!sprintInfo) return null;

    // Get health score
    const health = await analyticsRepo.getSprintHealth(sprintId);
    if (!health) {
      // Sprint exists but no analytics data (no board created yet)
      return {
        sprintId: sprintInfo.sprintId,
        sprintName: sprintInfo.sprintName,
        teamId: sprintInfo.teamId,
        teamName: sprintInfo.teamName,
        noDataReason: "No board has been created for this sprint yet",
      };
    }

    // Get previous sprint health for comparison
    const [prevSprintRow] = await sql`
      SELECT id FROM sprints
      WHERE team_id = ${sprintInfo.teamId}
        AND start_date < ${sprintInfo.startDate}
      ORDER BY start_date DESC
      LIMIT 1
    `;
    let previousSprintHealthScore = null;
    let changeFromPrevious = null;
    if (prevSprintRow) {
      const prevHealth = await analyticsRepo.getSprintHealth(prevSprintRow.id as string);
      if (prevHealth) {
        previousSprintHealthScore = prevHealth.healthScore;
        changeFromPrevious = health.healthScore - prevHealth.healthScore;
      }
    }

    // Get cards breakdown by column
    const cardsByColumn = await sql`
      SELECT
        col.id AS column_id,
        col.name AS column_name,
        COUNT(*)::int AS count
      FROM cards c
      JOIN columns col ON c.column_id = col.id
      JOIN boards b ON c.board_id = b.id
      WHERE b.sprint_id = ${sprintId}
      GROUP BY col.id, col.name, col.position
      ORDER BY col.position
    `;

    // Get groups count
    const [groupsRow] = await sql`
      SELECT COUNT(*)::int AS count
      FROM card_groups cg
      JOIN boards b ON cg.board_id = b.id
      WHERE b.sprint_id = ${sprintId}
    `;

    // Get average votes per card
    const [votesRow] = await sql`
      SELECT
        COALESCE(AVG(vote_count), 0) AS avg_votes
      FROM (
        SELECT c.id, COUNT(v.id)::int AS vote_count
        FROM cards c
        JOIN boards b ON c.board_id = b.id
        LEFT JOIN card_votes v ON v.card_id = c.id
        WHERE b.sprint_id = ${sprintId}
        GROUP BY c.id
      ) card_votes
    `;

    // Get sentiment detail
    const sentimentByColumn = await sentimentRepo.getSentimentByColumn(sprintId);
    const topCards = await sentimentRepo.getTopSentimentCards(sprintId, 5);

    const totalPositive = sentimentByColumn.reduce((sum, col) => sum + col.positiveCards, 0);
    const totalNegative = sentimentByColumn.reduce((sum, col) => sum + col.negativeCards, 0);
    const totalNeutral = sentimentByColumn.reduce((sum, col) => sum + col.neutralCards, 0);
    const averageSentiment = ((health.sentimentScore - 50) / 10);

    // Get participation detail
    const participation = await analyticsRepo.getParticipationStats(sprintInfo.teamId, sprintId);
    const participationRate =
      health.totalMembers > 0 ? (health.activeMembers / health.totalMembers) * 100 : 0;

    // Get action items stats
    const [actionItemsRow] = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'done')::int AS done,
        COUNT(*) FILTER (WHERE carried_from_id IS NOT NULL)::int AS carried_over
      FROM action_items ai
      JOIN boards b ON ai.board_id = b.id
      WHERE b.sprint_id = ${sprintId}
    `;

    const actionItemsTotal = Number(actionItemsRow.total);
    const actionItemsDone = Number(actionItemsRow.done);
    const completionRate = actionItemsTotal > 0 ? (actionItemsDone / actionItemsTotal) * 100 : 0;

    // Get word cloud
    const wordCloud = await analyticsRepo.getWordFrequency(sprintId, 100, 2);

    return {
      sprintId: sprintInfo.sprintId,
      sprintName: sprintInfo.sprintName,
      teamId: sprintInfo.teamId,
      teamName: sprintInfo.teamName,
      dateRange: {
        startDate: sprintInfo.startDate,
        endDate: sprintInfo.endDate,
      },
      health: {
        healthScore: health.healthScore,
        sentimentScore: health.sentimentScore,
        voteDistributionScore: health.voteDistributionScore,
        participationScore: health.participationScore,
        previousSprintHealthScore,
        changeFromPrevious,
      },
      cards: {
        total: health.cardCount,
        byColumn: cardsByColumn.map((r) => ({
          columnId: r.column_id as string,
          columnName: r.column_name as string,
          count: Number(r.count),
        })),
        groups: Number(groupsRow.count),
        averageVotesPerCard: Number(votesRow.avg_votes),
      },
      sentiment: {
        averageSentiment,
        normalizedScore: health.sentimentScore,
        positiveCards: totalPositive,
        negativeCards: totalNegative,
        neutralCards: totalNeutral,
        topPositiveCards: topCards.topPositive,
        topNegativeCards: topCards.topNegative,
      },
      participation: {
        totalMembers: health.totalMembers,
        activeMembers: health.activeMembers,
        participationRate,
        members: participation.map((m) => ({
          userId: m.userId,
          userName: m.userName,
          cardsSubmitted: m.perSprint[0]?.cardsSubmitted || 0,
          votesCast: m.perSprint[0]?.votesCast || 0,
          actionItemsOwned: m.perSprint[0]?.actionItemsOwned || 0,
          actionItemsCompleted: m.perSprint[0]?.actionItemsCompleted || 0,
        })),
      },
      actionItems: {
        total: actionItemsTotal,
        open: Number(actionItemsRow.open),
        inProgress: Number(actionItemsRow.in_progress),
        done: actionItemsDone,
        carriedOver: Number(actionItemsRow.carried_over),
        completionRate,
      },
      wordCloud: wordCloud.slice(0, 10), // Top 10 words for summary
    };
  }
}

export const analyticsService = new AnalyticsService();
