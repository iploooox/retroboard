import { sql } from '../db/connection.js';

const PAGE_SIZE = 100;

export async function getEventsAfter(
  boardId: string,
  lastEventId: string,
): Promise<{ events: EventRecord[]; hasMore: boolean }> {
  // Check if lastEventId exists
  const [lastEvent] = await sql`
    SELECT 1 FROM board_events
    WHERE id = ${lastEventId} AND board_id = ${boardId}
  `;

  let rows;
  if (lastEvent) {
    // Use subquery to keep full timestamp precision (avoids JS Date ms truncation)
    rows = await sql`
      SELECT * FROM board_events be
      WHERE be.board_id = ${boardId}
        AND (be.created_at, be.id) > (
          SELECT be2.created_at, be2.id
          FROM board_events be2
          WHERE be2.id = ${lastEventId}
        )
      ORDER BY be.created_at ASC, be.id ASC
      LIMIT ${PAGE_SIZE + 1}
    `;
  } else {
    // Unknown lastEventId — return all recent events for the board
    rows = await sql`
      SELECT * FROM board_events
      WHERE board_id = ${boardId}
      ORDER BY created_at ASC, id ASC
      LIMIT ${PAGE_SIZE + 1}
    `;
  }

  const hasMore = rows.length > PAGE_SIZE;
  const resultRows = rows.slice(0, PAGE_SIZE);

  const events: EventRecord[] = resultRows.map((row) => ({
    type: row.event_type as string,
    payload: row.payload ?? { id: row.entity_id as string },
    timestamp: new Date(row.created_at as string).toISOString(),
    eventId: row.id as string,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string,
  }));

  return { events, hasMore };
}

export interface EventRecord {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  eventId: string;
  entityType: string;
  entityId: string;
}
