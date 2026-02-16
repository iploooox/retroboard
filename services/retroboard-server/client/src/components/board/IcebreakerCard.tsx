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
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm px-4">
      <div className="max-w-2xl w-full text-center space-y-6">
        {/* Title */}
        <h2 className="text-2xl font-bold text-slate-900">
          🎲 Icebreaker Question
        </h2>

        {/* Question card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          {icebreaker ? (
            <div className="space-y-4">
              <p className="text-xl font-medium text-slate-800">
                {icebreaker.question}
              </p>
              <span className="inline-block px-3 py-1 text-sm font-medium bg-indigo-100 text-indigo-700 rounded-full">
                {icebreaker.category}
              </span>
            </div>
          ) : (
            <p className="text-xl text-slate-400 italic">Loading icebreaker...</p>
          )}
        </div>

        {/* Category filter buttons */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => handleCategoryChange(null)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
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
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                selectedCategory === category
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-500 border border-slate-300 hover:border-indigo-300'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Custom
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            New Question
          </button>

          <Button onClick={onDismiss}>
            Start Writing
          </Button>
        </div>

        {/* Custom Question Form (expandable) */}
        {showCustomForm && (
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white text-left">
            <p className="text-sm font-medium text-slate-600">Add Custom Question</p>
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
