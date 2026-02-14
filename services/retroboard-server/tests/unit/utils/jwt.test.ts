import { describe, it, expect } from 'vitest';
import { signAccessToken, signRefreshToken, verifyToken } from '../../../src/utils/jwt.js';
import { SignJWT } from 'jose';

const TEST_SECRET = 'test-secret-must-be-at-least-32-characters-long';

describe('JWT Utility', () => {
  it('U-JWT-01: sign creates valid JWT string with 3 dot-separated parts', async () => {
    const token = await signAccessToken({ sub: 'user-id', email: 'test@example.com' });
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    parts.forEach((part) => expect(part.length).toBeGreaterThan(0));
  });

  it('U-JWT-02: verify returns payload for valid token', async () => {
    const token = await signAccessToken({ sub: 'user-id', email: 'test@example.com' });
    const payload = await verifyToken(token);
    expect(payload.sub).toBe('user-id');
    expect(payload.email).toBe('test@example.com');
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it('U-JWT-03: verify rejects expired token', async () => {
    const secret = new TextEncoder().encode(TEST_SECRET);
    const token = await new SignJWT({ sub: 'user-id', email: 'test@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(secret);

    await expect(verifyToken(token)).rejects.toThrow();
  });

  it('U-JWT-04: verify rejects wrong secret', async () => {
    const wrongSecret = new TextEncoder().encode('wrong-secret-that-is-at-least-32-characters!');
    const token = await new SignJWT({ sub: 'user-id', email: 'test@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(wrongSecret);

    await expect(verifyToken(token)).rejects.toThrow();
  });

  it('U-JWT-05: verify rejects malformed token', async () => {
    await expect(verifyToken('not-a-jwt')).rejects.toThrow();
  });

  it('U-JWT-06: verify rejects tampered payload', async () => {
    const token = await signAccessToken({ sub: 'user-id', email: 'test@example.com' });
    const parts = token.split('.');
    // Tamper with payload
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'hacker', email: 'hacker@evil.com', iat: 0, exp: 9999999999 })).toString('base64url');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    await expect(verifyToken(tampered)).rejects.toThrow();
  });

  it('U-JWT-07: access token contains correct expiry (exp - iat === 900)', async () => {
    const token = await signAccessToken({ sub: 'user-id', email: 'test@example.com' });
    const payload = await verifyToken(token);
    expect(payload.exp! - payload.iat!).toBe(900);
  });

  it('U-JWT-08: token contains correct claims', async () => {
    const token = await signAccessToken({ sub: 'my-user-id', email: 'alice@example.com' });
    const payload = await verifyToken(token);
    expect(payload.sub).toBe('my-user-id');
    expect(payload.email).toBe('alice@example.com');
  });

  it('U-JWT-09: signRefreshToken creates a valid token with 7-day expiry', async () => {
    const token = await signRefreshToken({ sub: 'user-id', email: 'test@example.com' });
    const payload = await verifyToken(token);
    expect(payload.exp! - payload.iat!).toBe(7 * 24 * 60 * 60);
  });

  it('E-SEC-11: JWT with alg: none is rejected', async () => {
    // Craft a token with alg: none
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'user-id', email: 'test@example.com', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url');
    const token = `${header}.${payload}.`;
    await expect(verifyToken(token)).rejects.toThrow();
  });
});
