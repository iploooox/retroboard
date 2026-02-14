import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { env } from './config/env.js';
import { AppError, formatErrorResponse } from './utils/errors.js';

const app = new Hono();

// CORS
app.use(
  '*',
  cors({
    origin: env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  }),
);

// Request logging
app.use('*', logger());

// Security headers
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Content-Security-Policy', "default-src 'self'");
});

// Body size limit (1MB)
app.use('/api/*', async (c, next) => {
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
    return c.json(formatErrorResponse('PAYLOAD_TOO_LARGE', 'Request body too large'), 413);
  }
  await next();
});

// Health check
app.get('/api/v1/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Placeholder route groups
const authRoutes = new Hono();
authRoutes.all('/*', (c) => c.json(formatErrorResponse('NOT_IMPLEMENTED', 'Auth endpoints not yet implemented'), 501));

const teamsRoutes = new Hono();
teamsRoutes.all('/*', (c) => c.json(formatErrorResponse('NOT_IMPLEMENTED', 'Teams endpoints not yet implemented'), 501));

const sprintsRoutes = new Hono();
sprintsRoutes.all('/*', (c) => c.json(formatErrorResponse('NOT_IMPLEMENTED', 'Sprints endpoints not yet implemented'), 501));

const templatesRoutes = new Hono();
templatesRoutes.all('/*', (c) => c.json(formatErrorResponse('NOT_IMPLEMENTED', 'Templates endpoints not yet implemented'), 501));

app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/teams', teamsRoutes);
app.route('/api/v1/sprints', sprintsRoutes);
app.route('/api/v1/templates', templatesRoutes);

// Global error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(formatErrorResponse(err.code, err.message), err.status as 400);
  }

  console.error('Unhandled error:', err);
  return c.json(
    formatErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'),
    500,
  );
});

// 404 handler
app.notFound((c) => {
  return c.json(formatErrorResponse('NOT_FOUND', 'Route not found'), 404);
});

// Start server (only when not imported as a module)
const isMainModule = process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isMainModule) {
  console.log(`Starting server on port ${env.PORT}...`);
  serve({
    fetch: app.fetch,
    port: env.PORT,
  }, (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
  });
}

export { app };
