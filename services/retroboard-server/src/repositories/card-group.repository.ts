import { sql } from '../db/connection.js';

export interface GroupRow {
  id: string;
  board_id: string;
  title: string;
  position: number;
  created_at: string;
}

function formatGroup(row: Record<string, unknown>): GroupRow {
  return {
    id: row.id as string,
    board_id: row.board_id as string,
    title: row.title as string,
    position: Number(row.position),
    created_at: (row.created_at as Date).toISOString(),
  };
}

export async function create(
  boardId: string,
  title: string,
  cardIds: string[] = [],
): Promise<GroupRow & { card_ids: string[] }> {
  return sql.begin(async (tx) => {
    const [maxPos] = await tx`
      SELECT COALESCE(MAX(position), -1)::int AS max_pos
      FROM card_groups WHERE board_id = ${boardId}
    `;

    const [row] = await tx`
      INSERT INTO card_groups (board_id, title, position)
      VALUES (${boardId}, ${title}, ${maxPos.max_pos + 1})
      RETURNING *
    `;

    for (const cardId of cardIds) {
      // Remove from old group if any
      await tx`DELETE FROM card_group_members WHERE card_id = ${cardId}`;
      await tx`INSERT INTO card_group_members (group_id, card_id) VALUES (${row.id}, ${cardId})`;
    }

    return { ...formatGroup(row), card_ids: cardIds };
  });
}

export async function findById(groupId: string): Promise<GroupRow | null> {
  const [row] = await sql`SELECT * FROM card_groups WHERE id = ${groupId}`;
  return row ? formatGroup(row) : null;
}

export async function update(
  groupId: string,
  fields: {
    title?: string;
    add_card_ids?: string[];
    remove_card_ids?: string[];
    position?: number;
  },
): Promise<(GroupRow & { card_ids: string[] }) | null> {
  return sql.begin(async (tx) => {
    // Update title/position if provided
    if (fields.title !== undefined || fields.position !== undefined) {
      const sets: ReturnType<typeof sql>[] = [];
      if (fields.title !== undefined) sets.push(sql`title = ${fields.title}`);
      if (fields.position !== undefined) sets.push(sql`position = ${fields.position}`);
      const setCombined = sets.reduce((a, b) => sql`${a}, ${b}`);
      await tx`UPDATE card_groups SET ${setCombined} WHERE id = ${groupId}`;
    }

    // Remove cards
    if (fields.remove_card_ids?.length) {
      for (const cardId of fields.remove_card_ids) {
        await tx`DELETE FROM card_group_members WHERE group_id = ${groupId} AND card_id = ${cardId}`;
      }
    }

    // Add cards (move from old group if needed)
    if (fields.add_card_ids?.length) {
      for (const cardId of fields.add_card_ids) {
        await tx`DELETE FROM card_group_members WHERE card_id = ${cardId}`;
        await tx`INSERT INTO card_group_members (group_id, card_id) VALUES (${groupId}, ${cardId})`;
      }
    }

    // Fetch updated group with card_ids
    const [row] = await tx`SELECT * FROM card_groups WHERE id = ${groupId}`;
    if (!row) return null;

    const cardRows = await tx`
      SELECT card_id FROM card_group_members WHERE group_id = ${groupId} ORDER BY card_id
    `;

    return {
      ...formatGroup(row),
      card_ids: cardRows.map((r: Record<string, unknown>) => r.card_id as string),
    };
  });
}

export async function remove(groupId: string): Promise<{ ungrouped_card_ids: string[] } | null> {
  return sql.begin(async (tx) => {
    // Get card_ids in this group
    const cardRows = await tx`
      SELECT card_id FROM card_group_members WHERE group_id = ${groupId}
    `;

    // Remove all group members
    await tx`DELETE FROM card_group_members WHERE group_id = ${groupId}`;

    // Delete the group
    const [deleted] = await tx`DELETE FROM card_groups WHERE id = ${groupId} RETURNING id`;
    if (!deleted) return null;

    return {
      ungrouped_card_ids: cardRows.map((r: Record<string, unknown>) => r.card_id as string),
    };
  });
}
