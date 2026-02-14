import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '../stores/auth';

describe('Auth store', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isSubmitting: false,
      loginError: null,
      registerError: null,
      fieldErrors: {},
    });
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should start unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it('should login successfully', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          user: { id: '1', email: 'test@test.com', display_name: 'Test', avatar_url: null, created_at: '' },
          access_token: 'at-123',
          refresh_token: 'rt-456',
          expires_in: 900,
        }),
    });

    await useAuthStore.getState().login('test@test.com', 'Password1');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('test@test.com');
    expect(state.accessToken).toBe('at-123');
    expect(state.refreshToken).toBe('rt-456');
    expect(localStorage.getItem('retroboard_refresh_token')).toBe('rt-456');
  });

  it('should set loginError on invalid credentials', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({
          error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password' },
        }),
    });

    try {
      await useAuthStore.getState().login('bad@test.com', 'wrong');
    } catch {
      // Expected
    }

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.loginError).toBe('Invalid email or password');
  });

  it('should register successfully', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          user: { id: '2', email: 'new@test.com', display_name: 'New User', avatar_url: null, created_at: '' },
          access_token: 'at-789',
          refresh_token: 'rt-012',
          expires_in: 900,
        }),
    });

    await useAuthStore.getState().register('new@test.com', 'StrongPass1', 'New User');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.display_name).toBe('New User');
  });

  it('should set field error for duplicate email on register', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          error: { code: 'AUTH_EMAIL_EXISTS', message: 'Email already exists' },
        }),
    });

    try {
      await useAuthStore.getState().register('existing@test.com', 'StrongPass1', 'Test');
    } catch {
      // Expected
    }

    const state = useAuthStore.getState();
    expect(state.fieldErrors['email']).toBe('An account with this email already exists');
  });

  it('should logout and clear state', async () => {
    // Set up logged in state
    useAuthStore.setState({
      user: { id: '1', email: 'test@test.com', display_name: 'Test', avatar_url: null, created_at: '' },
      accessToken: 'at-123',
      refreshToken: 'rt-456',
      isAuthenticated: true,
    });
    localStorage.setItem('retroboard_refresh_token', 'rt-456');

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'Logged out' }),
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(localStorage.getItem('retroboard_refresh_token')).toBeNull();
  });

  it('should clear errors', () => {
    useAuthStore.setState({
      loginError: 'some error',
      registerError: 'another',
      fieldErrors: { email: 'bad' },
    });

    useAuthStore.getState().clearErrors();

    const state = useAuthStore.getState();
    expect(state.loginError).toBeNull();
    expect(state.registerError).toBeNull();
    expect(state.fieldErrors).toEqual({});
  });
});
