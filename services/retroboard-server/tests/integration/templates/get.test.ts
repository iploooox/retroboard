import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import { truncateTables } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('GET /api/v1/templates/:id', () => {
  beforeEach(async () => {
    await truncateTables();
    await seed(process.env.DATABASE_URL);
  });

  it('2.2.1: get system template (What Went Well / Delta)', async () => {
    const auth = await getAuthToken();

    const res = await app.request('/api/v1/templates/00000000-0000-4000-8000-000000000001', {
      headers: { 'Authorization': `Bearer ${auth.token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.template.name).toBe('What Went Well / Delta');
    expect(body.template.is_system).toBe(true);
    expect(body.template.columns).toHaveLength(2);
    expect(body.template.columns[0].name).toBe('What Went Well');
    expect(body.template.columns[0].color).toBe('#22c55e');
    expect(body.template.columns[1].name).toBe('Delta (What to Change)');
    expect(body.template.columns[1].color).toBe('#ef4444');
  });

  it('2.2.2: get system template (Start / Stop / Continue)', async () => {
    const auth = await getAuthToken();

    const res = await app.request('/api/v1/templates/00000000-0000-4000-8000-000000000002', {
      headers: { 'Authorization': `Bearer ${auth.token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.template.name).toBe('Start / Stop / Continue');
    expect(body.template.columns).toHaveLength(3);
  });

  it('2.2.5: get non-existent template ID', async () => {
    const auth = await getAuthToken();

    const res = await app.request('/api/v1/templates/00000000-0000-4000-8000-000000099999', {
      headers: { 'Authorization': `Bearer ${auth.token}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('2.2.6: columns ordered by position', async () => {
    const auth = await getAuthToken();

    const res = await app.request('/api/v1/templates/00000000-0000-4000-8000-000000000002', {
      headers: { 'Authorization': `Bearer ${auth.token}` },
    });

    const body = await res.json();
    for (let i = 0; i < body.template.columns.length - 1; i++) {
      expect(body.template.columns[i].position).toBeLessThan(body.template.columns[i + 1].position);
    }
  });

  it('2.2.7: get template without authentication returns 401', async () => {
    const res = await app.request('/api/v1/templates/00000000-0000-4000-8000-000000000001');
    expect(res.status).toBe(401);
  });

  it('template detail includes all fields', async () => {
    const auth = await getAuthToken();

    const res = await app.request('/api/v1/templates/00000000-0000-4000-8000-000000000001', {
      headers: { 'Authorization': `Bearer ${auth.token}` },
    });

    const body = await res.json();
    const t = body.template;
    expect(t.id).toBeDefined();
    expect(t.name).toBeDefined();
    expect(t.description).toBeDefined();
    expect(t.is_system).toBe(true);
    expect(t.team_id).toBeNull();
    expect(t.created_by).toBeNull();
    expect(t.created_at).toBeDefined();
    expect(t.updated_at).toBeDefined();
    expect(t.columns).toBeDefined();

    // Each column has correct fields
    const col = t.columns[0];
    expect(col.id).toBeDefined();
    expect(col.name).toBeDefined();
    expect(col.color).toBeDefined();
    expect(col.prompt_text).toBeDefined();
    expect(typeof col.position).toBe('number');
  });
});
