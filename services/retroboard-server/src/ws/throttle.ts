export class CursorThrottle {
  private windowMs: number;
  private lastSent: Map<string, number> = new Map();

  constructor(opts: { maxPerSecond: number }) {
    this.windowMs = 1000 / opts.maxPerSecond;
  }

  shouldAllow(userId: string): boolean {
    const now = Date.now();
    const last = this.lastSent.get(userId);
    if (last === undefined || now - last >= this.windowMs) {
      this.lastSent.set(userId, now);
      return true;
    }
    return false;
  }
}
