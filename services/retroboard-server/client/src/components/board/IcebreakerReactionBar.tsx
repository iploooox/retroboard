import { useCallback } from 'react';
import { useBoardStore } from '@/stores/board';

/**
 * Mapping from short emoji keys to unicode emoji characters.
 * Keys are stored in the database; display values are rendered in the UI.
 */
const EMOJI_MAP: Record<string, string> = {
  laugh: '\u{1F602}',
  fire: '\u{1F525}',
  heart: '\u{2764}\u{FE0F}',
  bullseye: '\u{1F3AF}',
  clap: '\u{1F44F}',
  skull: '\u{1F480}',
};

/** Ordered list of emoji keys for consistent rendering */
const EMOJI_KEYS = ['laugh', 'fire', 'heart', 'bullseye', 'clap', 'skull'] as const;

interface IcebreakerReactionBarProps {
  responseId: string;
  reactions: Record<string, number>;
  myReactions: string[];
}

/**
 * Reaction bar displayed below each icebreaker response card.
 * Shows 6 emoji buttons with toggle behavior and count badges.
 *
 * Desktop: hidden by default, shown on card hover via CSS (parent .group).
 * Mobile: always visible in compact form.
 */
export function IcebreakerReactionBar({ responseId, reactions, myReactions }: IcebreakerReactionBarProps) {
  const toggleReaction = useBoardStore((s) => s.toggleIcebreakerReaction);

  const handleClick = useCallback(
    (emoji: string) => {
      toggleReaction(responseId, emoji);
    },
    [responseId, toggleReaction],
  );

  return (
    <div
      className="flex items-center gap-1 mt-2 flex-wrap
        sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity sm:duration-200"
      data-testid="icebreaker-reaction-bar"
    >
      {EMOJI_KEYS.map((key) => {
        const count = reactions[key] ?? 0;
        const isActive = myReactions.includes(key);

        return (
          <button
            key={key}
            type="button"
            onClick={() => handleClick(key)}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors
              ${isActive
                ? 'bg-indigo-100 ring-1 ring-indigo-300'
                : 'bg-white/60 hover:bg-white/90'
              }`}
            aria-label={`React with ${key}`}
            data-testid={`icebreaker-reaction-${key}`}
          >
            <span className="text-sm leading-none">{EMOJI_MAP[key]}</span>
            {count > 0 && (
              <span
                className="text-[10px] font-medium text-slate-600 tabular-nums"
                data-testid={`icebreaker-reaction-count-${key}`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
