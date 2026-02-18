import { useState, useMemo } from 'react';
import { MessageCircle, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { CardItem } from './CardItem';
import type { BoardCard } from '@/lib/board-api';

const GROUP_COLORS = [
  { bg: '#eff6ff', border: '#3b82f6' },
  { bg: '#ecfdf5', border: '#10b981' },
  { bg: '#fffbeb', border: '#f59e0b' },
  { bg: '#fff1f2', border: '#f43f5e' },
  { bg: '#f5f3ff', border: '#8b5cf6' },
  { bg: '#ecfeff', border: '#06b6d4' },
];

const MAX_DISCUSS_ITEMS = 5;

/** A discussion item is either a group or a standalone ungrouped card */
interface DiscussItem {
  type: 'group' | 'card';
  id: string;
  title: string;
  votes: number;
  cards: BoardCard[];
  groupIndex?: number; // for color lookup
}

interface DiscussPhaseViewProps {
  isFacilitator: boolean;
  onCreateActionItem?: (cardId: string, cardContent: string) => void;
}

export function DiscussPhaseView({ isFacilitator, onCreateActionItem }: DiscussPhaseViewProps) {
  const board = useBoardStore((s) => s.board);
  const cards = useBoardStore((s) => s.cards);
  const groups = useBoardStore((s) => s.groups);
  const columns = useBoardStore((s) => s.columns);
  const setFocus = useBoardStore((s) => s.setFocus);

  const [discussedIds, setDiscussedIds] = useState<Set<string>>(new Set());

  const columnNameMap = new Map(columns.map((col) => [col.id, { name: col.name, color: col.color }]));

  const sortedGroups = useMemo(() =>
    Object.values(groups)
      .filter((g) => g !== undefined)
      .sort((a, b) => a.position - b.position),
    [groups]
  );

  // Build ranked discussion items: groups + ungrouped cards, sorted by votes
  const discussItems = useMemo(() => {
    const items: DiscussItem[] = [];

    // Add groups
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

    // Add ungrouped cards
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

    // Sort by votes descending, take top N
    items.sort((a, b) => b.votes - a.votes);
    return items.slice(0, MAX_DISCUSS_ITEMS);
  }, [cards, sortedGroups]);

  const focusItemId = board?.focus_item_id ?? null;
  const focusItemType = board?.focus_item_type ?? null;

  // Find current focused item index
  const currentIndex = discussItems.findIndex((item) =>
    (item.type === 'group' && focusItemType === 'group' && item.id === focusItemId) ||
    (item.type === 'card' && focusItemType === 'card' && item.id === focusItemId)
  );

  const handleFocus = (item: DiscussItem) => {
    if (!isFacilitator) return;
    const isFocused = focusItemId === item.id;
    if (isFocused) {
      setFocus(null, null);
    } else {
      setFocus(item.id, item.type === 'group' ? 'group' : 'card');
    }
  };

  const handleNext = () => {
    if (!isFacilitator) return;
    // Mark current as discussed
    if (currentIndex >= 0) {
      setDiscussedIds((prev) => new Set(prev).add(discussItems[currentIndex]!.id));
    }
    const nextIndex = currentIndex + 1;
    if (nextIndex < discussItems.length) {
      const next = discussItems[nextIndex]!;
      setFocus(next.id, next.type === 'group' ? 'group' : 'card');
    } else {
      setFocus(null, null);
    }
  };

  const handlePrev = () => {
    if (!isFacilitator || currentIndex <= 0) return;
    const prev = discussItems[currentIndex - 1]!;
    setFocus(prev.id, prev.type === 'group' ? 'group' : 'card');
  };

  if (!board) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: 'var(--theme-bg)' }}>
      <div className="max-w-3xl mx-auto">
        {/* Discussion queue header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" style={{ color: 'var(--theme-accent, #6366f1)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary, #1e293b)' }}>
              Top {Math.min(MAX_DISCUSS_ITEMS, discussItems.length)} to discuss
            </h2>
          </div>
          {isFacilitator && discussItems.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex <= 0}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous topic"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs tabular-nums" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                {currentIndex >= 0 ? currentIndex + 1 : '–'} / {discussItems.length}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex >= discussItems.length - 1 && currentIndex >= 0}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next topic"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Discussion items */}
        <div className="space-y-3">
          {discussItems.map((item, rank) => {
            const isFocused =
              (item.type === 'group' && focusItemType === 'group' && item.id === focusItemId) ||
              (item.type === 'card' && focusItemType === 'card' && item.id === focusItemId);
            const isDiscussed = discussedIds.has(item.id);
            const groupColor = item.type === 'group' && item.groupIndex !== undefined
              ? GROUP_COLORS[item.groupIndex % GROUP_COLORS.length] ?? GROUP_COLORS[0]!
              : null;

            return (
              <div
                key={item.id}
                className={`rounded-xl border-2 p-4 transition-all ${
                  isFocused
                    ? 'border-indigo-400 shadow-md shadow-indigo-100'
                    : isDiscussed
                      ? 'border-slate-200 opacity-60'
                      : 'border-slate-200'
                } ${isFacilitator ? 'cursor-pointer' : ''}`}
                style={{
                  backgroundColor: isFocused
                    ? '#eef2ff'
                    : groupColor
                      ? groupColor.bg
                      : 'var(--theme-card-bg, #ffffff)',
                }}
                onClick={() => handleFocus(item)}
              >
                {/* Item header */}
                <div className="flex items-center gap-3 mb-2">
                  {/* Rank badge */}
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isDiscussed
                        ? 'bg-green-100 text-green-600'
                        : isFocused
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isDiscussed ? <Check className="h-3.5 w-3.5" /> : rank + 1}
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    {item.type === 'group' ? (
                      <div className="flex items-center gap-1.5">
                        {groupColor && (
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: groupColor.border }} />
                        )}
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text-primary, #1e293b)' }}>
                          {item.title}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                          · {item.cards.length} cards
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm truncate" style={{ color: 'var(--theme-text-primary, #1e293b)' }}>
                        {item.title}
                      </p>
                    )}
                  </div>

                  {/* Vote count */}
                  <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                    <span className="text-xs font-bold">{item.votes}</span>
                    <span className="text-xs">{item.votes === 1 ? 'vote' : 'votes'}</span>
                  </div>
                </div>

                {/* Cards (expanded when focused or always for single cards) */}
                {(isFocused || item.type === 'card') && (
                  <div className={`${item.type === 'group' ? 'grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3' : ''}`}>
                    {item.cards.map((card) => {
                      const col = columnNameMap.get(card.column_id);
                      return (
                        <div key={card.id} className="relative" onClick={(e) => e.stopPropagation()}>
                          <CardItem
                            card={card}
                            isFacilitator={isFacilitator}
                            onCreateActionItem={onCreateActionItem}
                          />
                          {col && item.type === 'group' && (
                            <div className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/80 text-[10px]" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                              {col.name}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Collapsed group preview */}
                {!isFocused && item.type === 'group' && (
                  <div className="flex gap-1 mt-2 ml-10">
                    {item.cards.slice(0, 3).map((card) => (
                      <span
                        key={card.id}
                        className="text-xs truncate max-w-[120px] px-2 py-0.5 rounded-full bg-white/70"
                        style={{ color: 'var(--theme-text-muted, #64748b)' }}
                      >
                        {card.content}
                      </span>
                    ))}
                    {item.cards.length > 3 && (
                      <span className="text-xs px-2 py-0.5" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                        +{item.cards.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {discussItems.length === 0 && (
          <div className="text-center py-16">
            <MessageCircle className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--theme-text-muted, #64748b)' }} />
            <p className="text-sm" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
              No voted items to discuss.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
