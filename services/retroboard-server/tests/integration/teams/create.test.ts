import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../src/server.js';
import { truncateTables } from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';

describe('POST /api/v1/teams', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('I-CT-01: creates a team successfully', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Sprint Warriors', description: 'Our agile team' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.team.name).toBe('Sprint Warriors');
    expect(body.team.slug).toBe('sprint-warriors');
    expect(body.team.your_role).toBe('admin');
    expect(body.team.description).toBe('Our agile team');
  });

  it('I-CT-02: creator becomes admin member', async () => {
    const { token, user } = await getAuthToken();
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Test Team' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.team.your_role).toBe('admin');
    expect(body.team.created_by).toBe(user.id);
  });

  it('I-CT-03: auto-generates slug from name', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'My Team' }),
    });

    const body = await res.json();
    expect(body.team.slug).toBe('my-team');
  });

  it('I-CT-04: appends suffix for duplicate slugs', async () => {
    const { token } = await getAuthToken();

    await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Team' }),
    });

    const res2 = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Team' }),
    });

    const body2 = await res2.json();
    expect(body2.team.slug).toBe('my-team-2');
  });

  it('I-CT-05: missing name returns 400', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('I-CT-06: empty name returns 400', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });

    expect(res.status).toBe(400);
  });

  it('I-CT-07: name over 100 chars returns 400', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A'.repeat(101) }),
    });

    expect(res.status).toBe(400);
  });

  it('I-CT-08: description is optional and defaults to null', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Team No Desc' }),
    });

    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.team.description).toBeNull();
  });

  it('I-CT-09: member_count is 1 after creation', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Team' }),
    });

    const body = await res.json();
    expect(body.team.member_count).toBe(1);
  });

  it('I-CT-10: unauthenticated request returns 401', async () => {
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Team' }),
    });

    expect(res.status).toBe(401);
  });

  it('I-CT-11: whitespace-only name returns 400', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });

    expect(res.status).toBe(400);
  });

  it('I-CT-12: description over 500 chars returns 400', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Team', description: 'A'.repeat(501) }),
    });

    expect(res.status).toBe(400);
  });

  it('I-CT-13: invalid avatar_url returns 400', async () => {
    const { token } = await getAuthToken();
    const res = await app.request('/api/v1/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Team', avatar_url: 'not-a-url' }),
    });

    expect(res.status).toBe(400);
  });
});
