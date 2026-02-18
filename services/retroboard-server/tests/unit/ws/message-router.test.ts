import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageRouter } from '../../../src/ws/message-router.js';

interface ClientInfo {
  clientId: string;
  userId: string;
  userName: string;
  boardId: string;
  ws: { send: (data: string) => void; readyState: number };
}

describe('MessageRouter', () => {
  let router: MessageRouter;
  let mockSend: ReturnType<typeof vi.fn>;
  let mockBroadcast: ReturnType<typeof vi.fn>;
  let mockClient: ClientInfo;

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

  // ────────────────────────────────────────────────────────────
  // Icebreaker Vibe (S-006)
  // ────────────────────────────────────────────────────────────
  describe('icebreaker_vibe', () => {
    it('S-006.1: Valid vibe message broadcasts to all in room (including sender)', () => {
      router.handleMessage(
        mockClient,
        JSON.stringify({ type: 'icebreaker_vibe', payload: { emoji: 'fire' } }),
      );
      expect(mockBroadcast).toHaveBeenCalledWith(
        'board-1',
        expect.objectContaining({
          type: 'icebreaker_vibe',
          payload: expect.objectContaining({
            emoji: 'fire',
            id: expect.any(String),
          }),
        }),
        // No excludeClientId — broadcast to ALL including sender
      );
      // Verify third argument (excludeClientId) is NOT passed
      expect(mockBroadcast.mock.calls[0]).toHaveLength(2);
    });

    it('S-006.2: Missing emoji field sends error', () => {
      router.handleMessage(
        mockClient,
        JSON.stringify({ type: 'icebreaker_vibe', payload: {} }),
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('INVALID_MESSAGE'),
      );
      expect(mockBroadcast).not.toHaveBeenCalled();
    });

    it('S-006.3: Invalid emoji key sends error', () => {
      router.handleMessage(
        mockClient,
        JSON.stringify({ type: 'icebreaker_vibe', payload: { emoji: 'poop' } }),
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('INVALID_MESSAGE'),
      );
      expect(mockBroadcast).not.toHaveBeenCalled();
    });

    it('S-006.4: All 6 valid emoji keys are accepted', () => {
      const validEmojis = ['laugh', 'fire', 'heart', 'bullseye', 'clap', 'skull'];
      // Use a different user per emoji to avoid vibe rate limit
      for (let i = 0; i < validEmojis.length; i++) {
        const emoji = validEmojis[i];
        const client: ClientInfo = {
          clientId: `client-emoji-${i}`,
          userId: `user-emoji-${i}`,
          userName: `User ${i}`,
          boardId: 'board-1',
          ws: { send: vi.fn(), readyState: 1 },
        };
        mockBroadcast.mockClear();
        router.handleMessage(
          client,
          JSON.stringify({ type: 'icebreaker_vibe', payload: { emoji } }),
        );
        expect(mockBroadcast).toHaveBeenCalledTimes(1);
      }
    });

    it('S-006.5: Vibe rate limit — more than 3 per second per user triggers RATE_LIMITED', () => {
      // First 3 should succeed
      for (let i = 0; i < 3; i++) {
        router.handleMessage(
          mockClient,
          JSON.stringify({ type: 'icebreaker_vibe', payload: { emoji: 'fire' } }),
        );
      }
      expect(mockBroadcast).toHaveBeenCalledTimes(3);

      // 4th should be rate limited
      mockSend.mockClear();
      router.handleMessage(
        mockClient,
        JSON.stringify({ type: 'icebreaker_vibe', payload: { emoji: 'fire' } }),
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('RATE_LIMITED'),
      );
    });

    it('S-006.6: Vibe rate limit is per user, not per client', () => {
      // Client 1 sends 3 vibes
      for (let i = 0; i < 3; i++) {
        router.handleMessage(
          mockClient,
          JSON.stringify({ type: 'icebreaker_vibe', payload: { emoji: 'fire' } }),
        );
      }

      // A different client with the SAME userId should also be rate limited
      const client2 = { ...mockClient, clientId: 'client-2' };
      mockSend.mockClear();
      router.handleMessage(
        client2,
        JSON.stringify({ type: 'icebreaker_vibe', payload: { emoji: 'fire' } }),
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('RATE_LIMITED'),
      );
    });

    it('S-006.7: Different users have independent vibe rate limits', () => {
      // User 1 sends 3 vibes
      for (let i = 0; i < 3; i++) {
        router.handleMessage(
          mockClient,
          JSON.stringify({ type: 'icebreaker_vibe', payload: { emoji: 'fire' } }),
        );
      }

      // User 2 should not be rate limited
      const client2: ClientInfo = {
        clientId: 'client-2',
        userId: 'user-2',
        userName: 'Other User',
        boardId: 'board-1',
        ws: { send: vi.fn(), readyState: 1 },
      };
      router.handleMessage(
        client2,
        JSON.stringify({ type: 'icebreaker_vibe', payload: { emoji: 'fire' } }),
      );
      expect(mockBroadcast).toHaveBeenCalledTimes(4); // 3 from user-1 + 1 from user-2
    });

    it('S-006.8: Broadcast payload includes server-generated UUID id', () => {
      router.handleMessage(
        mockClient,
        JSON.stringify({ type: 'icebreaker_vibe', payload: { emoji: 'heart' } }),
      );
      const broadcastPayload = mockBroadcast.mock.calls[0][1] as {
        payload: { id: string; emoji: string };
      };
      expect(broadcastPayload.payload.id).toBeDefined();
      expect(typeof broadcastPayload.payload.id).toBe('string');
      expect(broadcastPayload.payload.id.length).toBeGreaterThan(0);
      // UUID v4 format check
      expect(broadcastPayload.payload.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('S-006.9: Non-string emoji field sends error', () => {
      router.handleMessage(
        mockClient,
        JSON.stringify({ type: 'icebreaker_vibe', payload: { emoji: 42 } }),
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('INVALID_MESSAGE'),
      );
      expect(mockBroadcast).not.toHaveBeenCalled();
    });

    it('S-006.10: No payload sends error', () => {
      router.handleMessage(
        mockClient,
        JSON.stringify({ type: 'icebreaker_vibe' }),
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('INVALID_MESSAGE'),
      );
      expect(mockBroadcast).not.toHaveBeenCalled();
    });
  });
});
