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

describe('POST /api/v1/auth/refresh', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('I-REF-01: successful refresh returns 200 with new token pair', async () => {
    const { refresh_token } = await registerUser();

    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).toBeDefined();
    expect(body.expires_in).toBe(900);
    expect(body.refresh_token).not.toBe(refresh_token);
  });

  it('I-REF-02: old refresh token is revoked after use', async () => {
    const { refresh_token } = await registerUser();
    const oldHash = hashToken(refresh_token);

    await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    const [token] = await sql`SELECT * FROM refresh_tokens WHERE token_hash = ${oldHash}`;
    expect(token.revoked_at).not.toBeNull();
  });

  it('I-REF-03: new refresh token is stored', async () => {
    const { refresh_token } = await registerUser();

    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    const body = await res.json();
    const newHash = hashToken(body.refresh_token);
    const [token] = await sql`SELECT * FROM refresh_tokens WHERE token_hash = ${newHash}`;
    expect(token).toBeDefined();
    expect(token.revoked_at).toBeNull();
  });

  it('I-REF-04: new access token works for authenticated endpoints', async () => {
    const { refresh_token } = await registerUser();

    const refreshRes = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    const { access_token } = await refreshRes.json();

    const meRes = await app.request('/api/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${access_token}` },
    });

    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.email).toBe('alice@example.com');
  });

  it('I-REF-05: old refresh token cannot be reused', async () => {
    const { refresh_token } = await registerUser();

    // Use the token once
    await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    // Try to reuse
    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_REFRESH_TOKEN_INVALID');
  });

  it('I-REF-06: reuse of revoked token revokes ALL user tokens (theft detection)', async () => {
    const { refresh_token, user } = await registerUser();

    // Create a second session
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'SecurePass1' }),
    });
    const loginBody = await loginRes.json();

    // Refresh once (rotates the token)
    const refreshRes = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });
    expect(refreshRes.status).toBe(200);

    // Reuse old revoked token (triggers theft detection)
    const theftRes = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });
    expect(theftRes.status).toBe(401);

    // ALL tokens for this user should be revoked
    const tokens = await sql`SELECT * FROM refresh_tokens WHERE user_id = ${user.id} AND revoked_at IS NULL`;
    expect(tokens.length).toBe(0);
  });

  it('I-REF-07: expired refresh token returns 401', async () => {
    const { user } = await registerUser();

    // Create a token with past expiry directly in DB
    const { createHash, randomBytes } = await import('node:crypto');
    const rawToken = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await sql`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${new Date(Date.now() - 1000)})
    `;

    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rawToken }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_REFRESH_TOKEN_EXPIRED');
  });

  it('I-REF-08: unknown refresh token returns 401', async () => {
    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: 'completely-random-fake-token' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_REFRESH_TOKEN_INVALID');
  });

  it('I-REF-09: missing refresh_token field returns 400', async () => {
    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('I-REF-10: new tokens have correct expiry (exp - iat === 900)', async () => {
    const { refresh_token } = await registerUser();

    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    const body = await res.json();
    const payloadPart = body.access_token.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());
    expect(payload.exp - payload.iat).toBe(900);
  });
});
