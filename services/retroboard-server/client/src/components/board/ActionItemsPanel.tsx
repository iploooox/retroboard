import { useEffect, useState, type FormEvent } from 'react';
import { X, Plus, Check, Circle, Clock, ArrowDownToLine, Trash2 } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/lib/toast';
import { api, ApiError } from '@/lib/api';
import type { ActionItem } from '@/lib/board-api';

interface TeamMember {
  user: {
    id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
  };
  role: string;
  joined_at: string;
}

interface ActionItemsPanelProps {
  open: boolean;
  onClose: () => void;
  isFacilitator: boolean;
  teamId: string;
  initialCardId?: string;
  initialTitle?: string;
}

const statusConfig: Record<ActionItem['status'], { icon: typeof Check; label: string; color: string }> = {
  open: { icon: Circle, label: 'Open', color: 'text-slate-400' },
  in_progress: { icon: Clock, label: 'In Progress', color: 'text-yellow-500' },
  done: { icon: Check, label: 'Done', color: 'text-green-500' },
};

const nextStatus: Record<ActionItem['status'], ActionItem['status']> = {
  open: 'in_progress',
  in_progress: 'done',
  done: 'open',
};

export function ActionItemsPanel({ open, onClose, isFacilitator, teamId, initialCardId, initialTitle }: ActionItemsPanelProps) {
  const actionItems = useBoardStore((s) => s.actionItems);
  const actionItemsLoading = useBoardStore((s) => s.actionItemsLoading);
  const fetchActionItems = useBoardStore((s) => s.fetchActionItems);
  const createActionItem = useBoardStore((s) => s.createActionItem);
  const updateActionItem = useBoardStore((s) => s.updateActionItem);
  const deleteActionItem = useBoardStore((s) => s.deleteActionItem);
  const carryOverActionItems = useBoardStore((s) => s.carryOverActionItems);
  const board = useBoardStore((s) => s.board);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCardId, setNewCardId] = useState<string | undefined>();
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCarrying, setIsCarrying] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    if (open && board) {
      fetchActionItems();
    }
  }, [open, board, fetchActionItems]);

  // Set initial values when panel opens with card data
  useEffect(() => {
    if (open && initialCardId && initialTitle) {
      setNewCardId(initialCardId);
      setNewTitle(initialTitle);
      setShowCreateForm(true);
    }
  }, [open, initialCardId, initialTitle]);

  useEffect(() => {
    if (open && teamId) {
      setMembersLoading(true);
      api.get<{ members: TeamMember[] }>(`/teams/${teamId}/members`)
        .then((data) => {
          setTeamMembers(data.members);
        })
        .catch((err) => {
          toast.error(err instanceof ApiError ? err.message : 'Failed to load team members');
        })
        .finally(() => {
          setMembersLoading(false);
        });
    }
  }, [open, teamId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await createActionItem({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        cardId: newCardId,
        assigneeId: newAssigneeId || undefined,
        dueDate: newDueDate || undefined,
      });
      setNewTitle('');
      setNewDescription('');
      setNewCardId(undefined);
      setNewAssigneeId('');
      setNewDueDate('');
      setShowCreateForm(false);
    } catch {
      // Error handled in store
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusToggle = async (item: ActionItem) => {
    try {
      await updateActionItem(item.id, { status: nextStatus[item.status] });
    } catch {
      // Error handled in store
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteActionItem(id);
    } catch {
      // Error handled in store
    }
  };

  const handleCarryOver = async () => {
    setIsCarrying(true);
    try {
      const result = await carryOverActionItems();
      if (result.totalResolved > 0) {
        toast.success(`Carried over ${result.totalResolved} action item${result.totalResolved > 1 ? 's' : ''}`);
      } else {
        toast.info('No action items to carry over');
      }
    } catch {
      // Error handled in store
    } finally {
      setIsCarrying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white shadow-xl border-l border-slate-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Action Items</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
          aria-label="Close panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Action bar */}
      <div className="flex gap-2 px-4 py-2 border-b border-slate-100">
        <Button size="sm" onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4" />
          New
        </Button>
        {isFacilitator && (
          <Button size="sm" variant="secondary" onClick={handleCarryOver} isLoading={isCarrying}>
            <ArrowDownToLine className="h-4 w-4" />
            Carry Over
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="px-4 py-3 border-b border-slate-200 bg-slate-50 space-y-2">
          {newCardId && (
            <div className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              📎 Linked to card
            </div>
          )}
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Action item title"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Assignee</label>
              <select
                value={newAssigneeId}
                onChange={(e) => setNewAssigneeId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                disabled={membersLoading}
              >
                <option value="">Unassigned</option>
                {teamMembers.map((member) => (
                  <option key={member.user.id} value={member.user.id}>
                    {member.user.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Due Date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowCreateForm(false);
                setNewTitle('');
                setNewDescription('');
                setNewCardId(undefined);
                setNewAssigneeId('');
                setNewDueDate('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting} disabled={!newTitle.trim()}>
              Create
            </Button>
          </div>
        </form>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {actionItemsLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6 text-indigo-600" />
          </div>
        ) : actionItems.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-sm text-slate-400">No action items yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {actionItems.map((item) => {
              const config = statusConfig[item.status];
              const StatusIcon = config.icon;
              const isOverdue = item.dueDate && item.status !== 'done' && new Date(item.dueDate) < new Date();
              return (
                <div key={item.id} className="px-4 py-3 hover:bg-slate-50 group">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => handleStatusToggle(item)}
                      className={`mt-0.5 p-0.5 rounded hover:bg-slate-200 ${config.color}`}
                      title={`Status: ${config.label}. Click to change.`}
                    >
                      <StatusIcon className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${item.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {item.assigneeName && (
                          <span className="text-xs text-slate-400">{item.assigneeName}</span>
                        )}
                        {item.dueDate && (
                          <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-slate-400'}`}>
                            {isOverdue && '⚠️ '}
                            Due: {item.dueDate}
                          </span>
                        )}
                        {item.status === 'done' && item.completedAt && (
                          <span className="text-xs text-green-600 font-medium">
                            Completed {new Date(item.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {item.carriedFromSprintName && (
                          <span className="text-xs text-amber-500">from {item.carriedFromSprintName}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete action item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
