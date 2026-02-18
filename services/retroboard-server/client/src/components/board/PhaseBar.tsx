import type { BoardPhase } from '@/lib/board-api';
import { Check, Sparkles } from 'lucide-react';

const PHASES: Array<{ key: BoardPhase; label: string; number: number; icon?: 'sparkle' }> = [
  { key: 'icebreaker', label: 'Icebreaker', number: 1, icon: 'sparkle' },
  { key: 'write', label: 'Write', number: 2 },
  { key: 'group', label: 'Group', number: 3 },
  { key: 'vote', label: 'Vote', number: 4 },
  { key: 'discuss', label: 'Discuss', number: 5 },
  { key: 'action', label: 'Action', number: 6 },
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
        const isFuturePhase = index > currentIndex;

        // Facilitators can click any non-active phase (completed or future) to jump to it
        const isClickable = isFacilitator && onPhaseClick && !isActive;
        const Tag = isFacilitator ? 'button' : 'div';
        return (
          <Tag
            key={phase.key}
            onClick={isClickable ? () => onPhaseClick(phase.key) : undefined}
            data-testid={`phase-step-${phase.key}`}
            aria-label={`${phase.number} ${phase.label}`}
            className={`
              flex items-center justify-center h-9 w-9 rounded-lg border transition-all
              ${isActive
                ? 'bg-indigo-600 text-white border-indigo-300 ring-2 ring-indigo-300'
                : isCompleted
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : isFuturePhase && isFacilitator
                    ? 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100'
                    : 'bg-slate-50 text-slate-400 border-slate-200'
              }
              ${isClickable ? 'cursor-pointer hover:brightness-105' : 'cursor-default'}
            `}
            title={`Phase ${phase.number}: ${phase.label}`}
          >
            {isCompleted ? (
              <Check className="h-4 w-4" />
            ) : phase.icon === 'sparkle' ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <span className="text-sm font-bold">{phase.number}</span>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
