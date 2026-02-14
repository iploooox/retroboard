import { sql } from '../db/connection.js';
import type { SprintStatus } from '../validation/sprints.js';

export interface SprintRow {
  id: string;
  team_id: string;
  name: string;
  goal: string | null;
  sprint_number: number;
  start_date: string;
  end_date: string | null;
  status: SprintStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function create(data: {
  team_id: string;
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string | null;
  created_by: string;
}): Promise<SprintRow> {
  const [sprint] = await sql`
    INSERT INTO sprints (team_id, name, goal, start_date, end_date, sprint_number, created_by)
    VALUES (
      ${data.team_id},
      ${data.name},
      ${data.goal},
      ${data.start_date},
      ${data.end_date},
      (SELECT COALESCE(MAX(sprint_number), 0) + 1 FROM sprints WHERE team_id = ${data.team_id}),
      ${data.created_by}
    )
    RETURNING *
  `;
  return formatSprint(sprint);
}

export async function findById(id: string, teamId: string): Promise<SprintRow | null> {
  const [sprint] = await sql`
    SELECT * FROM sprints WHERE id = ${id} AND team_id = ${teamId}
  `;
  return sprint ? formatSprint(sprint) : null;
}

export async function findByTeamId(
  teamId: string,
  options: {
    status?: SprintStatus;
    page: number;
    perPage: number;
  },
): Promise<{ sprints: SprintRow[]; total: number }> {
  const offset = (options.page - 1) * options.perPage;

  let rows;
  let countResult;
  if (options.status) {
    [rows, countResult] = await Promise.all([
      sql`
        SELECT *
        FROM sprints
        WHERE team_id = ${teamId} AND status = ${options.status}
        ORDER BY start_date DESC, created_at DESC
        LIMIT ${options.perPage} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS total FROM sprints
        WHERE team_id = ${teamId} AND status = ${options.status}
      `,
    ]);
  } else {
    [rows, countResult] = await Promise.all([
      sql`
        SELECT *
        FROM sprints
        WHERE team_id = ${teamId}
        ORDER BY start_date DESC, created_at DESC
        LIMIT ${options.perPage} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS total FROM sprints
        WHERE team_id = ${teamId}
      `,
    ]);
  }

  const total = Number(countResult[0].total);
  return {
    sprints: rows.map(formatSprint),
    total,
  };
}

export async function update(
  id: string,
  teamId: string,
  data: {
    name?: string;
    goal?: string | null;
    start_date?: string;
    end_date?: string | null;
  },
): Promise<SprintRow | null> {
  // Build dynamic update
  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    sets.push('name');
    values.push(data.name);
  }

  // Use a dynamic approach with individual queries
  // The postgres library handles this best with tagged templates
  const [sprint] = await sql`
    UPDATE sprints
    SET
      name = COALESCE(${data.name !== undefined ? data.name : null}, name),
      goal = ${data.goal !== undefined ? data.goal : sql`goal`},
      start_date = COALESCE(${data.start_date !== undefined ? data.start_date : null}, start_date),
      end_date = ${data.end_date !== undefined ? data.end_date : sql`end_date`},
      updated_at = NOW()
    WHERE id = ${id} AND team_id = ${teamId}
    RETURNING *
  `;

  return sprint ? formatSprint(sprint) : null;
}

export async function activate(id: string, teamId: string): Promise<SprintRow | null> {
  const [sprint] = await sql`
    UPDATE sprints
    SET status = 'active', updated_at = NOW()
    WHERE id = ${id} AND team_id = ${teamId} AND status = 'planning'
    RETURNING *
  `;
  return sprint ? formatSprint(sprint) : null;
}

export async function complete(id: string, teamId: string): Promise<SprintRow | null> {
  const [sprint] = await sql`
    UPDATE sprints
    SET status = 'completed', updated_at = NOW()
    WHERE id = ${id} AND team_id = ${teamId} AND status = 'active'
    RETURNING *
  `;
  return sprint ? formatSprint(sprint) : null;
}

export async function findActiveByTeamId(teamId: string): Promise<SprintRow | null> {
  const [sprint] = await sql`
    SELECT * FROM sprints WHERE team_id = ${teamId} AND status = 'active'
  `;
  return sprint ? formatSprint(sprint) : null;
}

export async function remove(id: string, teamId: string): Promise<boolean> {
  const [result] = await sql`
    DELETE FROM sprints WHERE id = ${id} AND team_id = ${teamId} RETURNING id
  `;
  return !!result;
}

function formatSprint(row: Record<string, unknown>): SprintRow {
  return {
    id: row.id as string,
    team_id: row.team_id as string,
    name: row.name as string,
    goal: row.goal as string | null,
    sprint_number: Number(row.sprint_number),
    start_date: formatDate(row.start_date),
    end_date: row.end_date ? formatDate(row.end_date) : null,
    status: row.status as SprintStatus,
    created_by: row.created_by as string,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

function formatDate(value: unknown): string {
  if (typeof value === 'string') {
    // Already a string, might be ISO format — extract date part
    return value.slice(0, 10);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}
