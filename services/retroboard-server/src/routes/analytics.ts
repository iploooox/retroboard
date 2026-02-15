import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { formatErrorResponse } from '../utils/errors.js';
import { analyticsService } from '../services/analytics-service.js';
import * as analyticsRepo from '../repositories/analytics.repository.js';

const analyticsRouter = new Hono();
analyticsRouter.use('*', requireAuth);

// GET /api/v1/teams/:teamId/analytics/health
analyticsRouter.get('/teams/:teamId/analytics/health', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');

  // Parse query params
  const limitParam = c.req.query('limit');
  const offsetParam = c.req.query('offset');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 20;
  const offset = offsetParam ? Math.max(parseInt(offsetParam, 10), 0) : 0;

  // Check team exists
  const exists = await analyticsRepo.teamExists(teamId);
  if (!exists) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  // Check user is team member
  const isMember = await analyticsRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  const result = await analyticsService.getHealthTrend(teamId, limit, offset);
  return c.json(result);
});

// GET /api/v1/teams/:teamId/analytics/participation
analyticsRouter.get('/teams/:teamId/analytics/participation', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');
  const sprintId = c.req.query('sprintId');

  // Check team exists
  const exists = await analyticsRepo.teamExists(teamId);
  if (!exists) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  // Check user is team member
  const isMember = await analyticsRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  const result = await analyticsService.getParticipation(teamId, sprintId);
  return c.json(result);
});

// GET /api/v1/teams/:teamId/analytics/sentiment
analyticsRouter.get('/teams/:teamId/analytics/sentiment', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');

  // Parse query params
  const limitParam = c.req.query('limit');
  const offsetParam = c.req.query('offset');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 20;
  const offset = offsetParam ? Math.max(parseInt(offsetParam, 10), 0) : 0;

  // Check team exists
  const exists = await analyticsRepo.teamExists(teamId);
  if (!exists) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  // Check user is team member
  const isMember = await analyticsRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  const result = await analyticsService.getSentimentTrend(teamId, limit, offset);
  return c.json(result);
});

// GET /api/v1/teams/:teamId/analytics/word-cloud
analyticsRouter.get('/teams/:teamId/analytics/word-cloud', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');
  const sprintId = c.req.query('sprintId');

  // Parse query params
  const limitParam = c.req.query('limit');
  const minFrequencyParam = c.req.query('minFrequency');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 500) : 100;
  const minFrequency = minFrequencyParam ? Math.max(parseInt(minFrequencyParam, 10), 1) : 2;

  // Check team exists
  const exists = await analyticsRepo.teamExists(teamId);
  if (!exists) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  // Check user is team member
  const isMember = await analyticsRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  const result = await analyticsService.getWordCloud(teamId, sprintId, limit, minFrequency);
  return c.json(result);
});

// GET /api/v1/sprints/:sprintId/analytics
analyticsRouter.get('/sprints/:sprintId/analytics', async (c) => {
  const sprintId = c.req.param('sprintId');
  const user = c.get('user');

  // Get sprint info (includes team check)
  const sprintInfo = await analyticsRepo.getSprintInfo(sprintId);
  if (!sprintInfo) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  // Check user is team member
  const isMember = await analyticsRepo.isTeamMember(sprintInfo.teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  const result = await analyticsService.getSprintAnalytics(sprintId);
  if (!result) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  return c.json(result);
});

export { analyticsRouter };
