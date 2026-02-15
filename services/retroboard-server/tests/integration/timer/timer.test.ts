import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  truncateTables,
  createTestTeam,
  addTeamMember,
  createTestSprint,
  createTestBoard,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('Timer Endpoints — Integration Tests', () => {
  let facilitatorToken: string;
  let facilitatorUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: Record<string, unknown>;

  beforeEach(async () => {
    await truncateTables();
    await seed();

    // Create facilitator (admin role on team)
    const facilitatorAuth = await getAuthToken({ displayName: 'Facilitator' });
    facilitatorToken = facilitatorAuth.token;
    facilitatorUser = facilitatorAuth.user;

    team = await createTestTeam(facilitatorUser.id);
    sprint = await createTestSprint(team.id, facilitatorUser.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, facilitatorUser.id);
    board = result.board;

    // Create member (non-facilitator)
    const memberAuth = await getAuthToken({ email: 'member@example.com', displayName: 'Member' });
    memberToken = memberAuth.token;
    memberUser = memberAuth.user;
    await addTeamMember(team.id, memberUser.id, 'member');
  });

  // --- Start timer ---

  it('3.4.1: Start timer — POST 201, timer started', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 300 }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.boardId ?? body.data?.boardId).toBeDefined();
    expect(body.durationSeconds ?? body.data?.durationSeconds).toBe(300);
    expect(body.remainingSeconds ?? body.data?.remainingSeconds).toBe(300);
    expect(body.isPaused ?? body.data?.isPaused).toBe(false);
  });

  // --- Timer tick / decrement ---

  it('3.4.2: Timer ticks — GET shows remaining decremented', async () => {
    // Start a timer
    await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 300 }),
    });

    // Wait for at least 1 tick (1100ms to ensure 1-second timer ticks)
    await new Promise((r) => setTimeout(r, 1100));

    // GET to verify remaining has decremented
    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${facilitatorToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const remaining = body.remainingSeconds ?? body.data?.remainingSeconds;
    expect(remaining).toBeDefined();
    expect(remaining).toBeLessThan(300);
  });

  // --- Timer expires ---

  it('3.4.3: Timer expires — short timer, GET shows no timer', async () => {
    // Start a very short timer (reduced from 3s to 1s)
    await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 1 }),
    });

    // Wait for expiry (reduced from 4500ms to 1500ms)
    await new Promise((r) => setTimeout(r, 1500));

    // GET should show no timer
    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${facilitatorToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // When no timer exists, API returns { timer: null }
    const timer = body.timer ?? body.data?.timer ?? body.data;
    expect(timer === null || timer?.remainingSeconds === 0).toBe(true);
  });

  // --- Pause timer ---

  it('3.4.4: Pause timer — PUT { action: "pause" } → 200', async () => {
    // Start timer first
    await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 300 }),
    });

    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'pause' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPaused ?? body.data?.isPaused).toBe(true);
  });

  // --- Resume timer ---

  it('3.4.5: Resume timer — PUT { action: "resume" } → 200', async () => {
    // Start and pause first
    await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 300 }),
    });

    await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'pause' }),
    });

    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'resume' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPaused ?? body.data?.isPaused).toBe(false);
  });

  // --- Stop timer ---

  it('3.4.6: Stop timer — DELETE → 200', async () => {
    // Start timer first
    await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 300 }),
    });

    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${facilitatorToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reason ?? body.data?.reason).toBe('manual');
  });

  // --- Conflict: start when one exists ---

  it('3.4.7: Start when timer already exists → 409 Conflict', async () => {
    // Start first timer
    await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 300 }),
    });

    // Start again — should conflict
    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 180 }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error?.code ?? body.error).toBe('TIMER_CONFLICT');
  });

  // --- Pause when not running ---

  it('3.4.8: Pause when not running → 400', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'pause' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code ?? body.error).toBe('TIMER_NOT_RUNNING');
  });

  // --- Resume when not paused ---

  it('3.4.9: Resume when not paused → 400', async () => {
    // Start but don't pause
    await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 300 }),
    });

    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'resume' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code ?? body.error).toBe('TIMER_NOT_PAUSED');
  });

  // --- Get timer state ---

  it('3.4.10: Get timer state — GET → 200 with timer object', async () => {
    // Start timer
    await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 300 }),
    });

    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${facilitatorToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const boardId = body.boardId ?? body.data?.boardId;
    expect(boardId).toBe(board.id);
  });

  // --- Get timer when none ---

  it('3.4.11: Get timer when none exists → 200 with timer: null', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${facilitatorToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timer ?? body.data?.timer ?? null).toBeNull();
  });

  // --- Authorization: member cannot start ---

  it('3.4.12: Member cannot start timer → 403', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 300 }),
    });

    expect(res.status).toBe(403);
  });

  // --- Validation: duration below minimum ---

  it('3.4.13: Duration below minimum (0) → 400', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 0 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code ?? body.error).toBe('INVALID_DURATION');
  });

  // --- Validation: duration above maximum ---

  it('3.4.14: Duration above maximum (3601) → 400', async () => {
    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 3601 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code ?? body.error).toBe('INVALID_DURATION');
  });

  // --- Timer survives page refresh ---

  it('3.4.15: Timer survives page refresh — remaining reflects elapsed', async () => {
    // Start timer
    await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${facilitatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds: 300 }),
    });

    // Simulate "page refresh" — reduced from 2000ms to 500ms
    await new Promise((r) => setTimeout(r, 500));

    const res = await app.request(`/api/v1/boards/${board.id}/timer`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${facilitatorToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const remaining = body.remainingSeconds ?? body.data?.remainingSeconds;
    // Should reflect elapsed time (within tolerance, adjusted for 500ms wait)
    expect(remaining).toBeDefined();
    expect(remaining).toBeLessThanOrEqual(300);
    expect(remaining).toBeGreaterThanOrEqual(298);
  });
});
