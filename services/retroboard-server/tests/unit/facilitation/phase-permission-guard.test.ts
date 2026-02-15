import { describe, it, expect } from 'vitest';
import { checkPhasePermission } from '../../../src/middleware/phase-permission-guard.js';

describe('Phase Permission Guard', () => {
  // ─── Write Phase ───────────────────────────────────────────────────

  it('3.2.1: Add card in write phase → allowed', () => {
    const result = checkPhasePermission({
      phase: 'write',
      action: 'add_card',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(true);
  });

  it('3.2.2: Add card in group phase → denied', () => {
    const result = checkPhasePermission({
      phase: 'group',
      action: 'add_card',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(false);
  });

  it('3.2.3: Add card in vote phase → denied', () => {
    const result = checkPhasePermission({
      phase: 'vote',
      action: 'add_card',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(false);
  });

  // ─── Group Phase ───────────────────────────────────────────────────

  it('3.2.4: Move card to group in group phase → allowed', () => {
    const result = checkPhasePermission({
      phase: 'group',
      action: 'group_card',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(true);
  });

  it('3.2.5: Move card to group in write phase → denied', () => {
    const result = checkPhasePermission({
      phase: 'write',
      action: 'group_card',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(false);
  });

  // ─── Vote Phase ────────────────────────────────────────────────────

  it('3.2.6: Vote in vote phase → allowed', () => {
    const result = checkPhasePermission({
      phase: 'vote',
      action: 'vote',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(true);
  });

  it('3.2.7: Vote in write phase → denied', () => {
    const result = checkPhasePermission({
      phase: 'write',
      action: 'vote',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(false);
  });

  // ─── Action Items ──────────────────────────────────────────────────

  it('3.2.8: Create action item in action phase → allowed', () => {
    const result = checkPhasePermission({
      phase: 'action',
      action: 'create_action',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(true);
  });

  it('3.2.9: Create action item in discuss phase → allowed', () => {
    const result = checkPhasePermission({
      phase: 'discuss',
      action: 'create_action',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(true);
  });

  it('3.2.10: Create action item in write phase → denied', () => {
    const result = checkPhasePermission({
      phase: 'write',
      action: 'create_action',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(false);
  });

  // ─── Edit Card ─────────────────────────────────────────────────────

  it('3.2.11: Edit own card in write phase → allowed', () => {
    const result = checkPhasePermission({
      phase: 'write',
      action: 'edit_card',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(true);
  });

  it('3.2.12: Edit own card in group phase → allowed', () => {
    const result = checkPhasePermission({
      phase: 'group',
      action: 'edit_card',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(true);
  });

  it('3.2.13: Edit own card in vote phase → denied', () => {
    const result = checkPhasePermission({
      phase: 'vote',
      action: 'edit_card',
      role: 'member',
      isLocked: false,
    });
    expect(result.allowed).toBe(false);
  });

  // ─── Board Lock Override ───────────────────────────────────────────

  it('3.2.14: Board locked, non-facilitator add card → denied', () => {
    const result = checkPhasePermission({
      phase: 'write',
      action: 'add_card',
      role: 'member',
      isLocked: true,
    });
    expect(result.allowed).toBe(false);
  });

  it('3.2.15: Board locked, facilitator add card → allowed', () => {
    const result = checkPhasePermission({
      phase: 'write',
      action: 'add_card',
      role: 'facilitator',
      isLocked: true,
    });
    expect(result.allowed).toBe(true);
  });
});
