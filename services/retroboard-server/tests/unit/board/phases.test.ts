import { describe, it, expect } from 'vitest';
import { ALLOWED_TRANSITIONS, BOARD_PHASES } from '../../../src/validation/boards.js';

describe('Phase Transition Logic', () => {
  it('1.4.1: Advance from write to group', () => {
    expect(ALLOWED_TRANSITIONS['write']).toContain('group');
  });

  it('1.4.2: Advance from group to vote', () => {
    expect(ALLOWED_TRANSITIONS['group']).toContain('vote');
  });

  it('1.4.3: Advance from vote to discuss', () => {
    expect(ALLOWED_TRANSITIONS['vote']).toContain('discuss');
  });

  it('1.4.4: Advance from discuss to action', () => {
    expect(ALLOWED_TRANSITIONS['discuss']).toContain('action');
  });

  it('1.4.5: Go back from group to write', () => {
    expect(ALLOWED_TRANSITIONS['group']).toContain('write');
  });

  it('1.4.6: Go back from vote to group', () => {
    expect(ALLOWED_TRANSITIONS['vote']).toContain('group');
  });

  it('1.4.7: Go back from discuss to vote', () => {
    expect(ALLOWED_TRANSITIONS['discuss']).toContain('vote');
  });

  it('1.4.8: Go back from action to discuss', () => {
    expect(ALLOWED_TRANSITIONS['action']).toContain('discuss');
  });

  it('1.4.9: Skip forward: write to vote is NOT allowed', () => {
    expect(ALLOWED_TRANSITIONS['write']).not.toContain('vote');
  });

  it('1.4.10: Skip forward: write to discuss is NOT allowed', () => {
    expect(ALLOWED_TRANSITIONS['write']).not.toContain('discuss');
  });

  it('1.4.11: Skip forward: group to discuss is NOT allowed', () => {
    expect(ALLOWED_TRANSITIONS['group']).not.toContain('discuss');
  });

  it('1.4.12: Skip backward: action to write is NOT allowed', () => {
    expect(ALLOWED_TRANSITIONS['action']).not.toContain('write');
  });

  it('1.4.13: Set phase to current phase (no-op) is NOT allowed', () => {
    for (const phase of BOARD_PHASES) {
      expect(ALLOWED_TRANSITIONS[phase]).not.toContain(phase);
    }
  });

  it('1.4.14: All defined phases have transition rules', () => {
    for (const phase of BOARD_PHASES) {
      expect(ALLOWED_TRANSITIONS[phase]).toBeDefined();
      expect(Array.isArray(ALLOWED_TRANSITIONS[phase])).toBe(true);
    }
  });
});
