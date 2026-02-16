import { useState, useEffect, useRef, useCallback } from 'react';
import type { BoardPhase } from '@/lib/board-api';
import { Play, Pause, RotateCcw, Lock, Unlock, Eye, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { facilitationApi } from '@/lib/facilitation-api';
import { api } from '@/lib/api';
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
  teamId: string;
  sprintId: string;
  currentPhase: BoardPhase;
  isLocked?: boolean;
  cardsRevealed?: boolean;
  anonymousMode?: boolean;
  onPhaseChange: (phase: BoardPhase) => void;
  onLockToggle: (locked: boolean) => void;
  onRevealCards: () => void;
  onBoardCompleted?: () => void;
}

export function FacilitatorToolbar({
  boardId,
  teamId,
  sprintId,
  currentPhase,
  isLocked = false,
  cardsRevealed = false,
  anonymousMode = false,
  onPhaseChange,
  onLockToggle,
  onRevealCards,
  onBoardCompleted,
}: FacilitatorToolbarProps) {
  const [timerDuration] = useState(300); // 5 minutes default
  const [timerRemaining, setTimerRemaining] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [isStartingTimer, setIsStartingTimer] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef<number>(0);
  const timerInitialRef = useRef<number>(300);

  // Clear interval helper
  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Client-side countdown using Date.now() arithmetic for accuracy
  useEffect(() => {
    if (!timerRunning || timerPaused) {
      clearTimerInterval();
      return;
    }

    timerStartRef.current = Date.now();
    timerInitialRef.current = timerRemaining;

    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
      const newRemaining = Math.max(0, timerInitialRef.current - elapsed);
      setTimerRemaining(newRemaining);

      if (newRemaining <= 0) {
        clearTimerInterval();
        setTimerRunning(false);
      }
    }, 100);

    return clearTimerInterval;
  }, [timerRunning, timerPaused, clearTimerInterval]);

  const currentPhaseIndex = PHASES.findIndex((p) => p.key === currentPhase);
  const nextPhase = currentPhaseIndex < PHASES.length - 1 ? PHASES[currentPhaseIndex + 1] : null;

  const handleStartTimer = async () => {
    setIsStartingTimer(true);
    // Start countdown optimistically so the UI updates immediately
    setTimerRunning(true);
    setTimerPaused(false);
    setTimerRemaining(timerDuration);
    try {
      await facilitationApi.startTimer(boardId, timerDuration);
      toast.success('Timer started');
    } catch {
      // Revert on failure
      setTimerRunning(false);
      setTimerPaused(false);
      setTimerRemaining(timerDuration);
      toast.error('Failed to start timer');
    } finally {
      setIsStartingTimer(false);
    }
  };

  const handlePauseTimer = async () => {
    // Pause immediately for responsive UI
    clearTimerInterval();
    setTimerPaused(true);
    setTimerRunning(false);
    try {
      await facilitationApi.pauseTimer(boardId);
      toast.success('Timer paused');
    } catch {
      // Revert: resume the timer
      setTimerPaused(false);
      setTimerRunning(true);
      toast.error('Failed to pause timer');
    }
  };

  const handleResumeTimer = async () => {
    // Resume immediately for responsive UI
    setTimerPaused(false);
    setTimerRunning(true);
    try {
      await facilitationApi.resumeTimer(boardId);
      toast.success('Timer resumed');
    } catch {
      // Revert: pause again
      setTimerPaused(true);
      setTimerRunning(false);
      toast.error('Failed to resume timer');
    }
  };

  const handleResetTimer = async () => {
    clearTimerInterval();
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

  const handleDirectPhaseAdvance = async (phase: BoardPhase) => {
    // Optimistic update — show new phase immediately before API completes
    onPhaseChange(phase);
    try {
      await facilitationApi.setPhase(boardId, phase);
    } catch {
      onPhaseChange(currentPhase); // Revert on failure
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

  const handleCompleteRetro = async () => {
    try {
      await api.put(`/teams/${teamId}/sprints/${sprintId}/complete`, {});
      toast.success('Retro completed');
      onBoardCompleted?.();
    } catch {
      toast.error('Failed to complete retro');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6">
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
                onClick={() => handleDirectPhaseAdvance(nextPhase.key)}
                className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-4"
                title={`Advance to ${nextPhase.label} phase`}
              >
                <span>Next phase</span>
                <ChevronRight className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
              </Button>
            )}

            {/* Complete Retro Button (action phase only) */}
            {!nextPhase && currentPhase === 'action' && (
              <Button
                onClick={handleCompleteRetro}
                className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-4"
              >
                <CheckCircle className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                <span>Complete Retro</span>
              </Button>
            )}
          </div>
        </div>
    </div>
  );
}
