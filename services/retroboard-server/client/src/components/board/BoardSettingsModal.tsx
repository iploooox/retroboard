import { useState, useEffect, type FormEvent } from 'react';
import { useBoardStore } from '@/stores/board';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Check, Plus, Trash2, Edit2, X } from 'lucide-react';

interface BoardSettingsModalProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  currentTheme?: string;
}

const THEMES = [
  { name: 'default', label: 'Default', color: 'bg-indigo-500' },
  { name: 'ocean', label: 'Ocean', color: 'bg-blue-500' },
  { name: 'sunset', label: 'Sunset', color: 'bg-orange-500' },
  { name: 'forest', label: 'Forest', color: 'bg-green-600' },
  { name: 'midnight', label: 'Midnight', color: 'bg-slate-900' },
  { name: 'lavender', label: 'Lavender', color: 'bg-purple-400' },
  { name: 'coral', label: 'Coral', color: 'bg-pink-500' },
  { name: 'monochrome', label: 'Monochrome', color: 'bg-gray-400' },
] as const;

interface CustomSentimentWord {
  word: string;
  score: number;
  teamId: string;
  isCustom: boolean;
}

export function BoardSettingsModal({ open, onClose, teamId, currentTheme = 'default' }: BoardSettingsModalProps) {
  const board = useBoardStore((s) => s.board);
  const updateSettings = useBoardStore((s) => s.updateSettings);

  const [anonymousMode, setAnonymousMode] = useState(board?.anonymous_mode ?? false);
  const [maxVotesPerUser, setMaxVotesPerUser] = useState(String(board?.max_votes_per_user ?? 5));
  const [maxVotesPerCard, setMaxVotesPerCard] = useState(String(board?.max_votes_per_card ?? 3));
  const [selectedTheme, setSelectedTheme] = useState(currentTheme);
  const [isSaving, setIsSaving] = useState(false);

  // Sentiment lexicon state
  const [customWords, setCustomWords] = useState<CustomSentimentWord[]>([]);
  const [isLoadingWords, setIsLoadingWords] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newScore, setNewScore] = useState('0');
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [editingWord, setEditingWord] = useState<string | null>(null);
  const [editScore, setEditScore] = useState('0');

  // Load custom words when modal opens
  useEffect(() => {
    if (open) {
      loadCustomWords();
    }
  }, [open, teamId]);

  const loadCustomWords = async () => {
    setIsLoadingWords(true);
    try {
      const response = await api.get<{ ok: boolean; data: CustomSentimentWord[] }>(
        `/teams/${teamId}/sentiment/lexicon`,
      );
      setCustomWords(response.data);
    } catch {
      toast.error('Failed to load custom sentiment words');
    } finally {
      setIsLoadingWords(false);
    }
  };

  const handleAddWord = async () => {
    if (!newWord.trim()) {
      toast.error('Word cannot be empty');
      return;
    }

    const score = parseFloat(newScore);
    if (isNaN(score) || score < -5 || score > 5) {
      toast.error('Score must be between -5.0 and 5.0');
      return;
    }

    setIsAddingWord(true);
    try {
      await api.post(`/teams/${teamId}/sentiment/lexicon`, {
        word: newWord.trim(),
        score,
      });
      toast.success('Custom word added');
      setNewWord('');
      setNewScore('0');
      await loadCustomWords();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('This word already exists');
      } else {
        toast.error('Failed to add word');
      }
    } finally {
      setIsAddingWord(false);
    }
  };

  const handleUpdateWord = async (word: string) => {
    const score = parseFloat(editScore);
    if (isNaN(score) || score < -5 || score > 5) {
      toast.error('Score must be between -5.0 and 5.0');
      return;
    }

    try {
      await api.put(`/teams/${teamId}/sentiment/lexicon/${encodeURIComponent(word)}`, {
        score,
      });
      toast.success('Word updated');
      setEditingWord(null);
      await loadCustomWords();
    } catch {
      toast.error('Failed to update word');
    }
  };

  const handleDeleteWord = async (word: string) => {
    if (!confirm(`Delete "${word}" from custom lexicon?`)) return;

    try {
      await api.delete(`/teams/${teamId}/sentiment/lexicon/${encodeURIComponent(word)}`);
      toast.success('Word deleted');
      await loadCustomWords();
    } catch {
      toast.error('Failed to delete word');
    }
  };

  const startEditing = (word: string, score: number) => {
    setEditingWord(word);
    setEditScore(String(score));
  };

  const cancelEditing = () => {
    setEditingWord(null);
    setEditScore('0');
  };

  if (!board) return null;

  const isWritePhase = board.phase === 'write';
  const canChangeVotes = board.phase === 'write' || board.phase === 'group';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Update board settings
      await updateSettings({
        anonymous_mode: anonymousMode,
        max_votes_per_user: parseInt(maxVotesPerUser) || 5,
        max_votes_per_card: parseInt(maxVotesPerCard) || 3,
      });

      // Update team theme if changed
      if (selectedTheme !== currentTheme) {
        await api.patch<{ team: { theme: string } }>(`/teams/${teamId}`, { theme: selectedTheme });
        toast.success('Theme updated successfully');
        // Reload page to apply new theme
        window.location.reload();
      }

      onClose();
    } catch {
      // Error handled in store
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Board Settings">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Theme Selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Board Theme</label>
          <div className="grid grid-cols-4 gap-3">
            {THEMES.map((theme) => (
              <button
                key={theme.name}
                type="button"
                onClick={() => setSelectedTheme(theme.name)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  selectedTheme === theme.name
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-full ${theme.color} flex items-center justify-center`}>
                  {selectedTheme === theme.name && <Check className="h-5 w-5 text-white" />}
                </div>
                <span className="text-xs font-medium text-slate-700">{theme.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="anonymous-mode" className="text-sm font-medium text-slate-700">
              Anonymous Mode
            </label>
            <p className="text-xs text-slate-400">Hide card authors from other members</p>
          </div>
          <button
            id="anonymous-mode"
            type="button"
            role="switch"
            aria-checked={anonymousMode}
            disabled={!isWritePhase}
            onClick={() => setAnonymousMode(!anonymousMode)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              anonymousMode ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                anonymousMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {!isWritePhase && (
          <p className="text-xs text-amber-600">Anonymous mode can only be changed during the Write phase.</p>
        )}

        <div className="space-y-1">
          <label htmlFor="max-votes-user" className="block text-sm font-medium text-slate-700">
            Max votes per user
          </label>
          <input
            id="max-votes-user"
            type="number"
            min={1}
            max={99}
            value={maxVotesPerUser}
            onChange={(e) => setMaxVotesPerUser(e.target.value)}
            disabled={!canChangeVotes}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="max-votes-card" className="block text-sm font-medium text-slate-700">
            Max votes per card (per user)
          </label>
          <input
            id="max-votes-card"
            type="number"
            min={1}
            max={99}
            value={maxVotesPerCard}
            onChange={(e) => setMaxVotesPerCard(e.target.value)}
            disabled={!canChangeVotes}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {!canChangeVotes && (
          <p className="text-xs text-amber-600">Vote limits can only be changed during Write or Group phase.</p>
        )}

        {/* Sentiment Lexicon Management */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-1">Custom Sentiment Words</h3>
            <p className="text-xs text-slate-500">
              Add custom words with sentiment scores (range: -5 to 5) to improve analysis for your team.
            </p>
          </div>

          {/* Add new word */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Word"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              step="0.1"
              min="-5"
              max="5"
              placeholder="Score"
              value={newScore}
              onChange={(e) => setNewScore(e.target.value)}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button
              type="button"
              onClick={handleAddWord}
              isLoading={isAddingWord}
              size="sm"
              aria-label="Add custom word"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* List of custom words */}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {isLoadingWords ? (
              <p className="text-xs text-slate-400 text-center py-4">Loading...</p>
            ) : customWords.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                No custom words yet. Add one above to get started.
              </p>
            ) : (
              customWords.map((item) => (
                <div
                  key={item.word}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-700">{item.word}</span>
                  </div>
                  {editingWord === item.word ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="-5"
                        max="5"
                        value={editScore}
                        onChange={(e) => setEditScore(e.target.value)}
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateWord(item.word)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="p-1 text-slate-500 hover:bg-slate-100 rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-mono px-2 py-1 rounded ${
                          item.score > 0
                            ? 'bg-green-100 text-green-700'
                            : item.score < 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.score > 0 ? '+' : ''}
                        {item.score.toFixed(1)}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditing(item.word, item.score)}
                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWord(item.word)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>Save Settings</Button>
        </div>
      </form>
    </Modal>
  );
}
