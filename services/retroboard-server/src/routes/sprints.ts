import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { sql } from '../db/connection.js';
import { AppError, formatErrorResponse } from '../utils/errors.js';
import * as sprintRepo from '../repositories/sprint.repository.js';
import {
  validateCreateSprint,
  validateUpdateSprint,
  validateStatusFilter,
  validatePagination,
  validateUUID,
} from '../validation/sprints.js';

type TeamRole = 'admin' | 'facilitator' | 'member';

async function getTeamMembership(teamId: string, userId: string) {
  // Validate UUID format
  validateUUID(teamId, 'team ID');

  // Check team exists
  const [team] = await sql`SELECT id FROM teams WHERE id = ${teamId} AND deleted_at IS NULL`;
  if (!team) {
    return { error: 'TEAM_NOT_FOUND' as const, status: 404 as const };
  }

  // Check membership
  const [membership] = await sql`
    SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}
  `;
  if (!membership) {
    return { error: 'TEAM_NOT_MEMBER' as const, status: 403 as const };
  }

  return { role: membership.role as TeamRole };
}

function requireRole(role: TeamRole, allowed: TeamRole[]): boolean {
  return allowed.includes(role);
}

const sprintsRouter = new Hono();

// All sprint routes require auth
sprintsRouter.use('*', requireAuth);

// POST /api/v1/teams/:teamId/sprints — create sprint
sprintsRouter.post('/', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');

  const membership = await getTeamMembership(teamId, user.id);
  if ('error' in membership) {
    return c.json(formatErrorResponse(membership.error, membership.error === 'TEAM_NOT_FOUND' ? 'Team not found' : 'You are not a member of this team'), membership.status);
  }

  if (!requireRole(membership.role, ['admin', 'facilitator'])) {
    return c.json(formatErrorResponse('TEAM_INSUFFICIENT_ROLE', 'Insufficient role for this action'), 403);
  }

  const body = await c.req.json().catch(() => null);
  const input = validateCreateSprint(body);

  const sprint = await sprintRepo.create({
    team_id: teamId,
    name: input.name,
    goal: input.goal,
    start_date: input.start_date,
    end_date: input.end_date,
    created_by: user.id,
  });

  return c.json({ sprint }, 201);
});

// GET /api/v1/teams/:teamId/sprints — list sprints
sprintsRouter.get('/', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');

  const membership = await getTeamMembership(teamId, user.id);
  if ('error' in membership) {
    return c.json(formatErrorResponse(membership.error, membership.error === 'TEAM_NOT_FOUND' ? 'Team not found' : 'You are not a member of this team'), membership.status);
  }

  const status = validateStatusFilter(c.req.query('status'));
  const { page, perPage } = validatePagination(c.req.query('page'), c.req.query('per_page'));

  const { sprints, total } = await sprintRepo.findByTeamId(teamId, {
    status,
    page,
    perPage,
  });

  return c.json({
    sprints,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  });
});

// GET /api/v1/teams/:teamId/sprints/:id — get sprint
sprintsRouter.get('/:id', async (c) => {
  const teamId = c.req.param('teamId');
  const sprintId = c.req.param('id');
  const user = c.get('user');

  const membership = await getTeamMembership(teamId, user.id);
  if ('error' in membership) {
    return c.json(formatErrorResponse(membership.error, membership.error === 'TEAM_NOT_FOUND' ? 'Team not found' : 'You are not a member of this team'), membership.status);
  }

  validateUUID(sprintId, 'sprint ID');

  const sprint = await sprintRepo.findById(sprintId, teamId);
  if (!sprint) {
    return c.json(formatErrorResponse('SPRINT_NOT_FOUND', 'Sprint not found'), 404);
  }

  return c.json({ sprint });
});

// PUT /api/v1/teams/:teamId/sprints/:id — update sprint
sprintsRouter.put('/:id', async (c) => {
  const teamId = c.req.param('teamId');
  const sprintId = c.req.param('id');
  const user = c.get('user');

  const membership = await getTeamMembership(teamId, user.id);
  if ('error' in membership) {
    return c.json(formatErrorResponse(membership.error, membership.error === 'TEAM_NOT_FOUND' ? 'Team not found' : 'You are not a member of this team'), membership.status);
  }

  if (!requireRole(membership.role, ['admin', 'facilitator'])) {
    return c.json(formatErrorResponse('TEAM_INSUFFICIENT_ROLE', 'Insufficient role for this action'), 403);
  }

  validateUUID(sprintId, 'sprint ID');

  const existingSprint = await sprintRepo.findById(sprintId, teamId);
  if (!existingSprint) {
    return c.json(formatErrorResponse('SPRINT_NOT_FOUND', 'Sprint not found'), 404);
  }

  if (existingSprint.status === 'completed') {
    return c.json(formatErrorResponse('SPRINT_NOT_EDITABLE', 'Sprint is completed and cannot be modified'), 400);
  }

  const body = await c.req.json().catch(() => null);
  const input = validateUpdateSprint(body, existingSprint.status);

  // Cross-field date validation
  if (existingSprint.status === 'planning') {
    const newStartDate = input.start_date ?? existingSprint.start_date;
    const newEndDate = input.end_date !== undefined ? input.end_date : existingSprint.end_date;
    if (newEndDate && newEndDate < newStartDate) {
      return c.json(formatErrorResponse('SPRINT_DATE_INVALID', 'end_date must be on or after start_date'), 400);
    }
  }

  const sprint = await sprintRepo.update(sprintId, teamId, input);
  if (!sprint) {
    return c.json(formatErrorResponse('SPRINT_NOT_FOUND', 'Sprint not found'), 404);
  }

  return c.json({ sprint });
});

// PUT /api/v1/teams/:teamId/sprints/:id/activate — activate sprint
sprintsRouter.put('/:id/activate', async (c) => {
  const teamId = c.req.param('teamId');
  const sprintId = c.req.param('id');
  const user = c.get('user');

  const membership = await getTeamMembership(teamId, user.id);
  if ('error' in membership) {
    return c.json(formatErrorResponse(membership.error, membership.error === 'TEAM_NOT_FOUND' ? 'Team not found' : 'You are not a member of this team'), membership.status);
  }

  if (!requireRole(membership.role, ['admin', 'facilitator'])) {
    return c.json(formatErrorResponse('TEAM_INSUFFICIENT_ROLE', 'Insufficient role for this action'), 403);
  }

  validateUUID(sprintId, 'sprint ID');

  const existingSprint = await sprintRepo.findById(sprintId, teamId);
  if (!existingSprint) {
    return c.json(formatErrorResponse('SPRINT_NOT_FOUND', 'Sprint not found'), 404);
  }

  if (existingSprint.status !== 'planning') {
    return c.json(formatErrorResponse('SPRINT_INVALID_TRANSITION', `Cannot transition from ${existingSprint.status} to active`), 400);
  }

  try {
    const sprint = await sprintRepo.activate(sprintId, teamId);
    if (!sprint) {
      return c.json(formatErrorResponse('SPRINT_NOT_FOUND', 'Sprint not found'), 404);
    }
    return c.json({ sprint });
  } catch (err: unknown) {
    const pgError = err as { code?: string; constraint_name?: string; constraint?: string };
    if (pgError.code === '23505' && (pgError.constraint_name === 'sprints_team_active_idx' || pgError.constraint === 'sprints_team_active_idx')) {
      // Find active sprint to include details in error
      const activeSprint = await sprintRepo.findActiveByTeamId(teamId);
      return c.json({
        error: {
          code: 'SPRINT_ALREADY_ACTIVE',
          message: 'Another sprint is already active for this team. Complete or delete it first.',
          details: activeSprint ? {
            active_sprint_id: activeSprint.id,
            active_sprint_name: activeSprint.name,
          } : undefined,
        },
      }, 409);
    }
    throw err;
  }
});

// PUT /api/v1/teams/:teamId/sprints/:id/complete — complete sprint
sprintsRouter.put('/:id/complete', async (c) => {
  const teamId = c.req.param('teamId');
  const sprintId = c.req.param('id');
  const user = c.get('user');

  const membership = await getTeamMembership(teamId, user.id);
  if ('error' in membership) {
    return c.json(formatErrorResponse(membership.error, membership.error === 'TEAM_NOT_FOUND' ? 'Team not found' : 'You are not a member of this team'), membership.status);
  }

  if (!requireRole(membership.role, ['admin', 'facilitator'])) {
    return c.json(formatErrorResponse('TEAM_INSUFFICIENT_ROLE', 'Insufficient role for this action'), 403);
  }

  validateUUID(sprintId, 'sprint ID');

  const existingSprint = await sprintRepo.findById(sprintId, teamId);
  if (!existingSprint) {
    return c.json(formatErrorResponse('SPRINT_NOT_FOUND', 'Sprint not found'), 404);
  }

  if (existingSprint.status !== 'active') {
    return c.json(formatErrorResponse('SPRINT_INVALID_TRANSITION', `Cannot transition from ${existingSprint.status} to completed`), 400);
  }

  const sprint = await sprintRepo.complete(sprintId, teamId);
  if (!sprint) {
    return c.json(formatErrorResponse('SPRINT_NOT_FOUND', 'Sprint not found'), 404);
  }

  return c.json({ sprint });
});

// DELETE /api/v1/teams/:teamId/sprints/:id — delete sprint
sprintsRouter.delete('/:id', async (c) => {
  const teamId = c.req.param('teamId');
  const sprintId = c.req.param('id');
  const user = c.get('user');

  const membership = await getTeamMembership(teamId, user.id);
  if ('error' in membership) {
    return c.json(formatErrorResponse(membership.error, membership.error === 'TEAM_NOT_FOUND' ? 'Team not found' : 'You are not a member of this team'), membership.status);
  }

  if (!requireRole(membership.role, ['admin'])) {
    return c.json(formatErrorResponse('TEAM_INSUFFICIENT_ROLE', 'Insufficient role for this action'), 403);
  }

  validateUUID(sprintId, 'sprint ID');

  const deleted = await sprintRepo.remove(sprintId, teamId);
  if (!deleted) {
    return c.json(formatErrorResponse('SPRINT_NOT_FOUND', 'Sprint not found'), 404);
  }

  return c.json({ message: 'Sprint deleted successfully' });
});

export { sprintsRouter };
