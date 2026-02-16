import type { Context, Next } from 'hono';
import { sql } from '../db/connection.js';
import { formatErrorResponse } from '../utils/errors.js';

type TeamRole = 'admin' | 'facilitator' | 'member';

declare module 'hono' {
  interface ContextVariableMap {
    teamRole: TeamRole;
  }
}

export function requireTeamRole(roles: TeamRole[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    const teamId = c.req.param('teamId') || c.req.param('id');

    // Check team exists
    const [team] = await sql`
      SELECT id FROM teams WHERE id = ${teamId} AND deleted_at IS NULL
    `;
    if (!team) {
      return c.json(formatErrorResponse('TEAM_NOT_FOUND', 'Team not found'), 404);
    }

    // Check membership
    const [membership] = await sql`
      SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
    `;
    if (!membership) {
      return c.json(formatErrorResponse('TEAM_NOT_MEMBER', 'You are not a member of this team'), 403);
    }

    if (!roles.includes(membership.role as TeamRole)) {
      return c.json(formatErrorResponse('TEAM_INSUFFICIENT_ROLE', 'Insufficient role for this action'), 403);
    }

    c.set('teamRole', membership.role as TeamRole);
    await next();
  };
}
