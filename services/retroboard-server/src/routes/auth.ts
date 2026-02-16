import { Hono } from 'hono';
import { formatErrorResponse } from '../utils/errors.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';
import { generateRefreshToken, hashToken } from '../utils/token.js';
import { registerSchema, loginSchema, refreshSchema, updateProfileSchema } from '../validation/auth.js';
import * as userRepo from '../repositories/user.repository.js';
import * as refreshTokenRepo from '../repositories/refresh-token.repository.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import type { ZodError } from 'zod';

// Pre-computed dummy hash for timing-attack mitigation on login
const DUMMY_HASH = '$2a$12$LJ3Fa5sVRA7u.fRQE0IiLO5g6Ux5Zy3YMpOI2X.sr0MFNMNqpNXa';

const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes

function formatUserResponse(user: userRepo.UserRow) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    updated_at: user.updated_at,
    onboarding_completed_at: user.onboarding_completed_at,
  };
}

function formatValidationError(error: ZodError) {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    },
  };
}

async function generateTokenPair(userId: string, email: string) {
  const accessToken = await signAccessToken({ sub: userId, email });
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await refreshTokenRepo.create(userId, tokenHash, expiresAt);

  return {
    access_token: accessToken,
    refresh_token: rawRefreshToken,
    expires_in: ACCESS_TOKEN_EXPIRY_SECONDS,
  };
}

const authRouter = new Hono();

// --- Rate limiters ---
const loginIpRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (c) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1';
    return `login:ip:${ip}`;
  },
});

const registerIpRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (c) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1';
    return `register:ip:${ip}`;
  },
});

const refreshIpRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (c) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1';
    return `refresh:ip:${ip}`;
  },
});

// POST /register
authRouter.post('/register', registerIpRateLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(formatValidationError(parsed.error), 400);
  }

  const { email, password, display_name } = parsed.data;

  // Check for existing user
  const existing = await userRepo.findByEmail(email);
  if (existing) {
    return c.json(formatErrorResponse('AUTH_EMAIL_EXISTS', 'A user with this email already exists'), 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepo.createUser({ email, password_hash: passwordHash, display_name });
  const tokens = await generateTokenPair(user.id, user.email);

  return c.json({
    user: formatUserResponse(user),
    ...tokens,
  }, 201);
});

// POST /login
authRouter.post('/login', loginIpRateLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(formatValidationError(parsed.error), 400);
  }

  const { email, password } = parsed.data;

  // Per-email rate limiting
  const emailRateAllowed = await (async () => {
    const { checkAndIncrement } = await import('../repositories/rate-limit.repository.js');
    return checkAndIncrement(`login:email:${email}`, 15 * 60 * 1000, 5);
  })();

  if (!emailRateAllowed) {
    c.header('Retry-After', '900');
    return c.json(
      formatErrorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.'),
      429,
    );
  }

  const user = await userRepo.findByEmail(email);

  // Timing attack mitigation: always run bcrypt compare
  const passwordToCompare = user ? user.password_hash : DUMMY_HASH;
  const isValid = await comparePassword(password, passwordToCompare);

  if (!user || !isValid) {
    return c.json(formatErrorResponse('AUTH_INVALID_CREDENTIALS', 'Invalid email or password'), 401);
  }

  const tokens = await generateTokenPair(user.id, user.email);

  return c.json({
    user: formatUserResponse(user),
    ...tokens,
  });
});

// POST /refresh
authRouter.post('/refresh', refreshIpRateLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = refreshSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(formatValidationError(parsed.error), 400);
  }

  const { refresh_token } = parsed.data;
  const tokenHash = hashToken(refresh_token);

  const storedToken = await refreshTokenRepo.findByHash(tokenHash);

  if (!storedToken) {
    return c.json(formatErrorResponse('AUTH_REFRESH_TOKEN_INVALID', 'Refresh token is invalid or has been revoked'), 401);
  }

  // Check if already revoked (theft detection)
  if (storedToken.revoked_at) {
    // Potential token theft — revoke ALL tokens for this user
    await refreshTokenRepo.revokeAllForUser(storedToken.user_id);
    return c.json(formatErrorResponse('AUTH_REFRESH_TOKEN_INVALID', 'Refresh token is invalid or has been revoked'), 401);
  }

  // Check if expired
  if (new Date(storedToken.expires_at) < new Date()) {
    return c.json(formatErrorResponse('AUTH_REFRESH_TOKEN_EXPIRED', 'Refresh token has expired'), 401);
  }

  // Rate limiting for refresh
  const { checkAndIncrement } = await import('../repositories/rate-limit.repository.js');
  const refreshAllowed = await checkAndIncrement(`refresh:user:${storedToken.user_id}`, 60 * 1000, 30);
  if (!refreshAllowed) {
    c.header('Retry-After', '60');
    return c.json(
      formatErrorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.'),
      429,
    );
  }

  // Rotate: revoke old, issue new
  await refreshTokenRepo.revoke(storedToken.id);

  // Get user for new token
  const user = await userRepo.findById(storedToken.user_id);
  if (!user) {
    return c.json(formatErrorResponse('AUTH_REFRESH_TOKEN_INVALID', 'Refresh token is invalid or has been revoked'), 401);
  }

  const tokens = await generateTokenPair(user.id, user.email);

  return c.json(tokens);
});

// POST /logout (requires auth)
authRouter.post('/logout', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = refreshSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(formatValidationError(parsed.error), 400);
  }

  const { refresh_token } = parsed.data;
  const tokenHash = hashToken(refresh_token);
  const user = c.get('user');

  // Find token and only revoke if it belongs to this user
  const storedToken = await refreshTokenRepo.findByHash(tokenHash);
  if (storedToken && storedToken.user_id === user.id) {
    await refreshTokenRepo.revoke(storedToken.id);
  }

  return c.json({ message: 'Logged out successfully' });
});

// GET /me (requires auth)
authRouter.get('/me', requireAuth, async (c) => {
  const authUser = c.get('user');
  const user = await userRepo.findById(authUser.id);

  if (!user) {
    return c.json(formatErrorResponse('AUTH_UNAUTHORIZED', 'User not found'), 401);
  }

  return c.json({ user: formatUserResponse(user) });
});

// PUT /me (requires auth)
authRouter.put('/me', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(formatValidationError(parsed.error), 400);
  }

  const authUser = c.get('user');
  const updated = await userRepo.updateProfile(authUser.id, parsed.data);

  if (!updated) {
    return c.json(formatErrorResponse('AUTH_UNAUTHORIZED', 'User not found'), 401);
  }

  return c.json({ user: formatUserResponse(updated) });
});

// POST /revoke-all (requires auth)
authRouter.post('/revoke-all', requireAuth, async (c) => {
  const authUser = c.get('user');
  await refreshTokenRepo.revokeAllForUser(authUser.id);
  return c.json({ message: 'All sessions revoked' });
});

export { authRouter };
