import { X } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { CardItem } from './CardItem';
import type { BoardCard } from '@/lib/board-api';

const GROUP_COLORS = [
  { bg: '#eff6ff', border: '#3b82f6', label: 'blue' },
  { bg: '#ecfdf5', border: '#10b981', label: 'emerald' },
  { bg: '#fffbeb', border: '#f59e0b', label: 'amber' },
  { bg: '#fff1f2', border: '#f43f5e', label: 'rose' },
  { bg: '#f5f3ff', border: '#8b5cf6', label: 'violet' },
  { bg: '#ecfeff', border: '#06b6d4', label: 'cyan' },
];

interface GroupPhaseViewProps {
  isFacilitator: boolean;
  onCreateActionItem?: (cardId: string, cardContent: string) => void;
  selectedCardIds: string[];
  onToggleCardSelect: (cardId: string) => void;
}

export function GroupPhaseView({ isFacilitator, onCreateActionItem, selectedCardIds, onToggleCardSelect }: GroupPhaseViewProps) {
  const board = useBoardStore((s) => s.board);
  const cards = useBoardStore((s) => s.cards);
  const groups = useBoardStore((s) => s.groups);
  const columns = useBoardStore((s) => s.columns);
  const deleteGroup = useBoardStore((s) => s.deleteGroup);

  const isGroupPhase = board?.phase === 'group';

  const allCards = Object.values(cards).filter((c): c is BoardCard => c !== undefined);
  const ungroupedCards = allCards.filter((c) => !c.group_id);

  const sortedGroups = Object.values(groups)
    .filter((g) => g !== undefined)
    .sort((a, b) => a.position - b.position);

  // Build column name lookup for the origin tag
  const columnNameMap = new Map(columns.map((col) => [col.id, { name: col.name, color: col.color }]));

  return (
    <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: 'var(--theme-bg)' }}>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Groups */}
        {sortedGroups.map((group, index) => {
          const groupColor = GROUP_COLORS[index % GROUP_COLORS.length] ?? GROUP_COLORS[0]!;
          const groupCards = group.card_ids
            .map((id) => cards[id])
            .filter((c): c is BoardCard => c !== undefined);

          return (
            <div
              key={group.id}
              className="rounded-xl border-l-4 p-4"
              style={{ borderLeftColor: groupColor.border, backgroundColor: groupColor.bg }}
            >
              {/* Group header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: groupColor.border }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary, #1e293b)' }}>
                  {group.title}
                </h3>
                <span className="text-xs" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                  {groupCards.length} {groupCards.length === 1 ? 'card' : 'cards'}
                </span>
                {group.total_votes > 0 && (
                  <span className="text-xs font-medium" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                    · {group.total_votes} votes
                  </span>
                )}
                {isFacilitator && isGroupPhase && (
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="ml-auto p-1 rounded hover:bg-white/60 text-slate-400 hover:text-red-500 transition-colors"
                    aria-label={`Dissolve group ${group.title}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Group cards in a responsive grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {groupCards.map((card) => {
                  const col = columnNameMap.get(card.column_id);
                  return (
                    <div key={card.id} className="relative">
                      <CardItem
                        card={card}
                        isFacilitator={isFacilitator}
                        onCreateActionItem={onCreateActionItem}
                      />
                      {/* Column origin tag */}
                      {col && (
                        <div className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/80 text-[10px]" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                          {col.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Ungrouped cards */}
        {ungroupedCards.length > 0 && (
          <div>
            {sortedGroups.length > 0 && (
              <h3 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                Ungrouped
              </h3>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ungroupedCards.map((card) => {
                const col = columnNameMap.get(card.column_id);
                return (
                  <div key={card.id} className="relative">
                    <CardItem
                      card={card}
                      isFacilitator={isFacilitator}
                      onCreateActionItem={onCreateActionItem}
                      isSelected={selectedCardIds.includes(card.id)}
                      onToggleSelect={() => onToggleCardSelect(card.id)}
                    />
                    {/* Column origin tag */}
                    {col && (
                      <div className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/80 text-[10px]" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                        {col.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {allCards.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
              No cards to group. Go back to Write phase to add cards.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
