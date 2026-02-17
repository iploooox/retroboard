import { useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, Send, X, Play } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { boardApi } from '@/lib/board-api';
import type { IcebreakerResponse } from '@/lib/board-api';
import { toast } from '@/lib/toast';
import { IcebreakerReactionBar } from './IcebreakerReactionBar';
import { VibeBar } from './VibeBar';

const CATEGORIES = ['Fun', 'Team-Building', 'Reflective', 'Creative', 'Quick'] as const;

const CATEGORY_DISPLAY: Record<string, string> = {
  'fun': 'Fun',
  'team-building': 'Team-Building',
  'reflective': 'Reflective',
  'creative': 'Creative',
  'quick': 'Quick',
};

const MAX_RESPONSE_LENGTH = 280;

/** Maximum cards rendered on the wall (older ones remain in store but are not rendered) */
const MAX_RENDERED_CARDS = 50;

/** Pastel colors assigned deterministically by response ID hash */
const PASTEL_COLORS = [
  '#FEF3C7', // warm yellow
  '#DBEAFE', // soft blue
  '#FCE7F3', // light pink
  '#D1FAE5', // mint green
  '#EDE9FE', // lavender
  '#FEE2E2', // rose
  '#E0F2FE', // sky
  '#FEF9C3', // cream
] as const;

/** Delay in ms between each card on initial cascade load */
const CASCADE_DELAY_MS = 50;

/**
 * Simple deterministic hash for a string.
 * Used to pick pastel color + rotation for each response, consistent across reloads.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

/** Get a deterministic pastel color for a response ID */
function getCardColor(responseId: string): string {
  return PASTEL_COLORS[hashString(responseId) % PASTEL_COLORS.length]!;
}

/** Get a deterministic rotation between -2deg and +2deg for a response ID */
function getCardRotation(responseId: string): number {
  // Use a different seed offset so rotation is independent of color
  const h = hashString(responseId + '_rot');
  // Map to range [-2, 2] with 0.5deg granularity
  return ((h % 9) - 4) * 0.5;
}

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
 * All participants can submit anonymous responses that appear on a shared wall.
 */
export function IcebreakerWarmup({ boardId, isFacilitator }: IcebreakerWarmupProps) {
  const icebreaker = useBoardStore((s) => s.board?.icebreaker ?? null);
  const responses = useBoardStore((s) => s.icebreakerResponses);
  const fetchIcebreakerResponses = useBoardStore((s) => s.fetchIcebreakerResponses);
  const submitIcebreakerResponse = useBoardStore((s) => s.submitIcebreakerResponse);
  const deleteIcebreakerResponse = useBoardStore((s) => s.deleteIcebreakerResponse);

  const setPhase = useBoardStore((s) => s.setPhase);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isRerolling, setIsRerolling] = useState(false);
  const [responseInput, setResponseInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [isStartingRetro, setIsStartingRetro] = useState(false);
  const wallRef = useRef<HTMLDivElement>(null);

  // Track whether this is the initial load (for cascade vs entrance animation)
  const isInitialLoadRef = useRef(true);
  // Track which response IDs have already been rendered (to distinguish new arrivals)
  const renderedIdsRef = useRef(new Set<string>());
  // Track IDs that are in the process of exit animation (deleted)
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());

  // Load existing responses on mount
  useEffect(() => {
    if (icebreaker) {
      fetchIcebreakerResponses().then(() => {
        // Mark initial load complete after a tick so cascade animation can apply
        requestAnimationFrame(() => {
          isInitialLoadRef.current = false;
        });
      }).catch(() => {
        // Error handled in store
        isInitialLoadRef.current = false;
      });
    }
  }, [icebreaker, fetchIcebreakerResponses]);

  // Auto-scroll wall to bottom when new responses arrive (smooth scroll)
  useEffect(() => {
    if (wallRef.current) {
      wallRef.current.scrollTo({
        top: wallRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [responses.length]);

  // Clean up will-change after animations complete
  const handleAnimationEnd = useCallback((e: React.AnimationEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.style.willChange = 'auto';
  }, []);

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

  const handleSubmitResponse = useCallback(async () => {
    const trimmed = responseInput.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitIcebreakerResponse(trimmed);
      setResponseInput('');
    } catch {
      // Error toast handled by store
    } finally {
      setIsSubmitting(false);
    }
  }, [responseInput, isSubmitting, submitIcebreakerResponse]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmitResponse();
      }
    },
    [handleSubmitResponse],
  );

  const handleStartRetroClick = useCallback(() => {
    setShowStartConfirm(true);
  }, []);

  const handleCancelStart = useCallback(() => {
    setShowStartConfirm(false);
  }, []);

  const handleConfirmStartRetro = useCallback(async () => {
    if (isStartingRetro) return;
    setIsStartingRetro(true);
    try {
      await setPhase('write');
      // Phase change will trigger WS broadcast and energy recap via useBoardSync
    } catch {
      toast.error('Failed to start retro');
      setShowStartConfirm(false);
    } finally {
      setIsStartingRetro(false);
    }
  }, [isStartingRetro, setPhase]);

  const handleDeleteResponse = useCallback(
    async (responseId: string) => {
      // Add to exiting set to trigger exit animation
      setExitingIds((prev) => new Set(prev).add(responseId));

      // Wait for exit animation duration, then actually delete
      setTimeout(async () => {
        try {
          await deleteIcebreakerResponse(responseId);
        } catch {
          // Error toast handled by store
        }
        // Remove from exiting set
        setExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(responseId);
          return next;
        });
      }, 250); // matches card-exit animation duration
    },
    [deleteIcebreakerResponse],
  );

  // Loading state -- no question yet
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

  const charCount = responseInput.trim().length;
  const isOverLimit = charCount > MAX_RESPONSE_LENGTH;
  const canSubmit = charCount > 0 && !isOverLimit && !isSubmitting;

  // Limit rendered responses to last MAX_RENDERED_CARDS
  const visibleResponses = responses.slice(-MAX_RENDERED_CARDS);

  // Build animation class for each card
  function getCardAnimationClass(response: IcebreakerResponse): string {
    // Exiting card
    if (exitingIds.has(response.id)) {
      return 'icebreaker-card-exit';
    }

    // Already rendered — no animation
    if (renderedIdsRef.current.has(response.id)) {
      return '';
    }

    // Mark as rendered
    renderedIdsRef.current.add(response.id);

    // Initial load — cascade with staggered delay
    if (isInitialLoadRef.current) {
      return 'icebreaker-card-cascade';
    }

    // Real-time arrival — entrance animation
    return 'icebreaker-card-enter';
  }

  return (
    <div
      className="flex-1 flex flex-col h-full"
      data-testid="icebreaker-warmup"
    >
      {/* Top section: Question + controls */}
      <div className="flex-shrink-0 px-4 pt-6 pb-4">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          {/* Sparkle icon */}
          <div className="flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-indigo-500" />
          </div>

          {/* Question card -- large, centered, prominent */}
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

          {/* Facilitator controls -- only visible to facilitators */}
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

      {/* Response count */}
      <div className="flex-shrink-0 px-4 pb-2">
        <div className="max-w-4xl mx-auto">
          <p
            className="text-sm font-medium text-slate-500"
            data-testid="icebreaker-response-count"
          >
            {responses.length} {responses.length === 1 ? 'response' : 'responses'}
          </p>
        </div>
      </div>

      {/* Response wall -- scrollable, takes remaining space */}
      <div
        ref={wallRef}
        className="flex-1 overflow-y-auto px-4 pb-4"
        data-testid="icebreaker-response-wall"
      >
        <div className="max-w-4xl mx-auto icebreaker-wall">
          {/* Responsive grid: 1 col mobile, 2 tablet, 3-4 desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleResponses.map((response, index) => {
              const animClass = getCardAnimationClass(response);
              const color = getCardColor(response.id);
              const rotation = getCardRotation(response.id);
              const cascadeDelay = animClass === 'icebreaker-card-cascade'
                ? `${index * CASCADE_DELAY_MS}ms`
                : undefined;

              return (
                <div
                  key={response.id}
                  className={`icebreaker-card group relative rounded-xl shadow-md px-5 py-4 ${animClass}`}
                  style={{
                    '--card-rotation': `${rotation}deg`,
                    '--cascade-delay': cascadeDelay,
                    backgroundColor: color,
                  } as React.CSSProperties}
                  onAnimationEnd={handleAnimationEnd}
                  data-testid="icebreaker-response-card"
                >
                  <p className="text-slate-800 text-sm leading-relaxed break-words">
                    {response.content}
                  </p>
                  <IcebreakerReactionBar
                    responseId={response.id}
                    reactions={response.reactions ?? {}}
                    myReactions={response.myReactions ?? []}
                  />
                  {isFacilitator && (
                    <button
                      type="button"
                      onClick={() => handleDeleteResponse(response.id)}
                      className="absolute -top-2 -right-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-0.5 transition-colors"
                      aria-label="Delete response"
                      data-testid="icebreaker-delete-response"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vibe bar — above input bar (S-006) */}
      <div className="flex-shrink-0">
        <VibeBar />
      </div>

      {/* Start Retro / Waiting area (S-007) */}
      <div className="flex-shrink-0 px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-indigo-100" data-testid="icebreaker-start-area">
        <div className="max-w-2xl mx-auto flex items-center justify-center">
          {isFacilitator ? (
            showStartConfirm ? (
              <div className="flex items-center gap-3" data-testid="icebreaker-start-confirm">
                <span className="text-sm font-medium text-slate-700">Ready?</span>
                <button
                  type="button"
                  onClick={handleConfirmStartRetro}
                  disabled={isStartingRetro}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  data-testid="icebreaker-start-confirm-button"
                >
                  <Play className="h-4 w-4" />
                  Start Retro
                </button>
                <button
                  type="button"
                  onClick={handleCancelStart}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-100 transition-colors"
                  data-testid="icebreaker-start-cancel-button"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartRetroClick}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 text-white text-lg font-semibold hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all"
                data-testid="icebreaker-start-retro-button"
              >
                <Play className="h-5 w-5" />
                Start Retro
              </button>
            )
          ) : (
            <p
              className="text-sm text-slate-500 italic"
              data-testid="icebreaker-waiting-text"
            >
              Waiting for facilitator to start the retro...
            </p>
          )}
        </div>
      </div>

      {/* Input bar -- fixed at bottom */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3" data-testid="icebreaker-input-bar">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <input
            type="text"
            value={responseInput}
            onChange={(e) => setResponseInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your anonymous response..."
            maxLength={300}
            className={`flex-1 px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-colors ${
              isOverLimit
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'
            }`}
            data-testid="icebreaker-response-input"
          />
          <span
            className={`text-xs tabular-nums ${isOverLimit ? 'text-red-500 font-medium' : 'text-slate-400'}`}
            data-testid="icebreaker-char-count"
          >
            {charCount}/{MAX_RESPONSE_LENGTH}
          </span>
          <button
            type="button"
            onClick={handleSubmitResponse}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Submit response"
            data-testid="icebreaker-submit-response"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
