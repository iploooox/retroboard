import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../../../src/db/connection.js';
import { truncateTables, createTestTeam, createTestSprint } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';
import { createTestApp } from '../../helpers/test-app.js';

const app = createTestApp();

describe('S-025: Advanced System Templates', () => {
  beforeEach(async () => {
    await truncateTables();
    await seed();
  });

  it('3.1: All 6 system templates exist after migration', async () => {
    const templates = await sql`
      SELECT * FROM templates WHERE is_system = true
    `;
    expect(templates).toHaveLength(6);
  });

  it('3.2: 4Ls has 4 columns with correct names and colors', async () => {
    const [template] = await sql`
      SELECT * FROM templates WHERE name = '4Ls' AND is_system = true
    `;
    expect(template).toBeDefined();

    const columns = await sql`
      SELECT name, color, position
      FROM template_columns
      WHERE template_id = ${template.id}
      ORDER BY position
    `;

    expect(columns).toHaveLength(4);
    expect(columns[0].name).toBe('Liked');
    expect(columns[0].color).toBe('#22c55e');
    expect(columns[1].name).toBe('Learned');
    expect(columns[1].color).toBe('#3b82f6');
    expect(columns[2].name).toBe('Lacked');
    expect(columns[2].color).toBe('#f59e0b');
    expect(columns[3].name).toBe('Longed For');
    expect(columns[3].color).toBe('#8b5cf6');
  });

  it('3.3: Mad/Sad/Glad has 3 columns with correct names and colors', async () => {
    const [template] = await sql`
      SELECT * FROM templates WHERE name = 'Mad / Sad / Glad' AND is_system = true
    `;
    expect(template).toBeDefined();

    const columns = await sql`
      SELECT name, color, position
      FROM template_columns
      WHERE template_id = ${template.id}
      ORDER BY position
    `;

    expect(columns).toHaveLength(3);
    expect(columns[0].name).toBe('Mad');
    expect(columns[0].color).toBe('#ef4444');
    expect(columns[1].name).toBe('Sad');
    expect(columns[1].color).toBe('#6366f1');
    expect(columns[2].name).toBe('Glad');
    expect(columns[2].color).toBe('#22c55e');
  });

  it('3.4: Sailboat has 4 columns with correct names and colors', async () => {
    const [template] = await sql`
      SELECT * FROM templates WHERE name = 'Sailboat' AND is_system = true
    `;
    expect(template).toBeDefined();

    const columns = await sql`
      SELECT name, color, position
      FROM template_columns
      WHERE template_id = ${template.id}
      ORDER BY position
    `;

    expect(columns).toHaveLength(4);
    expect(columns[0].name).toBe('Wind (Helps Us)');
    expect(columns[0].color).toBe('#22c55e');
    expect(columns[1].name).toBe('Anchor (Holds Us Back)');
    expect(columns[1].color).toBe('#ef4444');
    expect(columns[2].name).toBe('Rocks (Risks)');
    expect(columns[2].color).toBe('#f59e0b');
    expect(columns[3].name).toBe('Island (Goals)');
    expect(columns[3].color).toBe('#3b82f6');
  });

  it('3.5: Starfish has 5 columns with correct names and colors', async () => {
    const [template] = await sql`
      SELECT * FROM templates WHERE name = 'Starfish' AND is_system = true
    `;
    expect(template).toBeDefined();

    const columns = await sql`
      SELECT name, color, position
      FROM template_columns
      WHERE template_id = ${template.id}
      ORDER BY position
    `;

    expect(columns).toHaveLength(5);
    expect(columns[0].name).toBe('Keep Doing');
    expect(columns[0].color).toBe('#22c55e');
    expect(columns[1].name).toBe('More Of');
    expect(columns[1].color).toBe('#3b82f6');
    expect(columns[2].name).toBe('Less Of');
    expect(columns[2].color).toBe('#f59e0b');
    expect(columns[3].name).toBe('Stop Doing');
    expect(columns[3].color).toBe('#ef4444');
    expect(columns[4].name).toBe('Start Doing');
    expect(columns[4].color).toBe('#8b5cf6');
  });

  it('3.6: All system templates have team_id = NULL and created_by = NULL', async () => {
    const templates = await sql`
      SELECT * FROM templates WHERE is_system = true
    `;

    templates.forEach((template) => {
      expect(template.team_id).toBeNull();
      expect(template.created_by).toBeNull();
    });
  });

  it('3.7: All system templates have non-empty descriptions', async () => {
    const templates = await sql`
      SELECT * FROM templates WHERE is_system = true
    `;

    templates.forEach((template) => {
      expect(template.description).toBeTruthy();
      expect(template.description.length).toBeGreaterThan(0);
    });
  });

  it('3.8: All system templates have non-empty prompt_text for columns', async () => {
    const templates = await sql`
      SELECT id FROM templates WHERE is_system = true
    `;

    for (const template of templates) {
      const columns = await sql`
        SELECT prompt_text FROM template_columns WHERE template_id = ${template.id}
      `;

      columns.forEach((column) => {
        expect(column.prompt_text).toBeTruthy();
        expect(column.prompt_text.length).toBeGreaterThan(0);
      });
    }
  });

  it('3.9: Column positions are sequential starting from 0', async () => {
    const templates = await sql`
      SELECT id FROM templates WHERE is_system = true
    `;

    for (const template of templates) {
      const columns = await sql`
        SELECT position FROM template_columns
        WHERE template_id = ${template.id}
        ORDER BY position
      `;

      columns.forEach((column, index) => {
        expect(column.position).toBe(index);
      });
    }
  });

  it('3.10: Seed is idempotent - running twice does not create duplicates', async () => {
    const countBefore = await sql`
      SELECT COUNT(*) as count FROM templates WHERE is_system = true
    `;

    // Run seed again
    await seed();

    const countAfter = await sql`
      SELECT COUNT(*) as count FROM templates WHERE is_system = true
    `;

    expect(countAfter[0].count).toBe(countBefore[0].count);
    expect(countAfter[0].count).toBe(6);
  });

  it('3.11: Create board from 4Ls template creates correct columns', async () => {
    const auth = await getAuthToken();
    const team = await createTestTeam(auth.user.id);
    const sprint = await createTestSprint(team.id, auth.user.id);

    const [template] = await sql`
      SELECT id FROM templates WHERE name = '4Ls' AND is_system = true
    `;

    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_id: template.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.columns).toHaveLength(4);
  });

  it('3.12: Create board from Starfish template creates 5 columns', async () => {
    const auth = await getAuthToken();
    const team = await createTestTeam(auth.user.id);
    const sprint = await createTestSprint(team.id, auth.user.id);

    const [template] = await sql`
      SELECT id FROM templates WHERE name = 'Starfish' AND is_system = true
    `;

    const res = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_id: template.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.columns).toHaveLength(5);
  });

  it('3.13: All 6 templates are visible in list endpoint', async () => {
    const auth = await getAuthToken();

    const res = await app.request('/api/v1/templates', {
      headers: { 'Authorization': `Bearer ${auth.token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toHaveLength(6);

    const templateNames = body.templates.map((t: { name: string }) => t.name);
    expect(templateNames).toContain('What Went Well / Delta');
    expect(templateNames).toContain('Start / Stop / Continue');
    expect(templateNames).toContain('4Ls');
    expect(templateNames).toContain('Mad / Sad / Glad');
    expect(templateNames).toContain('Sailboat');
    expect(templateNames).toContain('Starfish');
  });
});
