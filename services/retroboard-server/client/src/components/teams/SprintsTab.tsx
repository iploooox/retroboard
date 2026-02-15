import { useEffect, useState, type FormEvent } from 'react';
import { Plus, AlertCircle, Calendar, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  sprint_number: number;
  start_date: string;
  end_date: string | null;
  status: 'planning' | 'active' | 'completed';
}

interface SprintsTabProps {
  teamId: string;
  canCreate: boolean;
}

const statusBadge = {
  planning: { variant: 'gray' as const, label: 'Planning' },
  active: { variant: 'green' as const, label: 'Active' },
  completed: { variant: 'blue' as const, label: 'Completed' },
};

export function SprintsTab({ teamId, canCreate }: SprintsTabProps) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchSprints = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<{ sprints: Sprint[] }>(`/teams/${teamId}/sprints`);
      setSprints(data.sprints);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load sprints');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSprints(); }, [teamId]);

  const handleActivate = async (sprintId: string) => {
    try {
      await api.put(`/teams/${teamId}/sprints/${sprintId}/activate`);
      toast.success('Sprint activated');
      fetchSprints();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to activate sprint');
    }
  };

  const handleComplete = async (sprintId: string) => {
    try {
      await api.put(`/teams/${teamId}/sprints/${sprintId}/complete`);
      toast.success('Sprint completed');
      fetchSprints();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to complete sprint');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
        <div>
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={fetchSprints} className="text-sm text-red-600 underline mt-1">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Sprints</h3>
        {canCreate && (
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            New Sprint
          </Button>
        )}
      </div>

      {sprints.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No sprints yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sprints.map((sprint) => {
            const badge = statusBadge[sprint.status];
            return (
              <div
                key={sprint.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-slate-900 truncate">{sprint.name}</h4>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span>#{sprint.sprint_number}</span>
                    <span>
                      {formatDate(sprint.start_date)}
                      {sprint.end_date && ` - ${formatDate(sprint.end_date)}`}
                    </span>
                  </div>
                  {sprint.goal && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">{sprint.goal}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(sprint.status === 'active' || sprint.status === 'completed') && (
                    <Link to={`/teams/${teamId}/sprints/${sprint.id}/board`}>
                      <Button size="sm" variant="secondary">
                        <LayoutDashboard className="h-4 w-4" />
                        Board
                      </Button>
                    </Link>
                  )}
                  {canCreate && sprint.status === 'planning' && (
                    <Button size="sm" variant="secondary" onClick={() => handleActivate(sprint.id)}>
                      Activate
                    </Button>
                  )}
                  {canCreate && sprint.status === 'active' && (
                    <Button size="sm" variant="secondary" onClick={() => handleComplete(sprint.id)}>
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateSprintModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        teamId={teamId}
        onCreated={() => { setShowCreateModal(false); fetchSprints(); }}
      />
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function CreateSprintModal({
  open,
  onClose,
  teamId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.post(`/teams/${teamId}/sprints`, {
        name: name.trim(),
        goal: goal.trim() || undefined,
        start_date: startDate,
        end_date: endDate || undefined,
      });
      toast.success('Sprint created!');
      setName('');
      setGoal('');
      setStartDate('');
      setEndDate('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create sprint');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Sprint">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Sprint Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sprint 42"
          required
        />
        <div className="space-y-1">
          <label htmlFor="sprint-goal" className="block text-sm font-medium text-slate-700">
            Goal (optional)
          </label>
          <textarea
            id="sprint-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="What should this sprint achieve?"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} disabled={!name.trim() || !startDate}>
            Create Sprint
          </Button>
        </div>
      </form>
    </Modal>
  );
}
