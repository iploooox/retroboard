import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageRouter } from '../../../src/ws/message-router.js';

describe('MessageRouter', () => {
  let router: MessageRouter;
  let mockSend: ReturnType<typeof vi.fn>;
  let mockBroadcast: ReturnType<typeof vi.fn>;
  let mockClient: any;

  beforeEach(() => {
    mockSend = vi.fn();
    mockBroadcast = vi.fn();
    mockClient = {
      clientId: 'client-1',
      userId: 'user-1',
      userName: 'Test User',
      boardId: 'board-1',
      ws: { send: mockSend, readyState: 1 },
    };
    router = new MessageRouter({
      broadcast: mockBroadcast,
    });
  });

  it('3.3.1: Valid ping message responds with pong', () => {
    router.handleMessage(mockClient, JSON.stringify({ type: 'ping' }));
    expect(mockSend).toHaveBeenCalledWith(
      expect.stringContaining('"type":"pong"'),
    );
  });

  it('3.3.2: Invalid JSON sends error event', () => {
    router.handleMessage(mockClient, 'not json');
    expect(mockSend).toHaveBeenCalledWith(
      expect.stringContaining('"type":"error"'),
    );
  });

  it('3.3.3: Unknown message type sends error with INVALID_MESSAGE', () => {
    router.handleMessage(mockClient, JSON.stringify({ type: 'unknown' }));
    expect(mockSend).toHaveBeenCalledWith(
      expect.stringContaining('INVALID_MESSAGE'),
    );
  });

  it('3.3.4: Missing type field sends error', () => {
    router.handleMessage(mockClient, JSON.stringify({ payload: {} }));
    expect(mockSend).toHaveBeenCalledWith(
      expect.stringContaining('"type":"error"'),
    );
  });

  it('3.3.5: cursor_move with valid coords broadcasts to room', () => {
    router.handleMessage(
      mockClient,
      JSON.stringify({ type: 'cursor_move', payload: { x: 10, y: 20 } }),
    );
    expect(mockBroadcast).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({ type: 'cursor_move' }),
      'client-1',
    );
  });

  it('3.3.6: cursor_move missing x sends error', () => {
    router.handleMessage(
      mockClient,
      JSON.stringify({ type: 'cursor_move', payload: { y: 20 } }),
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.stringContaining('"type":"error"'),
    );
  });

  it('3.3.7: cursor_move with negative coords accepted', () => {
    router.handleMessage(
      mockClient,
      JSON.stringify({ type: 'cursor_move', payload: { x: -10, y: -20 } }),
    );
    expect(mockBroadcast).toHaveBeenCalled();
  });

  it('3.3.8: join_board switches rooms', () => {
    // Start in board-1, send join_board for board-2
    router.handleMessage(
      mockClient,
      JSON.stringify({
        type: 'join_board',
        payload: { boardId: 'board-2' },
      }),
    );
    // Should trigger a room switch — the exact mechanism depends on implementation,
    // but we expect the broadcast or internal room-change logic to be invoked
    expect(mockBroadcast).toHaveBeenCalled();
  });

  it('3.3.9: Rate limit exceeded sends RATE_LIMITED error', () => {
    // Send 201 messages quickly (total rate limit is 200/min)
    for (let i = 0; i < 201; i++) {
      router.handleMessage(mockClient, JSON.stringify({ type: 'ping' }));
    }
    // The last call should trigger a rate limit error
    const lastCall = mockSend.mock.calls[mockSend.mock.calls.length - 1];
    expect(lastCall[0]).toContain('RATE_LIMITED');
  });
});
