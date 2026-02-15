import postgres from 'postgres';
import { sql } from '../db/connection.js';

export interface NotifyPayload {
  eventId: string;
  type: string;
  entityId: string;
  actorId: string | null;
  ts: number;
}

export class NotifyListener {
  private listenerSql: ReturnType<typeof postgres> | null = null;
  private boardRefCounts: Map<string, number> = new Map();
  private handler: (boardId: string, message: object) => void;

  constructor(handler: (boardId: string, message: object) => void) {
    this.handler = handler;
  }

  private getConnection(): ReturnType<typeof postgres> {
    if (!this.listenerSql) {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error('DATABASE_URL not set');
      this.listenerSql = postgres(url, { max: 1 });
    }
    return this.listenerSql;
  }

  async subscribe(boardId: string): Promise<void> {
    const count = this.boardRefCounts.get(boardId) ?? 0;
    this.boardRefCounts.set(boardId, count + 1);
    if (count === 0) {
      const channel = `board:${boardId}`;
      const conn = this.getConnection();
      await conn.listen(channel, (payload) => {
        this.onNotification(boardId, payload).catch((err) => {
          console.error('Error handling NOTIFY:', err);
        });
      });
    }
  }

  async unsubscribe(boardId: string): Promise<void> {
    const count = this.boardRefCounts.get(boardId) ?? 0;
    if (count <= 1) {
      this.boardRefCounts.delete(boardId);
      try {
        const channel = `board:${boardId}`;
        const conn = this.getConnection();
        await conn.unlisten(channel);
      } catch {
        // Ignore errors on unlisten (e.g., connection already closed)
      }
    } else {
      this.boardRefCounts.set(boardId, count - 1);
    }
  }

  private async onNotification(boardId: string, rawPayload: string): Promise<void> {
    let data: NotifyPayload;
    try {
      data = JSON.parse(rawPayload);
    } catch {
      console.error('Invalid NOTIFY payload:', rawPayload);
      return;
    }

    const message = await this.enrichEvent(boardId, data);
    this.handler(boardId, message);
  }

  private async enrichEvent(boardId: string, data: NotifyPayload): Promise<object> {
    const { eventId, type, entityId, actorId, ts } = data;
    const timestamp = new Date(ts * 1000).toISOString();

    let payload: Record<string, unknown> = { id: entityId, boardId };

    switch (type) {
      case 'card_created':
      case 'card_updated': {
        const [card] = await sql`
          SELECT
            c.*,
            u.display_name as author_name,
            COALESCE((SELECT COUNT(*) FROM card_votes WHERE card_id = c.id), 0) as vote_count
          FROM cards c
          LEFT JOIN users u ON u.id = c.author_id
          WHERE c.id = ${entityId}
        `;
        if (card) {
          payload = {
            card: {
              id: card.id,
              board_id: card.board_id,
              column_id: card.column_id,
              content: card.content,
              author_id: card.author_id,
              author_name: card.author_name || null,
              position: Number(card.position),
              vote_count: Number(card.vote_count),
              user_votes: 0, // Not tracked in WS events
              group_id: card.group_id || null,
              created_at: card.created_at,
              updated_at: card.updated_at,
            },
          };
        }
        break;
      }
      case 'card_deleted':
        payload = { id: entityId, boardId };
        break;
      case 'vote_added':
      case 'vote_removed':
        payload = { id: entityId, boardId };
        break;
      case 'group_created':
      case 'group_updated':
      case 'group_deleted':
        payload = { id: entityId, boardId };
        break;
      case 'card_grouped':
      case 'card_ungrouped':
        payload = { id: entityId, boardId };
        break;
      case 'phase_changed': {
        const [ev] = await sql`SELECT payload FROM board_events WHERE id = ${eventId}`;
        const p = (ev?.payload as Record<string, string>) ?? {};
        payload = {
          boardId,
          previousPhase: p.from,
          currentPhase: p.to,
        };
        break;
      }
      case 'focus_changed': {
        const [ev] = await sql`SELECT payload FROM board_events WHERE id = ${eventId}`;
        const p = (ev?.payload as Record<string, string>) ?? {};
        payload = {
          boardId,
          focusId: p.focusItemId,
          focusType: p.focusItemType,
        };
        break;
      }
      case 'board_locked':
      case 'board_unlocked':
      case 'cards_revealed':
        payload = { boardId };
        break;
      case 'action_item_created':
      case 'action_item_updated':
      case 'action_item_deleted':
        payload = { id: entityId, boardId };
        break;
      default:
        payload = { id: entityId, boardId };
    }

    return { type, payload, timestamp, eventId };
  }

  async close(): Promise<void> {
    if (this.listenerSql) {
      await this.listenerSql.end();
      this.listenerSql = null;
    }
  }
}
