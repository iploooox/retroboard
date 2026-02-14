import { AppError } from '../utils/errors.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export interface CreateSprintInput {
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string | null;
}

export interface UpdateSprintInput {
  name?: string;
  goal?: string | null;
  start_date?: string;
  end_date?: string | null;
}

export function validateCreateSprint(body: unknown): CreateSprintInput {
  if (!body || typeof body !== 'object') {
    throw new AppError('VALIDATION_ERROR', 400, 'Request body is required');
  }

  const data = body as Record<string, unknown>;
  const errors: string[] = [];

  // Name validation
  if (data.name === undefined || data.name === null) {
    errors.push('name is required');
  } else if (typeof data.name !== 'string') {
    errors.push('name must be a string');
  } else {
    const trimmed = data.name.trim();
    if (trimmed.length === 0) {
      errors.push('name must not be empty');
    } else if (trimmed.length > 100) {
      errors.push('name must be at most 100 characters');
    }
  }

  // Goal validation
  if (data.goal !== undefined && data.goal !== null) {
    if (typeof data.goal !== 'string') {
      errors.push('goal must be a string');
    } else if (data.goal.length > 500) {
      errors.push('goal must be at most 500 characters');
    }
  }

  // start_date validation
  if (data.start_date === undefined || data.start_date === null) {
    errors.push('start_date is required');
  } else if (typeof data.start_date !== 'string') {
    errors.push('start_date must be a string');
  } else if (!isValidDate(data.start_date)) {
    errors.push('start_date must be a valid date in YYYY-MM-DD format');
  }

  // end_date validation
  if (data.end_date !== undefined && data.end_date !== null) {
    if (typeof data.end_date !== 'string') {
      errors.push('end_date must be a string');
    } else if (!isValidDate(data.end_date)) {
      errors.push('end_date must be a valid date in YYYY-MM-DD format');
    }
  }

  if (errors.length > 0) {
    throw new AppError('VALIDATION_ERROR', 400, errors.join('; '));
  }

  // Cross-field: end_date >= start_date
  if (data.end_date && typeof data.end_date === 'string' && typeof data.start_date === 'string') {
    if (data.end_date < data.start_date) {
      throw new AppError('SPRINT_DATE_INVALID', 400, 'end_date must be on or after start_date');
    }
  }

  return {
    name: (data.name as string).trim(),
    goal: data.goal !== undefined && data.goal !== null ? (data.goal as string) : null,
    start_date: data.start_date as string,
    end_date: data.end_date !== undefined && data.end_date !== null ? (data.end_date as string) : null,
  };
}

export function validateUpdateSprint(body: unknown, currentStatus: string): UpdateSprintInput {
  if (!body || typeof body !== 'object') {
    throw new AppError('VALIDATION_ERROR', 400, 'Request body is required');
  }

  const data = body as Record<string, unknown>;
  const errors: string[] = [];
  const result: UpdateSprintInput = {};
  let hasUpdatableField = false;

  // Name validation
  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      errors.push('name must be a string');
    } else {
      const trimmed = data.name.trim();
      if (trimmed.length === 0) {
        errors.push('name must not be empty');
      } else if (trimmed.length > 100) {
        errors.push('name must be at most 100 characters');
      } else {
        result.name = trimmed;
        hasUpdatableField = true;
      }
    }
  }

  // Goal validation
  if ('goal' in data) {
    if (data.goal !== null && data.goal !== undefined) {
      if (typeof data.goal !== 'string') {
        errors.push('goal must be a string');
      } else if (data.goal.length > 500) {
        errors.push('goal must be at most 500 characters');
      } else {
        result.goal = data.goal;
        hasUpdatableField = true;
      }
    } else {
      result.goal = null;
      hasUpdatableField = true;
    }
  }

  // Date fields — only updatable for planning sprints
  if (data.start_date !== undefined) {
    if (currentStatus === 'planning') {
      if (typeof data.start_date !== 'string') {
        errors.push('start_date must be a string');
      } else if (!isValidDate(data.start_date)) {
        errors.push('start_date must be a valid date in YYYY-MM-DD format');
      } else {
        result.start_date = data.start_date;
        hasUpdatableField = true;
      }
    }
    // For active sprints, silently ignore date fields
  }

  if ('end_date' in data) {
    if (currentStatus === 'planning') {
      if (data.end_date !== null && data.end_date !== undefined) {
        if (typeof data.end_date !== 'string') {
          errors.push('end_date must be a string');
        } else if (!isValidDate(data.end_date)) {
          errors.push('end_date must be a valid date in YYYY-MM-DD format');
        } else {
          result.end_date = data.end_date;
          hasUpdatableField = true;
        }
      } else {
        result.end_date = null;
        hasUpdatableField = true;
      }
    }
    // For active sprints, silently ignore date fields
  }

  if (errors.length > 0) {
    throw new AppError('VALIDATION_ERROR', 400, errors.join('; '));
  }

  if (!hasUpdatableField) {
    throw new AppError('VALIDATION_ERROR', 400, 'No valid fields provided for update');
  }

  return result;
}

export type SprintStatus = 'planning' | 'active' | 'completed';

const VALID_TRANSITIONS: Record<SprintStatus, SprintStatus | null> = {
  planning: 'active',
  active: 'completed',
  completed: null,
};

export function validateStatusTransition(current: SprintStatus, target: SprintStatus): void {
  if (VALID_TRANSITIONS[current] !== target) {
    throw new AppError('SPRINT_INVALID_TRANSITION', 400, `Cannot transition from ${current} to ${target}`);
  }
}

const VALID_STATUSES = ['planning', 'active', 'completed'];

export function validateStatusFilter(status: string | undefined): SprintStatus | undefined {
  if (!status) return undefined;
  if (!VALID_STATUSES.includes(status)) {
    throw new AppError('VALIDATION_ERROR', 400, `Invalid status filter: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  return status as SprintStatus;
}

export function validatePagination(page?: string, perPage?: string): { page: number; perPage: number } {
  let p = 1;
  let pp = 20;

  if (page !== undefined) {
    p = parseInt(page, 10);
    if (isNaN(p) || p < 1) {
      throw new AppError('VALIDATION_ERROR', 400, 'page must be a positive integer');
    }
  }

  if (perPage !== undefined) {
    pp = parseInt(perPage, 10);
    if (isNaN(pp) || pp < 1) {
      throw new AppError('VALIDATION_ERROR', 400, 'per_page must be a positive integer');
    }
    if (pp > 100) {
      pp = 100;
    }
  }

  return { page: p, perPage: pp };
}

export function validateUUID(value: string, fieldName: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new AppError('VALIDATION_ERROR', 400, `Invalid ${fieldName} format`);
  }
}
