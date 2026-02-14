import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables } from '../../helpers/db.js';
import { sql } from '../../../src/db/connection.js';
import { hashToken } from '../../../src/utils/token.js';

async function registerUser(email = 'alice@example.com', password = 'SecurePass1', display_name = 'Alice') {
  const res = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name }),
  });
  return res.json();
}

describe('POST /api/v1/auth/logout', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('I-OUT-01: successful logout returns 200', async () => {
    const { access_token, refresh_token } = await registerUser();

    const res = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ refresh_token }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Logged out successfully');
  });

  it('I-OUT-02: refresh token is revoked after logout', async () => {
    const { access_token, refresh_token } = await registerUser();

    await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ refresh_token }),
    });

    const tokenHash = hashToken(refresh_token);
    const [token] = await sql`SELECT * FROM refresh_tokens WHERE token_hash = ${tokenHash}`;
    expect(token.revoked_at).not.toBeNull();
  });

  it('I-OUT-03: revoked token cannot be used to refresh', async () => {
    const { access_token, refresh_token } = await registerUser();

    await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ refresh_token }),
    });

    const refreshRes = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    expect(refreshRes.status).toBe(401);
  });

  it('I-OUT-04: access token still works after logout', async () => {
    const { access_token, refresh_token } = await registerUser();

    await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ refresh_token }),
    });

    const meRes = await app.request('/api/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${access_token}` },
    });

    expect(meRes.status).toBe(200);
  });

  it('I-OUT-05: idempotent - double logout returns 200', async () => {
    const { access_token, refresh_token } = await registerUser();

    await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ refresh_token }),
    });

    const res = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ refresh_token }),
    });

    expect(res.status).toBe(200);
  });

  it('I-OUT-06: unauthenticated logout returns 401', async () => {
    const res = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: 'some-token' }),
    });

    expect(res.status).toBe(401);
  });

  it('I-OUT-07: cannot logout another users token (no-op)', async () => {
    const userA = await registerUser('alice@example.com', 'SecurePass1', 'Alice');
    const userB = await registerUser('bob@example.com', 'SecurePass1', 'Bob');

    // User A tries to logout User B's token
    const res = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.access_token}`,
      },
      body: JSON.stringify({ refresh_token: userB.refresh_token }),
    });

    expect(res.status).toBe(200); // Returns 200 (no-op)

    // Verify User B's token was NOT revoked
    const tokenHash = hashToken(userB.refresh_token);
    const [token] = await sql`SELECT * FROM refresh_tokens WHERE token_hash = ${tokenHash}`;
    expect(token.revoked_at).toBeNull();
  });
});
