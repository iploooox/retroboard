import { useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, Send, X } from 'lucide-react';
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

const MAX_RESPONSE_LENGTH = 280;

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

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isRerolling, setIsRerolling] = useState(false);
  const [responseInput, setResponseInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const wallRef = useRef<HTMLDivElement>(null);

  // Load existing responses on mount
  useEffect(() => {
    if (icebreaker) {
      fetchIcebreakerResponses();
    }
  }, [icebreaker, fetchIcebreakerResponses]);

  // Auto-scroll wall to bottom when new responses arrive
  useEffect(() => {
    if (wallRef.current) {
      wallRef.current.scrollTop = wallRef.current.scrollHeight;
    }
  }, [responses.length]);

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

  const handleDeleteResponse = useCallback(
    async (responseId: string) => {
      try {
        await deleteIcebreakerResponse(responseId);
      } catch {
        // Error toast handled by store
      }
    },
    [deleteIcebreakerResponse],
  );

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

  const charCount = responseInput.trim().length;
  const isOverLimit = charCount > MAX_RESPONSE_LENGTH;
  const canSubmit = charCount > 0 && !isOverLimit && !isSubmitting;

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
        <div className="max-w-2xl mx-auto">
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
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-wrap gap-3">
            {responses.map((response) => (
              <div
                key={response.id}
                className="relative bg-white rounded-lg shadow-sm border border-slate-200 px-4 py-3 max-w-xs animate-fade-in"
                data-testid="icebreaker-response-card"
              >
                <p className="text-slate-800 text-sm leading-relaxed break-words">
                  {response.content}
                </p>
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
            ))}
          </div>
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
