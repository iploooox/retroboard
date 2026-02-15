import { Settings, ListChecks, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { BoardPhase } from '@/lib/board-api';

const phaseOrder: BoardPhase[] = ['write', 'group', 'vote', 'discuss', 'action'];

const phaseLabels: Record<BoardPhase, string> = {
  write: 'Write',
  group: 'Group',
  vote: 'Vote',
  discuss: 'Discuss',
  action: 'Action',
};

const phaseBadgeVariant: Record<BoardPhase, 'blue' | 'purple' | 'yellow' | 'green' | 'red'> = {
  write: 'blue',
  group: 'purple',
  vote: 'yellow',
  discuss: 'green',
  action: 'red',
};

interface BoardHeaderProps {
  isFacilitator: boolean;
  onOpenSettings: () => void;
  onOpenActionItems: () => void;
  onOpenExport: () => void;
}

export function BoardHeader({ isFacilitator, onOpenSettings, onOpenActionItems, onOpenExport }: BoardHeaderProps) {
  const board = useBoardStore((s) => s.board);
  const setPhase = useBoardStore((s) => s.setPhase);
  const userVotesRemaining = useBoardStore((s) => s.userVotesRemaining);

  if (!board) return null;

  const currentIdx = phaseOrder.indexOf(board.phase);
  const canGoBack = currentIdx > 0;
  const canGoForward = currentIdx < phaseOrder.length - 1;

  const handlePrevPhase = () => {
    if (canGoBack) {
      setPhase(phaseOrder[currentIdx - 1]!);
    }
  };

  const handleNextPhase = () => {
    if (canGoForward) {
      setPhase(phaseOrder[currentIdx + 1]!);
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant={phaseBadgeVariant[board.phase]}>
            {phaseLabels[board.phase]} Phase
          </Badge>
          {board.phase === 'vote' && (
            <span className="text-sm text-slate-500">
              {userVotesRemaining} vote{userVotesRemaining !== 1 ? 's' : ''} remaining
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isFacilitator && (
            <div className="flex items-center gap-1 mr-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevPhase}
                disabled={!canGoBack}
                aria-label="Previous phase"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex gap-1">
                {phaseOrder.map((p, i) => (
                  <div
                    key={p}
                    className={`h-1.5 w-6 rounded-full transition-colors ${
                      i <= currentIdx ? 'bg-indigo-500' : 'bg-slate-200'
                    }`}
                    title={phaseLabels[p]}
                  />
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPhase}
                disabled={!canGoForward}
                aria-label="Next phase"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button variant="ghost" size="sm" onClick={onOpenActionItems} aria-label="Action items">
            <ListChecks className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={onOpenExport} aria-label="Export retro">
            <Download className="h-4 w-4" />
          </Button>

          {isFacilitator && (
            <Button variant="ghost" size="sm" onClick={onOpenSettings} aria-label="Board settings">
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
