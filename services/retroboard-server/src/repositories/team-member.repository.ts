import { sql } from '../db/connection.js';

export const teamMemberRepository = {
  async addMember(teamId: string, userId: string, role: 'admin' | 'facilitator' | 'member') {
    const [member] = await sql`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${teamId}, ${userId}, ${role})
      RETURNING *
    `;
    return member;
  },

  async removeMember(teamId: string, userId: string) {
    const result = await sql`
      DELETE FROM team_members
      WHERE team_id = ${teamId} AND user_id = ${userId}
      RETURNING team_id
    `;
    return result.length > 0;
  },

  async updateRole(teamId: string, userId: string, role: 'admin' | 'facilitator' | 'member') {
    const [member] = await sql`
      UPDATE team_members SET role = ${role}
      WHERE team_id = ${teamId} AND user_id = ${userId}
      RETURNING *
    `;
    return member || null;
  },

  async findByTeam(teamId: string) {
    return sql`
      SELECT u.id, u.email, u.display_name, u.avatar_url,
             tm.role, tm.joined_at
      FROM team_members tm
      INNER JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ${teamId}
      ORDER BY
        CASE tm.role
          WHEN 'admin' THEN 1
          WHEN 'facilitator' THEN 2
          WHEN 'member' THEN 3
        END,
        tm.joined_at ASC
    `;
  },

  async findMembership(teamId: string, userId: string) {
    const [member] = await sql`
      SELECT * FROM team_members
      WHERE team_id = ${teamId} AND user_id = ${userId}
    `;
    return member || null;
  },

  async countAdmins(teamId: string) {
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count
      FROM team_members
      WHERE team_id = ${teamId} AND role = 'admin'
    `;
    return count;
  },
};
