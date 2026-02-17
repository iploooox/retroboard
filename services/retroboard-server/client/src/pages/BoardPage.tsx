import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, AlertCircle, LayoutDashboard } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useBoardStore } from '@/stores/board';
import { useAuthStore } from '@/stores/auth';
import { usePresenceStore } from '@/stores/presence';
import { api, ApiError } from '@/lib/api';
import { facilitationApi } from '@/lib/facilitation-api';
import { toast } from '@/lib/toast';
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
import { IcebreakerWarmup } from '@/components/board/IcebreakerWarmup';
import { EnergyRecap } from '@/components/board/EnergyRecap';
import type { BoardPhase } from '@/lib/board-api';

interface TeamMember {
  user: { id: string };
  role: string;
}

// Theme definitions with CSS custom properties
// Theme names match DB constraint: default, ocean, sunset, forest, midnight, lavender, coral, monochrome
// All themes validated for WCAG AA contrast (4.5:1 for normal text, 3:1 for large text)
const THEME_STYLES: Record<string, Record<string, string>> = {
  default: {
    '--theme-bg': '#f8fafc',
    '--theme-column-bg': '#f1f5f9',
    '--theme-column-border': '#cbd5e1',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#e2e8f0',
    '--theme-header-text': '#475569',
    '--theme-text-primary': '#1e293b',
    '--theme-text-secondary': '#475569',
    '--theme-text-muted': '#64748b',
    '--theme-accent': '#6366f1',
    '--theme-accent-hover': '#4f46e5',
  },
  ocean: {
    '--theme-bg': '#eff6ff',
    '--theme-column-bg': '#dbeafe',
    '--theme-column-border': '#93c5fd',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#bfdbfe',
    '--theme-header-text': '#1e40af',
    '--theme-text-primary': '#1e293b',
    '--theme-text-secondary': '#334155',
    '--theme-text-muted': '#64748b',
    '--theme-accent': '#3b82f6',
    '--theme-accent-hover': '#2563eb',
  },
  sunset: {
    '--theme-bg': '#fff7ed',
    '--theme-column-bg': '#ffedd5',
    '--theme-column-border': '#fdba74',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#fed7aa',
    '--theme-header-text': '#9a3412',
    '--theme-text-primary': '#1c1917',
    '--theme-text-secondary': '#44403c',
    '--theme-text-muted': '#78716c',
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
    '--theme-text-primary': '#14532d',
    '--theme-text-secondary': '#166534',
    '--theme-text-muted': '#4d7c0f',
    '--theme-accent': '#22c55e',
    '--theme-accent-hover': '#16a34a',
  },
  midnight: {
    '--theme-bg': '#0f172a',
    '--theme-column-bg': '#1e293b',
    '--theme-column-border': '#334155',
    '--theme-card-bg': '#1e293b',
    '--theme-card-border': '#475569',
    '--theme-header-text': '#e2e8f0',
    '--theme-text-primary': '#f1f5f9',
    '--theme-text-secondary': '#cbd5e1',
    '--theme-text-muted': '#94a3b8',
    '--theme-accent': '#818cf8',
    '--theme-accent-hover': '#6366f1',
  },
  lavender: {
    '--theme-bg': '#faf5ff',
    '--theme-column-bg': '#f3e8ff',
    '--theme-column-border': '#d8b4fe',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#e9d5ff',
    '--theme-header-text': '#6b21a8',
    '--theme-text-primary': '#1e293b',
    '--theme-text-secondary': '#4c1d95',
    '--theme-text-muted': '#6b21a8',
    '--theme-accent': '#a855f7',
    '--theme-accent-hover': '#9333ea',
  },
  coral: {
    '--theme-bg': '#fff1f2',
    '--theme-column-bg': '#ffe4e6',
    '--theme-column-border': '#fda4af',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#fecdd3',
    '--theme-header-text': '#9f1239',
    '--theme-text-primary': '#1c1917',
    '--theme-text-secondary': '#881337',
    '--theme-text-muted': '#be123c',
    '--theme-accent': '#f43f5e',
    '--theme-accent-hover': '#e11d48',
  },
  monochrome: {
    '--theme-bg': '#fafafa',
    '--theme-column-bg': '#f5f5f5',
    '--theme-column-border': '#d4d4d4',
    '--theme-card-bg': '#ffffff',
    '--theme-card-border': '#e5e5e5',
    '--theme-header-text': '#171717',
    '--theme-text-primary': '#0a0a0a',
    '--theme-text-secondary': '#262626',
    '--theme-text-muted': '#525252',
    '--theme-accent': '#404040',
    '--theme-accent-hover': '#262626',
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
  const [teamTheme, setTeamTheme] = useState<string>('default');
  const [actionItemInitialCardId, setActionItemInitialCardId] = useState<string | undefined>();
  const [actionItemInitialTitle, setActionItemInitialTitle] = useState<string | undefined>();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showPhaseConfirm, setShowPhaseConfirm] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<BoardPhase | null>(null);

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
    api.get<{ team: { theme?: string } }>(`/teams/${teamId}`)
      .then((response) => {
        if (response.team.theme) {
          setTeamTheme(response.team.theme);
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

  const handleCreateActionItemFromCard = (cardId: string, cardContent: string) => {
    setActionItemInitialCardId(cardId);
    setActionItemInitialTitle(cardContent);
    setShowActionItems(true);
  };

  const handleInvite = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await api.post<{ invitation: { invite_url: string } }>(`/teams/${teamId}/invitations`, {
        role: 'member',
        expires_in_hours: 168,
        max_uses: null,
      });
      // Normalize to /invite/ path (both /join/ and /invite/ routes work)
      setInviteLink(data.invitation.invite_url.replace('/join/', '/invite/'));
      setShowInviteModal(true);
    } catch {
      // If creating fails, still show the modal (empty state)
      setShowInviteModal(true);
    }
  }, [teamId]);

  const handlePhaseClick = useCallback((phase: BoardPhase) => {
    setPendingPhase(phase);
    setShowPhaseConfirm(true);
  }, []);

  const handleConfirmPhase = useCallback(async () => {
    if (!pendingPhase || !board) return;
    try {
      await facilitationApi.setPhase(board.id, pendingPhase);
      useBoardStore.setState((state) => ({
        board: state.board ? { ...state.board, phase: pendingPhase } : null,
      }));
      setShowPhaseConfirm(false);
      setPendingPhase(null);
      toast.success(`Phase changed to ${pendingPhase.charAt(0).toUpperCase() + pendingPhase.slice(1)}`);
    } catch {
      toast.error('Failed to change phase');
    }
  }, [pendingPhase, board]);

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
    // Dismiss any open phase confirmation dialog to prevent stale overlays
    setShowPhaseConfirm(false);
    setPendingPhase(null);
  };

  const handleLockToggle = (locked: boolean) => {
    // Update store directly for immediate UI feedback
    useBoardStore.setState((state) => ({
      isLocked: locked,
      board: state.board ? { ...state.board, is_locked: locked } : null,
    }));
  };

  const handleRevealCards = () => {
    // Update store directly for immediate UI feedback
    useBoardStore.setState({ cardsRevealed: true });
  };

  // Get theme styles
  const themeStyles = THEME_STYLES[teamTheme] || THEME_STYLES.default;

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
      <PhaseBar currentPhase={board.phase} isFacilitator={isFacilitator} onPhaseClick={isFacilitator ? handlePhaseClick : undefined} />

      {/* Board header */}
      <BoardHeader
        isFacilitator={isFacilitator}
        onOpenSettings={() => setShowSettings(true)}
        onOpenActionItems={() => setShowActionItems(true)}
        onOpenExport={() => setShowExport(true)}
        onInvite={handleInvite}
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

      {/* Board columns area — hidden when icebreaker warmup is active (Rule 10: fullscreen overlay) */}
      <div className="flex-1 overflow-x-auto min-h-0 relative" style={{ backgroundColor: 'var(--theme-bg)' }}>
        {board.phase === 'icebreaker' && teamId ? (
          /* Icebreaker warmup replaces columns during icebreaker phase — per Rule 10 */
          <IcebreakerWarmup teamId={teamId} boardId={board.id} isFacilitator={isFacilitator} />
        ) : (
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
        )}
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
          boardName="Retrospective Board"
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

      {/* Invite modal */}
      <Modal
        open={showInviteModal}
        onClose={() => { setShowInviteModal(false); setInviteLink(null); }}
        title="Invite Team Member"
      >
        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Share this link to invite someone to the team:</p>
            <input
              readOnly
              value={inviteLink}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50"
            />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Creating invite link...</p>
        )}
      </Modal>

      {/* Phase change confirmation dialog */}
      {showPhaseConfirm && pendingPhase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Change Phase</h3>
            <p className="text-slate-600 mb-4">
              Move from <strong>{board.phase.charAt(0).toUpperCase() + board.phase.slice(1)}</strong> to{' '}
              <strong>{pendingPhase.charAt(0).toUpperCase() + pendingPhase.slice(1)}</strong>?
            </p>
            <p className="text-sm text-slate-500 mb-6">
              This will change the board for all connected participants.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => { setShowPhaseConfirm(false); setPendingPhase(null); }}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmPhase}>Change Phase</Button>
            </div>
          </div>
        </div>
      )}

      {/* Facilitator toolbar (only for facilitators/admins) */}
      {isFacilitator && board && (
        <FacilitatorToolbar
          boardId={board.id}
          teamId={teamId || ''}
          sprintId={sprintId || ''}
          currentPhase={board.phase}
          isLocked={isLocked}
          cardsRevealed={cardsRevealed}
          anonymousMode={board.anonymous_mode}
          onPhaseChange={handlePhaseChange}
          onLockToggle={handleLockToggle}
          onRevealCards={handleRevealCards}
        />
      )}

      {/* Energy recap overlay (S-007) — shown briefly during icebreaker→write transition */}
      <EnergyRecap />
    </div>
  );
}
