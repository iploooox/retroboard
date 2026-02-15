import { useState, type FormEvent } from 'react';
import { useBoardStore } from '@/stores/board';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Check } from 'lucide-react';

interface BoardSettingsModalProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  currentTheme?: string;
}

const THEMES = [
  { name: 'ocean', label: 'Ocean', color: 'bg-blue-500' },
  { name: 'sunset', label: 'Sunset', color: 'bg-orange-500' },
  { name: 'forest', label: 'Forest', color: 'bg-green-600' },
  { name: 'lavender', label: 'Lavender', color: 'bg-purple-400' },
  { name: 'slate', label: 'Slate', color: 'bg-slate-600' },
  { name: 'rose', label: 'Rose', color: 'bg-pink-500' },
  { name: 'amber', label: 'Amber', color: 'bg-amber-500' },
  { name: 'emerald', label: 'Emerald', color: 'bg-emerald-500' },
] as const;

export function BoardSettingsModal({ open, onClose, teamId, currentTheme = 'ocean' }: BoardSettingsModalProps) {
  const board = useBoardStore((s) => s.board);
  const updateSettings = useBoardStore((s) => s.updateSettings);

  const [anonymousMode, setAnonymousMode] = useState(board?.anonymous_mode ?? false);
  const [maxVotesPerUser, setMaxVotesPerUser] = useState(String(board?.max_votes_per_user ?? 5));
  const [maxVotesPerCard, setMaxVotesPerCard] = useState(String(board?.max_votes_per_card ?? 3));
  const [selectedTheme, setSelectedTheme] = useState(currentTheme);
  const [isSaving, setIsSaving] = useState(false);

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
        await api.patch<{ ok: boolean; data: { theme: string } }>(`/teams/${teamId}`, { theme: selectedTheme });
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

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>Save Settings</Button>
        </div>
      </form>
    </Modal>
  );
}
