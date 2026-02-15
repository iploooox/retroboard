import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { CardItem } from './CardItem';
import type { BoardCard } from '@/lib/board-api';

interface BoardColumnProps {
  columnId: string;
  name: string;
  color: string;
  isFacilitator: boolean;
}

export function BoardColumn({ columnId, name, color, isFacilitator }: BoardColumnProps) {
  const board = useBoardStore((s) => s.board);
  const cards = useBoardStore((s) => s.cards);
  const groups = useBoardStore((s) => s.groups);
  const addCard = useBoardStore((s) => s.addCard);

  const [newCardContent, setNewCardContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isWritePhase = board?.phase === 'write';

  // Get cards for this column, sorted by position
  const columnCards = Object.values(cards)
    .filter((c): c is BoardCard => c !== undefined && c.column_id === columnId)
    .sort((a, b) => a.position - b.position);

  // Separate grouped and ungrouped cards
  const ungroupedCards = columnCards.filter((c) => !c.group_id);
  const groupedByGroup = new Map<string, BoardCard[]>();
  for (const card of columnCards) {
    if (card.group_id) {
      const existing = groupedByGroup.get(card.group_id) ?? [];
      existing.push(card);
      groupedByGroup.set(card.group_id, existing);
    }
  }

  // Get groups that have cards in this column
  const columnGroups = Object.values(groups)
    .filter((g) => g !== undefined && groupedByGroup.has(g.id))
    .sort((a, b) => a.position - b.position);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCardContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addCard(columnId, newCardContent.trim());
      setNewCardContent('');
      setIsAdding(false);
    } catch {
      // Error handled in store
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-shrink-0 w-72 h-full flex flex-col bg-slate-50 rounded-xl border border-slate-200">
      {/* Column header */}
      <div className="px-3 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <h3 className="text-sm font-semibold text-slate-700 truncate">{name}</h3>
        <span className="text-xs text-slate-400 ml-auto">{columnCards.length}</span>
      </div>

      {/* Cards list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {/* Grouped cards */}
        {columnGroups.map((group) => {
          const groupCards = groupedByGroup.get(group.id) ?? [];
          return (
            <div key={group.id} className="rounded-lg border-2 border-dashed border-slate-300 p-2 space-y-2 bg-white/50">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
                  {group.title}
                </span>
                {group.total_votes > 0 && (
                  <span className="text-xs font-medium text-slate-400">{group.total_votes} votes</span>
                )}
              </div>
              {groupCards.map((card) => (
                <CardItem key={card.id} card={card} isFacilitator={isFacilitator} />
              ))}
            </div>
          );
        })}

        {/* Ungrouped cards */}
        {ungroupedCards.map((card) => (
          <CardItem key={card.id} card={card} isFacilitator={isFacilitator} />
        ))}
      </div>

      {/* Add card input */}
      {isWritePhase && (
        <div className="p-2 border-t border-slate-200">
          {isAdding ? (
            <form onSubmit={handleSubmit}>
              <textarea
                value={newCardContent}
                onChange={(e) => setNewCardContent(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
                  if (e.key === 'Escape') { setIsAdding(false); setNewCardContent(''); }
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="submit"
                  disabled={!newCardContent.trim() || isSubmitting}
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Adding...' : 'Add Card'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setNewCardContent(''); }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add a card
            </button>
          )}
        </div>
      )}
    </div>
  );
}
