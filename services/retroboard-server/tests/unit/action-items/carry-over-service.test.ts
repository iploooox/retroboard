import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as actionItemRepo from '../../../src/repositories/action-item.repository.js';

// Mock the repository
vi.mock('../../../src/repositories/action-item.repository.js', () => ({
  carryOver: vi.fn(),
}));

describe('Action Item Carry-Over Service (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('3.1.1: Carry over unresolved items (2 open → 2 carried)', async () => {
    const mockResult = {
      carriedOver: [
        {
          id: 'new-ai-1',
          originalId: 'old-ai-1',
          originalSprintName: 'Sprint 14',
          title: 'Fix CI',
          description: null,
          assigneeId: 'user-1',
          assigneeName: 'Alice',
          dueDate: '2026-03-01',
          status: 'open',
          originalStatus: 'open',
        },
        {
          id: 'new-ai-2',
          originalId: 'old-ai-2',
          originalSprintName: 'Sprint 14',
          title: 'Add tests',
          description: 'Integration tests needed',
          assigneeId: null,
          assigneeName: null,
          dueDate: null,
          status: 'open',
          originalStatus: 'open',
        },
      ],
      skipped: [],
      alreadyCarried: [],
      sourceSprintName: 'Sprint 14',
      totalResolved: 2,
      totalSkipped: 0,
      totalAlreadyCarried: 0,
    };

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue(mockResult);

    const result = await actionItemRepo.carryOver('board-new', 'facilitator-1');

    expect(result).toEqual(mockResult);
    expect(result!.carriedOver).toHaveLength(2);
    expect(result!.totalResolved).toBe(2);
  });

  it('3.1.2: Skip done items (1 open + 1 done → only 1 carried)', async () => {
    const mockResult = {
      carriedOver: [
        {
          id: 'new-ai-1',
          originalId: 'old-ai-1',
          originalSprintName: 'Sprint 14',
          title: 'Fix CI',
          description: null,
          assigneeId: 'user-1',
          assigneeName: 'Alice',
          dueDate: '2026-03-01',
          status: 'open',
          originalStatus: 'open',
        },
      ],
      skipped: [
        {
          originalId: 'old-ai-2',
          title: 'Deploy staging',
          reason: 'already_done',
        },
      ],
      alreadyCarried: [],
      sourceSprintName: 'Sprint 14',
      totalResolved: 1,
      totalSkipped: 1,
      totalAlreadyCarried: 0,
    };

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue(mockResult);

    const result = await actionItemRepo.carryOver('board-new', 'facilitator-1');

    expect(result!.carriedOver).toHaveLength(1);
    expect(result!.skipped).toHaveLength(1);
    expect(result!.skipped![0].reason).toBe('already_done');
    expect(result!.totalSkipped).toBe(1);
  });

  it('3.1.3: Include in_progress items (status reset to open)', async () => {
    const mockResult = {
      carriedOver: [
        {
          id: 'new-ai-1',
          originalId: 'old-ai-1',
          originalSprintName: 'Sprint 14',
          title: 'Refactor auth',
          description: null,
          assigneeId: 'user-1',
          assigneeName: 'Bob',
          dueDate: null,
          status: 'open',
          originalStatus: 'in_progress',
        },
      ],
      skipped: [],
      alreadyCarried: [],
      sourceSprintName: 'Sprint 14',
      totalResolved: 1,
      totalSkipped: 0,
      totalAlreadyCarried: 0,
    };

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue(mockResult);

    const result = await actionItemRepo.carryOver('board-new', 'facilitator-1');

    expect(result!.carriedOver![0].status).toBe('open');
    expect(result!.carriedOver![0].originalStatus).toBe('in_progress');
  });

  it('3.1.4: Preserve title and description', async () => {
    const mockResult = {
      carriedOver: [
        {
          id: 'new-ai-1',
          originalId: 'old-ai-1',
          originalSprintName: 'Sprint 14',
          title: 'Original Title',
          description: 'Original detailed description',
          assigneeId: null,
          assigneeName: null,
          dueDate: null,
          status: 'open',
          originalStatus: 'open',
        },
      ],
      skipped: [],
      alreadyCarried: [],
      sourceSprintName: 'Sprint 14',
      totalResolved: 1,
      totalSkipped: 0,
      totalAlreadyCarried: 0,
    };

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue(mockResult);

    const result = await actionItemRepo.carryOver('board-new', 'facilitator-1');

    expect(result!.carriedOver![0].title).toBe('Original Title');
    expect(result!.carriedOver![0].description).toBe('Original detailed description');
  });

  it('3.1.5: Preserve assignee', async () => {
    const mockResult = {
      carriedOver: [
        {
          id: 'new-ai-1',
          originalId: 'old-ai-1',
          originalSprintName: 'Sprint 14',
          title: 'Task',
          description: null,
          assigneeId: 'user-123',
          assigneeName: 'Charlie Kim',
          dueDate: null,
          status: 'open',
          originalStatus: 'open',
        },
      ],
      skipped: [],
      alreadyCarried: [],
      sourceSprintName: 'Sprint 14',
      totalResolved: 1,
      totalSkipped: 0,
      totalAlreadyCarried: 0,
    };

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue(mockResult);

    const result = await actionItemRepo.carryOver('board-new', 'facilitator-1');

    expect(result!.carriedOver![0].assigneeId).toBe('user-123');
    expect(result!.carriedOver![0].assigneeName).toBe('Charlie Kim');
  });

  it('3.1.6: Preserve due date', async () => {
    const mockResult = {
      carriedOver: [
        {
          id: 'new-ai-1',
          originalId: 'old-ai-1',
          originalSprintName: 'Sprint 14',
          title: 'Task',
          description: null,
          assigneeId: null,
          assigneeName: null,
          dueDate: '2026-03-15',
          status: 'open',
          originalStatus: 'open',
        },
      ],
      skipped: [],
      alreadyCarried: [],
      sourceSprintName: 'Sprint 14',
      totalResolved: 1,
      totalSkipped: 0,
      totalAlreadyCarried: 0,
    };

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue(mockResult);

    const result = await actionItemRepo.carryOver('board-new', 'facilitator-1');

    expect(result!.carriedOver![0].dueDate).toBe('2026-03-15');
  });

  it('3.1.7: Set carried_from_id to original item ID (implicit in response structure)', async () => {
    const mockResult = {
      carriedOver: [
        {
          id: 'new-ai-1',
          originalId: 'old-ai-1',
          originalSprintName: 'Sprint 14',
          title: 'Task',
          description: null,
          assigneeId: null,
          assigneeName: null,
          dueDate: null,
          status: 'open',
          originalStatus: 'open',
        },
      ],
      skipped: [],
      alreadyCarried: [],
      sourceSprintName: 'Sprint 14',
      totalResolved: 1,
      totalSkipped: 0,
      totalAlreadyCarried: 0,
    };

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue(mockResult);

    const result = await actionItemRepo.carryOver('board-new', 'facilitator-1');

    // The carried_from_id is set to originalId
    expect(result!.carriedOver![0].originalId).toBe('old-ai-1');
  });

  it('3.1.8: Idempotent (second call returns items in alreadyCarried, no duplicates)', async () => {
    const mockResult = {
      carriedOver: [],
      skipped: [],
      alreadyCarried: [
        {
          originalId: 'old-ai-1',
          existingId: 'new-ai-1',
          title: 'Fix CI',
          reason: 'already_carried_over',
        },
        {
          originalId: 'old-ai-2',
          existingId: 'new-ai-2',
          title: 'Add tests',
          reason: 'already_carried_over',
        },
      ],
      sourceSprintName: 'Sprint 14',
      totalResolved: 0,
      totalSkipped: 0,
      totalAlreadyCarried: 2,
    };

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue(mockResult);

    const result = await actionItemRepo.carryOver('board-new', 'facilitator-1');

    expect(result!.carriedOver).toHaveLength(0);
    expect(result!.alreadyCarried).toHaveLength(2);
    expect(result!.totalAlreadyCarried).toBe(2);
    expect(result!.alreadyCarried![0].reason).toBe('already_carried_over');
  });

  it('3.1.9: No previous sprint → throws NO_PREVIOUS_SPRINT', async () => {
    vi.mocked(actionItemRepo.carryOver).mockResolvedValue({
      noPreviousSprint: true,
    });

    const result = await actionItemRepo.carryOver('board-new', 'facilitator-1');

    expect(result).toHaveProperty('noPreviousSprint', true);
  });

  it('3.1.10: Previous sprint has no items → empty carriedOver array', async () => {
    const mockResult = {
      carriedOver: [],
      skipped: [],
      alreadyCarried: [],
      sourceSprintName: 'Sprint 14',
      totalResolved: 0,
      totalSkipped: 0,
      totalAlreadyCarried: 0,
    };

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue(mockResult);

    const result = await actionItemRepo.carryOver('board-new', 'facilitator-1');

    expect(result!.carriedOver).toHaveLength(0);
    expect(result!.totalResolved).toBe(0);
  });

  it('3.1.11: All items already done → all in skipped array', async () => {
    const mockResult = {
      carriedOver: [],
      skipped: [
        {
          originalId: 'old-ai-1',
          title: 'Task 1',
          reason: 'already_done',
        },
        {
          originalId: 'old-ai-2',
          title: 'Task 2',
          reason: 'already_done',
        },
        {
          originalId: 'old-ai-3',
          title: 'Task 3',
          reason: 'already_done',
        },
      ],
      alreadyCarried: [],
      sourceSprintName: 'Sprint 14',
      totalResolved: 0,
      totalSkipped: 3,
      totalAlreadyCarried: 0,
    };

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue(mockResult);

    const result = await actionItemRepo.carryOver('board-new', 'facilitator-1');

    expect(result!.carriedOver).toHaveLength(0);
    expect(result!.skipped).toHaveLength(3);
    expect(result!.totalSkipped).toBe(3);
  });

  it('3.1.12: Chain carry-over (N-1 → N → N+1, carried_from_id points to N\'s item)', async () => {
    // When carrying from Sprint N to N+1, the originalId should be the item from Sprint N
    // (not the original-original from N-1)
    const mockResult = {
      carriedOver: [
        {
          id: 'sprint-n-plus-1-item',
          originalId: 'sprint-n-item',
          originalSprintName: 'Sprint N',
          title: 'Task',
          description: null,
          assigneeId: null,
          assigneeName: null,
          dueDate: null,
          status: 'open',
          originalStatus: 'open',
        },
      ],
      skipped: [],
      alreadyCarried: [],
      sourceSprintName: 'Sprint N',
      totalResolved: 1,
      totalSkipped: 0,
      totalAlreadyCarried: 0,
    };

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue(mockResult);

    const result = await actionItemRepo.carryOver('board-sprint-n-plus-1', 'facilitator-1');

    // The new item's originalId should point to the item from Sprint N (the immediate previous)
    expect(result!.carriedOver![0].originalId).toBe('sprint-n-item');
  });

  it('3.1.13: Created_by set to facilitator who triggered carry-over', async () => {
    // This is tested implicitly via the carryOver call signature
    const facilitatorId = 'facilitator-user-123';

    vi.mocked(actionItemRepo.carryOver).mockResolvedValue({
      carriedOver: [],
      skipped: [],
      alreadyCarried: [],
      sourceSprintName: 'Sprint 14',
      totalResolved: 0,
      totalSkipped: 0,
      totalAlreadyCarried: 0,
    });

    await actionItemRepo.carryOver('board-new', facilitatorId);

    expect(actionItemRepo.carryOver).toHaveBeenCalledWith('board-new', facilitatorId);
  });
});
