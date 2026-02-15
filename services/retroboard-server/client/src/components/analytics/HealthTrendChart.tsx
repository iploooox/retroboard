interface HealthDataPoint {
  sprintId: string;
  sprintName: string;
  healthScore: number;
  cardCount: number;
  totalMembers: number;
  activeMembers: number;
}

interface HealthTrendChartProps {
  data: HealthDataPoint[];
}

export function HealthTrendChart({ data }: HealthTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No health data available
      </div>
    );
  }

  const avgScore = data.reduce((sum, d) => sum + d.healthScore, 0) / data.length;
  const best = data.reduce((max, d) => (d.healthScore > max!.healthScore ? d : max), data[0])!;

  // Calculate trend (simple linear regression slope approximation)
  const trend =
    data.length > 1
      ? ((data[data.length - 1]!.healthScore - data[0]!.healthScore) / (data.length - 1)).toFixed(1)
      : '0';

  return (
    <div>
      {/* Chart */}
      <div className="relative h-64 mb-4">
        <svg className="w-full h-full" viewBox="0 0 800 256" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={256 - (y * 256) / 100}
              x2="800"
              y2={256 - (y * 256) / 100}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          ))}

          {/* Average line */}
          <line
            x1="0"
            y1={256 - (avgScore * 256) / 100}
            x2="800"
            y2={256 - (avgScore * 256) / 100}
            stroke="#cbd5e1"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Line chart */}
          {data.length > 1 && (
            <polyline
              points={data
                .map((d, i) => {
                  const x = (i / (data.length - 1)) * 800;
                  const y = 256 - (d.healthScore * 256) / 100;
                  return `${x},${y}`;
                })
                .join(' ')}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
            />
          )}

          {/* Data points */}
          {data.map((d, i) => {
            const x = data.length === 1 ? 400 : (i / (data.length - 1)) * 800;
            const y = 256 - (d.healthScore * 256) / 100;
            return (
              <circle key={d.sprintId} cx={x} cy={y} r="4" fill="#6366f1">
                <title>
                  {d.sprintName}: {d.healthScore.toFixed(1)}
                  {'\n'}
                  {d.cardCount} cards, {d.activeMembers}/{d.totalMembers} members
                </title>
              </circle>
            );
          })}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-slate-500 -ml-10">
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
          <span>0</span>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-slate-500 mb-4">
        {data.length <= 10 ? (
          data.map((d) => <span key={d.sprintId}>{d.sprintName}</span>)
        ) : (
          <>
            <span>{data[0]?.sprintName}</span>
            <span>...</span>
            <span>{data[data.length - 1]?.sprintName}</span>
          </>
        )}
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-6 text-sm pt-4 border-t border-slate-200">
        <div>
          <span className="text-slate-500">Average: </span>
          <span className="font-semibold text-slate-900">{avgScore.toFixed(1)}</span>
        </div>
        <div>
          <span className="text-slate-500">Trend: </span>
          <span className={`font-semibold ${Number(trend) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Number(trend) >= 0 ? '+' : ''}
            {trend} per sprint
          </span>
        </div>
        <div>
          <span className="text-slate-500">Best: </span>
          <span className="font-semibold text-slate-900">
            {best.sprintName} ({best.healthScore.toFixed(1)})
          </span>
        </div>
      </div>
    </div>
  );
}
