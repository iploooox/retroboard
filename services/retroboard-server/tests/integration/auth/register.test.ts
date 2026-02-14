import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables } from '../../helpers/db.js';
import { sql } from '../../../src/db/connection.js';

describe('POST /api/v1/auth/register', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('I-REG-01: successful registration returns 201 with user, tokens', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'SecurePass1',
        display_name: 'Alice Johnson',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe('alice@example.com');
    expect(body.user.display_name).toBe('Alice Johnson');
    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).toBeDefined();
    expect(body.expires_in).toBe(900);
  });

  it('I-REG-02: returns valid JWT with correct sub and email', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'SecurePass1',
        display_name: 'Alice',
      }),
    });

    const body = await res.json();
    // Decode JWT payload (base64url)
    const payloadPart = body.access_token.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());
    expect(payload.sub).toBe(body.user.id);
    expect(payload.email).toBe('alice@example.com');
    expect(payload.exp).toBeDefined();
  });

  it('I-REG-03: password is hashed in DB (not raw)', async () => {
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'SecurePass1',
        display_name: 'Alice',
      }),
    });

    const [user] = await sql`SELECT password_hash FROM users WHERE email = 'alice@example.com'`;
    expect(user.password_hash).toMatch(/^\$2a\$12\$/);
    expect(user.password_hash).not.toBe('SecurePass1');
  });

  it('I-REG-04: refresh token stored as SHA-256 hash in DB', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'SecurePass1',
        display_name: 'Alice',
      }),
    });

    const body = await res.json();
    const [token] = await sql`SELECT token_hash FROM refresh_tokens`;
    expect(token.token_hash).toHaveLength(64);
    expect(token.token_hash).not.toBe(body.refresh_token);
  });

  it('I-REG-05: duplicate email returns 409', async () => {
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'SecurePass1',
        display_name: 'Alice',
      }),
    });

    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'SecurePass1',
        display_name: 'Alice Again',
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_EMAIL_EXISTS');
  });

  it('I-REG-06: case-insensitive email duplicate returns 409', async () => {
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'Alice@Example.com',
        password: 'SecurePass1',
        display_name: 'Alice',
      }),
    });

    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'SecurePass1',
        display_name: 'Alice 2',
      }),
    });

    expect(res.status).toBe(409);
  });

  it('I-REG-07: invalid body returns 400 with VALIDATION_ERROR', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-valid' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('I-REG-08: empty body returns 400', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('I-REG-09: email stored lowercase', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'Bob@EXAMPLE.com',
        password: 'SecurePass1',
        display_name: 'Bob',
      }),
    });

    expect(res.status).toBe(201);
    const [user] = await sql`SELECT email FROM users`;
    expect(user.email).toBe('bob@example.com');
  });

  it('I-REG-10: returned user has no password_hash', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'SecurePass1',
        display_name: 'Alice',
      }),
    });

    const body = await res.json();
    expect(body.user.password_hash).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('password_hash');
  });
});
