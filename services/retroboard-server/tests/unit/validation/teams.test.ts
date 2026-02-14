import { describe, it, expect } from 'vitest';
import {
  createTeamSchema,
  updateTeamSchema,
  createInvitationSchema,
  updateMemberRoleSchema,
  paginationSchema,
  uuidParamSchema,
} from '../../../src/validation/teams.js';

describe('createTeamSchema', () => {
  it('accepts valid input', () => {
    const result = createTeamSchema.safeParse({ name: 'My Team' });
    expect(result.success).toBe(true);
  });

  it('accepts full input', () => {
    const result = createTeamSchema.safeParse({
      name: 'My Team',
      description: 'A great team',
      avatar_url: 'https://example.com/avatar.png',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = createTeamSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createTeamSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only name', () => {
    const result = createTeamSchema.safeParse({ name: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    const result = createTeamSchema.safeParse({ name: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects description over 500 chars', () => {
    const result = createTeamSchema.safeParse({
      name: 'Team',
      description: 'A'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid avatar_url', () => {
    const result = createTeamSchema.safeParse({
      name: 'Team',
      avatar_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('accepts null description', () => {
    const result = createTeamSchema.safeParse({ name: 'Team', description: null });
    expect(result.success).toBe(true);
  });

  it('accepts null avatar_url', () => {
    const result = createTeamSchema.safeParse({ name: 'Team', avatar_url: null });
    expect(result.success).toBe(true);
  });
});

describe('updateTeamSchema', () => {
  it('accepts partial update with name', () => {
    const result = updateTeamSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with description', () => {
    const result = updateTeamSchema.safeParse({ description: 'New Desc' });
    expect(result.success).toBe(true);
  });

  it('accepts null description to clear', () => {
    const result = updateTeamSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
  });

  it('rejects empty body', () => {
    const result = updateTeamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('createInvitationSchema', () => {
  it('accepts empty body with defaults', () => {
    const result = createInvitationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expires_in_hours).toBe(168);
      expect(result.data.max_uses).toBeNull();
      expect(result.data.role).toBe('member');
    }
  });

  it('accepts custom values', () => {
    const result = createInvitationSchema.safeParse({
      expires_in_hours: 24,
      max_uses: 5,
      role: 'facilitator',
    });
    expect(result.success).toBe(true);
  });

  it('rejects expires_in_hours = 0', () => {
    const result = createInvitationSchema.safeParse({ expires_in_hours: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects expires_in_hours > 720', () => {
    const result = createInvitationSchema.safeParse({ expires_in_hours: 800 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = createInvitationSchema.safeParse({ role: 'superadmin' });
    expect(result.success).toBe(false);
  });
});

describe('updateMemberRoleSchema', () => {
  it('accepts valid roles', () => {
    expect(updateMemberRoleSchema.safeParse({ role: 'admin' }).success).toBe(true);
    expect(updateMemberRoleSchema.safeParse({ role: 'facilitator' }).success).toBe(true);
    expect(updateMemberRoleSchema.safeParse({ role: 'member' }).success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = updateMemberRoleSchema.safeParse({ role: 'superadmin' });
    expect(result.success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('uses defaults', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.per_page).toBe(20);
    }
  });

  it('rejects negative page', () => {
    const result = paginationSchema.safeParse({ page: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects zero per_page', () => {
    const result = paginationSchema.safeParse({ per_page: 0 });
    expect(result.success).toBe(false);
  });

  it('caps per_page at 100', () => {
    const result = paginationSchema.safeParse({ per_page: 200 });
    expect(result.success).toBe(false);
  });
});

describe('uuidParamSchema', () => {
  it('accepts valid UUID', () => {
    expect(uuidParamSchema.safeParse('a1b2c3d4-e5f6-7890-abcd-ef1234567890').success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    expect(uuidParamSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});
