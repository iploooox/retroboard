import type { BoardPhase } from '@/lib/board-api';
import { Check } from 'lucide-react';

const PHASES: Array<{ key: BoardPhase; label: string; number: number }> = [
  { key: 'write', label: 'Write', number: 1 },
  { key: 'group', label: 'Group', number: 2 },
  { key: 'vote', label: 'Vote', number: 3 },
  { key: 'discuss', label: 'Discuss', number: 4 },
  { key: 'action', label: 'Action', number: 5 },
];

interface PhaseBarProps {
  currentPhase: BoardPhase;
  isFacilitator?: boolean;
  onPhaseClick?: (phase: BoardPhase) => void;
}

export function PhaseBar({ currentPhase, isFacilitator, onPhaseClick }: PhaseBarProps) {
  const currentIndex = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-b border-slate-200">
      {PHASES.map((phase, index) => {
        const isActive = phase.key === currentPhase;
        const isCompleted = index < currentIndex;
        const isClickable = isFacilitator && onPhaseClick;

        return (
          <button
            key={phase.key}
            onClick={() => isClickable && onPhaseClick(phase.key)}
            disabled={!isClickable}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
              ${isActive
                ? 'bg-indigo-600 text-white border-indigo-300 ring-2 ring-indigo-300'
                : isCompleted
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }
              ${isClickable ? 'cursor-pointer hover:brightness-105' : 'cursor-default'}
            `}
            title={`Phase ${phase.number}: ${phase.label}`}
          >
            <div className="flex items-center justify-center h-5 w-5">
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-sm font-medium">{phase.number}</span>
              )}
            </div>
            <span className="text-sm font-medium">{phase.label}</span>
          </button>
        );
      })}
    </div>
  );
}
