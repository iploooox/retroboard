import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Plus, ChevronDown, X } from 'lucide-react';
import { useBoardStore } from '@/stores/board';

const GROUP_COLORS = [
  { bg: '#eff6ff', border: '#3b82f6', label: 'blue' },
  { bg: '#ecfdf5', border: '#10b981', label: 'emerald' },
  { bg: '#fffbeb', border: '#f59e0b', label: 'amber' },
  { bg: '#fff1f2', border: '#f43f5e', label: 'rose' },
  { bg: '#f5f3ff', border: '#8b5cf6', label: 'violet' },
  { bg: '#ecfeff', border: '#06b6d4', label: 'cyan' },
];

interface GroupManagerProps {
  isFacilitator: boolean;
  selectedCardIds: string[];
  onClearSelection: () => void;
}

export function GroupManager({ isFacilitator, selectedCardIds, onClearSelection }: GroupManagerProps) {
  const board = useBoardStore((s) => s.board);
  const groups = useBoardStore((s) => s.groups);
  const createGroup = useBoardStore((s) => s.createGroup);
  const updateGroup = useBoardStore((s) => s.updateGroup);

  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showAddToDropdown, setShowAddToDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasSelection = selectedCardIds.length > 0;

  // Focus input when "Create Group" is clicked
  useEffect(() => {
    if (showCreateInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCreateInput]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAddToDropdown(false);
      }
    };
    if (showAddToDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAddToDropdown]);

  if (!board || board.phase !== 'group' || !isFacilitator) return null;

  const sortedGroups = Object.values(groups)
    .filter((g) => g !== undefined)
    .sort((a, b) => a.position - b.position);

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createGroup(newTitle.trim(), selectedCardIds);
      setNewTitle('');
      setShowCreateInput(false);
      onClearSelection();
    } catch {
      // Error handled in store
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToGroup = async (groupId: string) => {
    try {
      await updateGroup(groupId, { add_card_ids: selectedCardIds });
      onClearSelection();
      setShowAddToDropdown(false);
    } catch {
      // Error handled in store
    }
  };

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[calc(100%-2rem)]">
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Group legend */}
          {sortedGroups.length > 0 && (
            <div className="flex items-center gap-2 mr-auto">
              {sortedGroups.map((group, index) => {
                const groupColor = GROUP_COLORS[index % GROUP_COLORS.length] ?? GROUP_COLORS[0]!;
                return (
                  <div key={group.id} className="flex items-center gap-1 text-xs text-slate-600">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: groupColor.border }} />
                    <span className="truncate max-w-[80px]">{group.title}</span>
                    <span className="text-slate-400">{group.card_ids.length}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selection actions */}
          {hasSelection ? (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm font-medium text-slate-700">
                {selectedCardIds.length} selected
              </span>

              {showCreateInput ? (
                <form onSubmit={handleCreateGroup} className="flex items-center gap-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Group name..."
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowCreateInput(false);
                        setNewTitle('');
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!newTitle.trim() || isSubmitting}
                    className="rounded-lg bg-blue-500 text-white px-3 py-1 text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreateInput(false); setNewTitle(''); }}
                    className="p-1 rounded text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowCreateInput(true)}
                  className="flex items-center gap-1 rounded-lg bg-blue-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Group
                </button>
              )}

              {/* Add to existing group */}
              {sortedGroups.length > 0 && !showCreateInput && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowAddToDropdown(!showAddToDropdown)}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Add to
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {showAddToDropdown && (
                    <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px] z-50">
                      {sortedGroups.map((group, index) => {
                        const groupColor = GROUP_COLORS[index % GROUP_COLORS.length] ?? GROUP_COLORS[0]!;
                        return (
                          <button
                            key={group.id}
                            onClick={() => handleAddToGroup(group.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 text-left"
                          >
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: groupColor.border }} />
                            <span className="truncate">{group.title}</span>
                            <span className="text-xs text-slate-400 ml-auto">{group.card_ids.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={onClearSelection}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Clear
              </button>
            </div>
          ) : (
            <span className={`text-sm text-slate-500 ${sortedGroups.length === 0 ? '' : 'ml-auto'}`}>
              Click cards to select and group them
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
