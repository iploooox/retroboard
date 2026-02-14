import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, configureApiAuth } from '../lib/api';

describe('API client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    configureApiAuth({
      getAccessToken: () => 'test-token',
      getRefreshToken: () => 'test-refresh',
      setTokens: vi.fn(),
      clearAuth: vi.fn(),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should make GET requests with auth header', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const result = await api.get('/test');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual({ data: 'test' });
  });

  it('should make POST requests with JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: '123' }),
    });

    const result = await api.post('/test', { name: 'hello' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'hello' }),
      }),
    );
    expect(result).toEqual({ id: '123' });
  });

  it('should throw ApiError on non-ok responses', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: [{ field: 'email', message: 'Required' }],
          },
        }),
    });

    try {
      await api.post('/test', {});
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe('VALIDATION_ERROR');
      expect(apiErr.message).toBe('Invalid input');
      expect(apiErr.details).toHaveLength(1);
    }
  });

  it('should throw ApiError on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    try {
      await api.get('/test');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('NETWORK_ERROR');
    }
  });

  it('should handle 204 No Content', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await api.delete('/test');
    expect(result).toBeUndefined();
  });

  it('should attempt token refresh on 401', async () => {
    const setTokens = vi.fn();
    const clearAuth = vi.fn();

    configureApiAuth({
      getAccessToken: () => 'expired-token',
      getRefreshToken: () => 'valid-refresh',
      setTokens,
      clearAuth,
    });

    // First call returns 401, refresh succeeds, retry succeeds
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Expired' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'success' }),
      });

    const result = await api.get('/protected');
    expect(result).toEqual({ data: 'success' });
    expect(setTokens).toHaveBeenCalledWith('new-access', 'new-refresh');
  });
});
