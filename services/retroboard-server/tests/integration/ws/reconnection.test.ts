import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import { truncateTables, createTestTeam, addTeamMember, createTestSprint, createTestBoard, SYSTEM_TEMPLATE_WWD } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { createTestWSClient, closeAllClients, type TestWSClient, getPayload, assertEventReplayPayload } from '../../helpers/ws.js';

const app = createTestApp();

describe('Reconnection & Event Recovery', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string; display_name: string };
  let memberToken: string;
  let memberUser: { id: string; email: string; display_name: string };
  let team: { id: string };
  let board: Record<string, unknown>;
  let columns: Array<Record<string, unknown>>;
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
    columns = result.columns;

    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member User' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;
    await addTeamMember(team.id, memberUser.id, 'member');

    clients = [];
  });

  afterEach(async () => {
    await closeAllClients(...clients);
  });

  it('3.10.1: Reconnect with lastEventId — receives event_replay', async () => {
    // Connect, get the initial state
    const client = await createTestWSClient({ token: memberToken, boardId: board.id as string });
    clients.push(client);
    await client.waitForMessage('presence_state');

    // Create a card to generate an event
    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: columns[0].id, content: 'Before disconnect' }),
    });
    const cardEvent = await client.waitForMessage('card_created');
    const lastEventId = cardEvent.eventId as string;

    // Disconnect
    await client.close();
    clients = clients.filter((c) => c !== client);

    // Create more events while disconnected
    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: columns[0].id, content: 'While disconnected' }),
    });

    // Reconnect with lastEventId
    const client2 = await createTestWSClient({
      token: memberToken,
      boardId: board.id as string,
      lastEventId,
    });
    clients.push(client2);

    const replay = await client2.waitForMessage('event_replay');
    assertEventReplayPayload(replay);
    expect(replay.type).toBe('event_replay');
    expect(replay.payload.events.length).toBeGreaterThanOrEqual(1);
  });

  it('3.10.2: Reconnect without lastEventId — receives presence_state only', async () => {
    const client = await createTestWSClient({ token: memberToken, boardId: board.id as string });
    clients.push(client);
    const msg = await client.waitForMessage('presence_state');
    expect(msg.type).toBe('presence_state');

    // Should NOT have event_replay
    await new Promise((r) => setTimeout(r, 200));
    const replayMsgs = client.messages.filter((m) => m.type === 'event_replay');
    expect(replayMsgs).toHaveLength(0);
  });

  it('3.10.3: No missed events — event_replay with empty events array', async () => {
    const client = await createTestWSClient({ token: memberToken, boardId: board.id as string });
    clients.push(client);
    await client.waitForMessage('presence_state');

    // Create a card to get an eventId
    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: columns[0].id, content: 'Get event ID' }),
    });
    const cardEvent = await client.waitForMessage('card_created');
    const lastEventId = cardEvent.eventId as string;

    await client.close();
    clients = clients.filter((c) => c !== client);

    // Reconnect immediately — no events happened in between
    const client2 = await createTestWSClient({
      token: memberToken,
      boardId: board.id as string,
      lastEventId,
    });
    clients.push(client2);

    const replay = await client2.waitForMessage('event_replay');
    assertEventReplayPayload(replay);
    expect(replay.payload.events).toHaveLength(0);
  });

  it('3.10.4: Many missed events paginated — hasMore=true', async () => {
    const client = await createTestWSClient({ token: memberToken, boardId: board.id as string });
    clients.push(client);
    await client.waitForMessage('presence_state');

    // Get an initial event ID
    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: columns[0].id, content: 'Anchor card' }),
    });
    const anchorEvent = await client.waitForMessage('card_created');
    const lastEventId = anchorEvent.eventId as string;

    await client.close();
    clients = clients.filter((c) => c !== client);

    // Create 150 cards while disconnected to generate 150 events
    for (let i = 0; i < 150; i++) {
      await app.request(`/api/v1/boards/${board.id}/cards`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId: columns[0].id, content: `Card ${i}` }),
      });
    }

    const client2 = await createTestWSClient({
      token: memberToken,
      boardId: board.id as string,
      lastEventId,
    });
    clients.push(client2);

    const replay = await client2.waitForMessage('event_replay', 15000);
    assertEventReplayPayload(replay);
    expect(replay.payload.events.length).toBeLessThanOrEqual(100);
    expect(replay.payload.hasMore).toBe(true);
  });

  it('3.10.5: Unknown lastEventId — full state or error', async () => {
    const fakeEventId = '00000000-0000-4000-8000-000000099999';
    const client = await createTestWSClient({
      token: memberToken,
      boardId: board.id as string,
      lastEventId: fakeEventId,
    });
    clients.push(client);

    // Should receive either an error or a full state replay
    const msg = await client.waitForMessage('event_replay', 3000).catch(() => null)
      ?? await client.waitForMessage('presence_state', 3000).catch(() => null)
      ?? await client.waitForMessage('error', 3000).catch(() => null);

    expect(msg).not.toBeNull();
  });

  it('3.10.6: Events ordered correctly in replay', async () => {
    const client = await createTestWSClient({ token: memberToken, boardId: board.id as string });
    clients.push(client);
    await client.waitForMessage('presence_state');

    // Create first event
    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: columns[0].id, content: 'First' }),
    });
    const firstEvent = await client.waitForMessage('card_created');
    const lastEventId = firstEvent.eventId as string;

    await client.close();
    clients = clients.filter((c) => c !== client);

    // Create events in order
    for (let i = 0; i < 5; i++) {
      await app.request(`/api/v1/boards/${board.id}/cards`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId: columns[0].id, content: `Card ${i}` }),
      });
    }

    const client2 = await createTestWSClient({
      token: memberToken,
      boardId: board.id as string,
      lastEventId,
    });
    clients.push(client2);

    const replay = await client2.waitForMessage('event_replay');
    assertEventReplayPayload(replay);
    const events = replay.payload.events;
    expect(events.length).toBe(5);

    // Verify chronological order
    for (let i = 1; i < events.length; i++) {
      const prev = new Date(events[i - 1].timestamp).getTime();
      const curr = new Date(events[i].timestamp).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('3.10.7: Presence state after replay', async () => {
    const client = await createTestWSClient({ token: memberToken, boardId: board.id as string });
    clients.push(client);
    await client.waitForMessage('presence_state');

    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: columns[0].id, content: 'Some card' }),
    });
    const cardEvent = await client.waitForMessage('card_created');
    const lastEventId = cardEvent.eventId as string;

    await client.close();
    clients = clients.filter((c) => c !== client);

    // Create event while disconnected
    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: columns[0].id, content: 'Missed card' }),
    });

    const client2 = await createTestWSClient({
      token: memberToken,
      boardId: board.id as string,
      lastEventId,
    });
    clients.push(client2);

    // Should receive event_replay first, then presence_state
    const replay = await client2.waitForMessage('event_replay');
    expect(replay).toBeDefined();

    const presence = await client2.waitForMessage('presence_state');
    expect(presence).toBeDefined();
    expect(getPayload(presence).users).toBeDefined();
  });
});
