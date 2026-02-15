import type WebSocket from 'ws';

interface HeartbeatOptions {
  checkIntervalMs: number;
  staleThresholdMs: number;
  onStale: (clientId: string) => void;
}

export class HeartbeatManager {
  private clients: Map<string, { ws: WebSocket; lastPing: number | null }> = new Map();
  private interval: ReturnType<typeof setInterval>;
  private staleThresholdMs: number;
  private onStale: (clientId: string) => void;

  constructor(opts: HeartbeatOptions) {
    this.staleThresholdMs = opts.staleThresholdMs;
    this.onStale = opts.onStale;
    this.interval = setInterval(() => this.check(), opts.checkIntervalMs);
  }

  register(clientId: string, ws: WebSocket): void {
    this.clients.set(clientId, { ws, lastPing: null });
  }

  recordPing(clientId: string): void {
    const entry = this.clients.get(clientId);
    if (entry) {
      entry.lastPing = Date.now();
    }
  }

  unregister(clientId: string): void {
    this.clients.delete(clientId);
  }

  stop(): void {
    clearInterval(this.interval);
  }

  private check(): void {
    const now = Date.now();
    for (const [clientId, entry] of this.clients) {
      if (entry.lastPing === null || now - entry.lastPing > this.staleThresholdMs) {
        this.onStale(clientId);
      }
    }
  }
}
