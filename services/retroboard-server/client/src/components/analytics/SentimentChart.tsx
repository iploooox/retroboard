interface SentimentByColumn {
  columnId: string;
  columnName: string;
  averageSentiment: number;
  cardCount: number;
}

interface SentimentDataPoint {
  sprintId: string;
  sprintName: string;
  positiveCards: number;
  negativeCards: number;
  neutralCards: number;
  totalCards: number;
  sentimentByColumn?: SentimentByColumn[];
}

interface SentimentChartProps {
  data: SentimentDataPoint[];
  showColumnBreakdown?: boolean;
}

export function SentimentChart({ data, showColumnBreakdown = false }: SentimentChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No sentiment data available
      </div>
    );
  }

  // For column breakdown, show the first sprint's column data
  const columnData = showColumnBreakdown && data[0]?.sentimentByColumn ? data[0].sentimentByColumn : [];

  return (
    <div>
      {/* Main chart - per-sprint sentiment */}
      {!showColumnBreakdown && (
        <div className="space-y-2 mb-4">
          {data.slice(0, 10).map((sprint) => {
            const positivePct = (sprint.positiveCards / sprint.totalCards) * 100;
            const neutralPct = (sprint.neutralCards / sprint.totalCards) * 100;
            const negativePct = (sprint.negativeCards / sprint.totalCards) * 100;

            return (
              <div key={sprint.sprintId}>
                <div className="text-sm text-slate-700 font-medium mb-1">{sprint.sprintName}</div>
                <div className="flex h-8 rounded-lg overflow-hidden">
                  <div
                    className="bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${positivePct}%` }}
                    title={`${sprint.positiveCards} positive (${positivePct.toFixed(0)}%)`}
                  >
                    {positivePct > 15 ? `${positivePct.toFixed(0)}%` : ''}
                  </div>
                  <div
                    className="bg-slate-400 flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${neutralPct}%` }}
                    title={`${sprint.neutralCards} neutral (${neutralPct.toFixed(0)}%)`}
                  >
                    {neutralPct > 15 ? `${neutralPct.toFixed(0)}%` : ''}
                  </div>
                  <div
                    className="bg-red-500 flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${negativePct}%` }}
                    title={`${sprint.negativeCards} negative (${negativePct.toFixed(0)}%)`}
                  >
                    {negativePct > 15 ? `${negativePct.toFixed(0)}%` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Column breakdown - per-column sentiment for a sprint */}
      {showColumnBreakdown && columnData.length > 0 && (
        <div className="space-y-3 mb-4">
          {columnData.map((column) => {
            const sentiment = column.averageSentiment;
            const sentimentLabel = sentiment > 0.5 ? 'Positive' : sentiment < -0.5 ? 'Negative' : 'Neutral';
            const sentimentColor = sentiment > 0.5 ? 'text-green-600' : sentiment < -0.5 ? 'text-red-600' : 'text-slate-600';
            const bgColor = sentiment > 0.5 ? 'bg-green-100' : sentiment < -0.5 ? 'bg-red-100' : 'bg-slate-100';

            return (
              <div key={column.columnId} className={`${bgColor} rounded-lg p-3`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">{column.columnName}</span>
                  <span className={`text-xs font-semibold ${sentimentColor}`}>{sentimentLabel}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{column.cardCount} cards</span>
                  <span>Avg: {sentiment.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs pt-4 border-t border-slate-200">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span className="text-slate-600">Positive</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-slate-400 rounded" />
          <span className="text-slate-600">Neutral</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span className="text-slate-600">Negative</span>
        </div>
      </div>
    </div>
  );
}
