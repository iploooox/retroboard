import { Settings, ListChecks, Download, UserPlus } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { BoardPhase } from '@/lib/board-api';

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
  onInvite?: () => void;
}

export function BoardHeader({ isFacilitator, onOpenSettings, onOpenActionItems, onOpenExport, onInvite }: BoardHeaderProps) {
  const board = useBoardStore((s) => s.board);
  const userVotesRemaining = useBoardStore((s) => s.userVotesRemaining);

  if (!board) return null;

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant={phaseBadgeVariant[board.phase]}>
            {phaseLabels[board.phase]} Phase
          </Badge>
          {board.phase === 'vote' && (
            <span className="text-sm text-slate-500">
              {userVotesRemaining} remaining
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isFacilitator && onInvite && (
            <Button variant="ghost" size="sm" onClick={onInvite} aria-label="Invite">
              <UserPlus className="h-4 w-4" />
            </Button>
          )}

          {!(isFacilitator && board.phase === 'discuss') && (
            <Button variant="ghost" size="sm" onClick={onOpenActionItems} aria-label="Action items">
              <ListChecks className="h-4 w-4" />
            </Button>
          )}

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
