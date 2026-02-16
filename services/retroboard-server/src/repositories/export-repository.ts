import { sql } from '../db/connection.js';
import { AppError } from '../utils/errors.js';

export interface BoardExportData {
  board: {
    id: string;
    name: string;
    teamName: string;
    sprintName: string;
    sprintStartDate: string;
    sprintEndDate: string;
    templateName: string | null;
    facilitatorName: string | null;
    phase: string;
    isAnonymous: boolean;
    cardsRevealed: boolean;
    participantCount: number;
    createdAt: string;
  };
  columns: Array<{
    id: string;
    name: string;
    position: number;
    cards: Array<{
      id: string;
      content: string;
      authorId: string | null;
      authorName: string | null;
      voteCount: number;
      groupId: string | null;
      groupTitle: string | null;
      position: number;
    }>;
  }>;
  groups: Array<{
    id: string;
    title: string;
    columnId: string;
    columnName: string;
    totalVotes: number;
    cardIds: string[];
    position: number;
    cards: Array<{
      id: string;
      content: string;
      voteCount: number;
    }>;
  }>;
  actionItems: Array<{
    id: string;
    title: string;
    description: string | null;
    assigneeName: string | null;
    dueDate: string | null;
    status: string;
    sourceCardText: string | null;
    carriedFromSprintName: string | null;
  }>;
  analytics: {
    healthScore: number;
    sentimentScore: number;
    participationRate: number;
    totalCards: number;
    totalVotes: number;
    sentimentBreakdown: {
      positive: number;
      negative: number;
      neutral: number;
    };
    topVotedCards: Array<{
      content: string;
      voteCount: number;
      columnName: string;
    }>;
    topWords: Array<{
      word: string;
      frequency: number;
    }>;
  } | null;
}

export interface TeamReportData {
  team: {
    id: string;
    name: string;
    memberCount: number;
  };
  dateRange: {
    from: string;
    to: string;
  };
  sprintCount: number;
  healthTrend: Array<{
    sprintName: string;
    startDate: string;
    healthScore: number;
    sentimentScore: number;
    participationScore: number;
  }>;
  participation: {
    members: Array<{
      userName: string;
      totalCards: number;
      totalVotes: number;
      actionItemsCompleted: number;
      actionItemCompletionRate: number;
    }>;
  };
  actionItems: {
    totalCreated: number;
    totalCompleted: number;
    completionRate: number;
    totalCarriedOver: number;
    currentlyOpen: number;
  };
  topThemes: Array<{
    word: string;
    frequency: number;
  }>;
}

/**
 * Fetch complete board export data
 */
export async function fetchBoardExportData(
  boardId: string,
  includeAnalytics: boolean,
  includeActionItems: boolean
): Promise<BoardExportData> {
  // First check card count to prevent oversized exports
  const [cardCountRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM cards
    WHERE board_id = ${boardId}
  `;
  const cardCount = Number(cardCountRow.count);
  if (cardCount > 5000) {
    throw new AppError('PAYLOAD_TOO_LARGE', 413, 'Board exceeds export size limit (5000 cards)');
  }

  // Fetch board metadata
  const [boardRow] = await sql`
    SELECT
      b.id,
      COALESCE(s.name, 'Untitled Board') AS name,
      b.phase,
      b.anonymous_mode,
      b.cards_revealed,
      b.created_at,
      s.name AS sprint_name,
      s.start_date,
      s.end_date,
      t.name AS team_name,
      tmpl.name AS template_name,
      u.display_name AS facilitator_name,
      (SELECT COUNT(DISTINCT author_id)::int FROM cards WHERE board_id = b.id) AS participant_count
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    JOIN teams t ON s.team_id = t.id
    LEFT JOIN templates tmpl ON b.template_id = tmpl.id
    LEFT JOIN users u ON b.created_by = u.id
    WHERE b.id = ${boardId}
  `;

  if (!boardRow) {
    throw new AppError('NOT_FOUND', 404, 'Board not found');
  }

  const isAnonymous = Boolean(boardRow.anonymous_mode);
  const cardsRevealed = Boolean(boardRow.cards_revealed);
  const shouldHideAuthors = isAnonymous && !cardsRevealed;

  // Fetch columns with cards
  const columnsRows = await sql`
    SELECT
      col.id,
      col.name,
      col.position
    FROM columns col
    WHERE col.board_id = ${boardId}
    ORDER BY col.position
  `;

  const columns = [];
  for (const colRow of columnsRows) {
    // Fetch cards for this column
    const cardsRows = await sql`
      SELECT
        c.id,
        c.content,
        c.author_id,
        u.display_name AS author_name,
        c.position,
        cg.id AS group_id,
        cg.title AS group_title,
        COALESCE((SELECT COUNT(*)::int FROM card_votes WHERE card_id = c.id), 0) AS vote_count
      FROM cards c
      LEFT JOIN users u ON c.author_id = u.id
      LEFT JOIN card_group_members cgm ON cgm.card_id = c.id
      LEFT JOIN card_groups cg ON cgm.group_id = cg.id
      WHERE c.column_id = ${colRow.id}
      ORDER BY vote_count DESC, c.position
    `;

    const cards = cardsRows.map((cardRow) => ({
      id: cardRow.id as string,
      content: cardRow.content as string,
      authorId: shouldHideAuthors ? null : (cardRow.author_id as string | null),
      authorName: shouldHideAuthors ? null : (cardRow.author_name as string | null),
      voteCount: Number(cardRow.vote_count),
      groupId: cardRow.group_id as string | null,
      groupTitle: cardRow.group_title as string | null,
      position: Number(cardRow.position),
    }));

    columns.push({
      id: colRow.id as string,
      name: colRow.name as string,
      position: Number(colRow.position),
      cards,
    });
  }

  // Fetch groups with card IDs
  const groupsRows = await sql`
    SELECT
      cg.id,
      cg.title,
      cg.position,
      col.id AS column_id,
      col.name AS column_name,
      COALESCE(SUM((SELECT COUNT(*)::int FROM card_votes WHERE card_id = cgm.card_id)), 0) AS total_votes
    FROM card_groups cg
    JOIN boards b ON cg.board_id = b.id
    JOIN columns col ON col.board_id = b.id
    LEFT JOIN card_group_members cgm ON cgm.group_id = cg.id
    LEFT JOIN cards c ON cgm.card_id = c.id AND c.column_id = col.id
    WHERE cg.board_id = ${boardId}
    GROUP BY cg.id, cg.title, cg.position, col.id, col.name
    HAVING COUNT(cgm.card_id) > 0
    ORDER BY cg.position
  `;

  const groups = [];
  for (const groupRow of groupsRows) {
    // Get cards for this group
    const groupCardsRows = await sql`
      SELECT
        c.id,
        c.content,
        COALESCE((SELECT COUNT(*)::int FROM card_votes WHERE card_id = c.id), 0) AS vote_count
      FROM card_group_members cgm
      JOIN cards c ON cgm.card_id = c.id
      WHERE cgm.group_id = ${groupRow.id}
      ORDER BY vote_count DESC
    `;

    const groupCards = groupCardsRows.map((cardRow) => ({
      id: cardRow.id as string,
      content: cardRow.content as string,
      voteCount: Number(cardRow.vote_count),
    }));

    groups.push({
      id: groupRow.id as string,
      title: groupRow.title as string,
      columnId: groupRow.column_id as string,
      columnName: groupRow.column_name as string,
      totalVotes: Number(groupRow.total_votes),
      cardIds: groupCards.map((c) => c.id),
      position: Number(groupRow.position),
      cards: groupCards,
    });
  }

  // Fetch action items if requested
  let actionItems: BoardExportData['actionItems'] = [];
  if (includeActionItems) {
    const actionItemsRows = await sql`
      SELECT
        ai.id,
        ai.title,
        ai.description,
        ai.due_date,
        ai.status,
        u.display_name AS assignee_name,
        c.content AS source_card_text,
        s.name AS carried_from_sprint_name
      FROM action_items ai
      LEFT JOIN users u ON ai.assignee_id = u.id
      LEFT JOIN cards c ON ai.card_id = c.id
      LEFT JOIN action_items carried_from ON ai.carried_from_id = carried_from.id
      LEFT JOIN boards carried_from_board ON carried_from.board_id = carried_from_board.id
      LEFT JOIN sprints s ON carried_from_board.sprint_id = s.id
      WHERE ai.board_id = ${boardId}
      ORDER BY ai.created_at
    `;

    actionItems = actionItemsRows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | null,
      assigneeName: row.assignee_name as string | null,
      dueDate: row.due_date ? (row.due_date as Date).toISOString().split('T')[0] : null,
      status: row.status as string,
      sourceCardText: row.source_card_text as string | null,
      carriedFromSprintName: row.carried_from_sprint_name as string | null,
    }));
  }

  // Fetch analytics if requested
  let analytics: BoardExportData['analytics'] = null;
  if (includeAnalytics) {
    const sprintId = (await sql`
      SELECT sprint_id FROM boards WHERE id = ${boardId}
    `)[0]?.sprint_id as string;

    if (sprintId) {
      // Get health metrics from materialized view
      const [healthRow] = await sql`
        SELECT
          health_score,
          sentiment_score,
          card_count,
          total_members,
          active_members
        FROM mv_sprint_health
        WHERE sprint_id = ${sprintId}
      `;

      if (healthRow) {
        const totalMembers = Number(healthRow.total_members);
        const activeMembers = Number(healthRow.active_members);
        const participationRate = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;

        // Get total votes
        const [votesRow] = await sql`
          SELECT COUNT(*)::int AS total
          FROM card_votes cv
          JOIN cards c ON cv.card_id = c.id
          WHERE c.board_id = ${boardId}
        `;

        // Sentiment breakdown (placeholder - sentiment analysis not yet implemented)
        const sentimentBreakdown = {
          positive: 0,
          negative: 0,
          neutral: 0,
        };

        // Get top voted cards
        const topVotedRows = await sql`
          SELECT
            c.content,
            col.name AS column_name,
            COUNT(cv.id)::int AS vote_count
          FROM cards c
          JOIN columns col ON c.column_id = col.id
          LEFT JOIN card_votes cv ON cv.card_id = c.id
          WHERE c.board_id = ${boardId}
          GROUP BY c.id, c.content, col.name
          ORDER BY vote_count DESC
          LIMIT 5
        `;

        const topVotedCards = topVotedRows.map((row) => ({
          content: row.content as string,
          voteCount: Number(row.vote_count),
          columnName: row.column_name as string,
        }));

        // Get top words from materialized view
        const topWordsRows = await sql`
          SELECT word, frequency
          FROM mv_word_frequency
          WHERE sprint_id = ${sprintId}
          ORDER BY frequency DESC
          LIMIT 20
        `;

        const topWords = topWordsRows.map((row) => ({
          word: row.word as string,
          frequency: Number(row.frequency),
        }));

        analytics = {
          healthScore: Number(healthRow.health_score),
          sentimentScore: Number(healthRow.sentiment_score),
          participationRate,
          totalCards: Number(healthRow.card_count),
          totalVotes: Number(votesRow.total),
          sentimentBreakdown,
          topVotedCards,
          topWords,
        };
      } else {
        // Fallback: Calculate basic analytics if materialized view is empty
        const [cardsRow] = await sql`
          SELECT COUNT(*)::int AS total FROM cards WHERE board_id = ${boardId}
        `;

        const [votesRow] = await sql`
          SELECT COUNT(*)::int AS total
          FROM card_votes cv
          JOIN cards c ON cv.card_id = c.id
          WHERE c.board_id = ${boardId}
        `;

        const topVotedRows = await sql`
          SELECT
            c.content,
            col.name AS column_name,
            COUNT(cv.id)::int AS vote_count
          FROM cards c
          JOIN columns col ON c.column_id = col.id
          LEFT JOIN card_votes cv ON cv.card_id = c.id
          WHERE c.board_id = ${boardId}
          GROUP BY c.id, c.content, col.name
          ORDER BY vote_count DESC
          LIMIT 5
        `;

        const topVotedCards = topVotedRows.map((row) => ({
          content: row.content as string,
          voteCount: Number(row.vote_count),
          columnName: row.column_name as string,
        }));

        analytics = {
          healthScore: 50,
          sentimentScore: 50,
          participationRate: 0,
          totalCards: Number(cardsRow.total),
          totalVotes: Number(votesRow.total),
          sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 },
          topVotedCards,
          topWords: [],
        };
      }
    }
  }

  return {
    board: {
      id: boardRow.id as string,
      name: boardRow.name as string,
      teamName: boardRow.team_name as string,
      sprintName: boardRow.sprint_name as string,
      sprintStartDate: boardRow.start_date
        ? (boardRow.start_date as Date).toISOString().split('T')[0]
        : '',
      sprintEndDate: boardRow.end_date
        ? (boardRow.end_date as Date).toISOString().split('T')[0]
        : '',
      templateName: boardRow.template_name as string | null,
      facilitatorName: boardRow.facilitator_name as string | null,
      phase: boardRow.phase as string,
      isAnonymous,
      cardsRevealed,
      participantCount: Number(boardRow.participant_count),
      createdAt: (boardRow.created_at as Date).toISOString(),
    },
    columns,
    groups,
    actionItems,
    analytics,
  };
}

/**
 * Fetch team report data
 */
export async function fetchTeamReportData(
  teamId: string,
  from: string,
  to: string
): Promise<TeamReportData> {
  // Fetch team info
  const [teamRow] = await sql`
    SELECT
      t.id,
      t.name,
      COUNT(tm.user_id)::int AS member_count
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id
    WHERE t.id = ${teamId}
    GROUP BY t.id, t.name
  `;

  if (!teamRow) {
    throw new AppError('NOT_FOUND', 404, 'Team not found');
  }

  // Fetch health trend
  const healthTrendRows = await sql`
    SELECT
      sprint_name,
      start_date,
      health_score,
      sentiment_score,
      participation_score
    FROM mv_sprint_health
    WHERE team_id = ${teamId}
      AND start_date >= ${from}
      AND start_date <= ${to}
    ORDER BY start_date DESC
  `;

  const healthTrend = healthTrendRows.map((row) => ({
    sprintName: row.sprint_name as string,
    startDate: (row.start_date as Date).toISOString().split('T')[0],
    healthScore: Number(row.health_score),
    sentimentScore: Number(row.sentiment_score),
    participationScore: Number(row.participation_score),
  }));

  // Fetch participation per member
  const participationRows = await sql`
    SELECT
      user_name,
      SUM(cards_submitted)::int AS total_cards,
      SUM(votes_cast)::int AS total_votes,
      SUM(action_items_completed)::int AS action_items_completed,
      SUM(action_items_owned)::int AS action_items_owned
    FROM mv_participation_stats
    WHERE team_id = ${teamId}
      AND start_date >= ${from}
      AND start_date <= ${to}
    GROUP BY user_id, user_name
    ORDER BY user_name
  `;

  const members = participationRows.map((row) => {
    const owned = Number(row.action_items_owned);
    const completed = Number(row.action_items_completed);
    const completionRate = owned > 0 ? (completed / owned) * 100 : 0;

    return {
      userName: row.user_name as string,
      totalCards: Number(row.total_cards),
      totalVotes: Number(row.total_votes),
      actionItemsCompleted: completed,
      actionItemCompletionRate: completionRate,
    };
  });

  // Fetch action items stats
  const [actionItemsRow] = await sql`
    SELECT
      COUNT(*)::int AS total_created,
      COUNT(*) FILTER (WHERE ai.status = 'done')::int AS total_completed,
      COUNT(*) FILTER (WHERE ai.carried_from_id IS NOT NULL)::int AS total_carried_over,
      COUNT(*) FILTER (WHERE ai.status IN ('open', 'in_progress'))::int AS currently_open
    FROM action_items ai
    JOIN boards b ON ai.board_id = b.id
    JOIN sprints s ON b.sprint_id = s.id
    WHERE s.team_id = ${teamId}
      AND s.start_date >= ${from}
      AND s.start_date <= ${to}
  `;

  const totalCreated = Number(actionItemsRow?.total_created || 0);
  const totalCompleted = Number(actionItemsRow?.total_completed || 0);
  const completionRate = totalCreated > 0 ? (totalCompleted / totalCreated) * 100 : 0;

  // Fetch top themes (word frequency)
  const topThemesRows = await sql`
    SELECT
      word,
      SUM(frequency)::int AS frequency
    FROM mv_word_frequency
    WHERE sprint_id IN (
      SELECT id FROM sprints
      WHERE team_id = ${teamId}
        AND start_date >= ${from}
        AND start_date <= ${to}
    )
    GROUP BY word
    ORDER BY frequency DESC
    LIMIT 20
  `;

  const topThemes = topThemesRows.map((row) => ({
    word: row.word as string,
    frequency: Number(row.frequency),
  }));

  return {
    team: {
      id: teamRow.id as string,
      name: teamRow.name as string,
      memberCount: Number(teamRow.member_count),
    },
    dateRange: {
      from,
      to,
    },
    sprintCount: healthTrend.length,
    healthTrend,
    participation: {
      members,
    },
    actionItems: {
      totalCreated,
      totalCompleted,
      completionRate,
      totalCarriedOver: Number(actionItemsRow?.total_carried_over || 0),
      currentlyOpen: Number(actionItemsRow?.currently_open || 0),
    },
    topThemes,
  };
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
 * Get team ID for a board
 */
export async function getTeamIdForBoard(boardId: string): Promise<string | null> {
  const [row] = await sql`
    SELECT s.team_id
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    WHERE b.id = ${boardId}
  `;
  return row ? (row.team_id as string) : null;
}
