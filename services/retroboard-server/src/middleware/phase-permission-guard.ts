import type { BoardPhase } from '../validation/boards.js';

export type PhaseAction = 'add_card' | 'edit_card' | 'group_card' | 'vote' | 'create_action';

export interface PhasePermissionInput {
  phase: BoardPhase;
  action: PhaseAction;
  role: string;
  isLocked: boolean;
}

export interface PhasePermissionResult {
  allowed: boolean;
}

// Phase permission matrix: which actions are allowed in which phases
const PHASE_PERMISSIONS: Record<BoardPhase, Set<PhaseAction>> = {
  icebreaker: new Set(), // No card/vote/group actions during icebreaker
  write: new Set(['add_card', 'edit_card']),
  group: new Set(['edit_card', 'group_card']),
  vote: new Set(['vote']),
  discuss: new Set(['create_action']),
  action: new Set(['create_action']),
};

const FACILITATOR_ROLES = new Set(['facilitator', 'admin']);

export function checkPhasePermission(input: PhasePermissionInput): PhasePermissionResult {
  const { phase, action, role, isLocked } = input;

  // Board locked: only facilitator/admin can act
  if (isLocked && !FACILITATOR_ROLES.has(role)) {
    return { allowed: false };
  }

  // Check action is allowed in this phase
  const allowedActions = PHASE_PERMISSIONS[phase];
  if (!allowedActions || !allowedActions.has(action)) {
    return { allowed: false };
  }

  return { allowed: true };
}
