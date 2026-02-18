import { randomUUID } from 'node:crypto';

const VALID_TYPES = new Set(['ping', 'cursor_move', 'join_board', 'leave_board', 'icebreaker_vibe']);
const TOTAL_RATE_LIMIT = 200;
const RATE_WINDOW_MS = 60_000;

/** Valid emoji keys for vibe reactions */
const VALID_VIBE_EMOJIS = new Set(['laugh', 'fire', 'heart', 'bullseye', 'clap', 'skull']);

/** Vibe-specific rate limit: max 3 per second per user */
const VIBE_RATE_MAX = 3;
const VIBE_RATE_WINDOW_MS = 1_000;

interface ClientInfo {
  clientId: string;
  userId: string;
  userName: string;
  boardId: string;
  ws: { send: (data: string) => void; readyState: number };
}

interface MessageRouterOptions {
  broadcast: (boardId: string, message: object, excludeClientId?: string) => void;
}

export class MessageRouter {
  private broadcast: MessageRouterOptions['broadcast'];
  private rateCounts: Map<string, { count: number; resetAt: number }> = new Map();
  /** Per-user vibe rate limiting: userId -> { count, resetAt } */
  private vibeRateCounts: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(opts: MessageRouterOptions) {
    this.broadcast = opts.broadcast;
  }

  handleMessage(client: ClientInfo, raw: string): void {
    // Rate limiting
    if (this.isRateLimited(client)) return;

    let msg: { type?: string; payload?: Record<string, unknown> };
    try {
      msg = JSON.parse(raw);
    } catch {
      this.sendError(client, 'INVALID_MESSAGE', 'Invalid JSON');
      return;
    }

    if (!msg.type) {
      this.sendError(client, 'INVALID_MESSAGE', 'Missing type field');
      return;
    }

    if (!VALID_TYPES.has(msg.type)) {
      this.sendError(client, 'INVALID_MESSAGE', `Unknown message type: ${msg.type}`);
      return;
    }

    switch (msg.type) {
      case 'ping':
        this.handlePing(client);
        break;
      case 'cursor_move':
        this.handleCursorMove(client, msg.payload);
        break;
      case 'join_board':
        this.handleJoinBoard(client, msg.payload);
        break;
      case 'leave_board':
        this.handleLeaveBoard(client, msg.payload);
        break;
      case 'icebreaker_vibe':
        this.handleIcebreakerVibe(client, msg.payload);
        break;
    }
  }

  private handlePing(client: ClientInfo): void {
    client.ws.send(JSON.stringify({
      type: 'pong',
      timestamp: new Date().toISOString(),
      eventId: '',
    }));
  }

  private handleCursorMove(client: ClientInfo, payload?: Record<string, unknown>): void {
    if (!payload || typeof payload.x !== 'number' || typeof payload.y !== 'number') {
      this.sendError(client, 'INVALID_MESSAGE', 'cursor_move requires x and y coordinates');
      return;
    }

    this.broadcast(
      client.boardId,
      {
        type: 'cursor_move',
        payload: {
          userId: client.userId,
          userName: client.userName,
          x: payload.x,
          y: payload.y,
        },
        timestamp: new Date().toISOString(),
        eventId: '',
      },
      client.clientId,
    );
  }

  private handleJoinBoard(client: ClientInfo, payload?: Record<string, unknown>): void {
    if (!payload?.boardId) return;
    this.broadcast(
      client.boardId,
      {
        type: 'user_left',
        payload: { userId: client.userId, userName: client.userName },
        timestamp: new Date().toISOString(),
        eventId: '',
      },
      client.clientId,
    );
  }

  private handleLeaveBoard(client: ClientInfo, _payload?: Record<string, unknown>): void {
    this.broadcast(
      client.boardId,
      {
        type: 'user_left',
        payload: { userId: client.userId, userName: client.userName },
        timestamp: new Date().toISOString(),
        eventId: '',
      },
      client.clientId,
    );
  }

  private handleIcebreakerVibe(client: ClientInfo, payload?: Record<string, unknown>): void {
    if (!payload || typeof payload.emoji !== 'string') {
      this.sendError(client, 'INVALID_MESSAGE', 'icebreaker_vibe requires an emoji field');
      return;
    }

    if (!VALID_VIBE_EMOJIS.has(payload.emoji)) {
      this.sendError(client, 'INVALID_MESSAGE', `Invalid vibe emoji: ${payload.emoji}`);
      return;
    }

    // Per-user vibe rate limiting: 3 per second
    if (this.isVibeRateLimited(client.userId)) {
      this.sendError(client, 'RATE_LIMITED', 'Too many vibe reactions, slow down');
      return;
    }

    const vibeId = randomUUID();

    // Broadcast to ALL in room (including sender) — no excludeClientId
    this.broadcast(
      client.boardId,
      {
        type: 'icebreaker_vibe',
        payload: {
          emoji: payload.emoji,
          id: vibeId,
        },
        timestamp: new Date().toISOString(),
        eventId: '',
      },
    );
  }

  /** Check vibe-specific rate limit: max 3 per second per user */
  private isVibeRateLimited(userId: string): boolean {
    const now = Date.now();
    let entry = this.vibeRateCounts.get(userId);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + VIBE_RATE_WINDOW_MS };
      this.vibeRateCounts.set(userId, entry);
    }
    entry.count++;
    return entry.count > VIBE_RATE_MAX;
  }

  private isRateLimited(client: ClientInfo): boolean {
    const now = Date.now();
    let entry = this.rateCounts.get(client.clientId);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
      this.rateCounts.set(client.clientId, entry);
    }
    entry.count++;
    if (entry.count > TOTAL_RATE_LIMIT) {
      this.sendError(client, 'RATE_LIMITED', 'Too many messages, slow down');
      return true;
    }
    return false;
  }

  private sendError(client: ClientInfo, code: string, message: string): void {
    client.ws.send(JSON.stringify({
      type: 'error',
      payload: { code, message },
      timestamp: new Date().toISOString(),
      eventId: '',
    }));
  }
}
