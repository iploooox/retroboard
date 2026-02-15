import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { truncateTables, createTestTeam, addTeamMember, createTestSprint, createTestBoard, SYSTEM_TEMPLATE_WWD } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { createTestWSClient, closeAllClients, type TestWSClient } from '../../helpers/ws.js';

describe('WebSocket Presence', () => {
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

  it('3.7.1: First user joins — receives presence_state with empty users', async () => {
    const clientA = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(clientA);
    const msg = await clientA.waitForMessage('presence_state');
    expect(msg.type).toBe('presence_state');
    expect(msg.payload.users).toHaveLength(0);
  });

  it('3.7.2: Second user joins — gets presence_state with first user, first user gets user_joined', async () => {
    const clientA = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(clientA);
    await clientA.waitForMessage('presence_state');

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);

    const presenceB = await clientB.waitForMessage('presence_state');
    expect(presenceB.payload.users.length).toBeGreaterThanOrEqual(1);

    const joinedA = await clientA.waitForMessage('user_joined');
    expect(joinedA.payload.userId).toBe(memberUser.id);
  });

  it('3.7.3: User disconnects — other user receives user_left', async () => {
    const clientA = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(clientA);
    await clientA.waitForMessage('presence_state');

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    // Disconnect client A
    await clientA.close();
    clients = clients.filter((c) => c !== clientA);

    const leftMsg = await clientB.waitForMessage('user_left');
    expect(leftMsg.payload.userId).toBe(adminUser.id);
  });

  it('3.7.4: Multi-tab user disconnect one tab — no user_left broadcast', async () => {
    // Admin opens two tabs
    const tab1 = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(tab1);
    await tab1.waitForMessage('presence_state');

    const tab2 = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(tab2);

    // Member observes
    const observer = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(observer);
    await observer.waitForMessage('presence_state');

    // Close one tab
    await tab1.close();
    clients = clients.filter((c) => c !== tab1);

    // Wait briefly — no user_left should arrive for admin
    await new Promise((r) => setTimeout(r, 300));
    const leftMessages = observer.messages.filter(
      (m) => m.type === 'user_left' && m.payload.userId === adminUser.id,
    );
    expect(leftMessages).toHaveLength(0);
  });

  it('3.7.5: Multi-tab user disconnect all tabs — user_left broadcast', async () => {
    const tab1 = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(tab1);
    const tab2 = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(tab2);

    const observer = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(observer);
    await observer.waitForMessage('presence_state');

    // Close both tabs
    await tab1.close();
    await tab2.close();
    clients = clients.filter((c) => c !== tab1 && c !== tab2);

    const leftMsg = await observer.waitForMessage('user_left');
    expect(leftMsg.payload.userId).toBe(adminUser.id);
  });

  it('3.7.6: User reconnects quickly', async () => {
    const observer = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(observer);
    await observer.waitForMessage('presence_state');

    const clientA = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(clientA);
    await clientA.waitForMessage('presence_state');
    await observer.waitForMessage('user_joined');

    // Disconnect
    await clientA.close();
    clients = clients.filter((c) => c !== clientA);

    // Reconnect quickly
    const clientA2 = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(clientA2);
    await clientA2.waitForMessage('presence_state');

    // Observer should see user_left then user_joined (or just user_joined if within grace period)
    const joinMsgs = observer.messages.filter(
      (m) => m.type === 'user_joined' && m.payload.userId === adminUser.id,
    );
    expect(joinMsgs.length).toBeGreaterThanOrEqual(1);
  });
});
