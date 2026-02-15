interface CardDistribution {
  columnId: string;
  columnName: string;
  count: number;
}

interface CardDistributionChartProps {
  data: CardDistribution[];
}

export function CardDistributionChart({ data }: CardDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No card distribution data available
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(...data.map((d) => d.count));

  const colors = [
    'bg-indigo-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-orange-500',
    'bg-red-500',
  ];

  return (
    <div>
      {/* Bar chart */}
      <div className="space-y-3 mb-4">
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.count / total) * 100 : 0;
          const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

          return (
            <div key={item.columnId}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-700 font-medium">{item.columnName}</span>
                <span className="text-slate-500 text-xs">
                  {item.count} cards ({percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1 bg-slate-100 rounded-lg overflow-hidden h-8">
                  <div
                    className={`${colors[index % colors.length]} h-full flex items-center justify-end px-2 transition-all`}
                    style={{ width: `${barWidth}%` }}
                  >
                    {barWidth > 15 && (
                      <span className="text-white text-xs font-medium">{item.count}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="pt-4 border-t border-slate-200 text-sm text-slate-500">
        Total cards: <span className="font-semibold text-slate-900">{total}</span>
      </div>
    </div>
  );
}
