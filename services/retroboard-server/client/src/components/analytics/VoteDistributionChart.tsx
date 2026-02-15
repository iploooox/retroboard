import { BarChart3 } from 'lucide-react';

interface TopCard {
  cardId: string;
  text: string;
  votes: number;
  sentiment?: number;
}

interface VoteDistributionChartProps {
  cards: TopCard[];
  totalCards: number;
}

export function VoteDistributionChart({ cards, totalCards }: VoteDistributionChartProps) {
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <BarChart3 className="h-12 w-12 mb-2 text-slate-300" />
        <p>No vote data available</p>
      </div>
    );
  }

  // Calculate vote distribution by buckets
  const voteBuckets = {
    '0': 0,
    '1-2': 0,
    '3-5': 0,
    '6-10': 0,
    '11+': 0,
  };

  // We only have data for cards with votes (topVotedCards)
  // Cards with 0 votes = totalCards - cards.length
  const cardsWithVotes = cards.length;
  const cardsWithoutVotes = Math.max(0, totalCards - cardsWithVotes);
  voteBuckets['0'] = cardsWithoutVotes;

  cards.forEach((card) => {
    if (card.votes >= 11) {
      voteBuckets['11+']++;
    } else if (card.votes >= 6) {
      voteBuckets['6-10']++;
    } else if (card.votes >= 3) {
      voteBuckets['3-5']++;
    } else if (card.votes >= 1) {
      voteBuckets['1-2']++;
    }
  });

  const maxBucketCount = Math.max(...Object.values(voteBuckets));
  const totalVotes = cards.reduce((sum, card) => sum + card.votes, 0);

  // Calculate concentration metrics
  const top5Cards = cards.slice(0, 5);
  const top5Votes = top5Cards.reduce((sum, card) => sum + card.votes, 0);
  const top5Percentage = totalVotes > 0 ? (top5Votes / totalVotes) * 100 : 0;

  const top10Cards = cards.slice(0, 10);
  const top10Votes = top10Cards.reduce((sum, card) => sum + card.votes, 0);
  const top10Percentage = totalVotes > 0 ? (top10Votes / totalVotes) * 100 : 0;

  // Determine distribution pattern
  let distributionType = 'Balanced';
  let distributionColor = 'text-green-600';
  let distributionDescription = 'Votes are evenly distributed across cards';

  if (top5Percentage > 70) {
    distributionType = 'Highly Concentrated';
    distributionColor = 'text-red-600';
    distributionDescription = 'Votes are heavily concentrated on a few cards';
  } else if (top5Percentage > 50) {
    distributionType = 'Moderately Concentrated';
    distributionColor = 'text-orange-600';
    distributionDescription = 'Most votes are concentrated on popular cards';
  } else if (top5Percentage > 30) {
    distributionType = 'Somewhat Distributed';
    distributionColor = 'text-blue-600';
    distributionDescription = 'Votes are spread across multiple cards';
  }

  return (
    <div>
      {/* Distribution pattern summary */}
      <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Distribution Pattern:</span>
          <span className={`text-sm font-semibold ${distributionColor}`}>{distributionType}</span>
        </div>
        <p className="text-xs text-slate-500 mb-2">{distributionDescription}</p>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span>Top 5 cards: <strong>{top5Percentage.toFixed(0)}%</strong> of votes</span>
          <span>Top 10 cards: <strong>{top10Percentage.toFixed(0)}%</strong> of votes</span>
        </div>
      </div>

      {/* Histogram */}
      <div className="space-y-3 mb-4">
        {Object.entries(voteBuckets).map(([bucket, count]) => {
          const percentage = totalCards > 0 ? (count / totalCards) * 100 : 0;
          const barWidth = maxBucketCount > 0 ? (count / maxBucketCount) * 100 : 0;

          return (
            <div key={bucket}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-700 font-medium w-20">
                  {bucket === '0' ? 'No votes' : `${bucket} votes`}
                </span>
                <span className="text-slate-500 text-xs">
                  {count} {count === 1 ? 'card' : 'cards'} ({percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-6 overflow-hidden">
                <div
                  className={`h-6 rounded-full flex items-center justify-center text-xs font-medium text-white transition-all ${
                    bucket === '0'
                      ? 'bg-slate-400'
                      : bucket === '11+'
                      ? 'bg-indigo-600'
                      : bucket === '6-10'
                      ? 'bg-blue-500'
                      : bucket === '3-5'
                      ? 'bg-green-500'
                      : 'bg-yellow-500'
                  }`}
                  style={{ width: `${barWidth}%` }}
                  title={`${count} cards with ${bucket} votes`}
                >
                  {barWidth > 15 ? count : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="pt-4 border-t border-slate-200">
        <div className="text-sm text-slate-500 mb-3">
          <strong>Total votes cast:</strong> {totalVotes} across {cardsWithVotes} {cardsWithVotes === 1 ? 'card' : 'cards'}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-slate-400 rounded" />
            <span className="text-slate-600">No votes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded" />
            <span className="text-slate-600">1-2 votes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-slate-600">3-5 votes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-slate-600">6-10 votes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-indigo-600 rounded" />
            <span className="text-slate-600">11+ votes</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          <strong>Interpreting vote distribution:</strong> A balanced distribution suggests diverse team
          interests, while concentrated votes indicate strong alignment on specific topics. Both patterns
          are valid depending on your retrospective goals.
        </p>
      </div>
    </div>
  );
}
