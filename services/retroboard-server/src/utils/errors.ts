export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_EXISTS: 'AUTH_EMAIL_EXISTS',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_REFRESH_TOKEN_EXPIRED: 'AUTH_REFRESH_TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  SPRINT_ALREADY_ACTIVE: 'SPRINT_ALREADY_ACTIVE',
  TEAM_INVITE_EXHAUSTED: 'TEAM_INVITE_EXHAUSTED',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCodeType,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function formatErrorResponse(code: string, message: string) {
  return {
    error: {
      code,
      message,
    },
  };
}
