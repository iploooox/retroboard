import { sql } from '../db/connection.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TX = any;

export interface CreateTeamData {
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
}

export const teamRepository = {
  async create(data: CreateTeamData) {
    return sql.begin(async (tx: TX) => {
      const [team] = await tx`
        INSERT INTO teams (name, slug, description, avatar_url, created_by)
        VALUES (${data.name}, ${data.slug}, ${data.description}, ${data.avatar_url}, ${data.created_by})
        RETURNING *
      `;

      await tx`
        INSERT INTO team_members (team_id, user_id, role)
        VALUES (${team.id}, ${data.created_by}, 'admin')
      `;

      return { ...team, member_count: 1, your_role: 'admin' };
    });
  },

  async findById(id: string) {
    const [team] = await sql`
      SELECT t.*,
        (SELECT COUNT(*)::int FROM team_members WHERE team_id = t.id) AS member_count
      FROM teams t
      WHERE t.id = ${id} AND t.deleted_at IS NULL
    `;
    return team || null;
  },

  async findByIdForUser(id: string, userId: string) {
    const [team] = await sql`
      SELECT t.*, tm.role AS your_role,
        (SELECT COUNT(*)::int FROM team_members WHERE team_id = t.id) AS member_count
      FROM teams t
      INNER JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ${userId}
      WHERE t.id = ${id} AND t.deleted_at IS NULL
    `;
    return team || null;
  },

  async findBySlug(slug: string) {
    const [team] = await sql`
      SELECT * FROM teams WHERE slug = ${slug} AND deleted_at IS NULL
    `;
    return team || null;
  },

  async findByUserId(userId: string, page: number, perPage: number) {
    const offset = (page - 1) * perPage;

    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count
      FROM teams t
      INNER JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ${userId}
      WHERE t.deleted_at IS NULL
    `;

    const teams = await sql`
      SELECT t.*, tm.role AS your_role,
        (SELECT COUNT(*)::int FROM team_members WHERE team_id = t.id) AS member_count
      FROM teams t
      INNER JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ${userId}
      WHERE t.deleted_at IS NULL
      ORDER BY t.created_at DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;

    return {
      teams,
      total: count,
    };
  },

  async update(id: string, data: { name?: string; description?: string | null; avatar_url?: string | null; theme?: string }) {
    // Build SET clause dynamically — only update provided fields
    const sets: ReturnType<typeof sql>[] = [];
    if (data.name !== undefined) {
      sets.push(sql`name = ${data.name}`);
    }
    if (data.description !== undefined) {
      sets.push(sql`description = ${data.description}`);
    }
    if (data.avatar_url !== undefined) {
      sets.push(sql`avatar_url = ${data.avatar_url}`);
    }
    if (data.theme !== undefined) {
      sets.push(sql`theme = ${data.theme}`);
    }
    sets.push(sql`updated_at = NOW()`);

    const setCombined = sets.reduce((a, b) => sql`${a}, ${b}`);
    const [team] = await sql`
      UPDATE teams SET ${setCombined}
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *
    `;
    return team || null;
  },

  async softDelete(id: string) {
    const [team] = await sql`
      UPDATE teams SET deleted_at = NOW()
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING id
    `;
    return !!team;
  },

  async isSlugTaken(slug: string) {
    const [row] = await sql`
      SELECT 1 FROM teams WHERE slug = ${slug}
    `;
    return !!row;
  },
};
