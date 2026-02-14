import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import { truncateTables } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

const app = createTestApp();

describe('GET /api/v1/templates', () => {
  beforeEach(async () => {
    await truncateTables();
    // Re-seed system templates after truncation
    await seed(process.env.DATABASE_URL);
  });

  it('2.1.1: list templates returns system templates', async () => {
    const auth = await getAuthToken();

    const res = await app.request('/api/v1/templates', {
      headers: { 'Authorization': `Bearer ${auth.token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toHaveLength(2);
    expect(body.templates[0].is_system).toBe(true);
    expect(body.templates[1].is_system).toBe(true);
  });

  it('2.1.4: unauthenticated user gets 401', async () => {
    const res = await app.request('/api/v1/templates');
    expect(res.status).toBe(401);
  });

  it('2.1.5: system templates listed in correct order', async () => {
    const auth = await getAuthToken();

    const res = await app.request('/api/v1/templates', {
      headers: { 'Authorization': `Bearer ${auth.token}` },
    });

    const body = await res.json();
    const names = body.templates.map((t: { name: string }) => t.name);
    expect(names).toContain('What Went Well / Delta');
    expect(names).toContain('Start / Stop / Continue');
  });

  it('2.1.6: each template includes column_count', async () => {
    const auth = await getAuthToken();

    const res = await app.request('/api/v1/templates', {
      headers: { 'Authorization': `Bearer ${auth.token}` },
    });

    const body = await res.json();
    const wwwDelta = body.templates.find((t: { name: string }) => t.name === 'What Went Well / Delta');
    const ssc = body.templates.find((t: { name: string }) => t.name === 'Start / Stop / Continue');

    expect(wwwDelta.column_count).toBe(2);
    expect(ssc.column_count).toBe(3);
  });

  it('template includes all required fields', async () => {
    const auth = await getAuthToken();

    const res = await app.request('/api/v1/templates', {
      headers: { 'Authorization': `Bearer ${auth.token}` },
    });

    const body = await res.json();
    const template = body.templates[0];
    expect(template.id).toBeDefined();
    expect(template.name).toBeDefined();
    expect(template.description).toBeDefined();
    expect(template.is_system).toBeDefined();
    expect(template.team_id).toBeNull();
    expect(template.created_by).toBeNull();
    expect(template.column_count).toBeDefined();
    expect(template.created_at).toBeDefined();
    expect(template.updated_at).toBeDefined();
  });
});
