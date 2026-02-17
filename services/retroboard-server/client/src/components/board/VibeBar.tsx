import { useCallback, useEffect, useRef, useState } from 'react';
import { getWSClient } from '@/lib/ws-client';
import { ReactionRainEngine } from '@/lib/reaction-rain-engine';

/** Emoji keys in display order */
const VIBE_EMOJIS = [
  { key: 'laugh', char: '\u{1F602}', label: 'Send laugh reaction' },
  { key: 'fire', char: '\u{1F525}', label: 'Send fire reaction' },
  { key: 'heart', char: '\u{2764}\u{FE0F}', label: 'Send heart reaction' },
  { key: 'bullseye', char: '\u{1F3AF}', label: 'Send bullseye reaction' },
  { key: 'clap', char: '\u{1F44F}', label: 'Send clap reaction' },
  { key: 'skull', char: '\u{1F480}', label: 'Send skull reaction' },
] as const;

/** Client-side rate limit: 3 per second */
const CLIENT_RATE_MAX = 3;
const CLIENT_RATE_WINDOW_MS = 1_000;

export function VibeBar() {
  const engineRef = useRef<ReactionRainEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const rateBucketRef = useRef<{ count: number; resetAt: number }>({ count: 0, resetAt: 0 });

  // Mount the rain engine
  useEffect(() => {
    const engine = new ReactionRainEngine();
    engineRef.current = engine;

    // Mount to document body so it overlays everything
    engine.mount(document.body);

    // Track active count for glow
    engine.setActiveCountListener((count) => {
      setIsActive(count > 0);
    });

    return () => {
      engine.setActiveCountListener(null);
      engine.unmount();
      engineRef.current = null;
    };
  }, []);

  // Listen for incoming icebreaker_vibe WS events
  useEffect(() => {
    const ws = getWSClient();
    const seenVibeIds = new Set<string>();

    const handleVibe = (msg: { payload: Record<string, unknown> }) => {
      const emoji = msg.payload.emoji as string;
      const id = msg.payload.id as string;

      // Deduplicate
      if (id && seenVibeIds.has(id)) return;
      if (id) {
        seenVibeIds.add(id);
        // Keep set bounded
        if (seenVibeIds.size > 200) {
          const iter = seenVibeIds.values();
          for (let i = 0; i < 100; i++) {
            const next = iter.next();
            if (next.done) break;
            seenVibeIds.delete(next.value);
          }
        }
      }

      engineRef.current?.spawn(emoji);
    };

    ws.on('icebreaker_vibe', handleVibe as never);

    return () => {
      ws.off('icebreaker_vibe', handleVibe as never);
    };
  }, []);

  // Handle emoji tap with client-side rate limiting
  const handleEmojiTap = useCallback((emojiKey: string) => {
    const now = Date.now();
    const bucket = rateBucketRef.current;

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + CLIENT_RATE_WINDOW_MS;
    }

    bucket.count++;
    if (bucket.count > CLIENT_RATE_MAX) return; // Drop silently

    // Send to server
    const ws = getWSClient();
    ws.send('icebreaker_vibe', { emoji: emojiKey });

    // Visual tap feedback
    setPressedKey(emojiKey);
    setTimeout(() => setPressedKey(null), 150);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`vibe-bar ${isActive ? 'vibe-bar-active' : ''}`}
      data-testid="vibe-bar"
      role="toolbar"
      aria-label="Vibe reactions"
    >
      <div className="flex items-center justify-center gap-3">
        {VIBE_EMOJIS.map(({ key, char, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleEmojiTap(key)}
            className={`vibe-bar-button ${pressedKey === key ? 'vibe-bar-button-pressed' : ''}`}
            aria-label={label}
            data-testid={`vibe-emoji-${key}`}
          >
            <span className="text-[32px] leading-none select-none">{char}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
