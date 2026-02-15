import { CheckCircle, Circle, Clock, ArrowRight } from 'lucide-react';

interface ActionItemsSummaryProps {
  total: number;
  open: number;
  inProgress: number;
  done: number;
  carriedOver: number;
  completionRate: number;
}

export function ActionItemsSummary({
  total,
  open,
  inProgress,
  done,
  carriedOver,
  completionRate,
}: ActionItemsSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Circle className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wide">Total</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{total}</div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-700 uppercase tracking-wide">Completed</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{done}</div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-blue-700 uppercase tracking-wide">In Progress</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">{inProgress}</div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowRight className="h-4 w-4 text-orange-600" />
            <span className="text-xs text-orange-700 uppercase tracking-wide">Carried Over</span>
          </div>
          <div className="text-2xl font-bold text-orange-700">{carriedOver}</div>
        </div>
      </div>

      {/* Completion rate bar */}
      <div>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-700 font-medium">Completion Rate</span>
          <span className="text-slate-900 font-semibold">{completionRate.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all"
            style={{ width: `${Math.min(completionRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Status breakdown */}
      <div className="pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Open: {open}</span>
          <span>In Progress: {inProgress}</span>
          <span>Done: {done}</span>
        </div>
      </div>
    </div>
  );
}
