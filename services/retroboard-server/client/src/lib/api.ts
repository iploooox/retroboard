const BASE_URL = '/api/v1';

let getAccessToken: () => string | null = () => null;
let getRefreshToken: () => string | null = () => null;
let setTokens: (access: string, refresh: string) => void = () => {};
let clearAuth: () => void = () => {};

export function configureApiAuth(opts: {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (access: string, refresh: string) => void;
  clearAuth: () => void;
}) {
  getAccessToken = opts.getAccessToken;
  getRefreshToken = opts.getRefreshToken;
  setTokens = opts.setTokens;
  clearAuth = opts.clearAuth;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to connect. Check your internet connection.');
  }

  if (res.status === 401 && token) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      }
      try {
        res = await fetch(url, { ...options, headers });
      } catch {
        throw new ApiError(0, 'NETWORK_ERROR', 'Unable to connect. Check your internet connection.');
      }
    } else {
      clearAuth();
      throw new ApiError(401, 'AUTH_TOKEN_EXPIRED', 'Session expired. Please log in again.');
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();

  if (!res.ok) {
    const error = data.error || {};
    throw new ApiError(
      res.status,
      error.code || 'UNKNOWN_ERROR',
      error.message || 'Something went wrong',
      error.details,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
