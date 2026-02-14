import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface CreateTeamModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTeamModal({ open, onClose, onCreated }: CreateTeamModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/teams', {
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.success('Team created!');
      setName('');
      setDescription('');
      onCreated();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create team';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Team">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Team Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Platform Team"
          required
          error={error ?? undefined}
        />
        <div className="space-y-1">
          <label htmlFor="team-description" className="block text-sm font-medium text-slate-700">
            Description (optional)
          </label>
          <textarea
            id="team-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does this team work on?"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={!name.trim()}>
            Create Team
          </Button>
        </div>
      </form>
    </Modal>
  );
}
