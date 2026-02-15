import { describe, it, expect, afterEach } from 'vitest';
import { sql } from '../src/db/connection.js';
import { truncateTables, createTestUser, createTestTeam } from './helpers/db.js';
import { seed } from '../src/db/seed.js';

describe('Database', () => {
  afterEach(async () => {
    await truncateTables();
    // Re-seed templates after truncation
    await seed(process.env.DATABASE_URL);
  });

  it('migrations created all tables', async () => {
    const result = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    const tables = result.map((r) => r.table_name);

    expect(tables).toContain('users');
    expect(tables).toContain('refresh_tokens');
    expect(tables).toContain('rate_limits');
    expect(tables).toContain('teams');
    expect(tables).toContain('team_members');
    expect(tables).toContain('team_invitations');
    expect(tables).toContain('sprints');
    expect(tables).toContain('templates');
    expect(tables).toContain('template_columns');
    expect(tables).toContain('schema_migrations');
  });

  it('seed created system templates', async () => {
    const templates = await sql`
      SELECT * FROM templates WHERE is_system = true ORDER BY name
    `;
    expect(templates).toHaveLength(6);

    // Check a few key templates exist
    const templateNames = templates.map((t: any) => t.name);
    expect(templateNames).toContain('Start / Stop / Continue');
    expect(templateNames).toContain('What Went Well / Delta');
    expect(templateNames).toContain('4Ls');
    expect(templateNames).toContain('Mad / Sad / Glad');
    expect(templateNames).toContain('Sailboat');
    expect(templateNames).toContain('Starfish');

    // Check WWD template columns
    const wwdTemplate = templates.find((t: any) => t.name === 'What Went Well / Delta');
    const columns = await sql`
      SELECT * FROM template_columns
      WHERE template_id = ${wwdTemplate.id}
      ORDER BY position
    `;
    expect(columns).toHaveLength(2);
    expect(columns[0].name).toBe('What Went Well');
    expect(columns[0].color).toBe('#22c55e');
    expect(columns[1].name).toBe('Delta (What to Change)');
    expect(columns[1].color).toBe('#ef4444');
  });

  it('can create a test user', async () => {
    const user = await createTestUser({ email: 'alice@example.com', displayName: 'Alice' });
    expect(user.id).toBeDefined();
    expect(user.email).toBe('alice@example.com');
    expect(user.display_name).toBe('Alice');
  });

  it('can create a test team with admin member', async () => {
    const user = await createTestUser();
    const team = await createTestTeam(user.id);

    expect(team.id).toBeDefined();
    expect(team.name).toBe('Test Team');

    const [membership] = await sql`
      SELECT * FROM team_members WHERE team_id = ${team.id} AND user_id = ${user.id}
    `;
    expect(membership.role).toBe('admin');
  });

  it('enforces unique email constraint', async () => {
    await createTestUser({ email: 'dupe@example.com' });
    await expect(createTestUser({ email: 'dupe@example.com' })).rejects.toThrow();
  });

  it('enforces one active sprint per team', async () => {
    const user = await createTestUser();
    const team = await createTestTeam(user.id);

    await sql`
      INSERT INTO sprints (team_id, name, start_date, status, sprint_number, created_by)
      VALUES (${team.id}, 'Sprint 1', '2026-01-01', 'active', 1, ${user.id})
    `;

    await expect(sql`
      INSERT INTO sprints (team_id, name, start_date, status, sprint_number, created_by)
      VALUES (${team.id}, 'Sprint 2', '2026-01-15', 'active', 2, ${user.id})
    `).rejects.toThrow();
  });
});
