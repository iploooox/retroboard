import { createServer } from 'node:http';
import WebSocket from 'ws';
import { getAuthToken } from './auth.js';

const TEST_PORT = Number(process.env.TEST_PORT) || 3001;

interface WSMessage {
  type: string;
  payload?: unknown;
  [key: string]: unknown;
}

// Typed payload interfaces for different message types
export interface PresenceStatePayload {
  users: Array<{
    userId: string;
    userName: string;
    userAvatar: string;
    connectionCount: number;
    cursorPosition: { x: number; y: number } | null;
    joinedAt: string;
  }>;
}

export interface UserJoinedPayload {
  userId: string;
  userName: string;
}

export interface CursorMovePayload {
  userId: string;
  userName: string;
  x: number;
  y: number;
}

export interface CardCreatedPayload {
  id: string;
  boardId: string;
  [key: string]: unknown;
}

export interface VotePayload {
  id: string;
  boardId: string;
  [key: string]: unknown;
}

export interface GroupPayload {
  id: string;
  boardId: string;
  [key: string]: unknown;
}

export interface PhaseChangedPayload {
  phase: string;
  boardId: string;
  [key: string]: unknown;
}

export interface FocusChangedPayload {
  focusType: string | null;
  focusId: string | null;
  boardId: string;
  [key: string]: unknown;
}

export interface TimerPayload {
  boardId: string;
  durationMs?: number;
  [key: string]: unknown;
}

export interface EventReplayPayload {
  events: Array<{
    eventId: string;
    type: string;
    timestamp: string;
    [key: string]: unknown;
  }>;
  hasMore?: boolean;
  [key: string]: unknown;
}

// Type assertion helpers
export function assertPresenceState(msg: WSMessage): asserts msg is WSMessage & { payload: PresenceStatePayload } {
  if (!msg.payload || typeof msg.payload !== 'object') {
    throw new Error('Invalid presence_state payload');
  }
}

export function assertUserPayload(msg: WSMessage): asserts msg is WSMessage & { payload: UserJoinedPayload } {
  if (!msg.payload || typeof msg.payload !== 'object') {
    throw new Error('Invalid user payload');
  }
}

export function assertCursorPayload(msg: WSMessage): asserts msg is WSMessage & { payload: CursorMovePayload } {
  if (!msg.payload || typeof msg.payload !== 'object') {
    throw new Error('Invalid cursor payload');
  }
}

export function assertCardPayload(msg: WSMessage): asserts msg is WSMessage & { payload: CardCreatedPayload } {
  if (!msg.payload || typeof msg.payload !== 'object') {
    throw new Error('Invalid card payload');
  }
}

export function assertVotePayload(msg: WSMessage): asserts msg is WSMessage & { payload: VotePayload } {
  if (!msg.payload || typeof msg.payload !== 'object') {
    throw new Error('Invalid vote payload');
  }
}

export function assertGroupPayload(msg: WSMessage): asserts msg is WSMessage & { payload: GroupPayload } {
  if (!msg.payload || typeof msg.payload !== 'object') {
    throw new Error('Invalid group payload');
  }
}

export function assertPhasePayload(msg: WSMessage): asserts msg is WSMessage & { payload: PhaseChangedPayload } {
  if (!msg.payload || typeof msg.payload !== 'object') {
    throw new Error('Invalid phase payload');
  }
}

export function assertFocusPayload(msg: WSMessage): asserts msg is WSMessage & { payload: FocusChangedPayload } {
  if (!msg.payload || typeof msg.payload !== 'object') {
    throw new Error('Invalid focus payload');
  }
}

export function assertTimerPayload(msg: WSMessage): asserts msg is WSMessage & { payload: TimerPayload } {
  if (!msg.payload || typeof msg.payload !== 'object') {
    throw new Error('Invalid timer payload');
  }
}

export function assertEventReplayPayload(msg: WSMessage): asserts msg is WSMessage & { payload: EventReplayPayload } {
  if (!msg.payload || typeof msg.payload !== 'object') {
    throw new Error('Invalid event_replay payload');
  }
}

// Generic helper to access payload as a record
export function getPayload(msg: WSMessage): Record<string, unknown> {
  if (!msg.payload || typeof msg.payload !== 'object' || Array.isArray(msg.payload)) {
    return {};
  }
  return msg.payload as Record<string, unknown>;
}

// Lazy HTTP+WS server: starts once on first WS client creation
// Cleanup stored on globalThis so setup.ts afterAll can access it
let serverReady: Promise<void> | null = null;

declare global {
  var __wsServerCleanup: (() => Promise<void>) | undefined;
}

async function ensureServerStarted(): Promise<void> {
  if (serverReady) return serverReady;
  serverReady = (async () => {
    const { getRequestListener } = await import('@hono/node-server');
    const { app } = await import('../../src/server.js');
    const { setupWebSocket } = await import('../../src/ws/index.js');

    const server = createServer(getRequestListener(app.fetch));
    const cleanup = setupWebSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, resolve);
    });

    globalThis.__wsServerCleanup = async () => {
      await cleanup();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    };
  })();
  return serverReady;
}

export interface TestWSClient {
  ws: WebSocket;
  messages: WSMessage[];
  waitForMessage(type: string, timeoutMs?: number): Promise<WSMessage>;
  waitForMessages(type: string, count: number, timeoutMs?: number): Promise<WSMessage[]>;
  send(msg: unknown): void;
  close(): Promise<void>;
}

export async function createTestWSClient(options: {
  userId?: string;
  boardId: string;
  token?: string;
  lastEventId?: string;
}): Promise<TestWSClient> {
  await ensureServerStarted();
  const token = options.token ?? (await getAuthToken()).token;
  let url = `ws://localhost:${TEST_PORT}/ws?token=${token}&boardId=${options.boardId}`;
  if (options.lastEventId) url += `&lastEventId=${options.lastEventId}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messages: WSMessage[] = [];
    const waiters: Array<{
      type: string;
      resolve: (msg: WSMessage) => void;
      reject: (err: Error) => void;
    }> = [];

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      messages.push(msg);
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].type === msg.type) {
          waiters[i].resolve(msg);
          waiters.splice(i, 1);
        }
      }
    });

    ws.on('open', () => {
      resolve({
        ws,
        messages,
        waitForMessage(type: string, timeoutMs = 5000) {
          const existing = messages.find((m) => m.type === type);
          if (existing) return Promise.resolve(existing);
          return new Promise((res, rej) => {
            const timeout = setTimeout(
              () => rej(new Error(`Timeout waiting for message type "${type}"`)),
              timeoutMs,
            );
            waiters.push({
              type,
              resolve: (msg) => {
                clearTimeout(timeout);
                res(msg);
              },
              reject: rej,
            });
          });
        },
        waitForMessages(type: string, count: number, timeoutMs = 5000) {
          return new Promise((res, rej) => {
            const timeout = setTimeout(
              () =>
                rej(
                  new Error(
                    `Timeout waiting for ${count} "${type}" messages (got ${messages.filter((m) => m.type === type).length})`,
                  ),
                ),
              timeoutMs,
            );
            const check = () => {
              const matching = messages.filter((m) => m.type === type);
              if (matching.length >= count) {
                clearTimeout(timeout);
                res(matching.slice(0, count));
              }
            };
            check();
            ws.on('message', () => check());
          });
        },
        send(msg: unknown) {
          ws.send(JSON.stringify(msg));
        },
        close() {
          return new Promise<void>((res) => {
            if (ws.readyState === WebSocket.CLOSED) {
              res();
              return;
            }
            ws.on('close', () => res());
            ws.close();
          });
        },
      });
    });

    ws.on('error', reject);
  });
}

/** Close multiple WS clients, ignoring errors */
export async function closeAllClients(...clients: (TestWSClient | undefined)[]) {
  await Promise.allSettled(
    clients.filter(Boolean).map((c) => c!.close()),
  );
}
