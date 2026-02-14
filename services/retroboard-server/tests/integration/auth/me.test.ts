import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables } from '../../helpers/db.js';
import { signAccessToken } from '../../../src/utils/jwt.js';
import { SignJWT } from 'jose';

async function registerUser(email = 'alice@example.com', password = 'SecurePass1', display_name = 'Alice') {
  const res = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name }),
  });
  return res.json();
}

describe('GET /api/v1/auth/me', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('I-PRF-01: get own profile returns 200 with all user fields', async () => {
    const { access_token } = await registerUser();

    const res = await app.request('/api/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${access_token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBeDefined();
    expect(body.user.email).toBe('alice@example.com');
    expect(body.user.display_name).toBe('Alice');
    expect(body.user.created_at).toBeDefined();
    expect(body.user.updated_at).toBeDefined();
  });

  it('I-PRF-02: profile excludes password_hash', async () => {
    const { access_token } = await registerUser();

    const res = await app.request('/api/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const body = await res.json();
    expect(body.user.password_hash).toBeUndefined();
  });

  it('I-PRF-11: unauthenticated GET /me returns 401', async () => {
    const res = await app.request('/api/v1/auth/me', {
      method: 'GET',
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('I-MW-03: malformed Authorization header returns 401', async () => {
    const res = await app.request('/api/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: 'NotBearer xyz' },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('I-MW-05: expired access token returns 401', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret-must-be-at-least-32-characters-long');
    const token = await new SignJWT({ email: 'test@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('some-id')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(secret);

    const res = await app.request('/api/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('I-MW-06: token signed with wrong secret returns 401', async () => {
    const wrongSecret = new TextEncoder().encode('wrong-secret-that-is-at-least-32-characters!');
    const token = await new SignJWT({ email: 'test@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('some-id')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(wrongSecret);

    const res = await app.request('/api/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_TOKEN_INVALID');
  });
});

describe('PUT /api/v1/auth/me', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('I-PRF-03: update display_name', async () => {
    const { access_token } = await registerUser();

    const res = await app.request('/api/v1/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ display_name: 'New Name' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.display_name).toBe('New Name');
  });

  it('I-PRF-04: update avatar_url', async () => {
    const { access_token } = await registerUser();

    const res = await app.request('/api/v1/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ avatar_url: 'https://example.com/avatar.jpg' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.avatar_url).toBe('https://example.com/avatar.jpg');
  });

  it('I-PRF-05: clear avatar_url with null', async () => {
    const { access_token } = await registerUser();

    // Set avatar first
    await app.request('/api/v1/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ avatar_url: 'https://example.com/avatar.jpg' }),
    });

    // Clear it
    const res = await app.request('/api/v1/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ avatar_url: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.avatar_url).toBeNull();
  });

  it('I-PRF-06: update both fields', async () => {
    const { access_token } = await registerUser();

    const res = await app.request('/api/v1/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        display_name: 'Updated Name',
        avatar_url: 'https://example.com/new.jpg',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.display_name).toBe('Updated Name');
    expect(body.user.avatar_url).toBe('https://example.com/new.jpg');
  });

  it('I-PRF-07: empty update body returns 400', async () => {
    const { access_token } = await registerUser();

    const res = await app.request('/api/v1/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('I-PRF-08: cannot change email via PUT /me (field ignored)', async () => {
    const { access_token } = await registerUser();

    const res = await app.request('/api/v1/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ email: 'new@example.com', display_name: 'Alice' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe('alice@example.com');
  });

  it('I-PRF-10: updated_at changes on update', async () => {
    const { access_token, user } = await registerUser();
    const originalUpdatedAt = user.updated_at;

    // Wait a moment to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 50));

    const res = await app.request('/api/v1/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ display_name: 'Updated' }),
    });

    const body = await res.json();
    expect(new Date(body.user.updated_at).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());
  });
});
