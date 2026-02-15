/**
 * WebSocket Client for Real-Time Board Collaboration
 *
 * Manages WebSocket connections with:
 * - Auto-reconnection with exponential backoff
 * - Event replay on reconnect (lastEventId tracking)
 * - Connection state machine (CONNECTING, CONNECTED, RECONNECTING, DISCONNECTED)
 * - Cursor throttling and ping/pong heartbeat
 */

type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  eventId: string;
}

type EventHandler = (message: WSMessage) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private token: string = '';
  private boardId: string = '';

  private state: ConnectionState = 'DISCONNECTED';
  private lastEventId: string | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private stateChangeHandlers: Set<(state: ConnectionState) => void> = new Set();

  constructor() {}

  /**
   * Connect to WebSocket server
   */
  connect(boardId: string, token: string, lastEventId?: string): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return; // Already connected or connecting
    }

    this.boardId = boardId;
    this.token = token;
    if (lastEventId) {
      this.lastEventId = lastEventId;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.url = `${protocol}//${host}/ws?token=${token}&boardId=${boardId}${lastEventId ? `&lastEventId=${lastEventId}` : ''}`;

    this.setState('CONNECTING');
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.setState('CONNECTED');
      this.reconnectAttempts = 0;
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);

        // Track last event ID for reconnection recovery
        if (message.eventId) {
          this.lastEventId = message.eventId;
        }

        // Dispatch to registered handlers
        const handlers = this.eventHandlers.get(message.type);
        if (handlers) {
          handlers.forEach(h => h(message));
        }

        // Also dispatch to wildcard handlers
        const wildcardHandlers = this.eventHandlers.get('*');
        if (wildcardHandlers) {
          wildcardHandlers.forEach(h => h(message));
        }
      } catch (err) {
        console.error('[WSClient] Failed to parse message:', err);
      }
    };

    this.ws.onerror = (event) => {
      console.error('[WSClient] WebSocket error:', event);
    };

    this.ws.onclose = (event) => {
      this.stopPing();

      if (event.code === 1000) {
        // Normal closure
        this.setState('DISCONNECTED');
      } else {
        // Abnormal closure - attempt reconnect
        this.attemptReconnect();
      }
    };
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPing();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState('DISCONNECTED');
    this.reconnectAttempts = 0;
  }

  /**
   * Send a message to the server
   */
  send(type: string, payload: Record<string, unknown> = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn(`[WSClient] Cannot send message, connection state: ${this.state}`);
    }
  }

  /**
   * Register an event handler for a specific event type
   */
  on(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Unregister an event handler
   */
  off(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Register a state change handler
   */
  onStateChange(handler: (state: ConnectionState) => void): void {
    this.stateChangeHandlers.add(handler);
  }

  /**
   * Unregister a state change handler
   */
  offStateChange(handler: (state: ConnectionState) => void): void {
    this.stateChangeHandlers.delete(handler);
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get last event ID for reconnection recovery
   */
  getLastEventId(): string | null {
    return this.lastEventId;
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.stateChangeHandlers.forEach(h => h(newState));
    }
  }

  private attemptReconnect(): void {
    if (this.state === 'DISCONNECTED') {
      return; // User manually disconnected
    }

    this.setState('RECONNECTING');

    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    if (this.reconnectAttempts > 10) {
      console.error('[WSClient] Max reconnection attempts exceeded');
      this.setState('DISCONNECTED');
      return;
    }

    console.log(`[WSClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.boardId, this.token, this.lastEventId || undefined);
    }, delay);
  }

  private startPing(): void {
    // Send ping every 25 seconds
    this.pingTimer = setInterval(() => {
      this.send('ping');
    }, 25000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

// Singleton instance
let wsClientInstance: WSClient | null = null;

export function getWSClient(): WSClient {
  if (!wsClientInstance) {
    wsClientInstance = new WSClient();
  }
  return wsClientInstance;
}
