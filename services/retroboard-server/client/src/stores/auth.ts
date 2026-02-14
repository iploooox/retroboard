import { create } from 'zustand';
import { api, ApiError, configureApiAuth } from '@/lib/api';

interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  loginError: string | null;
  registerError: string | null;
  fieldErrors: Record<string, string>;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  clearErrors: () => void;
  setUser: (user: User) => void;
  initialize: () => Promise<void>;
}

const REFRESH_TOKEN_KEY = 'retroboard_refresh_token';

export const useAuthStore = create<AuthState>((set, get) => {
  // Configure API auth hooks
  configureApiAuth({
    getAccessToken: () => get().accessToken,
    getRefreshToken: () => get().refreshToken,
    setTokens: (access, refresh) => {
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
      set({ accessToken: access, refreshToken: refresh });
    },
    clearAuth: () => {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
    },
  });

  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
    isSubmitting: false,
    loginError: null,
    registerError: null,
    fieldErrors: {},

    login: async (email, password) => {
      set({ isSubmitting: true, loginError: null, fieldErrors: {} });
      try {
        const data = await api.post<{
          user: User;
          access_token: string;
          refresh_token: string;
        }>('/auth/login', { email, password });

        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
        set({
          user: data.user,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
          isSubmitting: false,
        });
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === 'AUTH_INVALID_CREDENTIALS') {
            set({ loginError: 'Invalid email or password', isSubmitting: false });
          } else if (err.details) {
            const fieldErrors: Record<string, string> = {};
            for (const d of err.details) {
              fieldErrors[d.field] = d.message;
            }
            set({ fieldErrors, isSubmitting: false });
          } else {
            set({ loginError: err.message, isSubmitting: false });
          }
        } else {
          set({ loginError: 'Something went wrong. Please try again.', isSubmitting: false });
        }
        throw err;
      }
    },

    register: async (email, password, displayName) => {
      set({ isSubmitting: true, registerError: null, fieldErrors: {} });
      try {
        const data = await api.post<{
          user: User;
          access_token: string;
          refresh_token: string;
        }>('/auth/register', { email, password, display_name: displayName });

        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
        set({
          user: data.user,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
          isSubmitting: false,
        });
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === 'AUTH_EMAIL_EXISTS') {
            set({ fieldErrors: { email: 'An account with this email already exists' }, isSubmitting: false });
          } else if (err.details) {
            const fieldErrors: Record<string, string> = {};
            for (const d of err.details) {
              fieldErrors[d.field] = d.message;
            }
            set({ fieldErrors, isSubmitting: false });
          } else {
            set({ registerError: err.message, isSubmitting: false });
          }
        } else {
          set({ registerError: 'Something went wrong. Please try again.', isSubmitting: false });
        }
        throw err;
      }
    },

    logout: async () => {
      const { refreshToken } = get();
      try {
        if (refreshToken) {
          await api.post('/auth/logout', { refresh_token: refreshToken });
        }
      } catch {
        // Ignore errors during logout
      }
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
    },

    refreshTokens: async () => {
      const refreshToken = get().refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return false;

      try {
        const data = await api.post<{
          access_token: string;
          refresh_token: string;
        }>('/auth/refresh', { refresh_token: refreshToken });

        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
        set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
        });
        return true;
      } catch {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
        return false;
      }
    },

    clearErrors: () => {
      set({ loginError: null, registerError: null, fieldErrors: {} });
    },

    setUser: (user) => {
      set({ user });
    },

    initialize: async () => {
      const storedToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!storedToken) {
        set({ isLoading: false });
        return;
      }

      set({ refreshToken: storedToken });
      try {
        const refreshed = await get().refreshTokens();
        if (refreshed) {
          const data = await api.get<{ user: User }>('/auth/me');
          set({ user: data.user, isAuthenticated: true, isLoading: false });
        } else {
          set({ isLoading: false });
        }
      } catch {
        set({ isLoading: false });
      }
    },
  };
});
