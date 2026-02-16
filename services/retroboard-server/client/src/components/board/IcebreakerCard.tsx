import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, Plus } from 'lucide-react';
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
    <div className="mx-4 mt-4 mb-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold text-indigo-900">🎲 Icebreaker Question</h3>
            {icebreaker && (
              <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                {icebreaker.category}
              </span>
            )}
          </div>
          {icebreaker ? (
            <p className="text-lg font-medium text-slate-800 leading-relaxed">{icebreaker.question}</p>
          ) : (
            <p className="text-slate-400 italic">Loading icebreaker...</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Dismiss icebreaker"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => handleCategoryChange(null)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            selectedCategory === null
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-slate-600 border border-slate-300 hover:border-indigo-300'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryChange(category)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              selectedCategory === category
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 border border-slate-300 hover:border-indigo-300'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Custom Question Form */}
      {showCustomForm && (
        <div className="border-t border-indigo-200 pt-3 mt-3 space-y-2">
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

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowCustomForm(!showCustomForm)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Custom
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          isLoading={isLoading}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          New Question
        </Button>
      </div>
    </div>
  );
}
