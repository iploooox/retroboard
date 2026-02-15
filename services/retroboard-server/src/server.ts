import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { bodyLimit } from 'hono/body-limit';
import { serve } from '@hono/node-server';
import { env } from './config/env.js';
import { AppError, formatErrorResponse } from './utils/errors.js';
import { authRouter } from './routes/auth.js';

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
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

// Body size limit (1MB)
app.use('/api/*', bodyLimit({
  maxSize: 1_048_576,
  onError: (c) => c.json(formatErrorResponse('PAYLOAD_TOO_LARGE', 'Request body too large'), 413),
}));

// Health check
app.get('/api/v1/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public stats endpoint (must be before other /api/v1 routes to avoid auth middleware)
import { statsRouter } from './routes/stats.js';
app.route('/api/v1', statsRouter);

import { teamsRouter } from './routes/teams.js';
import { sprintsRouter } from './routes/sprints.js';
import { templatesRouter } from './routes/templates.js';
import { boardsRouter } from './routes/boards.js';
import { cardsRouter } from './routes/cards.js';
import { actionItemsRouter } from './routes/action-items.js';
import { timerRouter } from './routes/timer.js';
import { analyticsRouter } from './routes/analytics.js';
import { exportRouter } from './routes/export-routes.js';
import { reactionsRouter } from './routes/reactions.js';
import { icebreakersRouter } from './routes/icebreakers.js';
import { onboardingRouter } from './routes/onboarding.js';
import { sentimentLexiconRouter } from './routes/sentiment-lexicon.js';

app.route('/api/v1/auth', authRouter);
app.route('/api/v1/teams', teamsRouter);
app.route('/api/v1/teams/:teamId/sprints', sprintsRouter);
app.route('/api/v1/templates', templatesRouter);
app.route('/api/v1', boardsRouter);
app.route('/api/v1', cardsRouter);
app.route('/api/v1', actionItemsRouter);
app.route('/api/v1', timerRouter);
app.route('/api/v1', analyticsRouter);
app.route('/api/v1', exportRouter);
app.route('/api/v1', reactionsRouter);
app.route('/api/v1', icebreakersRouter);
app.route('/api/v1', onboardingRouter);
app.route('/api/v1', sentimentLexiconRouter);

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
  const httpServer = serve({
    fetch: app.fetch,
    port: env.PORT,
  }, (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
  });

  // Attach WebSocket server
  import('./ws/index.js').then(({ setupWebSocket }) => {
    setupWebSocket(httpServer);
    console.log('WebSocket server attached');
  });
}

export { app };
