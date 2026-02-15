import WebSocket from 'ws';
import { getAuthToken } from './auth.js';

const TEST_PORT = Number(process.env.TEST_PORT) || 3001;

export interface TestWSClient {
  ws: WebSocket;
  messages: any[];
  waitForMessage(type: string, timeoutMs?: number): Promise<any>;
  waitForMessages(type: string, count: number, timeoutMs?: number): Promise<any[]>;
  send(msg: any): void;
  close(): Promise<void>;
}

export async function createTestWSClient(options: {
  userId?: string;
  boardId: string;
  token?: string;
  lastEventId?: string;
}): Promise<TestWSClient> {
  const token = options.token ?? (await getAuthToken()).token;
  let url = `ws://localhost:${TEST_PORT}/ws?token=${token}&boardId=${options.boardId}`;
  if (options.lastEventId) url += `&lastEventId=${options.lastEventId}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messages: any[] = [];
    const waiters: Array<{
      type: string;
      resolve: (msg: any) => void;
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
        send(msg: any) {
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
