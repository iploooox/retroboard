import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables } from '../../helpers/db.js';
import { sql } from '../../../src/db/connection.js';

async function registerUser(email = 'alice@example.com', password = 'SecurePass1', display_name = 'Alice') {
  const res = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name }),
  });
  return res.json();
}

async function loginUser(email = 'alice@example.com', password = 'SecurePass1') {
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

describe('POST /api/v1/auth/revoke-all', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('E-SEC-14: revoke all sessions invalidates all refresh tokens', async () => {
    const { access_token, user } = await registerUser();

    // Create additional sessions
    await loginUser();
    await loginUser();

    const res = await app.request('/api/v1/auth/revoke-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('All sessions revoked');

    // All tokens should be revoked
    const activeTokens = await sql`
      SELECT * FROM refresh_tokens
      WHERE user_id = ${user.id} AND revoked_at IS NULL
    `;
    expect(activeTokens.length).toBe(0);
  });

  it('unauthenticated revoke-all returns 401', async () => {
    const res = await app.request('/api/v1/auth/revoke-all', {
      method: 'POST',
    });

    expect(res.status).toBe(401);
  });

  it('access token still works after revoke-all (stateless)', async () => {
    const { access_token } = await registerUser();

    await app.request('/api/v1/auth/revoke-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const meRes = await app.request('/api/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${access_token}` },
    });

    expect(meRes.status).toBe(200);
  });

  it('refresh tokens fail after revoke-all', async () => {
    const { access_token, refresh_token } = await registerUser();

    await app.request('/api/v1/auth/revoke-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const refreshRes = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    expect(refreshRes.status).toBe(401);
  });
});
