import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerService } from '../../../src/services/timer-service.js';

// Mock timer repository (DB layer)
function createMockRepository() {
  return {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByBoardId: vi.fn(),
  };
}

describe('TimerService — Unit Tests', () => {
  let timerService: InstanceType<typeof TimerService>;
  let mockRepo: ReturnType<typeof createMockRepository>;
  let mockBroadcast: ReturnType<typeof vi.fn>;

  const boardId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    vi.useFakeTimers();
    mockRepo = createMockRepository();
    mockBroadcast = vi.fn();
    timerService = new TimerService(mockRepo, mockBroadcast);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Start ---

  it('3.3.1: Start timer — timer created, interval started', async () => {
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });

    const state = await timerService.start(boardId, 'write', 300, userId);

    expect(state).toBeDefined();
    expect(state.boardId).toBe(boardId);
    expect(state.durationSeconds).toBe(300);
    expect(state.remainingSeconds).toBe(300);
    expect(state.isPaused).toBe(false);
    expect(mockRepo.create).toHaveBeenCalled();
  });

  it('3.3.2: Start with min duration (1s) — created', async () => {
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 1,
      remaining_seconds: 1,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });

    const state = await timerService.start(boardId, 'write', 1, userId);

    expect(state).toBeDefined();
    expect(state.durationSeconds).toBe(1);
    expect(state.remainingSeconds).toBe(1);
  });

  it('3.3.3: Start with max duration (3600s) — created', async () => {
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 3600,
      remaining_seconds: 3600,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });

    const state = await timerService.start(boardId, 'write', 3600, userId);

    expect(state).toBeDefined();
    expect(state.durationSeconds).toBe(3600);
  });

  it('3.3.4: Start with 0 duration — INVALID_DURATION error', async () => {
    await expect(
      timerService.start(boardId, 'write', 0, userId),
    ).rejects.toThrow(/INVALID_DURATION/);
  });

  it('3.3.5: Start with negative duration — INVALID_DURATION error', async () => {
    await expect(
      timerService.start(boardId, 'write', -1, userId),
    ).rejects.toThrow(/INVALID_DURATION/);
  });

  it('3.3.6: Start with duration > 3600 — INVALID_DURATION error', async () => {
    await expect(
      timerService.start(boardId, 'write', 3601, userId),
    ).rejects.toThrow(/INVALID_DURATION/);
  });

  it('3.3.7: Start when timer already running — TIMER_CONFLICT error', async () => {
    mockRepo.findByBoardId.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 250,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });

    await expect(
      timerService.start(boardId, 'write', 300, userId),
    ).rejects.toThrow(/TIMER_CONFLICT/);
  });

  // --- Pause ---

  it('3.3.8: Pause running timer — paused_at set, remaining calculated', async () => {
    // Start a timer first so it's running in the service
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });
    await timerService.start(boardId, 'write', 300, userId);

    mockRepo.update.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      started_at: new Date(),
      paused_at: new Date(),
      started_by: userId,
    });

    const state = await timerService.pause(boardId, userId);

    expect(state).toBeDefined();
    expect(state.isPaused).toBe(true);
    expect(mockRepo.update).toHaveBeenCalled();
  });

  it('3.3.9: Pause when no timer — TIMER_NOT_RUNNING error', async () => {
    await expect(
      timerService.pause(boardId, userId),
    ).rejects.toThrow(/TIMER_NOT_RUNNING/);
  });

  it('3.3.10: Pause already paused timer — TIMER_NOT_RUNNING error', async () => {
    // Start then pause
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });
    await timerService.start(boardId, 'write', 300, userId);

    mockRepo.update.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      paused_at: new Date(),
      started_by: userId,
    });
    await timerService.pause(boardId, userId);

    // Pause again — should fail because already paused
    await expect(
      timerService.pause(boardId, userId),
    ).rejects.toThrow(/TIMER_NOT_RUNNING/);
  });

  // --- Resume ---

  it('3.3.11: Resume paused timer — paused_at cleared, interval restarted', async () => {
    // Start and pause
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });
    await timerService.start(boardId, 'write', 300, userId);

    mockRepo.update.mockResolvedValueOnce({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      paused_at: new Date(),
      started_by: userId,
    });
    await timerService.pause(boardId, userId);

    // Resume
    mockRepo.update.mockResolvedValueOnce({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      paused_at: null,
      started_by: userId,
    });

    const state = await timerService.resume(boardId, userId);

    expect(state).toBeDefined();
    expect(state.isPaused).toBe(false);
  });

  it('3.3.12: Resume when not paused — TIMER_NOT_PAUSED error', async () => {
    // Start without pausing
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });
    await timerService.start(boardId, 'write', 300, userId);

    await expect(
      timerService.resume(boardId, userId),
    ).rejects.toThrow(/TIMER_NOT_PAUSED/);
  });

  it('3.3.13: Resume when no timer exists — TIMER_NOT_PAUSED error', async () => {
    await expect(
      timerService.resume(boardId, userId),
    ).rejects.toThrow(/TIMER_NOT_PAUSED/);
  });

  // --- Stop ---

  it('3.3.14: Stop running timer — timer deleted, interval cleared', async () => {
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });
    await timerService.start(boardId, 'write', 300, userId);

    mockRepo.delete.mockResolvedValue(undefined);

    await timerService.stop(boardId, 'manual');

    expect(mockRepo.delete).toHaveBeenCalledWith(boardId);
    // getState should return null after stop
    const state = timerService.getState(boardId);
    expect(state).toBeNull();
  });

  it('3.3.15: Stop paused timer — timer deleted', async () => {
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });
    await timerService.start(boardId, 'write', 300, userId);

    mockRepo.update.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      paused_at: new Date(),
      started_by: userId,
    });
    await timerService.pause(boardId, userId);

    mockRepo.delete.mockResolvedValue(undefined);
    await timerService.stop(boardId, 'manual');

    expect(mockRepo.delete).toHaveBeenCalledWith(boardId);
  });

  it('3.3.16: Stop when no timer exists — TIMER_NOT_FOUND error', async () => {
    await expect(
      timerService.stop(boardId, 'manual'),
    ).rejects.toThrow(/TIMER_NOT_FOUND/);
  });

  // --- Tick ---

  it('3.3.17: Timer tick decrements remaining — 300 → 299', async () => {
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });
    await timerService.start(boardId, 'write', 300, userId);

    // Advance by 1 second to trigger a tick
    vi.advanceTimersByTime(1000);

    const state = timerService.getState(boardId);
    expect(state).toBeDefined();
    expect(state!.remainingSeconds).toBe(299);
    expect(mockBroadcast).toHaveBeenCalledWith(
      boardId,
      expect.objectContaining({ type: 'timer_tick', remainingSeconds: 299 }),
    );
  });

  it('3.3.18: Timer reaches zero — remaining=0, auto-stop, reason="expired"', async () => {
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 3,
      remaining_seconds: 3,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });
    mockRepo.delete.mockResolvedValue(undefined);

    await timerService.start(boardId, 'write', 3, userId);

    // Advance 3 seconds to reach zero
    vi.advanceTimersByTime(3000);

    // Timer should have auto-stopped
    const state = timerService.getState(boardId);
    expect(state).toBeNull();
    expect(mockBroadcast).toHaveBeenCalledWith(
      boardId,
      expect.objectContaining({ type: 'timer_stopped', reason: 'expired' }),
    );
  });

  it('3.3.19: Timer reaches zero triggers auto-stop — interval cleared, no more ticks', async () => {
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 2,
      remaining_seconds: 2,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });
    mockRepo.delete.mockResolvedValue(undefined);

    await timerService.start(boardId, 'write', 2, userId);

    // Expire the timer
    vi.advanceTimersByTime(2000);

    // Record current call count, then advance further
    mockBroadcast.mockClear();
    vi.advanceTimersByTime(5000);

    // No further timer_tick broadcasts after expiry
    const tickCalls = mockBroadcast.mock.calls.filter(
      (call: any[]) => call[1]?.type === 'timer_tick',
    );
    expect(tickCalls).toHaveLength(0);
  });

  // --- getState ---

  it('3.3.20: getState returns current timer — TimerState object', async () => {
    mockRepo.findByBoardId.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      board_id: boardId,
      phase: 'write',
      duration_seconds: 300,
      remaining_seconds: 300,
      started_at: new Date(),
      paused_at: null,
      started_by: userId,
    });

    await timerService.start(boardId, 'write', 300, userId);

    const state = timerService.getState(boardId);
    expect(state).toBeDefined();
    expect(state).toEqual(
      expect.objectContaining({
        boardId,
        phase: 'write',
        durationSeconds: 300,
        remainingSeconds: 300,
        isPaused: false,
      }),
    );
  });

  it('3.3.21: getState returns null when no timer', () => {
    const state = timerService.getState(boardId);
    expect(state).toBeNull();
  });
});
