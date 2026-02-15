import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type SprintRangeOption = '5' | '10' | '20' | 'all';

interface FilterBarProps {
  onExportCSV: () => void;
  sprintRange?: SprintRangeOption;
  onSprintRangeChange?: (range: SprintRangeOption) => void;
}

export function FilterBar({
  onExportCSV,
  sprintRange = '10',
  onSprintRangeChange,
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
      </div>

      <Button variant="secondary" onClick={onExportCSV}>
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
    </div>
  );
}
