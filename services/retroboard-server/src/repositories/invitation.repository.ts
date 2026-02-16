import postgres from 'postgres';
import { sql } from '../db/connection.js';

export interface CreateInvitationData {
  team_id: string;
  code: string;
  created_by: string;
  expires_at: Date;
  max_uses: number | null;
  role: 'admin' | 'facilitator' | 'member';
}

export const invitationRepository = {
  async create(data: CreateInvitationData) {
    const [invitation] = await sql`
      INSERT INTO team_invitations (team_id, code, created_by, expires_at, max_uses, role)
      VALUES (${data.team_id}, ${data.code}, ${data.created_by}, ${data.expires_at}, ${data.max_uses}, ${data.role})
      RETURNING *
    `;
    return invitation;
  },

  async findByToken(code: string) {
    const [invitation] = await sql`
      SELECT ti.*, t.name as team_name, t.slug as team_slug
      FROM team_invitations ti
      INNER JOIN teams t ON t.id = ti.team_id
      WHERE ti.code = ${code}
        AND ti.revoked_at IS NULL
        AND t.deleted_at IS NULL
    `;
    return invitation || null;
  },

  async findById(id: string) {
    const [invitation] = await sql`
      SELECT * FROM team_invitations WHERE id = ${id}
    `;
    return invitation || null;
  },

  async revoke(id: string, teamId: string) {
    const [invitation] = await sql`
      UPDATE team_invitations
      SET revoked_at = NOW()
      WHERE id = ${id} AND team_id = ${teamId} AND revoked_at IS NULL
      RETURNING id
    `;
    return !!invitation;
  },

  async findActiveByTeam(teamId: string) {
    return sql`
      SELECT * FROM team_invitations
      WHERE team_id = ${teamId}
        AND revoked_at IS NULL
        AND expires_at > NOW()
        AND (max_uses IS NULL OR use_count < max_uses)
      ORDER BY created_at DESC
    `;
  },

  async countActiveByTeam(teamId: string) {
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count
      FROM team_invitations
      WHERE team_id = ${teamId}
        AND revoked_at IS NULL
        AND expires_at > NOW()
        AND (max_uses IS NULL OR use_count < max_uses)
    `;
    return count;
  },

  async atomicJoin(inviteId: string, tx?: postgres.TransactionSql) {
    const db = tx || sql;
    const [result] = await db`
      UPDATE team_invitations
      SET use_count = use_count + 1
      WHERE id = ${inviteId}
        AND revoked_at IS NULL
        AND (max_uses IS NULL OR use_count < max_uses)
      RETURNING id, role, team_id
    `;
    return result || null;
  },
};
