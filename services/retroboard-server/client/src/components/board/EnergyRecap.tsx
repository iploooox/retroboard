import { useEffect, useRef, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { ReactionRainEngine } from '@/lib/reaction-rain-engine';

/** Emojis to burst during celebration */
const CELEBRATION_EMOJIS = ['laugh', 'fire', 'heart', 'clap', 'bullseye'] as const;

/** How long the recap displays before auto-dismissing (ms) */
const AUTO_DISMISS_MS = 3_000;

/** Number of celebration burst emojis to spawn */
const BURST_COUNT = 8;

/**
 * Energy recap overlay shown briefly when transitioning from icebreaker to write phase.
 * Displays aggregated stats (responses, reactions, participants) with a celebration burst.
 * Auto-dismisses after 3 seconds, or click anywhere to skip.
 */
export function EnergyRecap() {
  const showRecap = useBoardStore((s) => s.showEnergyRecap);
  const recapData = useBoardStore((s) => s.energyRecapData);
  const dismissRecap = useBoardStore((s) => s.dismissEnergyRecap);

  const engineRef = useRef<ReactionRainEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount rain engine and trigger celebration burst
  useEffect(() => {
    if (!showRecap) return;

    const engine = new ReactionRainEngine();
    engineRef.current = engine;
    engine.mount(document.body);

    // Spawn a celebration burst with staggered timing
    const spawnBurst = () => {
      for (let i = 0; i < BURST_COUNT; i++) {
        const emojiIndex = i % CELEBRATION_EMOJIS.length;
        const emoji = CELEBRATION_EMOJIS[emojiIndex] ?? 'fire';
        // Stagger spawns to avoid bunching
        setTimeout(() => {
          engine.spawn(emoji, true);
        }, i * 80);
      }
    };

    // Slight delay so the overlay fades in first
    const frameId = requestAnimationFrame(spawnBurst);

    // Auto-dismiss after 3 seconds
    timerRef.current = setTimeout(() => {
      dismissRecap();
    }, AUTO_DISMISS_MS);

    return () => {
      cancelAnimationFrame(frameId);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      engine.setActiveCountListener(null);
      engine.unmount();
      engineRef.current = null;
    };
  }, [showRecap, dismissRecap]);

  const handleClick = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dismissRecap();
  }, [dismissRecap]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  if (!showRecap || !recapData) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Click to dismiss energy recap"
      data-testid="energy-recap-overlay"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl px-10 py-8 max-w-md w-full text-center space-y-5 animate-scale-in"
        data-testid="energy-recap-card"
      >
        {/* Headline */}
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-8 w-8 text-amber-500" />
          <h2
            className="text-2xl font-bold text-slate-900"
            data-testid="energy-recap-headline"
          >
            Your team is warmed up!
          </h2>
          <Sparkles className="h-8 w-8 text-amber-500" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4" data-testid="energy-recap-stats">
          <div className="bg-amber-50 rounded-xl px-4 py-3">
            <p
              className="text-3xl font-bold text-amber-600"
              data-testid="energy-recap-response-count"
            >
              {recapData.responseCount}
            </p>
            <p className="text-sm text-amber-800 font-medium">
              {recapData.responseCount === 1 ? 'response shared' : 'responses shared'}
            </p>
          </div>
          <div className="bg-rose-50 rounded-xl px-4 py-3">
            <p
              className="text-3xl font-bold text-rose-600"
              data-testid="energy-recap-reaction-count"
            >
              {recapData.reactionCount}
            </p>
            <p className="text-sm text-rose-800 font-medium">
              {recapData.reactionCount === 1 ? 'reaction fired' : 'reactions fired'}
            </p>
          </div>
        </div>

        {/* Participant count */}
        <p className="text-slate-600 text-sm" data-testid="energy-recap-participants">
          {recapData.participantCount}{' '}
          {recapData.participantCount === 1 ? 'person' : 'people'} participated
        </p>

        {/* Skip hint */}
        <p className="text-xs text-slate-400">Click anywhere to continue</p>
      </div>
    </div>
  );
}
