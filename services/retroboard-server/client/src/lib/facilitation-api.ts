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
      ok: true;
      data: {
        phase: BoardPhase;
        previous_phase: BoardPhase;
        timerStopped: boolean;
      };
    }>(`/boards/${boardId}/phase`, { phase }).then(r => r.data),

  // Timer management
  startTimer: (boardId: string, durationSeconds: number, phase?: BoardPhase) =>
    api.post<TimerState>(`/boards/${boardId}/timer/start`, {
      durationSeconds,
      ...(phase && { phase }),
    }),

  pauseTimer: (boardId: string) =>
    api.post<TimerState>(`/boards/${boardId}/timer/pause`, {}),

  resumeTimer: (boardId: string) =>
    api.post<TimerState>(`/boards/${boardId}/timer/resume`, {}),

  stopTimer: (boardId: string) =>
    api.post<{
      reason: string;
    }>(`/boards/${boardId}/timer/reset`, {}),

  getTimer: (boardId: string) =>
    api.get<TimerState | { data: null }>(`/boards/${boardId}/timer`),

  // Board control
  lockBoard: (boardId: string, isLocked: boolean) =>
    api.put<{
      ok: true;
      data: {
        id: string;
        is_locked: boolean;
      };
    }>(`/boards/${boardId}/lock`, { isLocked }).then(r => r.data),

  revealCards: (boardId: string) =>
    api.put<{
      ok: true;
      data: {
        cards_revealed: boolean;
        revealedCards: Array<{
          cardId: string;
          authorId: string;
          authorName: string;
        }>;
      };
    }>(`/boards/${boardId}/reveal`, {}).then(r => r.data),

  setFocus: (boardId: string, focusType: 'card' | 'group' | null, focusId: string | null) =>
    api.put<{
      ok: true;
      data: {
        id: string;
        focus_item_id: string | null;
        focus_item_type: 'card' | 'group' | null;
        updated_at: string;
      };
    }>(`/boards/${boardId}/focus`, { focus_item_type: focusType, focus_item_id: focusId }).then(r => r.data),
};
