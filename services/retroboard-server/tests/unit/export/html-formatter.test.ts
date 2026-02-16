import { describe, it, expect } from 'vitest';
import { formatAsHTML } from '../../../src/formatters/html-formatter.js';
import type { BoardExportData } from '../../../src/repositories/export-repository.js';

// Helper to create BoardExportData with defaults
function createMockBoardExportData(overrides: {
  board?: Partial<BoardExportData['board']>;
  columns?: BoardExportData['columns'];
  groups?: BoardExportData['groups'];
  actionItems?: BoardExportData['actionItems'];
  analytics?: BoardExportData['analytics'];
} = {}): BoardExportData {
  const defaultBoard: BoardExportData['board'] = {
    id: 'board-1',
    name: 'Test Board',
    teamName: 'Test Team',
    sprintName: 'Test Sprint',
    sprintStartDate: '2026-01-01',
    sprintEndDate: '2026-01-15',
    templateName: null,
    facilitatorName: null,
    phase: 'write',
    isAnonymous: false,
    cardsRevealed: false,
    participantCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  };

  return {
    board: { ...defaultBoard, ...overrides.board },
    columns: overrides.columns || [],
    groups: overrides.groups || [],
    actionItems: overrides.actionItems || [],
    analytics: overrides.analytics !== undefined ? overrides.analytics : null,
  };
}

describe('HTML Formatter (Unit)', () => {
  it('5.4.1: Valid HTML output', () => {
    const boardData = createMockBoardExportData();

    const result = formatAsHTML(boardData);

    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html');
    expect(result).toContain('</html>');
  });

  it('5.4.2: Title set', () => {
    const boardData = createMockBoardExportData({
      board: { name: 'Sprint 15 Retro' },
    });

    const result = formatAsHTML(boardData);

    expect(result).toContain('<title>Retrospective: Sprint 15 Retro</title>');
  });

  it('5.4.3: Print CSS included', () => {
    const boardData = createMockBoardExportData();

    const result = formatAsHTML(boardData);

    expect(result).toContain('@media print');
  });

  it('5.4.4: Print banner included', () => {
    const boardData = createMockBoardExportData();

    const result = formatAsHTML(boardData);

    expect(result).toContain("Use your browser's Print function");
    expect(result).toContain('Ctrl+P');
    expect(result).toContain('Cmd+P');
  });

  it('5.4.5: Cards styled with border', () => {
    const boardData = createMockBoardExportData({
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            { id: 'card-1', content: 'Test card', voteCount: 3, authorId: null, authorName: null, groupId: null, groupTitle: null, position: 0 },
          ],
        },
      ],
    });

    const result = formatAsHTML(boardData);

    expect(result).toContain('.card');
    expect(result).toContain('border-left');
  });

  it('5.4.6: Vote counts highlighted', () => {
    const boardData = createMockBoardExportData({
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            { id: 'card-1', content: 'Voted card', voteCount: 5, authorId: null, authorName: null, groupId: null, groupTitle: null, position: 0 },
          ],
        },
      ],
    });

    const result = formatAsHTML(boardData);

    expect(result).toContain('.votes');
    expect(result).toContain('5 votes');
  });

  it('5.4.7: Action item status colored', () => {
    const boardData = createMockBoardExportData({
      actionItems: [
        { id: 'ai-1', title: 'Open task', status: 'open', description: null, assigneeName: null, dueDate: null, sourceCardText: null, carriedFromSprintName: null },
        { id: 'ai-2', title: 'In progress task', status: 'in_progress', description: null, assigneeName: null, dueDate: null, sourceCardText: null, carriedFromSprintName: null },
        { id: 'ai-3', title: 'Done task', status: 'done', description: null, assigneeName: null, dueDate: null, sourceCardText: null, carriedFromSprintName: null },
      ],
    });

    const result = formatAsHTML(boardData);

    expect(result).toContain('.status-open');
    expect(result).toContain('.status-done');
  });

  it('5.4.8: Tables have borders', () => {
    const boardData = createMockBoardExportData({
      analytics: {
        healthScore: 72.5,
        totalCards: 24,
        sentimentScore: 60,
        participationRate: 75,
        totalVotes: 50,
        sentimentBreakdown: { positive: 15, negative: 5, neutral: 4 },
        topVotedCards: [],
        topWords: [],
      },
    });

    const result = formatAsHTML(boardData);

    expect(result).toContain('border-collapse');
    expect(result).toContain('<table');
  });

  it('5.4.9: Page breaks avoided mid-card', () => {
    const boardData = createMockBoardExportData({
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            { id: 'card-1', content: 'Card 1', voteCount: 3, authorId: null, authorName: null, groupId: null, groupTitle: null, position: 0 },
            { id: 'card-2', content: 'Card 2', voteCount: 2, authorId: null, authorName: null, groupId: null, groupTitle: null, position: 1 },
          ],
        },
      ],
    });

    const result = formatAsHTML(boardData);

    expect(result).toContain('break-inside: avoid');
  });

  it('5.4.10: Page margins set for print', () => {
    const boardData = createMockBoardExportData();

    const result = formatAsHTML(boardData);

    expect(result).toContain('@page');
    expect(result).toContain('margin');
  });

  it('5.4.11: No-print elements hidden', () => {
    const boardData = createMockBoardExportData();

    const result = formatAsHTML(boardData);

    expect(result).toContain('.no-print');
    expect(result).toContain('display: none');
  });

  it('5.4.12: XSS prevention', () => {
    const boardData = createMockBoardExportData({
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            {
              id: 'card-1',
              content: '<script>alert("xss")</script>Malicious card',
              voteCount: 1,
              authorId: null,
              authorName: null,
              groupId: null,
              groupTitle: null,
              position: 0,
            },
          ],
        },
      ],
    });

    const result = formatAsHTML(boardData);

    expect(result).not.toContain('<script>alert("xss")</script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&lt;/script&gt;');
  });

  it('5.4.13: Unicode rendered', () => {
    const boardData = createMockBoardExportData({
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            {
              id: 'card-1',
              content: '🚀 Deploy faster! 中文测试',
              voteCount: 3,
              authorId: null,
              authorName: null,
              groupId: null,
              groupTitle: null,
              position: 0,
            },
          ],
        },
      ],
    });

    const result = formatAsHTML(boardData);

    expect(result).toContain('charset=UTF-8');
    expect(result).toContain('🚀 Deploy faster! 中文测试');
  });
});
