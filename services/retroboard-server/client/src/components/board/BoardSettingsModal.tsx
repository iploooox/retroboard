import { useState, type FormEvent } from 'react';
import { useBoardStore } from '@/stores/board';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface BoardSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function BoardSettingsModal({ open, onClose }: BoardSettingsModalProps) {
  const board = useBoardStore((s) => s.board);
  const updateSettings = useBoardStore((s) => s.updateSettings);

  const [anonymousMode, setAnonymousMode] = useState(board?.anonymous_mode ?? false);
  const [maxVotesPerUser, setMaxVotesPerUser] = useState(String(board?.max_votes_per_user ?? 5));
  const [maxVotesPerCard, setMaxVotesPerCard] = useState(String(board?.max_votes_per_card ?? 3));
  const [isSaving, setIsSaving] = useState(false);

  if (!board) return null;

  const isWritePhase = board.phase === 'write';
  const canChangeVotes = board.phase === 'write' || board.phase === 'group';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings({
        anonymous_mode: anonymousMode,
        max_votes_per_user: parseInt(maxVotesPerUser) || 5,
        max_votes_per_card: parseInt(maxVotesPerCard) || 3,
      });
      onClose();
    } catch {
      // Error handled in store
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Board Settings">
      <form onSubmit={handleSubmit} className="space-y-4">
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
