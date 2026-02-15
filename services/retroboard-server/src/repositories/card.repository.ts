import { sql } from '../db/connection.js';

export interface CardRow {
  id: string;
  board_id: string;
  column_id: string;
  author_id: string;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
}

function formatCard(row: Record<string, unknown>): CardRow {
  return {
    id: row.id as string,
    board_id: row.board_id as string,
    column_id: row.column_id as string,
    author_id: row.author_id as string,
    content: row.content as string,
    position: Number(row.position),
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

export async function create(
  boardId: string,
  columnId: string,
  authorId: string,
  content: string,
): Promise<CardRow> {
  const [maxPos] = await sql`
    SELECT COALESCE(MAX(position), -1)::int AS max_pos
    FROM cards WHERE column_id = ${columnId}
  `;
  const position = maxPos.max_pos + 1;

  const [row] = await sql`
    INSERT INTO cards (board_id, column_id, author_id, content, position)
    VALUES (${boardId}, ${columnId}, ${authorId}, ${content}, ${position})
    RETURNING *
  `;
  return formatCard(row);
}

export async function findById(cardId: string): Promise<CardRow | null> {
  const [row] = await sql`SELECT * FROM cards WHERE id = ${cardId}`;
  return row ? formatCard(row) : null;
}

export async function update(
  cardId: string,
  fields: { content?: string; column_id?: string; position?: number },
): Promise<CardRow | null> {
  const sets: ReturnType<typeof sql>[] = [];
  if (fields.content !== undefined) sets.push(sql`content = ${fields.content}`);
  if (fields.column_id !== undefined) sets.push(sql`column_id = ${fields.column_id}`);
  if (fields.position !== undefined) sets.push(sql`position = ${fields.position}`);

  if (sets.length === 0) return findById(cardId);

  const setCombined = sets.reduce((a, b) => sql`${a}, ${b}`);
  const [row] = await sql`
    UPDATE cards SET ${setCombined}
    WHERE id = ${cardId}
    RETURNING *
  `;
  return row ? formatCard(row) : null;
}

export async function remove(cardId: string): Promise<boolean> {
  const [row] = await sql`DELETE FROM cards WHERE id = ${cardId} RETURNING id`;
  return !!row;
}
