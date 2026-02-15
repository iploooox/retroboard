import { sql } from '../db/connection.js';
import type { BoardPhase, FocusItemType } from '../validation/boards.js';

export interface BoardRow {
  id: string;
  sprint_id: string;
  template_id: string;
  phase: BoardPhase;
  anonymous_mode: boolean;
  max_votes_per_user: number;
  max_votes_per_card: number;
  focus_item_id: string | null;
  focus_item_type: FocusItemType | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ColumnRow {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

function formatBoard(row: Record<string, unknown>): BoardRow {
  return {
    id: row.id as string,
    sprint_id: row.sprint_id as string,
    template_id: row.template_id as string,
    phase: row.phase as BoardPhase,
    anonymous_mode: row.anonymous_mode as boolean,
    max_votes_per_user: Number(row.max_votes_per_user),
    max_votes_per_card: Number(row.max_votes_per_card),
    focus_item_id: (row.focus_item_id as string) ?? null,
    focus_item_type: (row.focus_item_type as FocusItemType) ?? null,
    created_by: row.created_by as string,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

function formatColumn(row: Record<string, unknown>): ColumnRow {
  return {
    id: row.id as string,
    board_id: row.board_id as string,
    name: row.name as string,
    color: row.color as string,
    position: Number(row.position),
    created_at: (row.created_at as Date).toISOString(),
  };
}

export async function createBoard(data: {
  sprint_id: string;
  template_id: string;
  anonymous_mode: boolean;
  max_votes_per_user: number;
  max_votes_per_card: number;
  created_by: string;
}): Promise<{ board: BoardRow; columns: ColumnRow[] }> {
  return sql.begin(async (tx) => {
    // Create the board
    const [boardRow] = await tx`
      INSERT INTO boards (sprint_id, template_id, anonymous_mode, max_votes_per_user, max_votes_per_card, created_by)
      VALUES (${data.sprint_id}, ${data.template_id}, ${data.anonymous_mode}, ${data.max_votes_per_user}, ${data.max_votes_per_card}, ${data.created_by})
      RETURNING *
    `;

    // Copy template columns into board columns
    const templateColumns = await tx`
      SELECT name, color, position FROM template_columns
      WHERE template_id = ${data.template_id}
      ORDER BY position
    `;

    const columns: ColumnRow[] = [];
    for (const tc of templateColumns) {
      const [col] = await tx`
        INSERT INTO columns (board_id, name, color, position)
        VALUES (${boardRow.id}, ${tc.name}, ${tc.color}, ${tc.position})
        RETURNING *
      `;
      columns.push(formatColumn(col));
    }

    return { board: formatBoard(boardRow), columns };
  });
}

export async function findBySprintId(sprintId: string): Promise<BoardRow | null> {
  const [row] = await sql`
    SELECT * FROM boards WHERE sprint_id = ${sprintId}
  `;
  return row ? formatBoard(row) : null;
}

export async function findById(id: string): Promise<BoardRow | null> {
  const [row] = await sql`
    SELECT * FROM boards WHERE id = ${id}
  `;
  return row ? formatBoard(row) : null;
}

export async function getColumns(boardId: string): Promise<ColumnRow[]> {
  const rows = await sql`
    SELECT * FROM columns WHERE board_id = ${boardId} ORDER BY position
  `;
  return rows.map(formatColumn);
}

export async function getFullBoard(sprintId: string, userId: string): Promise<{
  board: BoardRow;
  columns: (ColumnRow & { cards: unknown[] })[];
  groups: unknown[];
  user_votes_remaining: number;
  user_total_votes_cast: number;
} | null> {
  const [boardRow] = await sql`
    SELECT * FROM boards WHERE sprint_id = ${sprintId}
  `;
  if (!boardRow) return null;

  const board = formatBoard(boardRow);

  const columnsRows = await sql`
    SELECT * FROM columns WHERE board_id = ${board.id} ORDER BY position
  `;

  // Get cards with vote info
  const cardsRows = await sql`
    SELECT c.*,
           u.display_name AS author_name,
           COALESCE(v.vote_count, 0)::int AS vote_count,
           COALESCE(uv.user_votes, 0)::int AS user_votes,
           cgm.group_id
    FROM cards c
    JOIN users u ON u.id = c.author_id
    LEFT JOIN (
      SELECT card_id, COUNT(*)::int AS vote_count
      FROM card_votes
      GROUP BY card_id
    ) v ON v.card_id = c.id
    LEFT JOIN (
      SELECT card_id, COUNT(*)::int AS user_votes
      FROM card_votes
      WHERE user_id = ${userId}
      GROUP BY card_id
    ) uv ON uv.card_id = c.id
    LEFT JOIN card_group_members cgm ON cgm.card_id = c.id
    WHERE c.board_id = ${board.id}
    ORDER BY c.column_id, c.position
  `;

  // Get groups
  const groupsRows = await sql`
    SELECT cg.*,
           COALESCE(
             array_agg(cgm.card_id ORDER BY cgm.card_id) FILTER (WHERE cgm.card_id IS NOT NULL),
             ARRAY[]::UUID[]
           ) AS card_ids,
           COALESCE(SUM(vc.cnt), 0)::int AS total_votes
    FROM card_groups cg
    LEFT JOIN card_group_members cgm ON cgm.group_id = cg.id
    LEFT JOIN (
      SELECT card_id, COUNT(*)::int AS cnt
      FROM card_votes
      GROUP BY card_id
    ) vc ON vc.card_id = cgm.card_id
    WHERE cg.board_id = ${board.id}
    GROUP BY cg.id
    ORDER BY cg.position
  `;

  // Count user's total votes on this board
  const [voteCount] = await sql`
    SELECT COUNT(*)::int AS total_votes_cast
    FROM card_votes cv
    JOIN cards c ON c.id = cv.card_id
    WHERE c.board_id = ${board.id} AND cv.user_id = ${userId}
  `;

  const userTotalVotesCast = Number(voteCount.total_votes_cast);
  const userVotesRemaining = board.max_votes_per_user - userTotalVotesCast;

  // Build columns with nested cards
  const columns = columnsRows.map((col) => {
    const colCards = cardsRows
      .filter((c) => c.column_id === col.id)
      .map((c) => ({
        id: c.id as string,
        column_id: c.column_id as string,
        board_id: c.board_id as string,
        content: c.content as string,
        author_id: c.author_id as string,
        author_name: c.author_name as string,
        position: Number(c.position),
        vote_count: Number(c.vote_count),
        user_votes: Number(c.user_votes),
        group_id: (c.group_id as string) ?? null,
        created_at: (c.created_at as Date).toISOString(),
        updated_at: (c.updated_at as Date).toISOString(),
      }));

    return {
      ...formatColumn(col),
      cards: colCards,
    };
  });

  const groups = groupsRows.map((g) => ({
    id: g.id as string,
    board_id: g.board_id as string,
    title: g.title as string,
    position: Number(g.position),
    card_ids: (g.card_ids as string[]) || [],
    total_votes: Number(g.total_votes),
    created_at: (g.created_at as Date).toISOString(),
  }));

  return {
    board,
    columns,
    groups,
    user_votes_remaining: userVotesRemaining,
    user_total_votes_cast: userTotalVotesCast,
  };
}

export async function updateSettings(
  boardId: string,
  data: {
    anonymous_mode?: boolean;
    max_votes_per_user?: number;
    max_votes_per_card?: number;
  },
): Promise<BoardRow | null> {
  const sets: ReturnType<typeof sql>[] = [];
  if (data.anonymous_mode !== undefined) {
    sets.push(sql`anonymous_mode = ${data.anonymous_mode}`);
  }
  if (data.max_votes_per_user !== undefined) {
    sets.push(sql`max_votes_per_user = ${data.max_votes_per_user}`);
  }
  if (data.max_votes_per_card !== undefined) {
    sets.push(sql`max_votes_per_card = ${data.max_votes_per_card}`);
  }

  if (sets.length === 0) return findById(boardId);

  const setCombined = sets.reduce((a, b) => sql`${a}, ${b}`);
  const [row] = await sql`
    UPDATE boards SET ${setCombined}
    WHERE id = ${boardId}
    RETURNING *
  `;
  return row ? formatBoard(row) : null;
}

export async function setPhase(boardId: string, phase: BoardPhase): Promise<BoardRow | null> {
  // If leaving discuss phase, clear focus
  const [row] = await sql`
    UPDATE boards
    SET phase = ${phase},
        focus_item_id = CASE WHEN ${phase} != 'discuss' THEN NULL ELSE focus_item_id END,
        focus_item_type = CASE WHEN ${phase} != 'discuss' THEN NULL ELSE focus_item_type END
    WHERE id = ${boardId}
    RETURNING *
  `;
  return row ? formatBoard(row) : null;
}

export async function setFocus(
  boardId: string,
  focusItemId: string | null,
  focusItemType: FocusItemType | null,
): Promise<BoardRow | null> {
  const [row] = await sql`
    UPDATE boards
    SET focus_item_id = ${focusItemId}, focus_item_type = ${focusItemType}
    WHERE id = ${boardId}
    RETURNING *
  `;
  return row ? formatBoard(row) : null;
}

export async function cardExistsOnBoard(cardId: string, boardId: string): Promise<boolean> {
  const [row] = await sql`
    SELECT 1 FROM cards WHERE id = ${cardId} AND board_id = ${boardId}
  `;
  return !!row;
}

export async function groupExistsOnBoard(groupId: string, boardId: string): Promise<boolean> {
  const [row] = await sql`
    SELECT 1 FROM card_groups WHERE id = ${groupId} AND board_id = ${boardId}
  `;
  return !!row;
}

export async function templateExists(templateId: string): Promise<boolean> {
  const [row] = await sql`
    SELECT 1 FROM templates WHERE id = ${templateId}
  `;
  return !!row;
}

export async function sprintExists(sprintId: string): Promise<{ exists: boolean; team_id: string | null }> {
  const [row] = await sql`
    SELECT team_id FROM sprints WHERE id = ${sprintId}
  `;
  return { exists: !!row, team_id: row ? (row.team_id as string) : null };
}

export async function getTeamIdForBoard(boardId: string): Promise<string | null> {
  const [row] = await sql`
    SELECT s.team_id
    FROM boards b
    JOIN sprints s ON s.id = b.sprint_id
    WHERE b.id = ${boardId}
  `;
  return row ? (row.team_id as string) : null;
}

export async function getUserTeamRole(teamId: string, userId: string): Promise<string | null> {
  const [row] = await sql`
    SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}
  `;
  return row ? (row.role as string) : null;
}
