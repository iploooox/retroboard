import { AppError } from '../utils/errors.js';

export interface TimerState {
  boardId: string;
  phase: string;
  durationSeconds: number;
  remainingSeconds: number;
  isPaused: boolean;
  startedBy: string;
}

interface ActiveTimer {
  state: TimerState;
  intervalId: ReturnType<typeof setInterval> | null;
}

export interface TimerRepository {
  create(data: {
    board_id: string;
    phase: string;
    duration_seconds: number;
    remaining_seconds: number;
    started_by: string;
  }): Promise<{
    board_id: string;
    phase: string;
    duration_seconds: number;
    remaining_seconds: number;
    started_at: Date;
    paused_at: Date | null;
    started_by: string;
  }>;
  findByBoardId(boardId: string): Promise<Record<string, unknown> | null>;
  update(boardId: string, data: Record<string, unknown>): Promise<unknown>;
  delete(boardId: string): Promise<void>;
}

type BroadcastFn = (boardId: string, event: Record<string, unknown>) => void;

export class TimerService {
  private activeTimers = new Map<string, ActiveTimer>();

  constructor(
    private repo: TimerRepository,
    private broadcast: BroadcastFn,
  ) {}

  async start(boardId: string, phase: string, durationSeconds: number, userId: string): Promise<TimerState> {
    if (durationSeconds < 1 || durationSeconds > 3600) {
      throw new AppError('INVALID_DURATION', 400, 'INVALID_DURATION');
    }

    const existing = await this.repo.findByBoardId(boardId);
    if (existing || this.activeTimers.has(boardId)) {
      throw new AppError('TIMER_CONFLICT', 409, 'TIMER_CONFLICT');
    }

    const row = await this.repo.create({
      board_id: boardId,
      phase,
      duration_seconds: durationSeconds,
      remaining_seconds: durationSeconds,
      started_by: userId,
    });

    const state: TimerState = {
      boardId,
      phase: row.phase,
      durationSeconds: row.duration_seconds,
      remainingSeconds: row.remaining_seconds,
      isPaused: false,
      startedBy: row.started_by,
    };

    const intervalId = setInterval(() => this.tick(boardId), 1000);
    this.activeTimers.set(boardId, { state, intervalId });

    // Broadcast timer_started event
    this.broadcast(boardId, {
      type: 'timer_started',
      payload: {
        phase,
        durationSeconds,
        remainingSeconds: durationSeconds,
        startedBy: userId,
      },
    });

    return { ...state };
  }

  async pause(boardId: string, _userId: string): Promise<TimerState> {
    const active = this.activeTimers.get(boardId);
    if (!active || active.state.isPaused) {
      throw new AppError('TIMER_NOT_RUNNING', 400, 'TIMER_NOT_RUNNING');
    }

    if (active.intervalId) {
      clearInterval(active.intervalId);
      active.intervalId = null;
    }

    active.state.isPaused = true;

    await this.repo.update(boardId, {
      remaining_seconds: active.state.remainingSeconds,
      paused_at: new Date(),
    });

    // Broadcast timer_paused event
    this.broadcast(boardId, {
      type: 'timer_paused',
      payload: {
        remainingSeconds: active.state.remainingSeconds,
      },
    });

    return { ...active.state };
  }

  async resume(boardId: string, _userId: string): Promise<TimerState> {
    const active = this.activeTimers.get(boardId);
    if (!active || !active.state.isPaused) {
      throw new AppError('TIMER_NOT_PAUSED', 400, 'TIMER_NOT_PAUSED');
    }

    active.state.isPaused = false;
    active.intervalId = setInterval(() => this.tick(boardId), 1000);

    await this.repo.update(boardId, {
      paused_at: null,
    });

    return { ...active.state };
  }

  async stop(boardId: string, reason: string): Promise<void> {
    const active = this.activeTimers.get(boardId);
    if (!active) {
      throw new AppError('TIMER_NOT_FOUND', 404, 'TIMER_NOT_FOUND');
    }

    if (active.intervalId) {
      clearInterval(active.intervalId);
    }

    this.activeTimers.delete(boardId);

    // Broadcast before async DB operation so synchronous test assertions see it
    this.broadcast(boardId, { type: 'timer_stopped', reason });

    await this.repo.delete(boardId);
  }

  getState(boardId: string): TimerState | null {
    const active = this.activeTimers.get(boardId);
    return active ? { ...active.state } : null;
  }

  private tick(boardId: string): void {
    const active = this.activeTimers.get(boardId);
    if (!active || active.state.isPaused) return;

    active.state.remainingSeconds--;

    this.broadcast(boardId, {
      type: 'timer_tick',
      remainingSeconds: active.state.remainingSeconds,
    });

    if (active.state.remainingSeconds <= 0) {
      this.stop(boardId, 'expired').catch(() => {});
    }
  }
}
