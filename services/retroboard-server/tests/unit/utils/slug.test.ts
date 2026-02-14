import { describe, it, expect } from 'vitest';
import { generateSlug } from '../../../src/utils/slug.js';

describe('generateSlug', () => {
  it('U-SLG-01: converts simple name to slug', () => {
    expect(generateSlug('Sprint Warriors')).toBe('sprint-warriors');
  });

  it('U-SLG-02: collapses multiple spaces', () => {
    expect(generateSlug('My  Cool   Team')).toBe('my-cool-team');
  });

  it('U-SLG-03: removes special characters', () => {
    expect(generateSlug('Team @#$% 2026!')).toBe('team-2026');
  });

  it('U-SLG-04: trims leading and trailing spaces', () => {
    expect(generateSlug('  Team A  ')).toBe('team-a');
  });

  it('U-SLG-05: passes through already-valid slug', () => {
    expect(generateSlug('my-team')).toBe('my-team');
  });

  it('U-SLG-06: handles unicode characters', () => {
    expect(generateSlug('Team Zolkiewska')).toBe('team-zolkiewska');
  });

  it('U-SLG-07: truncates to 50 characters', () => {
    const longName = 'A'.repeat(120);
    const slug = generateSlug(longName);
    expect(slug.length).toBeLessThanOrEqual(50);
  });

  it('U-SLG-08: falls back for all-special-chars input', () => {
    const slug = generateSlug('@#$%^&*');
    expect(slug).toBe('team');
  });

  it('U-SLG-09: handles numbers only', () => {
    expect(generateSlug('12345')).toBe('12345');
  });

  it('U-SLG-10: collapses consecutive hyphens', () => {
    expect(generateSlug('Team---Name')).toBe('team-name');
  });

  it('removes leading and trailing hyphens after cleanup', () => {
    expect(generateSlug('---Team---')).toBe('team');
  });
});
