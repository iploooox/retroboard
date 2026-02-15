import { describe, it, expect } from 'vitest';
import { formatReportAsJSON, formatReportAsMarkdown } from '../../../src/formatters/report-formatter.js';

describe('Report Formatter (Unit)', () => {
  it('5.5.1: JSON report valid', () => {
    const reportData = {
      team: { id: 'team-1', name: 'Platform Team', memberCount: 5 },
      dateRange: { from: '2025-08-14', to: '2026-02-14' },
      sprintCount: 12,
      healthTrend: [],
      participation: { members: [] },
      actionItems: { totalCreated: 48, totalCompleted: 32 },
      topThemes: [],
    };

    const result = formatReportAsJSON(reportData, 'user-1');

    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.team.name).toBe('Platform Team');
  });

  it('5.5.2: Markdown report valid', () => {
    const reportData = {
      team: { id: 'team-1', name: 'Platform Team', memberCount: 5 },
      dateRange: { from: '2025-08-14', to: '2026-02-14' },
      sprintCount: 12,
      healthTrend: [],
      participation: { members: [] },
      actionItems: { totalCreated: 48, totalCompleted: 32 },
      topThemes: [],
    };

    const result = formatReportAsMarkdown(reportData);

    expect(result).toMatch(/^# Team Report:/);
    expect(result).toContain('Platform Team');
  });

  it('5.5.3: Sprint count correct', () => {
    const reportData = {
      team: { id: 'team-1', name: 'Platform Team', memberCount: 5 },
      dateRange: { from: '2025-08-14', to: '2026-02-14' },
      sprintCount: 12,
      healthTrend: [],
      participation: { members: [] },
      actionItems: { totalCreated: 48, totalCompleted: 32 },
      topThemes: [],
    };

    const result = formatReportAsJSON(reportData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.sprintCount).toBe(12);
  });

  it('5.5.4: Health trend ordered', () => {
    const reportData = {
      team: { id: 'team-1', name: 'Platform Team', memberCount: 5 },
      dateRange: { from: '2025-08-14', to: '2026-02-14' },
      sprintCount: 3,
      healthTrend: [
        {
          sprintName: 'Sprint 15',
          startDate: '2026-02-03',
          healthScore: 72.5,
        },
        {
          sprintName: 'Sprint 14',
          startDate: '2026-01-20',
          healthScore: 68.3,
        },
        {
          sprintName: 'Sprint 13',
          startDate: '2026-01-06',
          healthScore: 65.0,
        },
      ],
      participation: { members: [] },
      actionItems: { totalCreated: 48, totalCompleted: 32 },
      topThemes: [],
    };

    const result = formatReportAsJSON(reportData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.healthTrend[0].sprintName).toBe('Sprint 15');
    expect(parsed.healthTrend[1].sprintName).toBe('Sprint 14');
    expect(parsed.healthTrend[2].sprintName).toBe('Sprint 13');
  });

  it('5.5.5: Participation per member', () => {
    const reportData = {
      team: { id: 'team-1', name: 'Platform Team', memberCount: 5 },
      dateRange: { from: '2025-08-14', to: '2026-02-14' },
      sprintCount: 12,
      healthTrend: [],
      participation: {
        members: [
          {
            userName: 'Alice Chen',
            totalCards: 45,
            totalVotes: 120,
            actionItemsCompleted: 9,
          },
          {
            userName: 'Bob Martinez',
            totalCards: 38,
            totalVotes: 105,
            actionItemsCompleted: 7,
          },
          {
            userName: 'Charlie Kim',
            totalCards: 42,
            totalVotes: 115,
            actionItemsCompleted: 10,
          },
          {
            userName: 'Dana Lee',
            totalCards: 35,
            totalVotes: 95,
            actionItemsCompleted: 6,
          },
          {
            userName: 'Eva Park',
            totalCards: 40,
            totalVotes: 110,
            actionItemsCompleted: 8,
          },
        ],
      },
      actionItems: { totalCreated: 48, totalCompleted: 32 },
      topThemes: [],
    };

    const result = formatReportAsJSON(reportData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.participation.members).toHaveLength(5);
    expect(parsed.participation.members[0].userName).toBe('Alice Chen');
  });

  it('5.5.6: Action item totals correct', () => {
    const reportData = {
      team: { id: 'team-1', name: 'Platform Team', memberCount: 5 },
      dateRange: { from: '2025-08-14', to: '2026-02-14' },
      sprintCount: 12,
      healthTrend: [],
      participation: { members: [] },
      actionItems: {
        totalCreated: 48,
        totalCompleted: 32,
        totalCarriedOver: 12,
        currentlyOpen: 6,
      },
      topThemes: [],
    };

    const result = formatReportAsJSON(reportData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.actionItems.totalCreated).toBe(48);
    expect(parsed.actionItems.totalCompleted).toBe(32);
    expect(parsed.actionItems.totalCarriedOver).toBe(12);
    expect(parsed.actionItems.currentlyOpen).toBe(6);
  });

  it('5.5.7: Completion rate calculated', () => {
    const reportData = {
      team: { id: 'team-1', name: 'Platform Team', memberCount: 5 },
      dateRange: { from: '2025-08-14', to: '2026-02-14' },
      sprintCount: 12,
      healthTrend: [],
      participation: { members: [] },
      actionItems: {
        totalCreated: 48,
        totalCompleted: 32,
        completionRate: 66.7,
      },
      topThemes: [],
    };

    const result = formatReportAsJSON(reportData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.actionItems.completionRate).toBe(66.7);
  });

  it('5.5.8: Top themes sorted', () => {
    const reportData = {
      team: { id: 'team-1', name: 'Platform Team', memberCount: 5 },
      dateRange: { from: '2025-08-14', to: '2026-02-14' },
      sprintCount: 12,
      healthTrend: [],
      participation: { members: [] },
      actionItems: { totalCreated: 48, totalCompleted: 32 },
      topThemes: [
        { word: 'deployment', frequency: 45 },
        { word: 'communication', frequency: 32 },
        { word: 'testing', frequency: 28 },
      ],
    };

    const result = formatReportAsJSON(reportData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.topThemes[0].frequency).toBe(45);
    expect(parsed.topThemes[1].frequency).toBe(32);
    expect(parsed.topThemes[2].frequency).toBe(28);
  });

  it('5.5.9: Date range respected', () => {
    const reportData = {
      team: { id: 'team-1', name: 'Platform Team', memberCount: 5 },
      dateRange: { from: '2025-08-14', to: '2026-02-14' },
      sprintCount: 12,
      healthTrend: [],
      participation: { members: [] },
      actionItems: { totalCreated: 48, totalCompleted: 32 },
      topThemes: [],
    };

    const result = formatReportAsJSON(reportData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.dateRange.from).toBe('2025-08-14');
    expect(parsed.dateRange.to).toBe('2026-02-14');
  });

  it('5.5.10: Empty date range', () => {
    const reportData = {
      team: { id: 'team-1', name: 'Platform Team', memberCount: 5 },
      dateRange: { from: '2026-01-01', to: '2026-01-31' },
      sprintCount: 0,
      healthTrend: [],
      participation: { members: [] },
      actionItems: {
        totalCreated: 0,
        totalCompleted: 0,
        completionRate: 0,
      },
      topThemes: [],
    };

    const result = formatReportAsJSON(reportData, 'user-1');
    const parsed = JSON.parse(result);

    expect(parsed.sprintCount).toBe(0);
    expect(parsed.healthTrend).toHaveLength(0);
    expect(parsed.actionItems.totalCreated).toBe(0);
  });
});
