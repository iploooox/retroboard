import { ThumbsUp } from 'lucide-react';

interface TopCard {
  cardId: string;
  text: string;
  votes: number;
  sentiment?: number;
}

interface TopVotedCardsProps {
  cards: TopCard[];
  limit?: number;
}

export function TopVotedCards({ cards, limit = 10 }: TopVotedCardsProps) {
  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No voted cards available
      </div>
    );
  }

  const displayCards = cards.slice(0, limit);

  return (
    <div className="space-y-2">
      {displayCards.map((card, index) => (
        <div
          key={card.cardId}
          className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm flex-shrink-0">
            #{index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700 line-clamp-2">{card.text}</p>
          </div>
          <div className="flex items-center gap-1 text-slate-600 flex-shrink-0">
            <ThumbsUp className="h-4 w-4" />
            <span className="font-semibold text-sm">{card.votes}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
