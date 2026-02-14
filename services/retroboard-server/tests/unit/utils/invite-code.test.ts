import { describe, it, expect } from 'vitest';
import { generateInviteCode } from '../../../src/utils/invite-code.js';

describe('generateInviteCode', () => {
  it('U-INV-01: generates a 12-character code', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(12);
  });

  it('U-INV-02: generates only alphanumeric characters', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[a-zA-Z0-9]{12}$/);
  });

  it('U-INV-03: generates unique codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode());
    }
    expect(codes.size).toBe(100);
  });
});
