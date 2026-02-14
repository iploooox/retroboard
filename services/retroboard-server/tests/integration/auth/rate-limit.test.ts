import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables } from '../../helpers/db.js';

async function registerUser(email = 'alice@example.com', password = 'SecurePass1', display_name = 'Alice') {
  const res = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name }),
  });
  return res.json();
}

describe('Rate Limiting', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('RL-01: 6th failed login within 15 minutes returns 429', async () => {
    await registerUser();

    // Make 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com', password: 'WrongPass1' }),
      });
    }

    // 6th attempt should be rate limited
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'WrongPass1' }),
    });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.headers.get('Retry-After')).toBeDefined();
  });

  it('RL-04: different emails are tracked independently', async () => {
    await registerUser('alice@example.com');
    await registerUser('bob@example.com', 'SecurePass1', 'Bob');

    // Make 5 failed login attempts for alice
    for (let i = 0; i < 5; i++) {
      await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com', password: 'WrongPass1' }),
      });
    }

    // Bob should still be able to login
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@example.com', password: 'WrongPass1' }),
    });

    // Should be 401 (wrong password), not 429 (rate limited)
    expect(res.status).toBe(401);
  });
});
