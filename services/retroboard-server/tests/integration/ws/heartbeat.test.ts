import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { truncateTables, createTestTeam, createTestSprint, createTestBoard, SYSTEM_TEMPLATE_WWD } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { createTestWSClient, closeAllClients, type TestWSClient } from '../../helpers/ws.js';

describe('WebSocket Heartbeat', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string; display_name: string };
  let team: { id: string };
  let board: Record<string, any>;
  let clients: TestWSClient[] = [];

  beforeEach(async () => {
    await truncateTables();
    await seed();
    const auth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = auth.token;
    adminUser = auth.user;
    team = await createTestTeam(adminUser.id);
    const sprint = await createTestSprint(team.id, adminUser.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = result.board;
    clients = [];
  });

  afterEach(async () => {
    await closeAllClients(...clients);
  });

  it('3.11.1: Ping/pong keeps connection alive', async () => {
    const client = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(client);
    await client.waitForMessage('presence_state');

    // Send pings every 25s for 60s total
    for (let i = 0; i < 3; i++) {
      client.send({ type: 'ping' });
      const pong = await client.waitForMessage('pong', 5000);
      expect(pong.type).toBe('pong');
      await new Promise((r) => setTimeout(r, 25_000));
    }

    // Connection should still be open
    expect(client.ws.readyState).toBe(1); // OPEN
  }, 90_000); // Extended timeout

  it('3.11.2: No ping causes disconnect after 45s', async () => {
    const client = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(client);
    await client.waitForMessage('presence_state');

    // Wait 50s without sending any pings
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 50_000);
      client.ws.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Connection should be closed by server
    expect(client.ws.readyState).toBe(3); // CLOSED
  }, 60_000); // Extended timeout

  it('3.11.3: Pong response is immediate', async () => {
    const client = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(client);
    await client.waitForMessage('presence_state');

    const before = Date.now();
    client.send({ type: 'ping' });
    await client.waitForMessage('pong');
    const latency = Date.now() - before;

    expect(latency).toBeLessThan(10);
  });
});
