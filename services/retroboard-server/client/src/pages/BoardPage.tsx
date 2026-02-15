import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, AlertCircle, LayoutDashboard } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { useAuthStore } from '@/stores/auth';
import { usePresenceStore } from '@/stores/presence';
import { api, ApiError } from '@/lib/api';
import { getWSClient } from '@/lib/ws-client';
import { useBoardSync } from '@/hooks/useBoardSync';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { BoardHeader } from '@/components/board/BoardHeader';
import { BoardColumn } from '@/components/board/BoardColumn';
import { GroupManager } from '@/components/board/GroupManager';
import { ActionItemsPanel } from '@/components/board/ActionItemsPanel';
import { BoardSettingsModal } from '@/components/board/BoardSettingsModal';
import { CreateBoardModal } from '@/components/board/CreateBoardModal';
import { ConnectionStatus } from '@/components/board/ConnectionStatus';
import { PresenceBar } from '@/components/board/PresenceBar';
import { PhaseBar } from '@/components/board/PhaseBar';
import { FacilitatorToolbar } from '@/components/board/FacilitatorToolbar';
import type { BoardPhase } from '@/lib/board-api';

interface TeamMember {
  user: { id: string };
  role: string;
}

export function BoardPage() {
  const { teamId, sprintId } = useParams<{ teamId: string; sprintId: string }>();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const board = useBoardStore((s) => s.board);
  const columns = useBoardStore((s) => s.columns);
  const isLoading = useBoardStore((s) => s.isLoading);
  const error = useBoardStore((s) => s.error);
  const isLocked = useBoardStore((s) => s.isLocked);
  const cardsRevealed = useBoardStore((s) => s.cardsRevealed);
  const fetchBoard = useBoardStore((s) => s.fetchBoard);
  const reset = useBoardStore((s) => s.reset);
  const resetPresence = usePresenceStore((s) => s.reset);

  const [showSettings, setShowSettings] = useState(false);
  const [showActionItems, setShowActionItems] = useState(false);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [userRole, setUserRole] = useState<string>('member');
  const [boardNotFound, setBoardNotFound] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // WebSocket sync
  useBoardSync(board?.id || null, wsConnected);

  // Fetch user role in team
  useEffect(() => {
    if (!teamId) return;
    api.get<{ members: TeamMember[] }>(`/teams/${teamId}/members`)
      .then((data) => {
        const member = data.members.find((m) => m.user.id === user?.id);
        if (member) setUserRole(member.role);
      })
      .catch(() => {
        // Fallback to member role
      });
  }, [teamId, user?.id]);

  // Fetch board data
  useEffect(() => {
    if (!sprintId) return;
    setBoardNotFound(false);
    fetchBoard(sprintId).catch((err) => {
      if (err instanceof ApiError && err.code === 'BOARD_NOT_FOUND') {
        setBoardNotFound(true);
      }
    });

    return () => {
      reset();
      resetPresence();
    };
  }, [sprintId, fetchBoard, reset, resetPresence]);

  // Connect to WebSocket when board loads
  useEffect(() => {
    if (!board || !accessToken) return;

    const ws = getWSClient();
    ws.connect(board.id, accessToken);
    setWsConnected(true);

    return () => {
      ws.disconnect();
      setWsConnected(false);
    };
  }, [board?.id, accessToken]);

  const isFacilitator = userRole === 'admin' || userRole === 'facilitator';
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  if (isLoading && !board) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  // Board doesn't exist yet — show create option
  if (boardNotFound || (error && !board)) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <Link
          to={`/teams/${teamId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-8"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Team
        </Link>

        {boardNotFound ? (
          <>
            <LayoutDashboard className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">No Board Yet</h2>
            <p className="text-slate-500 mb-6">
              {isFacilitator
                ? 'Create a retrospective board to get started.'
                : 'The facilitator hasn\'t started the retro yet.'}
            </p>
            {isFacilitator && (
              <Button onClick={() => setShowCreateBoard(true)}>
                Start Retro
              </Button>
            )}
            {sprintId && (
              <CreateBoardModal
                open={showCreateBoard}
                onClose={() => setShowCreateBoard(false)}
                sprintId={sprintId}
                onCreated={() => {
                  setShowCreateBoard(false);
                  setBoardNotFound(false);
                  if (sprintId) fetchBoard(sprintId);
                }}
              />
            )}
          </>
        ) : (
          <>
            <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-slate-700 mb-2">{error}</h2>
            <Button variant="secondary" onClick={() => { if (sprintId) fetchBoard(sprintId); }}>
              Retry
            </Button>
          </>
        )}
      </div>
    );
  }

  if (!board) return null;

  const handlePhaseChange = (phase: BoardPhase) => {
    // Phase change is handled by WebSocket sync
    console.log('Phase changed to:', phase);
  };

  const handleLockToggle = (locked: boolean) => {
    // Lock state is handled by WebSocket sync
    console.log('Board lock toggled:', locked);
  };

  const handleRevealCards = () => {
    // Reveal state is handled by WebSocket sync
    console.log('Cards revealed');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Back link */}
      <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between">
        <Link
          to={`/teams/${teamId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Team
        </Link>
        <ConnectionStatus />
      </div>

      {/* Presence bar */}
      <PresenceBar />

      {/* Phase bar */}
      <PhaseBar currentPhase={board.phase} isFacilitator={isFacilitator} />

      {/* Board header */}
      <BoardHeader
        isFacilitator={isFacilitator}
        onOpenSettings={() => setShowSettings(true)}
        onOpenActionItems={() => setShowActionItems(true)}
      />

      {/* Group manager (group phase only) */}
      <GroupManager isFacilitator={isFacilitator} />

      {/* Locked board banner */}
      {isLocked && !isFacilitator && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200">
          <p className="text-sm text-yellow-800 text-center">
            The board is currently locked by the facilitator. You cannot make changes.
          </p>
        </div>
      )}

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-4 h-full min-w-min">
          {sortedColumns.map((col) => (
            <BoardColumn
              key={col.id}
              columnId={col.id}
              name={col.name}
              color={col.color}
              isFacilitator={isFacilitator}
            />
          ))}
        </div>
      </div>

      {/* Action items panel */}
      <ActionItemsPanel
        open={showActionItems}
        onClose={() => setShowActionItems(false)}
        isFacilitator={isFacilitator}
      />

      {/* Settings modal */}
      <BoardSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Facilitator toolbar (only for facilitators/admins) */}
      {isFacilitator && board && (
        <FacilitatorToolbar
          boardId={board.id}
          currentPhase={board.phase}
          isLocked={isLocked}
          cardsRevealed={cardsRevealed}
          anonymousMode={board.anonymous_mode}
          onPhaseChange={handlePhaseChange}
          onLockToggle={handleLockToggle}
          onRevealCards={handleRevealCards}
        />
      )}
    </div>
  );
}
