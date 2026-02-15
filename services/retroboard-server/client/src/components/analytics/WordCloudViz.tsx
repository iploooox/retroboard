interface WordFrequency {
  word: string;
  frequency: number;
  sentiment: number;
}

interface WordCloudVizProps {
  words: WordFrequency[];
  totalCards: number;
}

export function WordCloudViz({ words, totalCards }: WordCloudVizProps) {
  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p>No word data available</p>
      </div>
    );
  }

  const maxFreq = Math.max(...words.map((w) => w.frequency));
  const minFreq = Math.min(...words.map((w) => w.frequency));

  const getFontSize = (frequency: number) => {
    const normalized = (frequency - minFreq) / (maxFreq - minFreq || 1);
    return 12 + normalized * 36; // 12px to 48px
  };

  const getColor = (sentiment: number) => {
    if (sentiment > 0.5) return 'text-green-600';
    if (sentiment < -0.5) return 'text-red-600';
    return 'text-slate-600';
  };

  return (
    <div>
      {/* Word cloud */}
      <div className="flex flex-wrap gap-3 justify-center items-center h-64 overflow-hidden p-4">
        {words.slice(0, 50).map((word) => (
          <span
            key={word.word}
            className={`font-semibold ${getColor(word.sentiment)} cursor-default`}
            style={{ fontSize: `${getFontSize(word.frequency)}px` }}
            title={`${word.word}: ${word.frequency} occurrences`}
          >
            {word.word}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-slate-200 text-sm text-slate-500">
        Based on {totalCards} cards across selected sprints
      </div>
    </div>
  );
}
