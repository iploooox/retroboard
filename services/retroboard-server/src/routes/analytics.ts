import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { formatErrorResponse } from '../utils/errors.js';
import { analyticsService } from '../services/analytics-service.js';
import * as analyticsRepo from '../repositories/analytics.repository.js';
import { z } from 'zod';

const analyticsRouter = new Hono();
analyticsRouter.use('*', requireAuth);

// UUID validator
const uuidParam = z.string().uuid();

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
    return c.json({ error: 'NOT_FOUND', message: 'Team not found' }, 404);
  }

  // Check user is team member
  const isMember = await analyticsRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN', message: 'Access denied' }, 403);
  }

  const result = await analyticsService.getHealthTrend(teamId, limit, offset);
  return c.json(result);
});

// GET /api/v1/teams/:teamId/analytics/participation
analyticsRouter.get('/teams/:teamId/analytics/participation', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');
  const sprintId = c.req.query('sprintId');

  // Validate sprintId UUID format if provided
  if (sprintId && !uuidParam.safeParse(sprintId).success) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid sprint ID format' }, 422);
  }

  // Check team exists
  const exists = await analyticsRepo.teamExists(teamId);
  if (!exists) {
    return c.json({ error: 'NOT_FOUND', message: 'Team not found' }, 404);
  }

  // Check user is team member
  const isMember = await analyticsRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN', message: 'Access denied' }, 403);
  }

  // Validate sprint ownership if sprintId provided
  if (sprintId) {
    const sprint = await analyticsRepo.getSprintInfo(sprintId);
    if (!sprint || sprint.teamId !== teamId) {
      return c.json({ error: 'NOT_FOUND', message: 'Sprint not found' }, 404);
    }
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
    return c.json({ error: 'NOT_FOUND', message: 'Team not found' }, 404);
  }

  // Check user is team member
  const isMember = await analyticsRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN', message: 'Access denied' }, 403);
  }

  const result = await analyticsService.getSentimentTrend(teamId, limit, offset);
  return c.json(result);
});

// GET /api/v1/teams/:teamId/analytics/word-cloud
analyticsRouter.get('/teams/:teamId/analytics/word-cloud', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');
  const sprintId = c.req.query('sprintId');

  // Validate sprintId UUID format if provided
  if (sprintId && !uuidParam.safeParse(sprintId).success) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid sprint ID format' }, 422);
  }

  // Parse query params
  const limitParam = c.req.query('limit');
  const minFrequencyParam = c.req.query('minFrequency');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 500) : 100;
  const minFrequency = minFrequencyParam ? Math.max(parseInt(minFrequencyParam, 10), 1) : 2;

  // Check team exists
  const exists = await analyticsRepo.teamExists(teamId);
  if (!exists) {
    return c.json({ error: 'NOT_FOUND', message: 'Team not found' }, 404);
  }

  // Check user is team member
  const isMember = await analyticsRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN', message: 'Access denied' }, 403);
  }

  // Validate sprint ownership if sprintId provided
  if (sprintId) {
    const sprint = await analyticsRepo.getSprintInfo(sprintId);
    if (!sprint || sprint.teamId !== teamId) {
      return c.json({ error: 'NOT_FOUND', message: 'Sprint not found' }, 404);
    }
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
    return c.json({ error: 'NOT_FOUND', message: 'Sprint not found' }, 404);
  }

  // Check user is team member
  const isMember = await analyticsRepo.isTeamMember(sprintInfo.teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN', message: 'Access denied' }, 403);
  }

  // Try to get analytics
  let result = await analyticsService.getSprintAnalytics(sprintId);

  // If no data found, refresh materialized views and retry once
  if (!result) {
    try {
      await analyticsRepo.refreshMaterializedViews();
      result = await analyticsService.getSprintAnalytics(sprintId);
    } catch (err) {
      console.error('Failed to refresh materialized views:', err);
      // Continue with null result if refresh fails
    }
  }

  if (!result) {
    return c.json({ error: 'NOT_FOUND', message: 'Sprint not found' }, 404);
  }

  // Return analytics data (may include noDataReason if sprint has no board yet)
  return c.json(result);
});

export { analyticsRouter };
