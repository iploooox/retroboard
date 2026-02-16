import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WSClient } from '@/lib/ws-client';

// Type for accessing WSClient internals in tests
type WSClientInternal = WSClient & {
  ws: MockWebSocket | null;
  state: string;
};

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string) {
    // Mock implementation
    console.log('Mock send:', data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    console.log('Mock close:', code, reason);
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket as never;

describe('WSClient', () => {
  let client: WSClient;

  beforeEach(() => {
    client = new WSClient();
  });

  it('should initialize in DISCONNECTED state', () => {
    expect(client.getState()).toBe('DISCONNECTED');
  });

  it('should transition to CONNECTING when connect is called', () => {
    const stateChanges: string[] = [];
    client.onStateChange((state) => {
      stateChanges.push(state);
    });

    client.connect('board-123', 'token-abc');

    expect(client.getState()).toBe('CONNECTING');
    expect(stateChanges).toContain('CONNECTING');
  });

  it('should register and unregister event handlers', () => {
    const handler = vi.fn();

    client.on('test_event', handler);
    expect(() => client.off('test_event', handler)).not.toThrow();
  });

  it('should send messages when connected', () => {
    client.connect('board-123', 'token-abc');

    // Simulate connection open
    const internalClient = client as WSClientInternal;
    const ws = internalClient.ws;
    if (ws) {
      ws.readyState = MockWebSocket.OPEN;
      internalClient.state = 'CONNECTED';
    }

    expect(() => client.send('ping', {})).not.toThrow();
  });

  it('should clean up on disconnect', () => {
    client.connect('board-123', 'token-abc');
    client.disconnect();

    expect(client.getState()).toBe('DISCONNECTED');
  });
});
