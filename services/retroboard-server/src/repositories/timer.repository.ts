import { sql } from '../db/connection.js';

export interface TimerRow {
  board_id: string;
  phase: string;
  duration_seconds: number;
  remaining_seconds: number;
  started_at: Date;
  paused_at: Date | null;
  started_by: string;
  created_at: Date;
  updated_at: Date;
}

export async function create(data: {
  board_id: string;
  phase: string;
  duration_seconds: number;
  remaining_seconds: number;
  started_by: string;
}): Promise<TimerRow> {
  const [row] = await sql`
    INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
    VALUES (${data.board_id}, ${data.phase}, ${data.duration_seconds}, ${data.remaining_seconds}, ${data.started_by})
    RETURNING *
  `;
  return row as unknown as TimerRow;
}

export async function findByBoardId(boardId: string): Promise<TimerRow | null> {
  const [row] = await sql`
    SELECT * FROM board_timers WHERE board_id = ${boardId}
  `;
  return row ? (row as unknown as TimerRow) : null;
}

export async function update(boardId: string, data: {
  remaining_seconds?: number;
  paused_at?: Date | null;
}): Promise<TimerRow> {
  const sets: ReturnType<typeof sql>[] = [];
  if (data.remaining_seconds !== undefined) {
    sets.push(sql`remaining_seconds = ${data.remaining_seconds}`);
  }
  if (data.paused_at !== undefined) {
    sets.push(sql`paused_at = ${data.paused_at}`);
  }

  if (sets.length === 0) {
    return (await findByBoardId(boardId))!;
  }

  const setCombined = sets.reduce((a, b) => sql`${a}, ${b}`);
  const [row] = await sql`
    UPDATE board_timers SET ${setCombined}
    WHERE board_id = ${boardId}
    RETURNING *
  `;
  return row as unknown as TimerRow;
}

export async function remove(boardId: string): Promise<void> {
  await sql`DELETE FROM board_timers WHERE board_id = ${boardId}`;
}
