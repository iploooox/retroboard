import { useState, useEffect } from 'react';
import type { BoardPhase } from '@/lib/board-api';
import { Play, Pause, RotateCcw, Lock, Unlock, Eye, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { facilitationApi } from '@/lib/facilitation-api';
import { toast } from '@/lib/toast';

const PHASES: Array<{ key: BoardPhase; label: string }> = [
  { key: 'write', label: 'Write' },
  { key: 'group', label: 'Group' },
  { key: 'vote', label: 'Vote' },
  { key: 'discuss', label: 'Discuss' },
  { key: 'action', label: 'Action' },
];

interface FacilitatorToolbarProps {
  boardId: string;
  currentPhase: BoardPhase;
  isLocked?: boolean;
  cardsRevealed?: boolean;
  anonymousMode?: boolean;
  onPhaseChange: (phase: BoardPhase) => void;
  onLockToggle: (locked: boolean) => void;
  onRevealCards: () => void;
}

export function FacilitatorToolbar({
  boardId,
  currentPhase,
  isLocked = false,
  cardsRevealed = false,
  anonymousMode = false,
  onPhaseChange,
  onLockToggle,
  onRevealCards,
}: FacilitatorToolbarProps) {
  const [timerDuration] = useState(300); // 5 minutes default
  const [timerRemaining, setTimerRemaining] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [isStartingTimer, setIsStartingTimer] = useState(false);
  const [showPhaseConfirm, setShowPhaseConfirm] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<BoardPhase | null>(null);

  // Client-side countdown interval
  useEffect(() => {
    if (!timerRunning || timerPaused) return;

    const interval = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, timerPaused]);

  const currentPhaseIndex = PHASES.findIndex((p) => p.key === currentPhase);
  const nextPhase = currentPhaseIndex < PHASES.length - 1 ? PHASES[currentPhaseIndex + 1] : null;

  const handleStartTimer = async () => {
    setIsStartingTimer(true);
    try {
      await facilitationApi.startTimer(boardId, timerDuration);
      setTimerRunning(true);
      setTimerPaused(false);
      setTimerRemaining(timerDuration);
      toast.success('Timer started');
    } catch {
      toast.error('Failed to start timer');
    } finally {
      setIsStartingTimer(false);
    }
  };

  const handlePauseTimer = async () => {
    try {
      await facilitationApi.pauseTimer(boardId);
      setTimerPaused(true);
      setTimerRunning(false);
      toast.success('Timer paused');
    } catch {
      toast.error('Failed to pause timer');
    }
  };

  const handleResumeTimer = async () => {
    try {
      await facilitationApi.resumeTimer(boardId);
      setTimerPaused(false);
      setTimerRunning(true);
      toast.success('Timer resumed');
    } catch {
      toast.error('Failed to resume timer');
    }
  };

  const handleResetTimer = async () => {
    try {
      await facilitationApi.stopTimer(boardId);
      setTimerRunning(false);
      setTimerPaused(false);
      setTimerRemaining(timerDuration);
      toast.success('Timer reset');
    } catch {
      toast.error('Failed to reset timer');
    }
  };

  const handlePhaseClick = (phase: BoardPhase) => {
    setPendingPhase(phase);
    setShowPhaseConfirm(true);
  };

  const handleConfirmPhase = async () => {
    if (!pendingPhase) return;

    try {
      await facilitationApi.setPhase(boardId, pendingPhase);
      onPhaseChange(pendingPhase);
      setShowPhaseConfirm(false);
      setPendingPhase(null);
      toast.success(`Phase changed to ${PHASES.find((p) => p.key === pendingPhase)?.label}`);
    } catch {
      toast.error('Failed to change phase');
    }
  };

  const handleLockToggle = async () => {
    try {
      await facilitationApi.lockBoard(boardId, !isLocked);
      onLockToggle(!isLocked);
      toast.success(isLocked ? 'Board unlocked' : 'Board locked');
    } catch {
      toast.error('Failed to toggle lock');
    }
  };

  const handleReveal = async () => {
    try {
      await facilitationApi.revealCards(boardId);
      onRevealCards();
      toast.success('Anonymous cards revealed');
    } catch {
      toast.error('Failed to reveal cards');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div className="bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6">
            {/* Phase Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm text-slate-600 font-medium mr-1 sm:mr-2">Phase:</span>
              {PHASES.map((phase, index) => {
                const isActive = phase.key === currentPhase;
                const isCompleted = index < currentPhaseIndex;
                return (
                  <button
                    key={phase.key}
                    onClick={() => handlePhaseClick(phase.key)}
                    className={`
                      px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all
                      ${isActive
                        ? 'bg-indigo-600 text-white'
                        : isCompleted
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-slate-50 text-slate-400'
                      }
                      hover:brightness-105
                    `}
                  >
                    {phase.label}
                  </button>
                );
              })}
            </div>

            {/* Timer Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm text-slate-600 font-medium hidden sm:inline">Timer:</span>
              <div
                data-testid="timer-display"
                className="font-mono text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-50 rounded-lg"
              >
                {formatTime(timerRemaining)}
              </div>
              {!timerRunning && !timerPaused && (
                <Button
                  size="sm"
                  onClick={handleStartTimer}
                  disabled={isStartingTimer}
                  aria-label="Start timer"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {timerRunning && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handlePauseTimer}
                  aria-label="Pause timer"
                >
                  <Pause className="h-4 w-4" />
                </Button>
              )}
              {timerPaused && (
                <Button
                  size="sm"
                  onClick={handleResumeTimer}
                  aria-label="Resume timer"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {(timerRunning || timerPaused) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleResetTimer}
                  aria-label="Reset timer"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Board Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleLockToggle}
                className={`
                  flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all
                  ${isLocked
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }
                `}
                aria-label={isLocked ? 'Unlock board' : 'Lock board'}
              >
                {isLocked ? <Unlock className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> : <Lock className="h-3.5 sm:h-4 w-3.5 sm:w-4" />}
                <span className="hidden sm:inline">{isLocked ? 'Unlock' : 'Lock'}</span>
              </button>

              {anonymousMode && !cardsRevealed && currentPhase === 'write' && (
                <button
                  onClick={handleReveal}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 transition-all"
                  aria-label="Reveal anonymous cards"
                >
                  <Eye className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                  <span className="hidden sm:inline">Reveal Cards</span>
                </button>
              )}
            </div>

            {/* Next Phase Button */}
            {nextPhase && (
              <Button
                onClick={() => handlePhaseClick(nextPhase.key)}
                className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-4"
              >
                <span className="hidden sm:inline">Next Phase: {nextPhase.label}</span>
                <span className="sm:hidden">Next: {nextPhase.label}</span>
                <ChevronRight className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Phase Confirmation Dialog */}
      {showPhaseConfirm && pendingPhase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Change Phase</h3>
            <p className="text-slate-600 mb-4">
              Move from <strong>{PHASES.find((p) => p.key === currentPhase)?.label}</strong> to{' '}
              <strong>{PHASES.find((p) => p.key === pendingPhase)?.label}</strong>?
            </p>
            <p className="text-sm text-slate-500 mb-6">
              This will change the board for all connected participants.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowPhaseConfirm(false);
                  setPendingPhase(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmPhase}>Change Phase</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
