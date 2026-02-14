import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Team {
  id: string;
  name: string;
  description: string | null;
}

interface SettingsTabProps {
  team: Team;
  onUpdated: () => void;
}

export function SettingsTab({ team, onUpdated }: SettingsTabProps) {
  const navigate = useNavigate();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
