import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { truncateTables, createTestTeam, addTeamMember, createTestSprint, createTestBoard, SYSTEM_TEMPLATE_WWD } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { createTestWSClient, closeAllClients, type TestWSClient } from '../../helpers/ws.js';

describe('Cursor Sharing', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string; display_name: string };
  let memberToken: string;
  let memberUser: { id: string; email: string; display_name: string };
  let team: { id: string };
  let board: Record<string, any>;
  let clients: TestWSClient[] = [];

  beforeEach(async () => {
    await truncateTables();
    await seed();
    const adminAuth = await getAuthToken({ displayName: 'Admin User' });
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;
    team = await createTestTeam(adminUser.id);
    const sprint = await createTestSprint(team.id, adminUser.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    board = result.board;

    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;
    await addTeamMember(team.id, memberUser.id, 'member');

    clients = [];
  });

  afterEach(async () => {
    await closeAllClients(...clients);
  });

  it('3.9.1: Cursor move relayed to others', async () => {
    const clientA = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(clientA);
    await clientA.waitForMessage('presence_state');

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    clientA.send({ type: 'cursor_move', payload: { x: 100, y: 200 } });

    const msg = await clientB.waitForMessage('cursor_move');
    expect(msg.type).toBe('cursor_move');
    expect(msg.payload.x).toBe(100);
    expect(msg.payload.y).toBe(200);
    expect(msg.payload.userId).toBe(adminUser.id);
  });

  it('3.9.2: Cursor move not echoed to sender', async () => {
    const clientA = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(clientA);
    await clientA.waitForMessage('presence_state');

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    clientA.send({ type: 'cursor_move', payload: { x: 100, y: 200 } });

    // Wait for B to receive it (confirm relay works)
    await clientB.waitForMessage('cursor_move');

    // A should NOT have received a cursor_move back
    const cursorMsgs = clientA.messages.filter((m) => m.type === 'cursor_move');
    expect(cursorMsgs).toHaveLength(0);
  });

  it('3.9.3: Throttled at 20/sec — Client B receives at most 20', async () => {
    const clientA = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(clientA);
    await clientA.waitForMessage('presence_state');

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    // Send 30 cursor moves rapidly
    for (let i = 0; i < 30; i++) {
      clientA.send({ type: 'cursor_move', payload: { x: i * 10, y: i * 10 } });
    }

    // Wait 1.5 seconds for all to be processed
    await new Promise((r) => setTimeout(r, 1500));

    const cursorMsgs = clientB.messages.filter((m) => m.type === 'cursor_move');
    expect(cursorMsgs.length).toBeLessThanOrEqual(20);
  });

  it('3.9.4: Cursor includes userId and userName', async () => {
    const clientA = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(clientA);
    await clientA.waitForMessage('presence_state');

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    clientA.send({ type: 'cursor_move', payload: { x: 50, y: 75 } });

    const msg = await clientB.waitForMessage('cursor_move');
    expect(msg.payload.userId).toBe(adminUser.id);
    expect(msg.payload.userName).toBe('Admin User');
  });
});
