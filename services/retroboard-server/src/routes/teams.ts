import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { requireTeamRole } from '../middleware/team-auth.js';
import { teamRepository } from '../repositories/team.repository.js';
import { teamMemberRepository } from '../repositories/team-member.repository.js';
import { invitationRepository } from '../repositories/invitation.repository.js';
import { generateSlug } from '../utils/slug.js';
import { generateInviteCode } from '../utils/invite-code.js';
import { formatErrorResponse } from '../utils/errors.js';
import { sql } from '../db/connection.js';
import {
  createTeamSchema,
  updateTeamSchema,
  createInvitationSchema,
  updateMemberRoleSchema,
  paginationSchema,
  uuidParamSchema,
} from '../validation/teams.js';

function formatTeam(team: Record<string, unknown>) {
  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    description: team.description ?? null,
    avatar_url: team.avatar_url ?? null,
    theme: team.theme ?? 'default',
    created_by: team.created_by,
    created_at: team.created_at,
    updated_at: team.updated_at,
    member_count: Number(team.member_count),
    your_role: team.your_role,
  };
}

function formatInvitation(inv: Record<string, unknown>, requestOrigin?: string) {
  let appBaseUrl = process.env.APP_BASE_URL;

  if (!appBaseUrl) {
    // In development, if request comes from backend port (3000), use frontend port (5173)
    if (requestOrigin?.includes('localhost:3000') || requestOrigin?.includes('127.0.0.1:3000')) {
      appBaseUrl = 'http://localhost:5173';
    } else {
      appBaseUrl = requestOrigin || 'http://localhost:5173';
    }
  }

  return {
    id: inv.id,
    team_id: inv.team_id,
    code: inv.code,
    invite_url: `${appBaseUrl}/join/${inv.code}`,
    created_by: inv.created_by,
    expires_at: inv.expires_at,
    max_uses: inv.max_uses ?? null,
    role: inv.role,
    use_count: Number(inv.use_count),
    revoked_at: inv.revoked_at ?? null,
    created_at: inv.created_at,
  };
}

const teamsRouter = new Hono();

// All team routes require auth
teamsRouter.use('*', requireAuth);

// POST /api/v1/teams — Create team
teamsRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
    }, 400);
  }

  const user = c.get('user');
  const { name, description, avatar_url } = parsed.data;

  // Generate unique slug
  let slug = generateSlug(name);
  if (await teamRepository.isSlugTaken(slug)) {
    let suffix = 2;
    while (await teamRepository.isSlugTaken(`${slug}-${suffix}`)) {
      suffix++;
    }
    slug = `${slug}-${suffix}`;
  }

  const team = await teamRepository.create({
    name,
    slug,
    description: description ?? null,
    avatar_url: avatar_url ?? null,
    created_by: user.id,
  });

  return c.json({ team: formatTeam(team) }, 201);
});

// GET /api/v1/teams — List user's teams
teamsRouter.get('/', async (c) => {
  const query = {
    page: c.req.query('page'),
    per_page: c.req.query('per_page'),
  };
  const parsed = paginationSchema.safeParse(query);
  if (!parsed.success) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
    }, 400);
  }

  const user = c.get('user');
  const { page, per_page } = parsed.data;

  const { teams, total } = await teamRepository.findByUserId(user.id, page, per_page);

  return c.json({
    teams: teams.map(formatTeam),
    pagination: {
      page,
      per_page,
      total,
      total_pages: Math.ceil(total / per_page),
    },
  });
});

// POST /api/v1/teams/join/:code — Join via invite (MUST be before /:id routes)
teamsRouter.post('/join/:code', async (c) => {
  const code = c.req.param('code');
  const user = c.get('user');

  const invitation = await invitationRepository.findByToken(code);
  if (!invitation) {
    return c.json(formatErrorResponse('TEAM_INVITE_NOT_FOUND', 'Invitation not found'), 404);
  }

  // Check expired
  if (new Date(invitation.expires_at) <= new Date()) {
    return c.json(formatErrorResponse('TEAM_INVITE_EXPIRED', 'Invitation has expired'), 410);
  }

  // Check exhausted
  if (invitation.max_uses !== null && invitation.use_count >= invitation.max_uses) {
    return c.json(formatErrorResponse('TEAM_INVITE_EXHAUSTED', 'Invitation has reached its usage limit'), 410);
  }

  // Check already a member
  const existing = await teamMemberRepository.findMembership(invitation.team_id, user.id);
  if (existing) {
    return c.json(formatErrorResponse('TEAM_MEMBER_EXISTS', 'You are already a member of this team'), 409);
  }

  // Atomic join + add member in a single transaction
  let joinRole: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    joinRole = await sql.begin(async (tx: any) => {
      const joinResult = await invitationRepository.atomicJoin(invitation.id, tx);
      if (!joinResult) {
        throw new Error('INVITE_EXHAUSTED');
      }
      await teamMemberRepository.addMember(invitation.team_id, user.id, joinResult.role as 'admin' | 'facilitator' | 'member', tx);
      return joinResult.role as string;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'INVITE_EXHAUSTED') {
      return c.json(formatErrorResponse('TEAM_INVITE_EXHAUSTED', 'Invitation has reached its usage limit'), 410);
    }
    throw err;
  }

  // Get team for response
  const team = await teamRepository.findByIdForUser(invitation.team_id, user.id);

  return c.json({
    team: formatTeam(team),
    membership: {
      role: joinRole,
      joined_at: new Date().toISOString(),
    },
  });
});

// GET /api/v1/teams/:id — Get team detail
teamsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const idParsed = uuidParamSchema.safeParse(id);
  if (!idParsed.success) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid team ID format',
      },
    }, 400);
  }

  const user = c.get('user');

  // Check team exists
  const teamExists = await teamRepository.findById(id);
  if (!teamExists) {
    return c.json(formatErrorResponse('TEAM_NOT_FOUND', 'Team not found'), 404);
  }

  const team = await teamRepository.findByIdForUser(id, user.id);
  if (!team) {
    return c.json(formatErrorResponse('TEAM_NOT_MEMBER', 'You are not a member of this team'), 403);
  }

  return c.json({ team: formatTeam(team) });
});

// PUT/PATCH /api/v1/teams/:id — Update team
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateTeamHandler = async (c: any) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
    }, 400);
  }

  const id = c.req.param('id');
  const user = c.get('user');

  // Build update object carefully: only include fields that were actually provided
  const updateData: { name?: string; description?: string | null; avatar_url?: string | null; theme?: string } = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if ('description' in body) updateData.description = parsed.data.description ?? null;
  if ('avatar_url' in body) updateData.avatar_url = parsed.data.avatar_url ?? null;
  if (parsed.data.theme !== undefined) updateData.theme = parsed.data.theme;

  const updated = await teamRepository.update(id, updateData);
  if (!updated) {
    return c.json(formatErrorResponse('TEAM_NOT_FOUND', 'Team not found'), 404);
  }

  const team = await teamRepository.findByIdForUser(id, user.id);
  return c.json({ team: formatTeam(team) });
};
teamsRouter.put('/:id', requireTeamRole(['admin']), updateTeamHandler);
teamsRouter.patch('/:id', requireTeamRole(['admin']), updateTeamHandler);

// DELETE /api/v1/teams/:id — Soft delete team
teamsRouter.delete('/:id', requireTeamRole(['admin']), async (c) => {
  const id = c.req.param('id');
  await teamRepository.softDelete(id);
  return c.body(null, 204);
});

// GET /api/v1/teams/:id/members — List members
teamsRouter.get('/:id/members', requireTeamRole(['admin', 'facilitator', 'member']), async (c) => {
  const teamId = c.req.param('id');
  const members = await teamMemberRepository.findByTeam(teamId);

  return c.json({
    members: members.map((m: Record<string, unknown>) => ({
      user: {
        id: m.id,
        email: m.email,
        display_name: m.display_name,
        avatar_url: m.avatar_url ?? null,
      },
      role: m.role,
      joined_at: m.joined_at,
    })),
  });
});

// POST /api/v1/teams/:id/invitations — Create invitation
teamsRouter.post('/:id/invitations', requireTeamRole(['admin', 'facilitator']), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
    }, 400);
  }

  const teamId = c.req.param('id');
  const user = c.get('user');
  const teamRole = c.get('teamRole');
  const { expires_in_hours, max_uses, role } = parsed.data;

  // Facilitators can't create admin invites
  if (teamRole === 'facilitator' && role === 'admin') {
    return c.json(formatErrorResponse('TEAM_INSUFFICIENT_ROLE', 'Facilitators cannot create admin invitations'), 403);
  }

  // Check active invite limit
  const activeCount = await invitationRepository.countActiveByTeam(teamId);
  if (activeCount >= 5) {
    return c.json(formatErrorResponse('TEAM_INVITE_LIMIT_REACHED', 'Team already has 5 active invitations'), 400);
  }

  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);

  const invitation = await invitationRepository.create({
    team_id: teamId,
    code,
    created_by: user.id,
    expires_at: expiresAt,
    max_uses: max_uses ?? null,
    role: role ?? 'member',
  });

  const origin = new URL(c.req.url).origin;
  return c.json({ invitation: formatInvitation(invitation, origin) }, 201);
});

// GET /api/v1/teams/:id/invitations — List active invitations
teamsRouter.get('/:id/invitations', requireTeamRole(['admin', 'facilitator']), async (c) => {
  const teamId = c.req.param('id');
  const invitations = await invitationRepository.findActiveByTeam(teamId);
  const origin = new URL(c.req.url).origin;
  return c.json({
    invitations: invitations.map((inv) => formatInvitation(inv, origin)),
  });
});

// DELETE /api/v1/teams/:id/invitations/:inviteId — Revoke invitation
teamsRouter.delete('/:id/invitations/:inviteId', requireTeamRole(['admin', 'facilitator']), async (c) => {
  const teamId = c.req.param('id');
  const inviteId = c.req.param('inviteId');
  const revoked = await invitationRepository.revoke(inviteId, teamId);
  if (!revoked) {
    return c.json(formatErrorResponse('TEAM_INVITE_NOT_FOUND', 'Invitation not found or already revoked'), 404);
  }
  return c.body(null, 204);
});

// PUT /api/v1/teams/:id/members/:userId — Update member role
teamsRouter.put('/:id/members/:userId', requireTeamRole(['admin']), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateMemberRoleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
    }, 400);
  }

  const teamId = c.req.param('id');
  const targetUserId = c.req.param('userId');
  const { role: newRole } = parsed.data;

  // Check target is a member
  const targetMember = await teamMemberRepository.findMembership(teamId, targetUserId);
  if (!targetMember) {
    return c.json(formatErrorResponse('TEAM_NOT_FOUND', 'Target user is not a member of this team'), 404);
  }

  // Last admin protection: if demoting an admin, check count
  if (targetMember.role === 'admin' && newRole !== 'admin') {
    const adminCount = await teamMemberRepository.countAdmins(teamId);
    if (adminCount <= 1) {
      return c.json(formatErrorResponse('TEAM_LAST_ADMIN', 'Cannot demote the last admin'), 400);
    }
  }

  const updated = await teamMemberRepository.updateRole(teamId, targetUserId, newRole);

  // Get user info for response
  const members = await teamMemberRepository.findByTeam(teamId);
  const memberInfo = members.find((m: Record<string, unknown>) => m.id === targetUserId);

  return c.json({
    member: {
      user: {
        id: memberInfo!.id,
        email: memberInfo!.email,
        display_name: memberInfo!.display_name,
        avatar_url: (memberInfo!.avatar_url as string) ?? null,
      },
      role: updated.role,
      joined_at: updated.joined_at,
    },
  });
});

// DELETE /api/v1/teams/:id/members/:userId — Remove member
teamsRouter.delete('/:id/members/:userId', async (c) => {
  const teamId = c.req.param('id');
  const targetUserId = c.req.param('userId');
  const user = c.get('user');

  // Validate UUID
  const idParsed = uuidParamSchema.safeParse(teamId);
  if (!idParsed.success) {
    return c.json(formatErrorResponse('VALIDATION_ERROR', 'Invalid team ID format'), 400);
  }

  // Check team exists
  const team = await teamRepository.findById(teamId);
  if (!team) {
    return c.json(formatErrorResponse('TEAM_NOT_FOUND', 'Team not found'), 404);
  }

  // Check requesting user's membership
  const requesterMembership = await teamMemberRepository.findMembership(teamId, user.id);
  if (!requesterMembership) {
    return c.json(formatErrorResponse('TEAM_NOT_MEMBER', 'You are not a member of this team'), 403);
  }

  const isSelfRemoval = targetUserId === user.id;

  if (!isSelfRemoval && requesterMembership.role !== 'admin') {
    return c.json(formatErrorResponse('TEAM_INSUFFICIENT_ROLE', 'Only admins can remove other members'), 403);
  }

  // Check target exists as member
  const targetMember = await teamMemberRepository.findMembership(teamId, targetUserId);
  if (!targetMember) {
    return c.json(formatErrorResponse('TEAM_NOT_FOUND', 'Target user is not a member of this team'), 404);
  }

  // Last admin protection
  if (targetMember.role === 'admin') {
    const adminCount = await teamMemberRepository.countAdmins(teamId);
    if (adminCount <= 1) {
      return c.json(formatErrorResponse('TEAM_LAST_ADMIN', 'The last admin cannot be removed'), 400);
    }
  }

  await teamMemberRepository.removeMember(teamId, targetUserId);
  return c.json({ message: 'Member removed successfully' });
});

export { teamsRouter };
