import type { Context, Next } from 'hono';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

export interface AuthUser {
  id: string;
  email: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header('Authorization');

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('AUTH_UNAUTHORIZED', 401, 'Authentication required');
  }

  const token = header.slice(7);

  if (!token) {
    throw new AppError('AUTH_TOKEN_INVALID', 401, 'Token is required');
  }

  const payload = await verifyToken(token);

  c.set('user', {
    id: payload.sub,
    email: payload.email,
  });

  await next();
}
