import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CursorThrottle } from '../../../src/ws/throttle.js';

describe('CursorThrottle', () => {
  let throttle: CursorThrottle;

  beforeEach(() => {
    vi.useFakeTimers();
    // 20/sec = 50ms window per message
    throttle = new CursorThrottle({ maxPerSecond: 20 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('3.5.1: First message passes through', () => {
    const allowed = throttle.shouldAllow('user-1');
    expect(allowed).toBe(true);
  });

  it('3.5.2: Second message within window dropped', () => {
    throttle.shouldAllow('user-1');
    vi.advanceTimersByTime(10); // only 10ms later
    const allowed = throttle.shouldAllow('user-1');
    expect(allowed).toBe(false);
  });

  it('3.5.3: Message after window passes through', () => {
    throttle.shouldAllow('user-1');
    vi.advanceTimersByTime(50); // after 50ms window
    const allowed = throttle.shouldAllow('user-1');
    expect(allowed).toBe(true);
  });

  it('3.5.4: Different users throttled independently', () => {
    throttle.shouldAllow('user-1');
    const allowedB = throttle.shouldAllow('user-2');
    expect(allowedB).toBe(true);
  });

  it('3.5.5: 20 messages in 1 second — exactly 20 pass', () => {
    let passed = 0;
    for (let i = 0; i < 40; i++) {
      if (throttle.shouldAllow('user-1')) passed++;
      vi.advanceTimersByTime(25); // 40 * 25ms = 1000ms total
    }
    expect(passed).toBe(20);
  });
});
