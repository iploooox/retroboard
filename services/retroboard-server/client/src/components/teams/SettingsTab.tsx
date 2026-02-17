import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Sparkles, Trash2, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Team {
  id: string;
  name: string;
  description: string | null;
  icebreaker_enabled?: boolean;
  icebreaker_default_category?: string | null;
  icebreaker_timer_seconds?: number | null;
}

interface CustomQuestion {
  id: string;
  question: string;
  category: string;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

interface SettingsTabProps {
  team: Team;
  onUpdated: () => void;
}

const CATEGORIES = [
  { value: 'fun', label: 'Fun' },
  { value: 'team-building', label: 'Team-Building' },
  { value: 'reflective', label: 'Reflective' },
  { value: 'creative', label: 'Creative' },
  { value: 'quick', label: 'Quick' },
] as const;

const TIMER_OPTIONS = [
  { value: '', label: 'No timer' },
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '120', label: '2 minutes' },
  { value: '180', label: '3 minutes' },
  { value: '300', label: '5 minutes' },
  { value: '600', label: '10 minutes' },
] as const;

export function SettingsTab({ team, onUpdated }: SettingsTabProps) {
  const navigate = useNavigate();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Icebreaker settings
  const [icebreakerEnabled, setIcebreakerEnabled] = useState(team.icebreaker_enabled ?? true);
  const [defaultCategory, setDefaultCategory] = useState<string>(team.icebreaker_default_category ?? '');
  const [timerSeconds, setTimerSeconds] = useState<string>(
    team.icebreaker_timer_seconds != null ? String(team.icebreaker_timer_seconds) : '',
  );
  const [isSavingIcebreaker, setIsSavingIcebreaker] = useState(false);

  // Custom questions
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionCategory, setNewQuestionCategory] = useState('fun');
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);

  // Sync icebreaker settings when team prop changes
  useEffect(() => {
    setIcebreakerEnabled(team.icebreaker_enabled ?? true);
    setDefaultCategory(team.icebreaker_default_category ?? '');
    setTimerSeconds(team.icebreaker_timer_seconds != null ? String(team.icebreaker_timer_seconds) : '');
  }, [team.icebreaker_enabled, team.icebreaker_default_category, team.icebreaker_timer_seconds]);

  const fetchCustomQuestions = useCallback(async () => {
    setIsLoadingQuestions(true);
    try {
      const data = await api.get<{ ok: boolean; data: { questions: CustomQuestion[] } }>(
        `/teams/${team.id}/icebreakers/custom`,
      );
      setCustomQuestions(data.data.questions);
    } catch {
      // Silently fail — not critical for settings page load
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [team.id]);

  useEffect(() => {
    fetchCustomQuestions();
  }, [fetchCustomQuestions]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await api.put(`/teams/${team.id}`, {
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.success('Team updated');
      onUpdated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update team');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIcebreaker = async () => {
    setIsSavingIcebreaker(true);
    try {
      await api.patch(`/teams/${team.id}/settings/icebreaker`, {
        enabled: icebreakerEnabled,
        defaultCategory: defaultCategory || null,
        timerSeconds: timerSeconds ? Number(timerSeconds) : null,
      });
      toast.success('Icebreaker settings updated');
      onUpdated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update icebreaker settings');
    } finally {
      setIsSavingIcebreaker(false);
    }
  };

  const handleAddQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    setIsAddingQuestion(true);
    try {
      await api.post(`/teams/${team.id}/icebreakers/custom`, {
        question: newQuestion.trim(),
        category: newQuestionCategory,
      });
      toast.success('Custom question added');
      setNewQuestion('');
      await fetchCustomQuestions();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add question');
    } finally {
      setIsAddingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setDeletingQuestionId(questionId);
    try {
      await api.delete(`/teams/${team.id}/icebreakers/${questionId}`);
      toast.success('Question deleted');
      setCustomQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete question');
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/teams/${team.id}`);
      toast.success('Team deleted');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete team');
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Team Settings</h3>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 mb-8">
        <Input
          label="Team Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="space-y-1">
          <label htmlFor="settings-description" className="block text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            id="settings-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving} disabled={!name.trim()}>
            Save Changes
          </Button>
        </div>
      </form>

      {/* Icebreaker Settings Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8" data-testid="icebreaker-settings-section">
        <h4 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          Icebreaker Settings
        </h4>

        <div className="space-y-5">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Enable Icebreaker Warmup</p>
              <p className="text-xs text-slate-500">When disabled, new boards skip icebreaker and start in write phase</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={icebreakerEnabled}
              onClick={() => setIcebreakerEnabled(!icebreakerEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                icebreakerEnabled ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
              data-testid="icebreaker-enabled-toggle"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  icebreakerEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Default Category */}
          <div className="space-y-1">
            <label htmlFor="icebreaker-default-category" className="block text-sm font-medium text-slate-700">
              Default Category
            </label>
            <p className="text-xs text-slate-500">If set, new icebreakers auto-filter to this category</p>
            <select
              id="icebreaker-default-category"
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              data-testid="icebreaker-default-category"
            >
              <option value="">All (no filter)</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Auto-timer */}
          <div className="space-y-1">
            <label htmlFor="icebreaker-timer" className="block text-sm font-medium text-slate-700">
              Auto-Timer
            </label>
            <p className="text-xs text-slate-500">Optional countdown during icebreaker phase. Shows &quot;Time&apos;s up!&quot; when done (does not auto-transition)</p>
            <select
              id="icebreaker-timer"
              value={timerSeconds}
              onChange={(e) => setTimerSeconds(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              data-testid="icebreaker-timer-select"
            >
              {TIMER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              isLoading={isSavingIcebreaker}
              onClick={handleSaveIcebreaker}
              data-testid="icebreaker-settings-save"
            >
              Save Icebreaker Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Custom Questions Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8" data-testid="custom-questions-section">
        <h4 className="text-base font-semibold text-slate-900 mb-4">Custom Icebreaker Questions</h4>

        {/* Add new question form */}
        <form onSubmit={handleAddQuestion} className="space-y-3 mb-6">
          <div className="space-y-1">
            <label htmlFor="new-question" className="block text-sm font-medium text-slate-700">
              New Question
            </label>
            <input
              id="new-question"
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Type your icebreaker question..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              data-testid="new-question-input"
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <label htmlFor="new-question-category" className="block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                id="new-question-category"
                value={newQuestionCategory}
                onChange={(e) => setNewQuestionCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                data-testid="new-question-category"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              size="sm"
              isLoading={isAddingQuestion}
              disabled={!newQuestion.trim()}
              data-testid="add-question-button"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </form>

        {/* Questions list */}
        {isLoadingQuestions ? (
          <p className="text-sm text-slate-500">Loading questions...</p>
        ) : customQuestions.length === 0 ? (
          <p className="text-sm text-slate-500" data-testid="no-custom-questions">
            No custom questions yet. Add one above!
          </p>
        ) : (
          <div className="space-y-3" data-testid="custom-questions-list">
            {customQuestions.map((q) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50"
                data-testid="custom-question-item"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 font-medium">{q.question}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {CATEGORIES.find((c) => c.value === q.category)?.label ?? q.category}
                    </span>
                    <span className="text-xs text-slate-400">
                      by {q.created_by_name ?? 'Unknown'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(q.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(q.id)}
                  disabled={deletingQuestionId === q.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  aria-label="Delete question"
                  data-testid="delete-question-button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h4 className="text-base font-semibold text-red-700 mb-2 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </h4>
        <p className="text-sm text-slate-600 mb-4">
          Deleting a team will make it inaccessible to all members. This action cannot be undone.
        </p>
        {showDeleteConfirm ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-red-600 font-medium">Are you sure?</p>
            <Button variant="danger" size="sm" isLoading={isDeleting} onClick={handleDelete}>
              Yes, Delete Team
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
            Delete Team
          </Button>
        )}
      </div>
    </div>
  );
}
