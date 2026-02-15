import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { formatErrorResponse } from '../utils/errors.js';
import * as templateRepo from '../repositories/template.repository.js';

const templatesRouter = new Hono();

// All template routes require auth
templatesRouter.use('*', requireAuth);

// GET /api/v1/templates — list system templates
templatesRouter.get('/', async (c) => {
  const templates = await templateRepo.findAll();
  return c.json({ templates });
});

// GET /api/v1/templates/:id — get template detail
templatesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return c.json(formatErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found'), 404);
  }

  const template = await templateRepo.findById(id, user.id);
  if (!template) {
    return c.json(formatErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found'), 404);
  }

  return c.json({ template });
});

export { templatesRouter };
