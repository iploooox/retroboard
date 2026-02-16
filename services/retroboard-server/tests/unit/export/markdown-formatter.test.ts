import { describe, it, expect } from 'vitest';
import { formatAsMarkdown } from '../../../src/formatters/markdown-formatter.js';
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

describe('Markdown Formatter (Unit)', () => {
  it('5.3.1: Valid Markdown structure', () => {
    const boardData = createMockBoardExportData({
      board: { name: 'Sprint 15 Retro' },
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toMatch(/^# Retrospective:/);
  });

  it('5.3.2: Metadata table rendered', () => {
    const boardData = createMockBoardExportData({
      board: {
        name: 'Sprint 15 Retro',
        teamName: 'Platform Team',
        sprintName: 'Sprint 15',
        sprintStartDate: '2026-02-03',
        sprintEndDate: '2026-02-14',
        facilitatorName: 'Alice Chen',
        participantCount: 5,
      },
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('**Team:**');
    expect(result).toContain('Platform Team');
    expect(result).toContain('**Sprint:**');
    expect(result).toContain('Sprint 15');
    expect(result).toContain('**Facilitator:**');
    expect(result).toContain('Alice Chen');
    expect(result).toContain('**Participants:**');
    expect(result).toContain('5');
  });

  it('5.3.3: Summary table rendered', () => {
    const boardData = createMockBoardExportData({
      analytics: {
        healthScore: 72.5,
        totalCards: 24,
        totalVotes: 48,
        participationRate: 80.0,
        sentimentScore: 65.0,
        sentimentBreakdown: { positive: 15, negative: 5, neutral: 4 },
        topVotedCards: [],
        topWords: [],
      },
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('## Summary');
    expect(result).toContain('72.5');
    expect(result).toContain('24');
    expect(result).toContain('48');
    expect(result).toContain('80');
  });

  it('5.3.4: Columns as H2 headers', () => {
    const boardData = createMockBoardExportData({
      columns: [
        { id: 'col-1', name: 'Start', position: 0, cards: [] },
        { id: 'col-2', name: 'Stop', position: 1, cards: [] },
        { id: 'col-3', name: 'Continue', position: 2, cards: [] },
      ],
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('## Start');
    expect(result).toContain('## Stop');
    expect(result).toContain('## Continue');
  });

  it('5.3.5: Cards as H3 headers', () => {
    const boardData = createMockBoardExportData({
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            { id: 'card-1', content: 'More pair programming', voteCount: 5, authorId: null, authorName: null, groupId: null, groupTitle: null, position: 0 },
            { id: 'card-2', content: 'Daily standups', voteCount: 3, authorId: null, authorName: null, groupId: null, groupTitle: null, position: 1 },
          ],
        },
      ],
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('### More pair programming (5 votes)');
    expect(result).toContain('### Daily standups (3 votes)');
  });

  it('5.3.6: Author in blockquote', () => {
    const boardData = createMockBoardExportData({
      board: { isAnonymous: false },
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
              groupId: null,
              groupTitle: null,
              position: 0,
            },
          ],
        },
      ],
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('> **Author:** Bob Martinez');
  });

  it('5.3.7: Anonymous author handled', () => {
    const boardData = createMockBoardExportData({
      board: {
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
              voteCount: 2,
              groupId: null,
              groupTitle: null,
              position: 0,
            },
          ],
        },
      ],
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('> **Author:** Anonymous');
  });

  it('5.3.8: Groups section rendered', () => {
    const boardData = createMockBoardExportData({
      groups: [
        {
          id: 'group-1',
          title: 'Collaboration Ideas',
          columnId: 'col-1',
          columnName: 'Start',
          totalVotes: 15,
          cardIds: ['card-1', 'card-2'],
          position: 0,
          cards: [
            { id: 'card-1', content: 'Pair programming', voteCount: 8 },
            { id: 'card-2', content: 'Code reviews', voteCount: 7 },
          ],
        },
      ],
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('## Groups');
    expect(result).toContain('### Collaboration Ideas (15 total votes)');
    expect(result).toContain('_Column: Start_');
    expect(result).toContain('- Pair programming (8 votes)');
    expect(result).toContain('- Code reviews (7 votes)');
  });

  it('5.3.9: Action items as table', () => {
    const boardData = createMockBoardExportData({
      actionItems: [
        {
          id: 'ai-1',
          title: 'Schedule pair programming',
          description: null,
          assigneeName: 'Bob Martinez',
          dueDate: '2026-02-21',
          status: 'open',
          sourceCardText: null,
          carriedFromSprintName: null,
        },
        {
          id: 'ai-2',
          title: 'Update CI config',
          description: null,
          assigneeName: 'Alice Chen',
          dueDate: '2026-02-28',
          status: 'in_progress',
          sourceCardText: null,
          carriedFromSprintName: null,
        },
        {
          id: 'ai-3',
          title: 'Deploy to staging',
          description: null,
          assigneeName: null,
          dueDate: null,
          status: 'open',
          sourceCardText: null,
          carriedFromSprintName: null,
        },
        {
          id: 'ai-4',
          title: 'Fix flaky tests',
          description: null,
          assigneeName: 'Charlie Kim',
          dueDate: '2026-02-25',
          status: 'done',
          sourceCardText: null,
          carriedFromSprintName: null,
        },
        {
          id: 'ai-5',
          title: 'Add metrics',
          description: null,
          assigneeName: 'Dana Lee',
          dueDate: '2026-03-01',
          status: 'open',
          sourceCardText: null,
          carriedFromSprintName: null,
        },
      ],
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('## Action Items');
    expect(result).toContain('| # | Title | Assignee | Due Date | Status |');
    expect(result).toContain('| 1 | Schedule pair programming | Bob Martinez | 2026-02-21 | Open |');
    expect(result).toContain('| 2 | Update CI config | Alice Chen | 2026-02-28 | In Progress |');
    expect(result).toContain('| 3 | Deploy to staging |');
    expect(result).toContain('| 4 | Fix flaky tests | Charlie Kim | 2026-02-25 | Done |');
    expect(result).toContain('| 5 | Add metrics | Dana Lee | 2026-03-01 | Open |');
  });

  it('5.3.10: Top voted cards listed', () => {
    const boardData = createMockBoardExportData({
      analytics: {
        healthScore: 70,
        totalCards: 20,
        totalVotes: 50,
        participationRate: 75,
        sentimentScore: 60,
        sentimentBreakdown: { positive: 12, negative: 4, neutral: 4 },
        topVotedCards: [
          { content: 'Most popular', voteCount: 10, columnName: 'Start' },
          { content: 'Second best', voteCount: 8, columnName: 'Continue' },
          { content: 'Third place', voteCount: 6, columnName: 'Stop' },
          { content: 'Fourth', voteCount: 5, columnName: 'Start' },
          { content: 'Fifth', voteCount: 4, columnName: 'Continue' },
        ],
        topWords: [],
      },
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('## Top Voted Cards');
    expect(result).toContain('1. **Most popular** - 10 votes (Start)');
    expect(result).toContain('2. **Second best** - 8 votes (Continue)');
    expect(result).toContain('3. **Third place** - 6 votes (Stop)');
    expect(result).toContain('4. **Fourth** - 5 votes (Start)');
    expect(result).toContain('5. **Fifth** - 4 votes (Continue)');
  });

  it('5.3.11: Word cloud rendered', () => {
    const boardData = createMockBoardExportData({
      analytics: {
        healthScore: 70,
        totalCards: 20,
        totalVotes: 50,
        participationRate: 75,
        sentimentScore: 60,
        sentimentBreakdown: { positive: 12, negative: 4, neutral: 4 },
        topVotedCards: [],
        topWords: [
          { word: 'deployment', frequency: 8 },
          { word: 'collaboration', frequency: 6 },
          { word: 'testing', frequency: 5 },
        ],
      },
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('## Frequent Words');
    expect(result).toContain('deployment (8), collaboration (6), testing (5)');
  });

  it('5.3.12: Footer included', () => {
    const boardData = createMockBoardExportData();

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('*Exported from RetroBoard Pro');
  });

  it('5.3.13: Special characters escaped', () => {
    const boardData = createMockBoardExportData({
      columns: [
        {
          id: 'col-1',
          name: 'Start',
          position: 0,
          cards: [
            {
              id: 'card-1',
              content: 'Compare A | B and use # for comments',
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

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('Compare A \\| B');
    expect(result).toContain('\\#');
  });

  it('5.3.14: Empty board', () => {
    const boardData = createMockBoardExportData({
      board: { name: 'Empty Board' },
      columns: [
        { id: 'col-1', name: 'Start', position: 0, cards: [] },
        { id: 'col-2', name: 'Stop', position: 1, cards: [] },
      ],
    });

    const result = formatAsMarkdown(boardData);

    expect(result).toContain('# Retrospective: Empty Board');
    expect(result).toContain('## Start');
    expect(result).toContain('## Stop');
    expect(result).toContain('No cards');
  });
});
