import { describe, it, expect } from 'vitest';
import {
  validateCreateSprint,

  validateStatusTransition,
} from '../../../src/validation/sprints.js';
import { AppError } from '../../../src/utils/errors.js';

function expectAppError(fn: () => void, code: string) {
  try {
    fn();
    expect.fail('Expected AppError to be thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe(code);
  }
}

describe('Sprint Validation', () => {
  describe('validateCreateSprint', () => {
    it('U-SV-01: valid sprint data passes', () => {
      const result = validateCreateSprint({
        name: 'Sprint 1',
        start_date: '2026-03-01',
        end_date: '2026-03-14',
      });
      expect(result.name).toBe('Sprint 1');
      expect(result.start_date).toBe('2026-03-01');
      expect(result.end_date).toBe('2026-03-14');
    });

    it('U-SV-02: missing name rejected', () => {
      expect(() => validateCreateSprint({ start_date: '2026-03-01' }))
        .toThrow('name is required');
    });

    it('U-SV-03: empty name rejected', () => {
      expect(() => validateCreateSprint({ name: '', start_date: '2026-03-01' }))
        .toThrow('name must not be empty');
    });

    it('U-SV-04: name over 100 chars rejected', () => {
      expect(() => validateCreateSprint({ name: 'x'.repeat(101), start_date: '2026-03-01' }))
        .toThrow('name must be at most 100 characters');
    });

    it('U-SV-05: missing start_date rejected', () => {
      expect(() => validateCreateSprint({ name: 'Sprint 1' }))
        .toThrow('start_date is required');
    });

    it('U-SV-06: invalid date format rejected', () => {
      expect(() => validateCreateSprint({ name: 'Sprint 1', start_date: '02-28-2026' }))
        .toThrow('start_date must be a valid date in YYYY-MM-DD format');
    });

    it('U-SV-07: invalid date value rejected', () => {
      expect(() => validateCreateSprint({ name: 'Sprint 1', start_date: '2026-13-45' }))
        .toThrow('start_date must be a valid date in YYYY-MM-DD format');
    });

    it('U-SV-08: end_date before start_date rejected', () => {
      expect(() => validateCreateSprint({
        name: 'Sprint 1',
        start_date: '2026-03-14',
        end_date: '2026-03-01',
      })).toThrow('end_date must be on or after start_date');
    });

    it('U-SV-09: end_date equal to start_date accepted', () => {
      const result = validateCreateSprint({
        name: 'Sprint 1',
        start_date: '2026-03-01',
        end_date: '2026-03-01',
      });
      expect(result.start_date).toBe('2026-03-01');
      expect(result.end_date).toBe('2026-03-01');
    });

    it('U-SV-10: null end_date accepted', () => {
      const result = validateCreateSprint({
        name: 'Sprint 1',
        start_date: '2026-03-01',
        end_date: null,
      });
      expect(result.end_date).toBeNull();
    });

    it('U-SV-11: goal over 500 chars rejected', () => {
      expect(() => validateCreateSprint({
        name: 'Sprint 1',
        start_date: '2026-03-01',
        goal: 'x'.repeat(501),
      })).toThrow('goal must be at most 500 characters');
    });

    it('U-SV-12: goal is optional', () => {
      const result = validateCreateSprint({
        name: 'Sprint 1',
        start_date: '2026-03-01',
      });
      expect(result.goal).toBeNull();
    });

    it('U-SV-13: name with only whitespace rejected', () => {
      expect(() => validateCreateSprint({ name: '   ', start_date: '2026-03-01' }))
        .toThrow('name must not be empty');
    });

    it('U-SV-14: invalid date (non-leap-year Feb 29) rejected', () => {
      expect(() => validateCreateSprint({ name: 'Sprint 1', start_date: '2027-02-29' }))
        .toThrow('start_date must be a valid date in YYYY-MM-DD format');
    });

    it('U-SV-15: ISO datetime format rejected (date-only required)', () => {
      expect(() => validateCreateSprint({ name: 'Sprint 1', start_date: '2026-03-01T00:00:00Z' }))
        .toThrow('start_date must be a valid date in YYYY-MM-DD format');
    });
  });

  describe('Status Transitions', () => {
    it('U-ST-01: planning to active is allowed', () => {
      expect(() => validateStatusTransition('planning', 'active')).not.toThrow();
    });

    it('U-ST-02: active to completed is allowed', () => {
      expect(() => validateStatusTransition('active', 'completed')).not.toThrow();
    });

    it('U-ST-03: planning to completed is rejected', () => {
      expectAppError(() => validateStatusTransition('planning', 'completed'), 'SPRINT_INVALID_TRANSITION');
    });

    it('U-ST-04: active to planning is rejected', () => {
      expectAppError(() => validateStatusTransition('active', 'planning'), 'SPRINT_INVALID_TRANSITION');
    });

    it('U-ST-05: completed to active is rejected', () => {
      expectAppError(() => validateStatusTransition('completed', 'active'), 'SPRINT_INVALID_TRANSITION');
    });

    it('U-ST-06: completed to planning is rejected', () => {
      expectAppError(() => validateStatusTransition('completed', 'planning'), 'SPRINT_INVALID_TRANSITION');
    });

    it('U-ST-07: planning to planning (no-op) is rejected', () => {
      expectAppError(() => validateStatusTransition('planning', 'planning'), 'SPRINT_INVALID_TRANSITION');
    });

    it('U-ST-08: active to active (no-op) is rejected', () => {
      expectAppError(() => validateStatusTransition('active', 'active'), 'SPRINT_INVALID_TRANSITION');
    });

    it('U-ST-09: completed to completed (no-op) is rejected', () => {
      expectAppError(() => validateStatusTransition('completed', 'completed'), 'SPRINT_INVALID_TRANSITION');
    });
  });
});
