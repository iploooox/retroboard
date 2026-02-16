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
  onCreateActionItem?: (cardId: string, cardContent: string) => void;
}

export function BoardColumn({ columnId, name, color, isFacilitator, onCreateActionItem }: BoardColumnProps) {
  const board = useBoardStore((s) => s.board);
  const cards = useBoardStore((s) => s.cards);
  const groups = useBoardStore((s) => s.groups);
  const addCard = useBoardStore((s) => s.addCard);
  const isLocked = useBoardStore((s) => s.isLocked);

  const [newCardContent, setNewCardContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isWritePhase = board?.phase === 'write';
  const canAddCards = isWritePhase && !isLocked;

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
    <div
      className="flex-shrink-0 w-72 h-full flex flex-col rounded-xl border"
      style={{
        backgroundColor: 'var(--theme-column-bg, #f8fafc)',
        borderColor: 'var(--theme-column-border, #cbd5e1)'
      }}
    >
      {/* Column header */}
      <div
        className="px-3 py-2.5 border-b flex items-center gap-2 pointer-events-none"
        style={{ borderColor: 'var(--theme-column-border, #cbd5e1)' }}
      >
        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <h3
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--theme-header-text, #475569)' }}
        >
          {name}
        </h3>
        <span className="text-xs ml-auto" style={{ color: 'var(--theme-text-muted, #64748b)' }}>{columnCards.length}</span>
      </div>

      {/* Cards list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {/* Grouped cards */}
        {columnGroups.map((group) => {
          const groupCards = groupedByGroup.get(group.id) ?? [];
          return (
            <div key={group.id} className="rounded-lg border-2 border-dashed border-slate-300 p-2 space-y-2 bg-white/50">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider truncate" style={{ color: 'var(--theme-text-secondary, #475569)' }}>
                  {group.title}
                </span>
                {group.total_votes > 0 && (
                  <span className="text-xs font-medium" style={{ color: 'var(--theme-text-muted, #64748b)' }}>{group.total_votes} votes</span>
                )}
              </div>
              {groupCards.map((card) => (
                <CardItem key={card.id} card={card} isFacilitator={isFacilitator} onCreateActionItem={onCreateActionItem} />
              ))}
            </div>
          );
        })}

        {/* Ungrouped cards */}
        {ungroupedCards.map((card) => (
          <CardItem key={card.id} card={card} isFacilitator={isFacilitator} onCreateActionItem={onCreateActionItem} />
        ))}
      </div>

      {/* Add card input */}
      {isWritePhase && (
        <div
          className="p-2 border-t"
          style={{ borderColor: 'var(--theme-column-border, #cbd5e1)' }}
        >
          {isAdding && canAddCards ? (
            <form onSubmit={handleSubmit}>
              <textarea
                value={newCardContent}
                onChange={(e) => setNewCardContent(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full rounded-lg border px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2"
                style={{
                  borderColor: 'var(--theme-card-border, #e2e8f0)',
                  backgroundColor: 'var(--theme-card-bg, #ffffff)',
                }}
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                  if (e.key === 'Escape') { setIsAdding(false); setNewCardContent(''); }
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="submit"
                  disabled={!newCardContent.trim() || isSubmitting}
                  className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{
                    backgroundColor: 'var(--theme-accent, #3b82f6)',
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = 'var(--theme-accent-hover, #2563eb)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--theme-accent, #3b82f6)';
                  }}
                >
                  {isSubmitting ? 'Adding...' : 'Add Card'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setNewCardContent(''); }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-slate-100 transition-colors"
                  style={{ color: 'var(--theme-text-secondary, #475569)' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              disabled={!canAddCards}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: 'var(--theme-column-border, #cbd5e1)',
                color: 'var(--theme-text-muted, #64748b)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--theme-accent, #3b82f6)';
                e.currentTarget.style.borderColor = 'var(--theme-accent, #3b82f6)';
                e.currentTarget.style.backgroundColor = 'var(--theme-bg, #eff6ff)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--theme-text-muted, #64748b)';
                e.currentTarget.style.borderColor = 'var(--theme-column-border, #cbd5e1)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
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
