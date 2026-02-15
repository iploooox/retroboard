import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import { truncateTables, createTestTeam, addTeamMember, createTestSprint, createTestBoard, createTestCard, SYSTEM_TEMPLATE_WWD } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { createTestWSClient, closeAllClients, type TestWSClient } from '../../helpers/ws.js';

const app = createTestApp();

describe('Real-Time Event Propagation via LISTEN/NOTIFY', () => {
  let adminToken: string;
  let adminUser: { id: string; email: string; display_name: string };
  let memberToken: string;
  let memberUser: { id: string; email: string; display_name: string };
  let team: { id: string };
  let board: Record<string, any>;
  let columns: Record<string, any>[];
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

  it('3.8.1: Card creation propagates via WS', async () => {
    const clientA = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(clientA);
    await clientA.waitForMessage('presence_state');

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    // Client A creates a card via REST
    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ columnId: columns[0].id, content: 'WS test card' }),
    });

    // Client B should receive card_created via WebSocket
    const msg = await clientB.waitForMessage('card_created');
    expect(msg.type).toBe('card_created');
    expect(msg.payload.content || msg.payload.text).toContain('WS test card');
  });

  it('3.8.2: Card update propagates via WS', async () => {
    const card = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Original' });

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    // Update card via REST
    await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Updated' }),
    });

    const msg = await clientB.waitForMessage('card_updated');
    expect(msg.type).toBe('card_updated');
  });

  it('3.8.3: Card deletion propagates via WS', async () => {
    const card = await createTestCard(board.id, columns[0].id, adminUser.id);

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    await app.request(`/api/v1/boards/${board.id}/cards/${card.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    const msg = await clientB.waitForMessage('card_deleted');
    expect(msg.type).toBe('card_deleted');
    expect(msg.payload.id).toBe(card.id);
  });

  it('3.8.4: Vote added propagates via WS', async () => {
    const card = await createTestCard(board.id, columns[0].id, adminUser.id);
    // Move to vote phase
    await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'group' }),
    });
    await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'vote' }),
    });

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/votes`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    const msg = await clientB.waitForMessage('vote_added');
    expect(msg.type).toBe('vote_added');
  });

  it('3.8.5: Vote removed propagates via WS', async () => {
    const card = await createTestCard(board.id, columns[0].id, adminUser.id);
    // Move to vote phase and add a vote
    await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'group' }),
    });
    await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'vote' }),
    });
    await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/votes`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    const clientB = await createTestWSClient({ token: adminToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    await app.request(`/api/v1/boards/${board.id}/cards/${card.id}/votes`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${memberToken}` },
    });

    const msg = await clientB.waitForMessage('vote_removed');
    expect(msg.type).toBe('vote_removed');
  });

  it('3.8.6: Group creation propagates via WS', async () => {
    const card1 = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 1' });
    const card2 = await createTestCard(board.id, columns[0].id, adminUser.id, { content: 'Card 2' });
    // Move to group phase
    await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'group' }),
    });

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    await app.request(`/api/v1/boards/${board.id}/groups`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Group', cardIds: [card1.id, card2.id] }),
    });

    const msg = await clientB.waitForMessage('group_created');
    expect(msg.type).toBe('group_created');
  });

  it('3.8.7: Phase change propagates via WS', async () => {
    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'group' }),
    });

    const msg = await clientB.waitForMessage('phase_changed');
    expect(msg.type).toBe('phase_changed');
    expect(msg.payload.currentPhase).toBe('group');
    expect(msg.payload.previousPhase).toBe('write');
  });

  it('3.8.8: Focus change propagates via WS', async () => {
    const card = await createTestCard(board.id, columns[0].id, adminUser.id);
    // Move to discuss phase
    await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'group' }),
    });
    await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'vote' }),
    });
    await app.request(`/api/v1/boards/${board.id}/phase`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'discuss' }),
    });

    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    await app.request(`/api/v1/boards/${board.id}/focus`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ focusType: 'card', focusId: card.id }),
    });

    const msg = await clientB.waitForMessage('focus_changed');
    expect(msg.type).toBe('focus_changed');
    expect(msg.payload.focusId).toBe(card.id);
  });

  it('3.8.9: Events scoped to board — other board does not receive', async () => {
    // Create a second board
    const sprint2 = await createTestSprint(team.id, adminUser.id, { name: 'Sprint 2' });
    const result2 = await createTestBoard(sprint2.id, SYSTEM_TEMPLATE_WWD, adminUser.id);
    const board2 = result2.board;

    const clientOnBoard2 = await createTestWSClient({ token: adminToken, boardId: board2.id });
    clients.push(clientOnBoard2);
    await clientOnBoard2.waitForMessage('presence_state');

    // Create card on board 1 via REST
    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: columns[0].id, content: 'Board 1 card' }),
    });

    // Wait briefly — client on board 2 should NOT receive card_created
    await new Promise((r) => setTimeout(r, 300));
    const cardEvents = clientOnBoard2.messages.filter((m) => m.type === 'card_created');
    expect(cardEvents).toHaveLength(0);
  });

  it('3.8.10: Event contains correct eventId (UUID)', async () => {
    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: columns[0].id, content: 'Event ID test' }),
    });

    const msg = await clientB.waitForMessage('card_created');
    expect(msg.eventId).toBeDefined();
    expect(msg.eventId).not.toBe('');
    // UUID format check
    expect(msg.eventId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('3.8.11: Event has server timestamp', async () => {
    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: columns[0].id, content: 'Timestamp test' }),
    });

    const msg = await clientB.waitForMessage('card_created');
    expect(msg.timestamp).toBeDefined();
    const ts = new Date(msg.timestamp);
    expect(ts.getTime()).not.toBeNaN();
  });

  it('3.8.12: Latency under 100ms', async () => {
    const clientB = await createTestWSClient({ token: memberToken, boardId: board.id });
    clients.push(clientB);
    await clientB.waitForMessage('presence_state');

    const before = Date.now();
    await app.request(`/api/v1/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: columns[0].id, content: 'Latency test' }),
    });

    await clientB.waitForMessage('card_created');
    const latency = Date.now() - before;
    expect(latency).toBeLessThan(100);
  });
});
