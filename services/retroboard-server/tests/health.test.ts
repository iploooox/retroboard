import { describe, it, expect } from 'vitest';
import { createTestApp } from './helpers/test-app.js';

describe('Health Check', () => {
  const app = createTestApp();

  it('GET /api/v1/health returns 200 with status ok', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await app.request('/nonexistent');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns security headers', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('placeholder auth routes return 501', async () => {
    const res = await app.request('/api/v1/auth/login', { method: 'POST' });
    expect(res.status).toBe(501);
  });
});
