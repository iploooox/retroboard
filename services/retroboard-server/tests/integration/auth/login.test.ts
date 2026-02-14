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

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('I-LOG-01: successful login returns 200 with tokens', async () => {
    await registerUser();

    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'SecurePass1' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).toBeDefined();
    expect(body.expires_in).toBe(900);
    expect(body.user).toBeDefined();
  });

  it('I-LOG-02: wrong password returns 401', async () => {
    await registerUser();

    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'WrongPass1' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('I-LOG-03: non-existent email returns 401', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'SomePass1' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('I-LOG-04: same error for wrong email and wrong password', async () => {
    await registerUser();

    const wrongEmailRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'SomePass1' }),
    });

    const wrongPwRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'WrongPass1' }),
    });

    const wrongEmailBody = await wrongEmailRes.json();
    const wrongPwBody = await wrongPwRes.json();

    expect(wrongEmailBody.error.code).toBe(wrongPwBody.error.code);
    expect(wrongEmailBody.error.message).toBe(wrongPwBody.error.message);
  });

  it('I-LOG-05: login returns user profile', async () => {
    await registerUser();

    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'SecurePass1' }),
    });

    const body = await res.json();
    expect(body.user.id).toBeDefined();
    expect(body.user.email).toBe('alice@example.com');
    expect(body.user.display_name).toBe('Alice');
  });

  it('I-LOG-06: each login creates new refresh token', async () => {
    await registerUser();

    await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'SecurePass1' }),
    });

    await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'SecurePass1' }),
    });

    // Register also creates one, so we should have 3 total
    const tokens = await sql`SELECT * FROM refresh_tokens`;
    expect(tokens.length).toBeGreaterThanOrEqual(3);
  });

  it('I-LOG-07: invalid body returns 400', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('I-LOG-08: case-insensitive email login', async () => {
    await registerUser('alice@example.com');

    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Alice@Example.COM', password: 'SecurePass1' }),
    });

    expect(res.status).toBe(200);
  });
});
