import { Repeat } from 'lucide-react';

interface WordFrequency {
  word: string;
  frequency: number;
  sentiment: number;
}

interface RecurringThemesProps {
  words: WordFrequency[];
  totalSprints: number;
}

export function RecurringThemes({ words, totalSprints: _totalSprints }: RecurringThemesProps) {
  // Identify recurring themes as words that appear frequently
  // Use a threshold: words appearing at least 3 times OR in the top 30% by frequency
  const sortedWords = [...words].sort((a, b) => b.frequency - a.frequency);
  const threshold = Math.max(3, Math.ceil(sortedWords.length * 0.3));
  const recurringWords = sortedWords.slice(0, threshold).filter(w => w.frequency >= 3);

  if (recurringWords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Repeat className="h-12 w-12 mb-2 text-slate-300" />
        <p>No recurring themes detected</p>
        <p className="text-xs mt-1">Complete more retrospectives to identify patterns</p>
      </div>
    );
  }

  const getRecurrenceLevel = (frequency: number): { label: string; color: string } => {
    if (frequency >= 10) return { label: 'Very Common', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' };
    if (frequency >= 6) return { label: 'Common', color: 'bg-blue-100 text-blue-700 border-blue-300' };
    return { label: 'Emerging', color: 'bg-slate-100 text-slate-700 border-slate-300' };
  };

  const getSentimentIcon = (sentiment: number): string => {
    if (sentiment > 0.5) return '✅';
    if (sentiment < -0.5) return '⚠️';
    return '💬';
  };

  const getSentimentLabel = (sentiment: number): string => {
    if (sentiment > 0.5) return 'Positive';
    if (sentiment < -0.5) return 'Needs Attention';
    return 'Neutral';
  };

  return (
    <div>
      {/* Recurring themes list */}
      <div className="space-y-3">
        {recurringWords.map((theme, index) => {
          const { label, color } = getRecurrenceLevel(theme.frequency);
          const sentimentIcon = getSentimentIcon(theme.sentiment);
          const sentimentLabel = getSentimentLabel(theme.sentiment);

          return (
            <div
              key={theme.word}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl font-bold text-slate-300 w-8">
                  #{index + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-semibold text-slate-800 capitalize">
                      {theme.word}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Repeat className="h-3.5 w-3.5" />
                      Mentioned {theme.frequency} times
                    </span>
                    <span className="flex items-center gap-1">
                      {sentimentIcon} {sentimentLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-sm text-slate-500">
          <span className="font-medium text-slate-700">Recurring themes</span> are topics that appear
          frequently across your retrospectives. Focus on positive themes to reinforce what's working,
          and address recurring concerns marked as "Needs Attention."
        </p>
      </div>
    </div>
  );
}
