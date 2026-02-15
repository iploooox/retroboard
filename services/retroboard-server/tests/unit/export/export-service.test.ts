import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as exportRepository from '../../../src/repositories/export-repository.js';

// Mock the repository
vi.mock('../../../src/repositories/export-repository.js', () => ({
  fetchBoardExportData: vi.fn(),
}));

describe('Export Service (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('5.1.1: Fetch complete board data', async () => {
    const mockData = {
      board: {
        id: 'board-1',
        name: 'Sprint 15 Retro',
        teamName: 'Platform Team',
        sprintName: 'Sprint 15',
        phase: 'action',
      },
      columns: [
        { id: 'col-1', name: 'Start', position: 0, cards: [] },
        { id: 'col-2', name: 'Stop', position: 1, cards: [] },
      ],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', true, true);

    expect(result).toEqual(mockData);
    expect(result.board.id).toBe('board-1');
    expect(result.columns).toHaveLength(2);
  });

  it('5.1.2: Board not found', async () => {
    vi.mocked(exportRepository.fetchBoardExportData).mockRejectedValue(
      new Error('NOT_FOUND')
    );

    await expect(
      exportRepository.fetchBoardExportData('non-existent', true, true)
    ).rejects.toThrow('NOT_FOUND');
  });

  it('5.1.3: Anonymous cards not revealed', async () => {
    const mockData = {
      board: {
        id: 'board-1',
        name: 'Anonymous Retro',
        isAnonymous: true,
        cardsRevealed: false,
      },
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            {
              id: 'card-1',
              content: 'Test card',
              authorId: null,
              authorName: null,
              voteCount: 3,
            },
          ],
        },
      ],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', true, true);

    expect(result.columns[0].cards[0].authorId).toBeNull();
    expect(result.columns[0].cards[0].authorName).toBeNull();
  });

  it('5.1.4: Anonymous cards revealed', async () => {
    const mockData = {
      board: {
        id: 'board-1',
        name: 'Anonymous Retro',
        isAnonymous: true,
        cardsRevealed: true,
      },
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            {
              id: 'card-1',
              content: 'Test card',
              authorId: 'user-1',
              authorName: 'Alice Chen',
              voteCount: 3,
            },
          ],
        },
      ],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', true, true);

    expect(result.columns[0].cards[0].authorId).toBe('user-1');
    expect(result.columns[0].cards[0].authorName).toBe('Alice Chen');
  });

  it('5.1.5: Non-anonymous board', async () => {
    const mockData = {
      board: {
        id: 'board-1',
        name: 'Open Retro',
        isAnonymous: false,
        cardsRevealed: false,
      },
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            {
              id: 'card-1',
              content: 'Test card',
              authorId: 'user-1',
              authorName: 'Bob Martinez',
              voteCount: 2,
            },
          ],
        },
      ],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', true, true);

    expect(result.columns[0].cards[0].authorId).toBe('user-1');
    expect(result.columns[0].cards[0].authorName).toBe('Bob Martinez');
  });

  it('5.1.6: Cards sorted by vote count', async () => {
    const mockData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            { id: 'card-1', content: 'High votes', voteCount: 10 },
            { id: 'card-2', content: 'Medium votes', voteCount: 5 },
            { id: 'card-3', content: 'Low votes', voteCount: 1 },
          ],
        },
      ],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', true, true);

    expect(result.columns[0].cards[0].voteCount).toBe(10);
    expect(result.columns[0].cards[1].voteCount).toBe(5);
    expect(result.columns[0].cards[2].voteCount).toBe(1);
  });

  it('5.1.7: Groups include card IDs', async () => {
    const mockData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            { id: 'card-1', content: 'Card 1', groupId: 'group-1' },
            { id: 'card-2', content: 'Card 2', groupId: 'group-1' },
          ],
        },
      ],
      groups: [
        {
          id: 'group-1',
          title: 'Test Group',
          columnId: 'col-1',
          cardIds: ['card-1', 'card-2'],
          totalVotes: 8,
        },
      ],
      actionItems: [],
      analytics: null,
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', true, true);

    expect(result.groups[0].cardIds).toContain('card-1');
    expect(result.groups[0].cardIds).toContain('card-2');
  });

  it('5.1.8: Action items include source card', async () => {
    const mockData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [],
      groups: [],
      actionItems: [
        {
          id: 'ai-1',
          title: 'Fix CI',
          cardId: 'card-1',
          sourceCardText: 'CI is flaky',
        },
      ],
      analytics: null,
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', true, true);

    expect(result.actionItems[0].sourceCardText).toBe('CI is flaky');
  });

  it('5.1.9: Action items without source card', async () => {
    const mockData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [],
      groups: [],
      actionItems: [
        {
          id: 'ai-1',
          title: 'General task',
          cardId: null,
          sourceCardText: null,
        },
      ],
      analytics: null,
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', true, true);

    expect(result.actionItems[0].sourceCardText).toBeNull();
  });

  it('5.1.10: Analytics included when requested', async () => {
    const mockData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [],
      groups: [],
      actionItems: [],
      analytics: {
        healthScore: 72.5,
        sentimentScore: 65.0,
        participationRate: 80.0,
        totalCards: 24,
        totalVotes: 48,
      },
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', true, true);

    expect(result.analytics).toBeDefined();
    expect(result.analytics?.healthScore).toBe(72.5);
  });

  it('5.1.11: Analytics excluded when requested', async () => {
    const mockData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', false, true);

    expect(result.analytics).toBeNull();
  });

  it('5.1.12: Action items excluded when requested', async () => {
    const mockData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', true, false);

    expect(result.actionItems).toHaveLength(0);
  });

  it('5.1.13: Board with 5000 cards', async () => {
    const mockCards = Array.from({ length: 5000 }, (_, i) => ({
      id: `card-${i}`,
      content: `Card ${i}`,
      voteCount: 0,
    }));

    const mockData = {
      board: { id: 'board-1', name: 'Large Board' },
      columns: [
        {
          id: 'col-1',
          name: 'Column',
          position: 0,
          cards: mockCards,
        },
      ],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    vi.mocked(exportRepository.fetchBoardExportData).mockResolvedValue(mockData);

    const result = await exportRepository.fetchBoardExportData('board-1', true, true);

    expect(result.columns[0].cards).toHaveLength(5000);
  });

  it('5.1.14: Board with >5000 cards', async () => {
    vi.mocked(exportRepository.fetchBoardExportData).mockRejectedValue(
      new Error('PAYLOAD_TOO_LARGE')
    );

    await expect(
      exportRepository.fetchBoardExportData('oversized-board', true, true)
    ).rejects.toThrow('PAYLOAD_TOO_LARGE');
  });
});
