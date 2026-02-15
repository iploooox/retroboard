import { api } from './api';
import { BoardPhase } from './board-api';

// Timer API
export interface TimerState {
  boardId: string;
  phase: BoardPhase;
  durationSeconds: number;
  remainingSeconds: number;
  startedAt: string;
  pausedAt: string | null;
  isPaused: boolean;
  startedBy: string;
}

export interface TimerResponse {
  boardId: string;
  timer: TimerState | null;
}

// Facilitation API endpoints
export const facilitationApi = {
  // Phase management
  setPhase: (boardId: string, phase: BoardPhase) =>
    api.put<{
      id: string;
      phase: BoardPhase;
      previousPhase: BoardPhase;
      changedBy: string;
      changedAt: string;
      timerStopped: boolean;
    }>(`/boards/${boardId}/phase`, { phase }),

  // Timer management
  startTimer: (boardId: string, durationSeconds: number, phase?: BoardPhase) =>
    api.post<TimerState>(`/boards/${boardId}/timer`, {
      durationSeconds,
      ...(phase && { phase }),
    }),

  pauseTimer: (boardId: string) =>
    api.put<TimerState>(`/boards/${boardId}/timer`, { action: 'pause' }),

  resumeTimer: (boardId: string) =>
    api.put<TimerState>(`/boards/${boardId}/timer`, { action: 'resume' }),

  stopTimer: (boardId: string) =>
    api.delete<{
      boardId: string;
      stoppedAt: string;
      reason: string;
      remainingSeconds: number;
    }>(`/boards/${boardId}/timer`),

  getTimer: (boardId: string) =>
    api.get<TimerResponse>(`/boards/${boardId}/timer`),

  // Board control
  lockBoard: (boardId: string, isLocked: boolean) =>
    api.put<{
      id: string;
      isLocked: boolean;
      lockedBy?: string;
      lockedAt?: string;
      unlockedBy?: string;
      unlockedAt?: string;
    }>(`/boards/${boardId}/lock`, { isLocked }),

  revealCards: (boardId: string) =>
    api.put<{
      id: string;
      cardsRevealed: boolean;
      revealedBy: string;
      revealedAt: string;
      revealedCards: Array<{
        cardId: string;
        authorId: string;
        authorName: string;
      }>;
    }>(`/boards/${boardId}/reveal`, {}),

  setFocus: (boardId: string, focusType: 'card' | 'group' | null, focusId: string | null) =>
    api.put<{
      id: string;
      focusType: 'card' | 'group' | null;
      focusId: string | null;
      focusTitle: string | null;
      focusVoteCount: number | null;
      changedBy: string;
      changedAt: string;
    }>(`/boards/${boardId}/focus`, { focusType, focusId }),
};
