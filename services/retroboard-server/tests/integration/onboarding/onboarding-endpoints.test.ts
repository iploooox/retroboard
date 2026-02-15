import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../../../src/db/connection.js';
import { createTestApp } from '../../helpers/test-app.js';
import { truncateTables } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('S-029: Onboarding Endpoints', () => {
  let userToken: string;
  let userId: string;

  beforeEach(async () => {
    await truncateTables();
    await seed();

    const auth = await getAuthToken({ displayName: 'Test User' });
    userToken = auth.token;
    userId = auth.user.id;
  });

  it('9.1: GET /api/v1/users/me/onboarding returns 200 with initial state', async () => {
    const res = await app.request('/api/v1/users/me/onboarding', {
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.currentStep).toBeDefined();
    expect(body.data.completedSteps).toBeDefined();
    expect(body.data.skippedSteps).toBeDefined();
    expect(Array.isArray(body.data.completedSteps)).toBe(true);
    expect(Array.isArray(body.data.skippedSteps)).toBe(true);
  });

  it('9.2: PATCH /api/v1/users/me/onboarding complete a step returns 200', async () => {
    const res = await app.request('/api/v1/users/me/onboarding', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        step: 'welcome',
        action: 'complete',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.completedSteps).toContain('welcome');
  });

  it('9.3: GET after completing step shows step as completed', async () => {
    await app.request('/api/v1/users/me/onboarding', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        step: 'create_team',
        action: 'complete',
      }),
    });

    const res = await app.request('/api/v1/users/me/onboarding', {
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
    });

    const body = await res.json();
    expect(body.data.completedSteps).toContain('create_team');
  });

  it('9.4: PATCH with skip action marks step as skipped', async () => {
    const res = await app.request('/api/v1/users/me/onboarding', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        step: 'invite_members',
        action: 'skip',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.skippedSteps).toContain('invite_members');
  });

  it('9.5: POST /api/v1/users/me/onboarding/complete sets onboarding_completed_at', async () => {
    const res = await app.request('/api/v1/users/me/onboarding/complete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Check database
    const [user] = await sql`
      SELECT onboarding_completed_at FROM users WHERE id = ${userId}
    `;
    expect(user.onboarding_completed_at).not.toBeNull();
  });

  it('9.6: GET after complete returns null (onboarding done)', async () => {
    await app.request('/api/v1/users/me/onboarding/complete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });

    const res = await app.request('/api/v1/users/me/onboarding', {
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
    });

    const body = await res.json();
    expect(body.data).toBeNull();
  });

  it('9.7: POST /api/v1/users/me/onboarding/reset resets onboarding', async () => {
    // Complete onboarding first
    await app.request('/api/v1/users/me/onboarding/complete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Reset
    const res = await app.request('/api/v1/users/me/onboarding/reset', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(res.status).toBe(200);

    // Check database
    const [user] = await sql`
      SELECT onboarding_completed_at FROM users WHERE id = ${userId}
    `;
    expect(user.onboarding_completed_at).toBeNull();
  });

  it('9.8: GET after reset returns initial state again', async () => {
    // Complete onboarding
    await app.request('/api/v1/users/me/onboarding/complete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Reset
    await app.request('/api/v1/users/me/onboarding/reset', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Get onboarding state
    const res = await app.request('/api/v1/users/me/onboarding', {
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
    });

    const body = await res.json();
    expect(body.data).not.toBeNull();
    expect(body.data.currentStep).toBeDefined();
  });

  it('9.9: No auth returns 401', async () => {
    const res = await app.request('/api/v1/users/me/onboarding');

    expect(res.status).toBe(401);
  });

  it('9.10: Invalid step name returns 400', async () => {
    const res = await app.request('/api/v1/users/me/onboarding', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        step: 'invalid_step_name',
        action: 'complete',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('9.11: Valid step names include welcome, create_team, invite_members, create_sprint, start_retro', async () => {
    const validSteps = ['welcome', 'create_team', 'invite_members', 'create_sprint', 'start_retro'];

    for (const step of validSteps) {
      const res = await app.request('/api/v1/users/me/onboarding', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          step,
          action: 'complete',
        }),
      });

      expect(res.status).toBe(200);
    }
  });

  it('9.12: Onboarding data persisted in JSONB column', async () => {
    await app.request('/api/v1/users/me/onboarding', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        step: 'welcome',
        action: 'complete',
      }),
    });

    const [user] = await sql`
      SELECT onboarding_data FROM users WHERE id = ${userId}
    `;

    expect(user.onboarding_data).toBeDefined();
    expect(typeof user.onboarding_data).toBe('object');
    expect(user.onboarding_data.completedSteps).toContain('welcome');
  });
});
