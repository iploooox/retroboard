import { useState, useCallback } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { boardApi } from '@/lib/board-api';
import { toast } from '@/lib/toast';

const CATEGORIES = ['Fun', 'Team-Building', 'Reflective', 'Creative', 'Quick'] as const;

const CATEGORY_DISPLAY: Record<string, string> = {
  'fun': 'Fun',
  'team-building': 'Team-Building',
  'reflective': 'Reflective',
  'creative': 'Creative',
  'quick': 'Quick',
};

interface IcebreakerWarmupProps {
  boardId: string;
  teamId: string;
  isFacilitator: boolean;
}

/**
 * Fullscreen icebreaker warmup phase component.
 * Renders when board.phase === 'icebreaker'.
 * Shows a shared question to all participants.
 * Facilitators get controls to reroll and filter by category.
 */
export function IcebreakerWarmup({ boardId, isFacilitator }: IcebreakerWarmupProps) {
  const icebreaker = useBoardStore((s) => s.board?.icebreaker ?? null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isRerolling, setIsRerolling] = useState(false);

  const handleReroll = useCallback(async () => {
    setIsRerolling(true);
    try {
      const result = await boardApi.rerollIcebreaker(
        boardId,
        selectedCategory ? selectedCategory.toLowerCase() : undefined,
      );
      // Update store immediately for the facilitator (WS will update for others)
      useBoardStore.setState((state) => ({
        board: state.board
          ? {
              ...state.board,
              icebreaker_id: result.id,
              icebreaker: result,
            }
          : null,
      }));
    } catch {
      toast.error('Failed to get a new question');
    } finally {
      setIsRerolling(false);
    }
  }, [boardId, selectedCategory]);

  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category);
  }, []);

  // Loading state — no question yet
  if (!icebreaker) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center px-4"
        data-testid="icebreaker-warmup"
      >
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="flex items-center justify-center">
            <Sparkles className="h-12 w-12 text-indigo-500 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            Icebreaker Warmup
          </h2>
          <p className="text-slate-600" data-testid="icebreaker-loading">
            Loading icebreaker question...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-4"
      data-testid="icebreaker-warmup"
    >
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Sparkle icon */}
        <div className="flex items-center justify-center">
          <Sparkles className="h-10 w-10 text-indigo-500" />
        </div>

        {/* Question card — large, centered, prominent */}
        <div
          className="bg-white rounded-2xl shadow-lg p-8 transition-opacity duration-300"
          data-testid="icebreaker-question-card"
        >
          <p
            className="text-3xl font-bold text-center text-slate-900 leading-relaxed"
            data-testid="icebreaker-question-text"
          >
            {icebreaker.question}
          </p>
        </div>

        {/* Category badge */}
        <div className="flex justify-center">
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
            data-testid="icebreaker-category-badge"
          >
            {CATEGORY_DISPLAY[icebreaker.category] || icebreaker.category}
          </span>
        </div>

        {/* Facilitator controls — only visible to facilitators */}
        {isFacilitator && (
          <div className="space-y-4" data-testid="icebreaker-facilitator-controls">
            {/* Category filter pills */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleCategorySelect(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === null
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                data-testid="icebreaker-category-all"
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategorySelect(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  data-testid={`icebreaker-category-${cat.toLowerCase()}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Reroll button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleReroll}
                disabled={isRerolling}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="icebreaker-reroll-button"
              >
                <RefreshCw className={`h-4 w-4 ${isRerolling ? 'animate-spin' : ''}`} />
                New Question
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
