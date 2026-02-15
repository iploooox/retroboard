import { describe, it, expect } from 'vitest';
import { formatAsJSON } from '../../../src/formatters/json-formatter.js';

describe('JSON Formatter (Unit)', () => {
  it('5.2.1: Valid JSON output', () => {
    const boardData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    const result = formatAsJSON(boardData, 'user-1');

    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.board.id).toBe('board-1');
  });

  it('5.2.2: Export version included', () => {
    const boardData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    const result = formatAsJSON(boardData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.exportVersion).toBe('1.0');
  });

  it('5.2.3: Exported timestamp set', () => {
    const boardData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    const result = formatAsJSON(boardData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.exportedAt).toBeDefined();
    expect(new Date(parsed.exportedAt).toISOString()).toBe(parsed.exportedAt);
  });

  it('5.2.4: Board metadata complete', () => {
    const boardData = {
      board: {
        id: 'board-1',
        name: 'Sprint 15 Retro',
        teamName: 'Platform Team',
        sprintName: 'Sprint 15',
        phase: 'action',
        isAnonymous: true,
        cardsRevealed: false,
      },
      columns: [],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    const result = formatAsJSON(boardData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.board.id).toBe('board-1');
    expect(parsed.board.name).toBe('Sprint 15 Retro');
    expect(parsed.board.teamName).toBe('Platform Team');
    expect(parsed.board.sprintName).toBe('Sprint 15');
    expect(parsed.board.phase).toBe('action');
    expect(parsed.board.isAnonymous).toBe(true);
    expect(parsed.board.cardsRevealed).toBe(false);
  });

  it('5.2.5: Columns ordered by position', () => {
    const boardData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [
        { id: 'col-1', name: 'Start', position: 0, cards: [] },
        { id: 'col-2', name: 'Stop', position: 1, cards: [] },
        { id: 'col-3', name: 'Continue', position: 2, cards: [] },
      ],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    const result = formatAsJSON(boardData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.columns[0].position).toBe(0);
    expect(parsed.columns[1].position).toBe(1);
    expect(parsed.columns[2].position).toBe(2);
  });

  it('5.2.6: Cards nested under columns', () => {
    const boardData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            { id: 'card-1', content: 'Card A' },
          ],
        },
        {
          id: 'col-2',
          name: 'Stop',
          position: 1,
          cards: [
            { id: 'card-2', content: 'Card B' },
          ],
        },
      ],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    const result = formatAsJSON(boardData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.columns[0].cards).toHaveLength(1);
    expect(parsed.columns[0].cards[0].id).toBe('card-1');
    expect(parsed.columns[1].cards).toHaveLength(1);
    expect(parsed.columns[1].cards[0].id).toBe('card-2');
  });

  it('5.2.7: Empty columns included', () => {
    const boardData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [
        { id: 'col-1', name: 'Start', position: 0, cards: [] },
        { id: 'col-2', name: 'Stop', position: 1, cards: [] },
      ],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    const result = formatAsJSON(boardData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.columns).toHaveLength(2);
    expect(parsed.columns[0].cards).toHaveLength(0);
    expect(parsed.columns[1].cards).toHaveLength(0);
  });

  it('5.2.8: Group totalVotes calculated', () => {
    const boardData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [],
      groups: [
        {
          id: 'group-1',
          title: 'Test Group',
          totalVotes: 15,
          cardIds: ['card-1', 'card-2', 'card-3'],
        },
      ],
      actionItems: [],
      analytics: null,
    };

    const result = formatAsJSON(boardData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.groups[0].totalVotes).toBe(15);
  });

  it('5.2.9: Null fields serialized as null', () => {
    const boardData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [],
      groups: [],
      actionItems: [
        {
          id: 'ai-1',
          title: 'Task',
          assigneeName: null,
          dueDate: null,
        },
      ],
      analytics: null,
    };

    const result = formatAsJSON(boardData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.actionItems[0].assigneeName).toBeNull();
    expect(parsed.actionItems[0].dueDate).toBeNull();
    expect('assigneeName' in parsed.actionItems[0]).toBe(true);
    expect('dueDate' in parsed.actionItems[0]).toBe(true);
  });

  it('5.2.10: Unicode preserved', () => {
    const boardData = {
      board: { id: 'board-1', name: 'Test Board' },
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            { id: 'card-1', content: '🚀 Deploy faster! 中文测试' },
          ],
        },
      ],
      groups: [],
      actionItems: [],
      analytics: null,
    };

    const result = formatAsJSON(boardData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.columns[0].cards[0].content).toBe('🚀 Deploy faster! 中文测试');
  });
});
