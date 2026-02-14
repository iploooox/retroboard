import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../../src/utils/password.js';

describe('Password Utility', () => {
  it('U-PW-01: hash produces bcrypt string with $2a$12$ prefix and length 60', async () => {
    const hash = await hashPassword('testpassword');
    expect(hash).toMatch(/^\$2a\$12\$/);
    expect(hash).toHaveLength(60);
  });

  it('U-PW-02: hash is non-deterministic (same input, different hashes)', async () => {
    const hash1 = await hashPassword('testpassword');
    const hash2 = await hashPassword('testpassword');
    expect(hash1).not.toBe(hash2);
  });

  it('U-PW-03: compare returns true for correct password', async () => {
    const hash = await hashPassword('correct');
    const result = await comparePassword('correct', hash);
    expect(result).toBe(true);
  });

  it('U-PW-04: compare returns false for wrong password', async () => {
    const hash = await hashPassword('correct');
    const result = await comparePassword('wrong', hash);
    expect(result).toBe(false);
  });

  it('U-PW-05: hash uses cost factor 12', async () => {
    const hash = await hashPassword('anypassword');
    expect(hash).toContain('$2a$12$');
  });

  it('U-PW-07: hash handles max-length password (128 chars)', async () => {
    const longPassword = 'A'.repeat(128);
    const hash = await hashPassword(longPassword);
    expect(hash).toMatch(/^\$2a\$12\$/);
    expect(hash).toHaveLength(60);
  });
});
