import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react';
import { Plus, Check, Circle, Clock, Trash2, ArrowDownToLine, ClipboardList, ChevronDown, ChevronUp, User, Calendar } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { BoardCard, ActionItem } from '@/lib/board-api';

const GROUP_COLORS = [
  { bg: '#eff6ff', border: '#3b82f6' },
  { bg: '#ecfdf5', border: '#10b981' },
  { bg: '#fffbeb', border: '#f59e0b' },
  { bg: '#fff1f2', border: '#f43f5e' },
  { bg: '#f5f3ff', border: '#8b5cf6' },
  { bg: '#ecfeff', border: '#06b6d4' },
];

const MAX_DISCUSS_ITEMS = 5;

interface DiscussItem {
  type: 'group' | 'card';
  id: string;
  title: string;
  votes: number;
  cards: BoardCard[];
  groupIndex?: number;
}

interface TeamMember {
  user: { id: string; display_name: string };
  role: string;
}

const statusConfig: Record<ActionItem['status'], { icon: typeof Check; label: string; color: string; bg: string }> = {
  open: { icon: Circle, label: 'Open', color: 'text-slate-400', bg: 'bg-slate-50' },
  in_progress: { icon: Clock, label: 'In Progress', color: 'text-amber-500', bg: 'bg-amber-50' },
  done: { icon: Check, label: 'Done', color: 'text-green-500', bg: 'bg-green-50' },
};

const nextStatus: Record<ActionItem['status'], ActionItem['status']> = {
  open: 'in_progress',
  in_progress: 'done',
  done: 'open',
};

interface ActionPhaseViewProps {
  isFacilitator: boolean;
  teamId: string;
}

export function ActionPhaseView({ isFacilitator, teamId }: ActionPhaseViewProps) {
  const board = useBoardStore((s) => s.board);
  const cards = useBoardStore((s) => s.cards);
  const groups = useBoardStore((s) => s.groups);
  const actionItems = useBoardStore((s) => s.actionItems);
  const actionItemsLoading = useBoardStore((s) => s.actionItemsLoading);
  const fetchActionItems = useBoardStore((s) => s.fetchActionItems);
  const createActionItem = useBoardStore((s) => s.createActionItem);
  const updateActionItem = useBoardStore((s) => s.updateActionItem);
  const deleteActionItem = useBoardStore((s) => s.deleteActionItem);
  const carryOverActionItems = useBoardStore((s) => s.carryOverActionItems);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isCarrying, setIsCarrying] = useState(false);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

  // Inline create form state
  const [createForTopicId, setCreateForTopicId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Standalone create (not linked to a topic)
  const [showStandaloneCreate, setShowStandaloneCreate] = useState(false);
  const [standaloneTitle, setStandaloneTitle] = useState('');
  const [standaloneAssigneeId, setStandaloneAssigneeId] = useState('');
  const [standaloneDueDate, setStandaloneDueDate] = useState('');
  const [standaloneSubmitting, setStandaloneSubmitting] = useState(false);
  const standaloneInputRef = useRef<HTMLInputElement>(null);

  // Fetch action items on mount
  useEffect(() => {
    if (board) fetchActionItems();
  }, [board, fetchActionItems]);

  // Fetch team members for assignee dropdown
  useEffect(() => {
    if (teamId) {
      api.get<{ members: TeamMember[] }>(`/teams/${teamId}/members`)
        .then((data) => setTeamMembers(data.members))
        .catch(() => { /* ignore */ });
    }
  }, [teamId]);

  // Focus input when creating for a topic
  useEffect(() => {
    if (createForTopicId && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [createForTopicId]);

  useEffect(() => {
    if (showStandaloneCreate && standaloneInputRef.current) {
      standaloneInputRef.current.focus();
    }
  }, [showStandaloneCreate]);

  const sortedGroups = useMemo(() =>
    Object.values(groups)
      .filter((g) => g !== undefined)
      .sort((a, b) => a.position - b.position),
    [groups]
  );

  // Build ranked discussion items (same logic as DiscussPhaseView)
  const discussItems = useMemo(() => {
    const items: DiscussItem[] = [];

    sortedGroups.forEach((group, index) => {
      const groupCards = group.card_ids
        .map((id) => cards[id])
        .filter((c): c is BoardCard => c !== undefined);
      items.push({
        type: 'group',
        id: group.id,
        title: group.title,
        votes: group.total_votes,
        cards: groupCards,
        groupIndex: index,
      });
    });

    const allCards = Object.values(cards).filter((c): c is BoardCard => c !== undefined);
    for (const card of allCards) {
      if (!card.group_id) {
        items.push({
          type: 'card',
          id: card.id,
          title: card.content,
          votes: card.vote_count,
          cards: [card],
        });
      }
    }

    items.sort((a, b) => b.votes - a.votes);
    return items.slice(0, MAX_DISCUSS_ITEMS);
  }, [cards, sortedGroups]);

  const handleCreateFromTopic = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createActionItem({
        title: newTitle.trim(),
        assigneeId: newAssigneeId || undefined,
        dueDate: newDueDate || undefined,
      });
      setNewTitle('');
      setNewAssigneeId('');
      setNewDueDate('');
      setCreateForTopicId(null);
    } catch {
      // Error handled in store
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStandaloneCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!standaloneTitle.trim() || standaloneSubmitting) return;

    setStandaloneSubmitting(true);
    try {
      await createActionItem({
        title: standaloneTitle.trim(),
        assigneeId: standaloneAssigneeId || undefined,
        dueDate: standaloneDueDate || undefined,
      });
      setStandaloneTitle('');
      setStandaloneAssigneeId('');
      setStandaloneDueDate('');
      setShowStandaloneCreate(false);
    } catch {
      // Error handled in store
    } finally {
      setStandaloneSubmitting(false);
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

  if (!board) return null;

  const doneCount = actionItems.filter((i) => i.status === 'done').length;

  return (
    <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: 'var(--theme-bg)' }}>
      <div className="max-w-4xl mx-auto">

        {/* ─── Action Items Section ─── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" style={{ color: 'var(--theme-accent, #6366f1)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary, #1e293b)' }}>
                Action Items
              </h2>
              {actionItems.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                  {doneCount}/{actionItems.length} done
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isFacilitator && (
                <button
                  onClick={handleCarryOver}
                  disabled={isCarrying}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <ArrowDownToLine className="h-3 w-3" />
                  {isCarrying ? 'Carrying...' : 'Carry Over'}
                </button>
              )}
              <button
                onClick={() => setShowStandaloneCreate(true)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
              >
                <Plus className="h-3 w-3" />
                New Action
              </button>
            </div>
          </div>

          {/* Standalone create form */}
          {showStandaloneCreate && (
            <form onSubmit={handleStandaloneCreate} className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
              <input
                ref={standaloneInputRef}
                type="text"
                value={standaloneTitle}
                onChange={(e) => setStandaloneTitle(e.target.value)}
                placeholder="What needs to happen?"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowStandaloneCreate(false); setStandaloneTitle(''); } }}
              />
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 flex-1">
                  <User className="h-3 w-3 text-slate-400" />
                  <select
                    value={standaloneAssigneeId}
                    onChange={(e) => setStandaloneAssigneeId(e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.user.id} value={m.user.id}>{m.user.display_name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  <input
                    type="date"
                    value={standaloneDueDate}
                    onChange={(e) => setStandaloneDueDate(e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setShowStandaloneCreate(false); setStandaloneTitle(''); setStandaloneAssigneeId(''); setStandaloneDueDate(''); }}
                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!standaloneTitle.trim() || standaloneSubmitting}
                    className="text-xs px-3 py-1 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                  >
                    {standaloneSubmitting ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Action items list */}
          {actionItemsLoading ? (
            <div className="text-center py-6">
              <p className="text-xs" style={{ color: 'var(--theme-text-muted, #64748b)' }}>Loading action items...</p>
            </div>
          ) : actionItems.length === 0 && !showStandaloneCreate ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center">
              <ClipboardList className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--theme-text-muted, #64748b)' }} />
              <p className="text-sm" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                No action items yet. Create one from a topic below or click &quot;New Action&quot;.
              </p>
            </div>
          ) : actionItems.length > 0 ? (
            <div className="space-y-1.5">
              {actionItems.map((item) => {
                const config = statusConfig[item.status];
                const StatusIcon = config.icon;
                const isOverdue = item.dueDate && item.status !== 'done' && new Date(item.dueDate) < new Date();
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 group transition-colors ${
                      item.status === 'done' ? 'bg-green-50/50 border-green-100' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                    style={{ backgroundColor: item.status !== 'done' ? 'var(--theme-card-bg, #ffffff)' : undefined }}
                  >
                    <button
                      onClick={() => handleStatusToggle(item)}
                      className={`shrink-0 p-0.5 rounded hover:bg-slate-100 ${config.color}`}
                      title={`${config.label} — click to change`}
                    >
                      <StatusIcon className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.status === 'done' ? 'text-slate-400 line-through' : ''}`} style={{ color: item.status !== 'done' ? 'var(--theme-text-primary, #1e293b)' : undefined }}>
                        {item.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.assigneeName && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hidden sm:inline">
                          {item.assigneeName}
                        </span>
                      )}
                      {item.dueDate && (
                        <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-slate-400'}`}>
                          {isOverdue ? '!' : ''}{item.dueDate}
                        </span>
                      )}
                      {item.carriedFromSprintName && (
                        <span className="text-xs text-amber-500 hidden sm:inline">carried</span>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete action item"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* ─── Discussion Topics Reference ─── */}
        {discussItems.length > 0 && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
              Discussion Topics — create actions from these
            </h3>
            <div className="space-y-2">
              {discussItems.map((item, rank) => {
                const groupColor = item.type === 'group' && item.groupIndex !== undefined
                  ? GROUP_COLORS[item.groupIndex % GROUP_COLORS.length] ?? GROUP_COLORS[0]!
                  : null;
                const isExpanded = expandedTopicId === item.id;
                const isCreating = createForTopicId === item.id;

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border p-3 transition-colors"
                    style={{
                      borderColor: groupColor ? groupColor.border + '40' : 'var(--theme-card-border, #e2e8f0)',
                      backgroundColor: groupColor ? groupColor.bg : 'var(--theme-card-bg, #ffffff)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank */}
                      <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                        {rank + 1}
                      </div>

                      {/* Title */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {groupColor && (
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: groupColor.border }} />
                          )}
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--theme-text-primary, #1e293b)' }}>
                            {item.title}
                          </span>
                          {item.type === 'group' && (
                            <span className="text-xs" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                              · {item.cards.length} cards
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Votes */}
                      <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        <span className="text-xs font-bold">{item.votes}</span>
                        <span className="text-xs">{item.votes === 1 ? 'vote' : 'votes'}</span>
                      </div>

                      {/* Expand button for groups */}
                      {item.type === 'group' && (
                        <button
                          onClick={() => setExpandedTopicId(isExpanded ? null : item.id)}
                          className="p-1 rounded hover:bg-white/60 text-slate-400"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      )}

                      {/* Create action button */}
                      {!isCreating && (
                        <button
                          onClick={() => {
                            setCreateForTopicId(item.id);
                            setNewTitle('');
                            setNewAssigneeId('');
                            setNewDueDate('');
                          }}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shrink-0"
                        >
                          <Plus className="h-3 w-3" />
                          Action
                        </button>
                      )}
                    </div>

                    {/* Expanded cards */}
                    {isExpanded && item.type === 'group' && (
                      <div className="mt-2 ml-9 space-y-1">
                        {item.cards.map((card) => (
                          <p key={card.id} className="text-xs py-1 px-2 rounded bg-white/60" style={{ color: 'var(--theme-text-secondary, #475569)' }}>
                            {card.content}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Single card preview */}
                    {item.type === 'card' && (
                      <p className="text-xs mt-1 ml-9 truncate" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                        {item.cards[0]?.content}
                      </p>
                    )}

                    {/* Inline create form for this topic */}
                    {isCreating && (
                      <form onSubmit={handleCreateFromTopic} className="mt-3 ml-9 rounded-lg border border-indigo-200 bg-white p-2.5">
                        <input
                          ref={titleInputRef}
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder={`Action for "${item.title.slice(0, 30)}${item.title.length > 30 ? '...' : ''}"...`}
                          className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          onKeyDown={(e) => { if (e.key === 'Escape') { setCreateForTopicId(null); setNewTitle(''); } }}
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1 flex-1">
                            <User className="h-3 w-3 text-slate-400" />
                            <select
                              value={newAssigneeId}
                              onChange={(e) => setNewAssigneeId(e.target.value)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">Unassigned</option>
                              {teamMembers.map((m) => (
                                <option key={m.user.id} value={m.user.id}>{m.user.display_name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <input
                              type="date"
                              value={newDueDate}
                              onChange={(e) => setNewDueDate(e.target.value)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => { setCreateForTopicId(null); setNewTitle(''); }}
                            className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={!newTitle.trim() || isSubmitting}
                            className="text-xs px-3 py-1 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                          >
                            {isSubmitting ? '...' : 'Create'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state when no topics */}
        {discussItems.length === 0 && actionItems.length === 0 && (
          <div className="text-center py-16">
            <ClipboardList className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--theme-text-muted, #64748b)' }} />
            <p className="text-sm" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
              No items to act on. Go back and vote on cards first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
