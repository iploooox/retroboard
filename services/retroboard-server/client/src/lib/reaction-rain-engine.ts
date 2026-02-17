/**
 * ReactionRainEngine — Object-pooled animation engine for vibe emoji reactions.
 *
 * Pre-creates a fixed pool of DOM elements (absolute-positioned spans).
 * When a vibe event arrives, grabs an idle element from the pool, assigns the
 * emoji and animation class, and returns it to the pool on `animationend`.
 *
 * Supports burst detection: 3+ of the same emoji within 2 seconds spawns 5 extras
 * at a larger size.
 */

/** Emoji key to unicode character mapping */
const EMOJI_CHARS: Record<string, string> = {
  laugh: '\u{1F602}',
  fire: '\u{1F525}',
  heart: '\u{2764}\u{FE0F}',
  bullseye: '\u{1F3AF}',
  clap: '\u{1F44F}',
  skull: '\u{1F480}',
};

/** Emoji key to CSS animation class mapping */
const EMOJI_ANIMATION_CLASS: Record<string, string> = {
  laugh: 'vibe-bounce-laugh',
  fire: 'vibe-rain-fire',
  heart: 'vibe-float-heart',
  bullseye: 'vibe-zoom-bullseye',
  clap: 'vibe-cascade-clap',
  skull: 'vibe-tumble-skull',
};

/** Pool size — max concurrent animations */
const POOL_SIZE = 30;

/** Burst detection: 3+ same emoji in this window triggers 5 extras */
const BURST_WINDOW_MS = 2_000;
const BURST_THRESHOLD = 3;
const BURST_EXTRAS = 5;

interface PoolElement {
  el: HTMLSpanElement;
  inUse: boolean;
}

interface BurstEntry {
  emoji: string;
  timestamp: number;
}

export class ReactionRainEngine {
  private container: HTMLDivElement | null = null;
  private pool: PoolElement[] = [];
  private recentEmojis: BurstEntry[] = [];
  private activeCount = 0;
  private reducedMotion = false;
  private onActiveCountChange: ((count: number) => void) | null = null;

  constructor() {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = mq.matches;
      mq.addEventListener('change', (e) => {
        this.reducedMotion = e.matches;
      });
    }
  }

  /**
   * Mount the engine into the DOM. Creates the container and pool elements.
   * Must be called once when the component mounts.
   */
  mount(parent: HTMLElement): void {
    if (this.container) return; // Already mounted

    this.container = document.createElement('div');
    this.container.className = 'vibe-rain-container';
    this.container.setAttribute('aria-hidden', 'true');
    // Full viewport overlay, no pointer events, above content but below modals
    Object.assign(this.container.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '40',
      overflow: 'hidden',
    });

    parent.appendChild(this.container);

    // Pre-create pool elements
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = document.createElement('span');
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      el.style.willChange = 'transform, opacity';
      el.style.display = 'none';
      el.style.fontSize = '32px';
      el.style.lineHeight = '1';
      el.setAttribute('aria-hidden', 'true');

      // Return to pool on animation end
      el.addEventListener('animationend', () => {
        this.recycle(i);
      });

      this.container.appendChild(el);
      this.pool.push({ el, inUse: false });
    }
  }

  /**
   * Unmount and clean up. Call when the component unmounts.
   */
  unmount(): void {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
    this.pool = [];
    this.recentEmojis = [];
    this.activeCount = 0;
  }

  /**
   * Register a callback that fires whenever the number of active animations changes.
   * Used by the VibeBar to show/hide glow.
   */
  setActiveCountListener(fn: ((count: number) => void) | null): void {
    this.onActiveCountChange = fn;
  }

  /**
   * Spawn a vibe emoji reaction.
   * Called when an `icebreaker_vibe` WS event arrives.
   */
  spawn(emoji: string, isBurst = false): void {
    if (!this.container) return;

    const char = EMOJI_CHARS[emoji];
    if (!char) return;

    // Track for burst detection (only non-burst spawns)
    if (!isBurst) {
      const now = Date.now();
      this.recentEmojis.push({ emoji, timestamp: now });
      // Clean old entries
      this.recentEmojis = this.recentEmojis.filter(
        (e) => now - e.timestamp < BURST_WINDOW_MS,
      );
      // Check for burst
      const sameEmojiCount = this.recentEmojis.filter(
        (e) => e.emoji === emoji,
      ).length;
      if (sameEmojiCount >= BURST_THRESHOLD) {
        // Clear the count for this emoji so we don't re-trigger immediately
        this.recentEmojis = this.recentEmojis.filter((e) => e.emoji !== emoji);
        // Spawn extras in the next frame
        requestAnimationFrame(() => {
          for (let i = 0; i < BURST_EXTRAS; i++) {
            this.spawn(emoji, true);
          }
        });
      }
    }

    // Grab an idle element from pool
    const poolItem = this.pool.find((p) => !p.inUse);
    if (!poolItem) return; // Pool exhausted, drop silently

    poolItem.inUse = true;
    this.activeCount++;
    this.onActiveCountChange?.(this.activeCount);

    const { el } = poolItem;

    // Random horizontal position (10-90% viewport width)
    const leftPercent = 10 + Math.random() * 80;

    // Slight random variation in animation duration (+-20%)
    const baseDuration = this.getBaseDuration(emoji);
    const variation = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
    const duration = baseDuration * variation;

    // Burst emojis are bigger
    const fontSize = isBurst ? '48px' : '32px';

    el.textContent = char;
    el.style.display = 'block';
    el.style.left = `${leftPercent}%`;
    el.style.fontSize = fontSize;

    // Reset animation
    el.className = '';

    if (this.reducedMotion) {
      // Reduced motion: simple fade in/out
      el.className = 'vibe-reduced-motion';
      el.style.animationDuration = `${duration}s`;
    } else {
      const animClass = EMOJI_ANIMATION_CLASS[emoji] ?? 'vibe-rain-fire';
      el.className = animClass;
      el.style.animationDuration = `${duration}s`;
    }

    // For cascade-clap, alternate left/right
    if (emoji === 'clap' && !this.reducedMotion) {
      const fromLeft = Math.random() > 0.5;
      el.style.left = fromLeft ? `${5 + Math.random() * 30}%` : `${65 + Math.random() * 30}%`;
    }

    // For zoom-bullseye, always start from center
    if (emoji === 'bullseye' && !this.reducedMotion) {
      el.style.left = `${40 + Math.random() * 20}%`;
      el.style.top = `${40 + Math.random() * 20}%`;
    }
  }

  /** Get base animation duration per emoji type (seconds) */
  private getBaseDuration(emoji: string): number {
    switch (emoji) {
      case 'laugh': return 2.0;
      case 'fire': return 2.5;
      case 'heart': return 3.0;
      case 'bullseye': return 1.8;
      case 'clap': return 2.2;
      case 'skull': return 2.5;
      default: return 2.0;
    }
  }

  /** Return a pool element to idle state */
  private recycle(index: number): void {
    const item = this.pool[index];
    if (!item) return;

    item.inUse = false;
    item.el.style.display = 'none';
    item.el.className = '';
    item.el.style.top = '';
    item.el.style.animationDuration = '';

    this.activeCount = Math.max(0, this.activeCount - 1);
    this.onActiveCountChange?.(this.activeCount);
  }
}
