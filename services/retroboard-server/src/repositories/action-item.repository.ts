import { sql } from '../db/connection.js';

function formatDate(date: unknown): string | null {
  if (!date) return null;
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return String(date).split('T')[0];
}

export function formatActionItem(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    boardId: row.board_id as string,
    cardId: (row.card_id as string) ?? null,
    cardText: (row.card_text as string) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? null,
    assigneeId: (row.assignee_id as string) ?? null,
    assigneeName: (row.assignee_name as string) ?? null,
    dueDate: formatDate(row.due_date),
    status: row.status as string,
    completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
    carriedFromId: (row.carried_from_id as string) ?? null,
    carriedFromSprintName: (row.carried_from_sprint_name as string) ?? null,
    createdBy: row.created_by as string,
    createdByName: row.created_by_name as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function formatTeamActionItem(row: Record<string, unknown>) {
  return {
    ...formatActionItem(row),
    sprintId: row.sprint_id as string,
    sprintName: row.sprint_name as string,
  };
}

// ─── Lookups ────────────────────────────────────────

export async function getTeamIdForBoard(boardId: string): Promise<string | null> {
  const [row] = await sql`
    SELECT s.team_id
    FROM boards b
    JOIN sprints s ON s.id = b.sprint_id
    WHERE b.id = ${boardId}
  `;
  return row ? (row.team_id as string) : null;
}

export async function getTeamIdForActionItem(
  actionItemId: string,
): Promise<{ teamId: string; boardId: string } | null> {
  const [row] = await sql`
    SELECT s.team_id, ai.board_id
    FROM action_items ai
    JOIN boards b ON b.id = ai.board_id
    JOIN sprints s ON s.id = b.sprint_id
    WHERE ai.id = ${actionItemId}
  `;
  return row ? { teamId: row.team_id as string, boardId: row.board_id as string } : null;
}

export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const [row] = await sql`
    SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}
  `;
  return !!row;
}

export async function cardBelongsToBoard(cardId: string, boardId: string): Promise<boolean> {
  const [row] = await sql`
    SELECT 1 FROM cards WHERE id = ${cardId} AND board_id = ${boardId}
  `;
  return !!row;
}

export async function teamExists(teamId: string): Promise<boolean> {
  const [row] = await sql`
    SELECT 1 FROM teams WHERE id = ${teamId}
  `;
  return !!row;
}

// ─── Enriched finder (with JOINs) ──────────────────

export async function findEnrichedById(id: string) {
  const [row] = await sql`
    SELECT
      ai.*,
      u_assignee.display_name AS assignee_name,
      u_creator.display_name AS created_by_name,
      c.content AS card_text,
      carried_sprint.name AS carried_from_sprint_name
    FROM action_items ai
    LEFT JOIN users u_assignee ON ai.assignee_id = u_assignee.id
    LEFT JOIN users u_creator ON ai.created_by = u_creator.id
    LEFT JOIN cards c ON ai.card_id = c.id
    LEFT JOIN action_items carried ON ai.carried_from_id = carried.id
    LEFT JOIN boards carried_board ON carried.board_id = carried_board.id
    LEFT JOIN sprints carried_sprint ON carried_board.sprint_id = carried_sprint.id
    WHERE ai.id = ${id}
  `;
  return row ? formatActionItem(row) : null;
}

// ─── CRUD ───────────────────────────────────────────

export async function create(data: {
  boardId: string;
  cardId: string | null;
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  createdBy: string;
}) {
  const [row] = await sql`
    INSERT INTO action_items (board_id, card_id, title, description, assignee_id, due_date, created_by)
    VALUES (
      ${data.boardId},
      ${data.cardId},
      ${data.title},
      ${data.description},
      ${data.assigneeId},
      ${data.dueDate},
      ${data.createdBy}
    )
    RETURNING *
  `;
  return findEnrichedById(row.id as string);
}

export async function update(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    assigneeId?: string | null;
    dueDate?: string | null;
    status?: string;
  },
  flags: {
    hasDescription: boolean;
    hasAssigneeId: boolean;
    hasDueDate: boolean;
  },
) {
  const sets: ReturnType<typeof sql>[] = [];

  if (data.title !== undefined) {
    sets.push(sql`title = ${data.title}`);
  }
  if (flags.hasDescription) {
    sets.push(sql`description = ${data.description ?? null}`);
  }
  if (flags.hasAssigneeId) {
    sets.push(sql`assignee_id = ${data.assigneeId ?? null}`);
  }
  if (flags.hasDueDate) {
    sets.push(sql`due_date = ${data.dueDate ?? null}`);
  }
  if (data.status !== undefined) {
    sets.push(sql`status = ${data.status}`);
  }

  if (sets.length === 0) {
    return findEnrichedById(id);
  }

  const setCombined = sets.reduce((a, b) => sql`${a}, ${b}`);
  const [row] = await sql`
    UPDATE action_items SET ${setCombined}
    WHERE id = ${id}
    RETURNING *
  `;
  if (!row) return null;
  return findEnrichedById(id);
}

export async function remove(id: string): Promise<boolean> {
  const [row] = await sql`
    DELETE FROM action_items WHERE id = ${id} RETURNING id
  `;
  return !!row;
}

// ─── List by board ──────────────────────────────────

function buildOrderClause(sort: string, order: string) {
  if (sort === 'due_date' && order === 'asc') return sql`ORDER BY ai.due_date ASC NULLS LAST`;
  if (sort === 'due_date' && order === 'desc') return sql`ORDER BY ai.due_date DESC NULLS FIRST`;
  if (sort === 'status' && order === 'asc') return sql`ORDER BY ai.status ASC`;
  if (sort === 'status' && order === 'desc') return sql`ORDER BY ai.status DESC`;
  if (sort === 'title' && order === 'asc') return sql`ORDER BY ai.title ASC`;
  if (sort === 'title' && order === 'desc') return sql`ORDER BY ai.title DESC`;
  if (order === 'desc') return sql`ORDER BY ai.created_at DESC`;
  return sql`ORDER BY ai.created_at ASC`;
}

export async function findByBoardId(
  boardId: string,
  options: {
    status?: string;
    assigneeId?: string;
    sort: string;
    order: string;
    limit: number;
    offset: number;
  },
) {
  const conditions = [sql`ai.board_id = ${boardId}`];
  if (options.status) {
    conditions.push(sql`ai.status = ${options.status}`);
  }
  if (options.assigneeId) {
    conditions.push(sql`ai.assignee_id = ${options.assigneeId}`);
  }
  const where = conditions.reduce((a, b) => sql`${a} AND ${b}`);

  const [countRow] = await sql`
    SELECT COUNT(*)::int AS total
    FROM action_items ai
    WHERE ${where}
  `;

  const orderBy = buildOrderClause(options.sort, options.order);

  const rows = await sql`
    SELECT
      ai.*,
      u_assignee.display_name AS assignee_name,
      u_creator.display_name AS created_by_name,
      c.content AS card_text,
      carried_sprint.name AS carried_from_sprint_name
    FROM action_items ai
    LEFT JOIN users u_assignee ON ai.assignee_id = u_assignee.id
    LEFT JOIN users u_creator ON ai.created_by = u_creator.id
    LEFT JOIN cards c ON ai.card_id = c.id
    LEFT JOIN action_items carried ON ai.carried_from_id = carried.id
    LEFT JOIN boards carried_board ON carried.board_id = carried_board.id
    LEFT JOIN sprints carried_sprint ON carried_board.sprint_id = carried_sprint.id
    WHERE ${where}
    ${orderBy}
    LIMIT ${options.limit} OFFSET ${options.offset}
  `;

  return {
    items: rows.map((r) => formatActionItem(r)),
    total: countRow.total as number,
  };
}

// ─── List by team ───────────────────────────────────

function buildTeamOrderClause(sort: string, order: string) {
  if (sort === 'sprint' && order === 'asc') return sql`ORDER BY s.start_date ASC, ai.created_at ASC`;
  if (sort === 'sprint' && order === 'desc') return sql`ORDER BY s.start_date DESC, ai.created_at ASC`;
  if (sort === 'due_date' && order === 'asc') return sql`ORDER BY ai.due_date ASC NULLS LAST`;
  if (sort === 'due_date' && order === 'desc') return sql`ORDER BY ai.due_date DESC NULLS FIRST`;
  if (sort === 'status' && order === 'asc') return sql`ORDER BY ai.status ASC`;
  if (sort === 'status' && order === 'desc') return sql`ORDER BY ai.status DESC`;
  if (order === 'asc') return sql`ORDER BY ai.created_at ASC`;
  return sql`ORDER BY ai.created_at DESC`;
}

export async function findByTeam(
  teamId: string,
  options: {
    status?: string;
    sprintId?: string;
    assigneeId?: string;
    sort: string;
    order: string;
    limit: number;
    offset: number;
  },
) {
  // Build filter conditions
  const conditions = [sql`s.team_id = ${teamId}`];
  if (options.status) {
    conditions.push(sql`ai.status = ${options.status}`);
  }
  if (options.sprintId) {
    conditions.push(sql`s.id = ${options.sprintId}`);
  }
  if (options.assigneeId) {
    conditions.push(sql`ai.assignee_id = ${options.assigneeId}`);
  }
  const where = conditions.reduce((a, b) => sql`${a} AND ${b}`);

  // Total count (filtered)
  const [countRow] = await sql`
    SELECT COUNT(*)::int AS total
    FROM action_items ai
    JOIN boards b ON ai.board_id = b.id
    JOIN sprints s ON b.sprint_id = s.id
    WHERE ${where}
  `;

  // Summary counts (for full team — no filters)
  const [summary] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE ai.status = 'open')::int AS open_count,
      COUNT(*) FILTER (WHERE ai.status = 'in_progress')::int AS in_progress_count,
      COUNT(*) FILTER (WHERE ai.status = 'done')::int AS done_count,
      COUNT(*) FILTER (
        WHERE ai.status IN ('open', 'in_progress')
        AND ai.due_date IS NOT NULL
        AND ai.due_date < CURRENT_DATE
      )::int AS overdue_count
    FROM action_items ai
    JOIN boards b ON ai.board_id = b.id
    JOIN sprints s ON b.sprint_id = s.id
    WHERE s.team_id = ${teamId}
  `;

  const orderBy = buildTeamOrderClause(options.sort, options.order);

  const rows = await sql`
    SELECT
      ai.*,
      s.id AS sprint_id,
      s.name AS sprint_name,
      u_assignee.display_name AS assignee_name,
      u_creator.display_name AS created_by_name,
      c.content AS card_text,
      carried_sprint.name AS carried_from_sprint_name
    FROM action_items ai
    JOIN boards b ON ai.board_id = b.id
    JOIN sprints s ON b.sprint_id = s.id
    LEFT JOIN users u_assignee ON ai.assignee_id = u_assignee.id
    LEFT JOIN users u_creator ON ai.created_by = u_creator.id
    LEFT JOIN cards c ON ai.card_id = c.id
    LEFT JOIN action_items carried ON ai.carried_from_id = carried.id
    LEFT JOIN boards carried_board ON carried.board_id = carried_board.id
    LEFT JOIN sprints carried_sprint ON carried_board.sprint_id = carried_sprint.id
    WHERE ${where}
    ${orderBy}
    LIMIT ${options.limit} OFFSET ${options.offset}
  `;

  return {
    items: rows.map((r) => formatTeamActionItem(r)),
    total: countRow.total as number,
    summary: {
      open: summary.open_count as number,
      inProgress: summary.in_progress_count as number,
      done: summary.done_count as number,
      overdue: summary.overdue_count as number,
    },
  };
}

// ─── Carry-over ─────────────────────────────────────

export async function carryOver(boardId: string, userId: string) {
  // 1. Get board's sprint and team
  const [boardInfo] = await sql`
    SELECT b.id AS board_id, s.id AS sprint_id, s.team_id
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    WHERE b.id = ${boardId}
  `;
  if (!boardInfo) return null;

  // 2. Find previous sprint (same team, earlier start_date, closest to current)
  const [prevSprint] = await sql`
    SELECT s.id, s.name
    FROM sprints s
    WHERE s.team_id = ${boardInfo.team_id}
      AND s.id != ${boardInfo.sprint_id}
      AND s.start_date < (SELECT s2.start_date FROM sprints s2 WHERE s2.id = ${boardInfo.sprint_id})
    ORDER BY s.start_date DESC
    LIMIT 1
  `;

  if (!prevSprint) {
    return { noPreviousSprint: true as const };
  }

  // 3. Get ALL action items from previous sprint's board(s)
  const prevItems = await sql`
    SELECT ai.*, u.display_name AS assignee_name
    FROM action_items ai
    JOIN boards b ON ai.board_id = b.id
    LEFT JOIN users u ON ai.assignee_id = u.id
    WHERE b.sprint_id = ${prevSprint.id}
  `;

  // 4. Check which items are already carried to this board
  const alreadyCarriedRows = await sql`
    SELECT carried_from_id, id
    FROM action_items
    WHERE board_id = ${boardId}
      AND carried_from_id IS NOT NULL
  `;
  const alreadyCarriedMap = new Map<string, string>();
  for (const r of alreadyCarriedRows) {
    alreadyCarriedMap.set(r.carried_from_id as string, r.id as string);
  }

  // 5. Separate items into categories
  const skipped: { originalId: string; title: string; reason: string }[] = [];
  const alreadyCarried: { originalId: string; existingId: string; title: string; reason: string }[] = [];
  const toCarry: (typeof prevItems)[number][] = [];

  for (const item of prevItems) {
    if (item.status === 'done') {
      skipped.push({
        originalId: item.id as string,
        title: item.title as string,
        reason: 'already_done',
      });
    } else if (alreadyCarriedMap.has(item.id as string)) {
      alreadyCarried.push({
        originalId: item.id as string,
        existingId: alreadyCarriedMap.get(item.id as string)!,
        title: item.title as string,
        reason: 'already_carried_over',
      });
    } else {
      toCarry.push(item);
    }
  }

  // 6. Create new items for those to carry
  const carriedOver: {
    id: string;
    originalId: string;
    originalSprintName: string;
    title: string;
    description: string | null;
    assigneeId: string | null;
    assigneeName: string | null;
    dueDate: string | null;
    status: string;
    originalStatus: string;
  }[] = [];

  for (const item of toCarry) {
    const [newItem] = await sql`
      INSERT INTO action_items (board_id, title, description, assignee_id, due_date, status, carried_from_id, created_by)
      VALUES (
        ${boardId},
        ${item.title},
        ${item.description},
        ${item.assignee_id},
        ${item.due_date},
        'open',
        ${item.id},
        ${userId}
      )
      RETURNING *
    `;

    carriedOver.push({
      id: newItem.id as string,
      originalId: item.id as string,
      originalSprintName: prevSprint.name as string,
      title: newItem.title as string,
      description: (newItem.description as string) ?? null,
      assigneeId: (newItem.assignee_id as string) ?? null,
      assigneeName: (item.assignee_name as string) ?? null,
      dueDate: formatDate(newItem.due_date),
      status: 'open',
      originalStatus: item.status as string,
    });
  }

  return {
    carriedOver,
    skipped,
    alreadyCarried,
    sourceSprintName: prevSprint.name as string,
    totalResolved: carriedOver.length,
    totalSkipped: skipped.length,
    totalAlreadyCarried: alreadyCarried.length,
  };
}
