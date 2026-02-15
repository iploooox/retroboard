import { useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { Button } from '@/components/ui/Button';

interface GroupManagerProps {
  isFacilitator: boolean;
}

export function GroupManager({ isFacilitator }: GroupManagerProps) {
  const board = useBoardStore((s) => s.board);
  const groups = useBoardStore((s) => s.groups);
  const cards = useBoardStore((s) => s.cards);
  const createGroup = useBoardStore((s) => s.createGroup);
  const updateGroup = useBoardStore((s) => s.updateGroup);
  const deleteGroup = useBoardStore((s) => s.deleteGroup);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!board || board.phase !== 'group' || !isFacilitator) return null;

  const sortedGroups = Object.values(groups)
    .filter((g) => g !== undefined)
    .sort((a, b) => a.position - b.position);

  const ungroupedCards = Object.values(cards)
    .filter((c) => c !== undefined && !c.group_id);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await createGroup(newTitle.trim(), selectedCardIds);
      setNewTitle('');
      setSelectedCardIds([]);
      setShowCreate(false);
    } catch {
      // Error handled in store
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCardToGroup = async (groupId: string, cardId: string) => {
    try {
      await updateGroup(groupId, { add_card_ids: [cardId] });
    } catch {
      // Error handled in store
    }
  };

  const handleRemoveCardFromGroup = async (groupId: string, cardId: string) => {
    try {
      await updateGroup(groupId, { remove_card_ids: [cardId] });
    } catch {
      // Error handled in store
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteGroup(groupId);
    } catch {
      // Error handled in store
    }
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Groups</h3>
        <Button size="sm" variant="secondary" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New Group
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Group title"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          {ungroupedCards.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Select cards to add (optional):</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {ungroupedCards.map((card) => (
                  <label
                    key={card.id}
                    className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-100 rounded px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCardIds.includes(card.id)}
                      onChange={() => toggleCardSelection(card.id)}
                      className="text-indigo-600 rounded"
                    />
                    <span className="truncate">{card.content}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => { setShowCreate(false); setNewTitle(''); setSelectedCardIds([]); }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting} disabled={!newTitle.trim()}>
              Create Group
            </Button>
          </div>
        </form>
      )}

      {sortedGroups.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {sortedGroups.map((group) => (
            <div key={group.id} className="inline-flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1.5 text-sm">
              <span className="font-medium text-slate-700">{group.title}</span>
              <span className="text-xs text-slate-400">({group.card_ids.length} cards)</span>
              {/* Add ungrouped card dropdown */}
              {ungroupedCards.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddCardToGroup(group.id, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white"
                  defaultValue=""
                >
                  <option value="" disabled>+ Add card</option>
                  {ungroupedCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.content.slice(0, 40)}
                    </option>
                  ))}
                </select>
              )}
              {/* Remove cards from group */}
              {group.card_ids.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleRemoveCardFromGroup(group.id, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white"
                  defaultValue=""
                >
                  <option value="" disabled>- Remove card</option>
                  {group.card_ids.map((cardId) => {
                    const card = cards[cardId];
                    return (
                      <option key={cardId} value={cardId}>
                        {card ? card.content.slice(0, 40) : cardId}
                      </option>
                    );
                  })}
                </select>
              )}
              <button
                onClick={() => handleDeleteGroup(group.id)}
                className="p-0.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600"
                aria-label={`Delete group ${group.title}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
