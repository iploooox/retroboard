import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';
import { getWSClient } from '@/lib/ws-client';

interface IcebreakerCardProps {
  teamId: string;
  boardId: string;
  onDismiss: () => void;
}

interface Icebreaker {
  id: string;
  question: string;
  category: string;
}

const CATEGORIES = ['Fun', 'Team-Building', 'Reflective', 'Creative', 'Quick'] as const;

export function IcebreakerCard({ teamId, boardId, onDismiss }: IcebreakerCardProps) {
  const [icebreaker, setIcebreaker] = useState<Icebreaker | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [customCategory, setCustomCategory] = useState<string>('Fun');
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  const fetchIcebreaker = useCallback(async (category?: string) => {
    setIsLoading(true);
    try {
      let query = `?teamId=${teamId}&boardId=${boardId}`;
      if (category) {
        query += `&category=${category.toLowerCase()}`;
      }
      const response = await api.get<{ ok: boolean; data: Icebreaker }>(`/icebreakers/random${query}`);
      setIcebreaker(response.data);
    } catch {
      toast.error('Failed to load icebreaker question');
    } finally {
      setIsLoading(false);
    }
  }, [teamId, boardId]);

  useEffect(() => {
    fetchIcebreaker();
  }, [fetchIcebreaker]);

  // Listen for WebSocket icebreaker updates
  useEffect(() => {
    const ws = getWSClient();

    const handleIcebreakerUpdate = (msg: { payload: Record<string, unknown> }) => {
      const { question, category, id } = msg.payload;
      if (typeof question === 'string' && typeof category === 'string' && typeof id === 'string') {
        setIcebreaker({ id, question, category });
      }
    };

    ws.on('icebreaker_update', handleIcebreakerUpdate);

    return () => {
      ws.off('icebreaker_update', handleIcebreakerUpdate);
    };
  }, []);

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    fetchIcebreaker(category || undefined);
  };

  const handleRefresh = () => {
    fetchIcebreaker(selectedCategory || undefined);
  };

  const handleSubmitCustom = async () => {
    if (!customQuestion.trim()) return;

    setIsSubmittingCustom(true);
    try {
      await api.post(`/teams/${teamId}/icebreakers/custom`, {
        question: customQuestion.trim(),
        category: customCategory.toLowerCase(),
      });
      toast.success('Custom icebreaker question added!');
      setCustomQuestion('');
      setShowCustomForm(false);
    } catch {
      toast.error('Failed to add custom question');
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  return (
    <div
      className="shrink-0 border-b px-4 py-3"
      style={{
        backgroundColor: 'var(--theme-card-bg, #ffffff)',
        borderColor: 'var(--theme-column-border, #cbd5e1)',
      }}
    >
      {/* Compact banner: title + question + actions in one row */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Title */}
          <span
            className="text-sm font-bold shrink-0"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            🎲 Icebreaker Question
          </span>

          {/* Question text */}
          <div className="flex-1 min-w-0">
            {icebreaker ? (
              <span className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  &ldquo;{icebreaker.question}&rdquo;
                </span>
                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                  {icebreaker.category}
                </span>
              </span>
            ) : (
              <span className="text-sm text-slate-400 italic">Loading...</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Category filter */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => handleCategoryChange(null)}
                className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                  selectedCategory === null
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-500 border border-slate-300 hover:border-indigo-300'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                    selectedCategory === category
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-500 border border-slate-300 hover:border-indigo-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowCustomForm(!showCustomForm)}
              className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Add custom question"
            >
              <Plus className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              title="New question"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <Button size="sm" onClick={onDismiss}>
              Start Writing
            </Button>
          </div>
        </div>

        {/* Custom Question Form (expandable) */}
        {showCustomForm && (
          <div className="mt-3 border border-slate-200 rounded-lg p-3 space-y-2 bg-white">
            <p className="text-xs font-medium text-slate-600">Add Custom Question</p>
            <textarea
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="Enter your custom icebreaker question..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
            />
            <div className="flex items-center gap-2">
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowCustomForm(false);
                  setCustomQuestion('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmitCustom}
                isLoading={isSubmittingCustom}
                disabled={!customQuestion.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
