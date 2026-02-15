import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeartbeatManager } from '../../../src/ws/heartbeat.js';

describe('HeartbeatManager', () => {
  let hb: HeartbeatManager;
  let mockTerminate: ReturnType<typeof vi.fn>;
  let mockOnStale: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockTerminate = vi.fn();
    mockOnStale = vi.fn();
    hb = new HeartbeatManager({
      checkIntervalMs: 30_000,
      staleThresholdMs: 45_000,
      onStale: mockOnStale,
    });
  });

  afterEach(() => {
    hb.stop();
    vi.useRealTimers();
  });

  it('3.4.1: Active connection kept alive', () => {
    hb.register('client-1', { terminate: mockTerminate } as any);
    hb.recordPing('client-1');

    // Advance 30s — check runs but client pinged recently
    vi.advanceTimersByTime(30_000);
    expect(mockOnStale).not.toHaveBeenCalled();
  });

  it('3.4.2: Stale connection terminated', () => {
    hb.register('client-1', { terminate: mockTerminate } as any);
    // Do NOT send a ping, advance past stale threshold
    vi.advanceTimersByTime(50_000);
    expect(mockOnStale).toHaveBeenCalledWith('client-1');
  });

  it('3.4.3: Check interval runs every 30s', () => {
    hb.register('client-1', { terminate: mockTerminate } as any);
    hb.recordPing('client-1');

    // First check at 30s — client is fresh
    vi.advanceTimersByTime(30_000);
    expect(mockOnStale).not.toHaveBeenCalled();

    // Second check at 60s — client hasn't pinged since initial registration
    vi.advanceTimersByTime(30_000);
    expect(mockOnStale).toHaveBeenCalledTimes(1);
  });

  it('3.4.4: Terminated connection cleaned up', () => {
    hb.register('client-1', { terminate: mockTerminate } as any);
    hb.unregister('client-1');

    // Advance past threshold — should not trigger stale callback
    vi.advanceTimersByTime(60_000);
    expect(mockOnStale).not.toHaveBeenCalled();
  });
});
