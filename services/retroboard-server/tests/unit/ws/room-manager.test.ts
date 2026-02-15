import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomManager } from '../../../src/ws/room-manager.js';

describe('RoomManager', () => {
  let rm: RoomManager;

  beforeEach(() => {
    rm = new RoomManager();
  });

  // --- Mock helpers ---
  function mockWs(overrides: Partial<{ readyState: number; send: ReturnType<typeof vi.fn> }> = {}) {
    return {
      send: overrides.send ?? vi.fn(),
      readyState: overrides.readyState ?? 1, // 1 = OPEN
    } as any;
  }

  it('3.1.1: Join adds client to room', () => {
    const ws = mockWs();
    rm.join('board-1', 'client-1', ws, 'user-1');
    const clients = rm.getClients('board-1');
    expect(clients.has('client-1')).toBe(true);
  });

  it('3.1.2: Join creates room if not exists', () => {
    const ws = mockWs();
    rm.join('board-new', 'client-1', ws, 'user-1');
    const clients = rm.getClients('board-new');
    expect(clients.size).toBe(1);
  });

  it('3.1.3: Leave removes client from room', () => {
    const ws = mockWs();
    rm.join('board-1', 'client-1', ws, 'user-1');
    rm.leave('board-1', 'client-1');
    const clients = rm.getClients('board-1');
    expect(clients.has('client-1')).toBe(false);
  });

  it('3.1.4: Leave deletes empty room', () => {
    const ws = mockWs();
    rm.join('board-1', 'client-1', ws, 'user-1');
    rm.leave('board-1', 'client-1');
    expect(rm.getRoomSize('board-1')).toBe(0);
  });

  it('3.1.5: getClients returns all room clients', () => {
    rm.join('board-1', 'c1', mockWs(), 'u1');
    rm.join('board-1', 'c2', mockWs(), 'u2');
    rm.join('board-1', 'c3', mockWs(), 'u3');
    const clients = rm.getClients('board-1');
    expect(clients.size).toBe(3);
  });

  it('3.1.6: getClients returns empty for unknown room', () => {
    const clients = rm.getClients('unknown-board');
    expect(clients.size).toBe(0);
  });

  it('3.1.7: broadcast sends to all clients in room', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    const ws3 = mockWs();
    rm.join('board-1', 'c1', ws1, 'u1');
    rm.join('board-1', 'c2', ws2, 'u2');
    rm.join('board-1', 'c3', ws3, 'u3');

    rm.broadcast('board-1', { type: 'test', payload: {} });

    expect(ws1.send).toHaveBeenCalledOnce();
    expect(ws2.send).toHaveBeenCalledOnce();
    expect(ws3.send).toHaveBeenCalledOnce();
  });

  it('3.1.8: broadcast excludes specified client', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    const ws3 = mockWs();
    rm.join('board-1', 'c1', ws1, 'u1');
    rm.join('board-1', 'c2', ws2, 'u2');
    rm.join('board-1', 'c3', ws3, 'u3');

    rm.broadcast('board-1', { type: 'test', payload: {} }, 'c2');

    expect(ws1.send).toHaveBeenCalledOnce();
    expect(ws2.send).not.toHaveBeenCalled();
    expect(ws3.send).toHaveBeenCalledOnce();
  });

  it('3.1.9: broadcast ignores closed WebSockets', () => {
    const wsOpen1 = mockWs();
    const wsClosed = mockWs({ readyState: 3 }); // 3 = CLOSED
    const wsOpen2 = mockWs();
    rm.join('board-1', 'c1', wsOpen1, 'u1');
    rm.join('board-1', 'c2', wsClosed, 'u2');
    rm.join('board-1', 'c3', wsOpen2, 'u3');

    rm.broadcast('board-1', { type: 'test', payload: {} });

    expect(wsOpen1.send).toHaveBeenCalledOnce();
    expect(wsClosed.send).not.toHaveBeenCalled();
    expect(wsOpen2.send).toHaveBeenCalledOnce();
  });

  it('3.1.10: removeClient removes from all rooms', () => {
    const ws = mockWs();
    rm.join('board-1', 'c1', ws, 'u1');
    rm.join('board-2', 'c1', ws, 'u1');

    rm.removeClient('c1');

    expect(rm.getClients('board-1').has('c1')).toBe(false);
    expect(rm.getClients('board-2').has('c1')).toBe(false);
  });

  it('3.1.11: getRoomSize returns correct count', () => {
    rm.join('board-1', 'c1', mockWs(), 'u1');
    rm.join('board-1', 'c2', mockWs(), 'u2');
    rm.join('board-1', 'c3', mockWs(), 'u3');
    expect(rm.getRoomSize('board-1')).toBe(3);
  });

  it('3.1.12: getUserBoards returns all boards for user', () => {
    rm.join('board-1', 'c1', mockWs(), 'u1');
    rm.join('board-2', 'c2', mockWs(), 'u1');
    const boards = rm.getUserBoards('u1');
    expect(boards.size).toBe(2);
    expect(boards.has('board-1')).toBe(true);
    expect(boards.has('board-2')).toBe(true);
  });
});
