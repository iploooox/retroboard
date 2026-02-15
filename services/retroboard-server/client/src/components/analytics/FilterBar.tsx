import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type SprintRangeOption = '5' | '10' | '20' | 'all';

interface FilterBarProps {
  onExportCSV: () => void;
  sprintRange?: SprintRangeOption;
  onSprintRangeChange?: (range: SprintRangeOption) => void;
  dateRange?: { start: string; end: string } | null;
  onDateRangeChange?: (range: { start: string; end: string } | null) => void;
}

export function FilterBar({
  onExportCSV,
  sprintRange = '10',
  onSprintRangeChange,
  dateRange,
  onDateRangeChange,
}: FilterBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
      <div className="flex items-center gap-3">
        {/* Sprint Range Selector */}
        {onSprintRangeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="sprint-range" className="text-sm text-slate-600 font-medium">
              Sprint Range:
            </label>
            <select
              id="sprint-range"
              value={sprintRange}
              onChange={(e) => onSprintRangeChange(e.target.value as SprintRangeOption)}
              className="text-sm border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="5">Last 5 sprints</option>
              <option value="10">Last 10 sprints</option>
              <option value="20">Last 20 sprints</option>
              <option value="all">All sprints</option>
            </select>
          </div>
        )}

        {/* Date Range Filter */}
        {onDateRangeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="date-start" className="text-sm text-slate-600 font-medium">
              Date Range:
            </label>
            <input
              id="date-start"
              type="date"
              value={dateRange?.start || ''}
              onChange={(e) => {
                if (e.target.value && dateRange?.end) {
                  onDateRangeChange({ start: e.target.value, end: dateRange.end });
                } else if (e.target.value) {
                  onDateRangeChange({ start: e.target.value, end: new Date().toISOString().split('T')[0]! });
                }
              }}
              className="text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400">to</span>
            <input
              id="date-end"
              type="date"
              value={dateRange?.end || ''}
              onChange={(e) => {
                if (e.target.value && dateRange?.start) {
                  onDateRangeChange({ start: dateRange.start, end: e.target.value });
                }
              }}
              className="text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {dateRange && (
              <button
                onClick={() => onDateRangeChange(null)}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <Button variant="secondary" onClick={onExportCSV}>
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
    </div>
  );
}
