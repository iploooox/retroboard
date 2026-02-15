import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { onboardingService } from '../services/onboarding-service.js';
import { z } from 'zod';

function okRes(data: unknown) {
  return { ok: true, data };
}

function errRes(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

const onboardingRouter = new Hono();
onboardingRouter.use('*', requireAuth);

// GET /api/v1/users/me/onboarding
onboardingRouter.get('/users/me/onboarding', async (c) => {
  const user = c.get('user');
  const state = await onboardingService.getState(user.id);
  return c.json(okRes(state));
});

// PATCH /api/v1/users/me/onboarding
onboardingRouter.patch('/users/me/onboarding', async (c) => {
  const user = c.get('user');

  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    step: z.string(),
    action: z.enum(['complete', 'skip']),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json(errRes('VALIDATION_ERROR', 'Validation failed'), 400);
  }

  const { step, action } = parsed.data;

  // Validate step name
  if (!onboardingService.isValidStep(step)) {
    return c.json(errRes('VALIDATION_ERROR', 'Invalid step name'), 400);
  }

  try {
    const newState = await onboardingService.updateStep(user.id, step, action);
    return c.json(okRes(newState));
  } catch (err: any) {
    return c.json(errRes('VALIDATION_ERROR', err.message), 400);
  }
});

// POST /api/v1/users/me/onboarding/complete
onboardingRouter.post('/users/me/onboarding/complete', async (c) => {
  const user = c.get('user');
  await onboardingService.complete(user.id);
  return c.json(okRes({ completed: true }));
});

// POST /api/v1/users/me/onboarding/reset
onboardingRouter.post('/users/me/onboarding/reset', async (c) => {
  const user = c.get('user');
  await onboardingService.reset(user.id);
  return c.json(okRes({ reset: true }));
});

export { onboardingRouter };
