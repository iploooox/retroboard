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
import { ExportDialog } from '@/components/board/ExportDialog';
import { BoardSettingsModal } from '@/components/board/BoardSettingsModal';
import { CreateBoardModal } from '@/components/board/CreateBoardModal';
import { ConnectionStatus } from '@/components/board/ConnectionStatus';
import { PresenceBar } from '@/components/board/PresenceBar';
import { PhaseBar } from '@/components/board/PhaseBar';
import { FacilitatorToolbar } from '@/components/board/FacilitatorToolbar';
import { IcebreakerCard } from '@/components/board/IcebreakerCard';
import type { BoardPhase } from '@/lib/board-api';

interface TeamMember {
  user: { id: string };
  role: string;
}

// Theme definitions with CSS custom properties
const THEME_STYLES: Record<string, Record<string, string>> = {
  ocean: {
    '--theme-bg': '#eff6ff',
    '--theme-column-bg': '#dbeafe',
    '--theme-column-border': '#93c5fd',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#bfdbfe',
    '--theme-header-text': '#1e40af',
    '--theme-accent': '#3b82f6',
    '--theme-accent-hover': '#2563eb',
  },
  sunset: {
    '--theme-bg': '#fff7ed',
    '--theme-column-bg': '#ffedd5',
    '--theme-column-border': '#fdba74',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#fed7aa',
    '--theme-header-text': '#c2410c',
    '--theme-accent': '#f97316',
    '--theme-accent-hover': '#ea580c',
  },
  forest: {
    '--theme-bg': '#f0fdf4',
    '--theme-column-bg': '#dcfce7',
    '--theme-column-border': '#86efac',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#bbf7d0',
    '--theme-header-text': '#15803d',
    '--theme-accent': '#22c55e',
    '--theme-accent-hover': '#16a34a',
  },
  lavender: {
    '--theme-bg': '#faf5ff',
    '--theme-column-bg': '#f3e8ff',
    '--theme-column-border': '#d8b4fe',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#e9d5ff',
    '--theme-header-text': '#7e22ce',
    '--theme-accent': '#a855f7',
    '--theme-accent-hover': '#9333ea',
  },
  slate: {
    '--theme-bg': '#f8fafc',
    '--theme-column-bg': '#f1f5f9',
    '--theme-column-border': '#cbd5e1',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#e2e8f0',
    '--theme-header-text': '#475569',
    '--theme-accent': '#64748b',
    '--theme-accent-hover': '#475569',
  },
  rose: {
    '--theme-bg': '#fff1f2',
    '--theme-column-bg': '#ffe4e6',
    '--theme-column-border': '#fda4af',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#fecdd3',
    '--theme-header-text': '#be123c',
    '--theme-accent': '#f43f5e',
    '--theme-accent-hover': '#e11d48',
  },
  amber: {
    '--theme-bg': '#fffbeb',
    '--theme-column-bg': '#fef3c7',
    '--theme-column-border': '#fcd34d',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#fde68a',
    '--theme-header-text': '#b45309',
    '--theme-accent': '#f59e0b',
    '--theme-accent-hover': '#d97706',
  },
  emerald: {
    '--theme-bg': '#ecfdf5',
    '--theme-column-bg': '#d1fae5',
    '--theme-column-border': '#6ee7b7',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#a7f3d0',
    '--theme-header-text': '#047857',
    '--theme-accent': '#10b981',
    '--theme-accent-hover': '#059669',
  },
};

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
  const [showExport, setShowExport] = useState(false);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [userRole, setUserRole] = useState<string>('member');
  const [boardNotFound, setBoardNotFound] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [teamTheme, setTeamTheme] = useState<string>('ocean');
  const [showIcebreaker, setShowIcebreaker] = useState(true);
  const [actionItemInitialCardId, setActionItemInitialCardId] = useState<string | undefined>();
  const [actionItemInitialTitle, setActionItemInitialTitle] = useState<string | undefined>();

  // WebSocket sync
  useBoardSync(board?.id || null, wsConnected);

  // Fetch user role in team and team theme
  useEffect(() => {
    if (!teamId) return;

    // Fetch team members to get user role
    api.get<{ members: TeamMember[] }>(`/teams/${teamId}/members`)
      .then((data) => {
        const member = data.members.find((m) => m.user.id === user?.id);
        if (member) setUserRole(member.role);
      })
      .catch(() => {
        // Fallback to member role
      });

    // Fetch team data to get current theme
    api.get<{ ok: boolean; data: { theme?: string } }>(`/teams/${teamId}`)
      .then((response) => {
        if (response.data?.theme) {
          setTeamTheme(response.data.theme);
        }
      })
      .catch(() => {
        // Use default theme
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintId]); // Only sprintId — Zustand store functions are stable

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

  const handleCreateActionItemFromCard = (cardId: string, cardContent: string) => {
    setActionItemInitialCardId(cardId);
    setActionItemInitialTitle(cardContent);
    setShowActionItems(true);
  };

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
    // Update store directly for immediate UI feedback
    useBoardStore.setState((state) => ({
      board: state.board ? { ...state.board, phase } : null,
    }));
  };

  const handleLockToggle = (locked: boolean) => {
    // Update store directly for immediate UI feedback
    useBoardStore.setState({ isLocked: locked });
  };

  const handleRevealCards = () => {
    // Update store directly for immediate UI feedback
    useBoardStore.setState({ cardsRevealed: true });
  };

  // Get theme styles
  const themeStyles = THEME_STYLES[teamTheme] || THEME_STYLES.ocean;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]" style={themeStyles as React.CSSProperties}>
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
        onOpenExport={() => setShowExport(true)}
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

      {/* Icebreaker (write phase only) */}
      {board.phase === 'write' && showIcebreaker && teamId && (
        <IcebreakerCard teamId={teamId} onDismiss={() => setShowIcebreaker(false)} />
      )}

      {/* Columns */}
      <div className="flex-1 overflow-x-auto min-h-0" style={{ backgroundColor: 'var(--theme-bg)' }}>
        <div className="flex gap-4 p-4 h-full min-w-min">
          {sortedColumns.map((col) => (
            <BoardColumn
              key={col.id}
              columnId={col.id}
              name={col.name}
              color={col.color}
              isFacilitator={isFacilitator}
              onCreateActionItem={handleCreateActionItemFromCard}
            />
          ))}
        </div>
      </div>

      {/* Action items panel */}
      <ActionItemsPanel
        open={showActionItems}
        onClose={() => {
          setShowActionItems(false);
          setActionItemInitialCardId(undefined);
          setActionItemInitialTitle(undefined);
        }}
        isFacilitator={isFacilitator}
        teamId={teamId || ''}
        initialCardId={actionItemInitialCardId}
        initialTitle={actionItemInitialTitle}
      />

      {/* Export dialog */}
      {board && (
        <ExportDialog
          open={showExport}
          onClose={() => setShowExport(false)}
          boardId={board.id}
          boardName={`Sprint ${board.sprint_id}`}
        />
      )}

      {/* Settings modal */}
      {teamId && (
        <BoardSettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          teamId={teamId}
          currentTheme={teamTheme}
        />
      )}

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
