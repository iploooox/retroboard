import type { BoardExportData } from '../repositories/export-repository.js';

type FlexibleBoardExportData = {
  board: Partial<BoardExportData['board']> & { id: string; name: string };
  columns: Array<Partial<BoardExportData['columns'][number]> & { cards?: Array<Partial<BoardExportData['columns'][number]['cards'][number]> & Record<string, unknown>> }>;
  groups: Array<Partial<BoardExportData['groups'][number]> & { cards?: Array<Partial<BoardExportData['groups'][number]['cards'][number]> & Record<string, unknown>> }>;
  actionItems: Array<Partial<BoardExportData['actionItems'][number]> & Record<string, unknown>>;
  analytics: Partial<BoardExportData['analytics']> | null;
};

/**
 * Escape markdown special characters
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([|#])/g, '\\$1');
}

/**
 * Format board export data as Markdown
 */
export function formatAsMarkdown(boardData: BoardExportData | FlexibleBoardExportData): string {
  const { board, columns, groups, actionItems, analytics } = boardData;
  const lines: string[] = [];

  // Header
  lines.push(`# Retrospective: ${board.name}`);
  lines.push('');
  if (board.teamName) {
    lines.push(`**Team:** ${board.teamName}`);
  }
  if (board.sprintName && board.sprintStartDate && board.sprintEndDate) {
    lines.push(`**Sprint:** ${board.sprintName} (${board.sprintStartDate} - ${board.sprintEndDate})`);
  }
  if (board.templateName) {
    lines.push(`**Template:** ${board.templateName}`);
  }
  if (board.facilitatorName) {
    lines.push(`**Facilitator:** ${board.facilitatorName}`);
  }
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  if (board.participantCount !== undefined) {
    lines.push(`**Participants:** ${board.participantCount}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  if (analytics) {
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    if (analytics.healthScore !== undefined) {
      lines.push(`| Health Score | ${analytics.healthScore}/100 |`);
    }
    if (analytics.totalCards !== undefined) {
      lines.push(`| Cards | ${analytics.totalCards} |`);
    }
    if (analytics.totalVotes !== undefined) {
      lines.push(`| Votes | ${analytics.totalVotes} |`);
    }
    if (analytics.participationRate !== undefined) {
      lines.push(`| Participation | ${analytics.participationRate.toFixed(0)}% |`);
    }

    // Sentiment label
    if (analytics.sentimentScore !== undefined) {
      let sentimentLabel = 'Neutral';
      if (analytics.sentimentScore >= 60) sentimentLabel = 'Slightly Positive';
      if (analytics.sentimentScore >= 70) sentimentLabel = 'Positive';
      if (analytics.sentimentScore >= 80) sentimentLabel = 'Very Positive';
      if (analytics.sentimentScore < 50) sentimentLabel = 'Slightly Negative';
      if (analytics.sentimentScore < 40) sentimentLabel = 'Negative';
      if (analytics.sentimentScore < 30) sentimentLabel = 'Very Negative';

      lines.push(`| Sentiment | ${sentimentLabel} (${analytics.sentimentScore}/100) |`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Columns with cards
  for (const column of columns) {
    const cards = column.cards || [];
    const cardCount = cards.length;
    lines.push(`## ${column.name ?? 'Untitled Column'} (${cardCount} cards)`);
    lines.push('');

    if (cards.length === 0) {
      lines.push('No cards');
      lines.push('');
    } else {
      for (const card of cards) {
        const voteCount = card.voteCount ?? 0;
        const voteText = voteCount === 1 ? 'vote' : 'votes';
        lines.push(`### ${escapeMarkdown(card.content ?? '')} (${voteCount} ${voteText})`);
        const authorName = card.authorName || 'Anonymous';
        lines.push(`> **Author:** ${authorName}`);
        if (card.groupTitle) {
          lines.push(`> **Group:** ${card.groupTitle}`);
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  // Groups
  if (groups.length > 0) {
    lines.push('## Groups');
    lines.push('');

    for (const group of groups) {
      const totalVotes = group.totalVotes ?? 0;
      const voteText = totalVotes === 1 ? 'vote' : 'votes';
      lines.push(`### ${group.title ?? 'Untitled Group'} (${totalVotes} total ${voteText})`);
      lines.push(`_Column: ${group.columnName ?? 'Unknown'}_`);
      const groupCards = group.cards || [];
      for (const card of groupCards) {
        const cardVoteCount = card.voteCount ?? 0;
        const cardVoteText = cardVoteCount === 1 ? 'vote' : 'votes';
        lines.push(`- ${escapeMarkdown(card.content ?? '')} (${cardVoteCount} ${cardVoteText})`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // Action Items
  if (actionItems.length > 0) {
    lines.push('## Action Items');
    lines.push('');
    lines.push('| # | Title | Assignee | Due Date | Status |');
    lines.push('|---|-------|----------|----------|--------|');

    actionItems.forEach((item, index) => {
      const assignee = item.assigneeName || '-';
      const dueDate = item.dueDate || '-';
      const status = (item.status ?? 'open').replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      lines.push(`| ${index + 1} | ${escapeMarkdown(item.title ?? '')} | ${assignee} | ${dueDate} | ${status} |`);
    });

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Top Voted Cards
  if (analytics?.topVotedCards && analytics.topVotedCards.length > 0) {
    lines.push('## Top Voted Cards');
    lines.push('');
    analytics.topVotedCards.forEach((card, index) => {
      const voteText = card.voteCount === 1 ? 'vote' : 'votes';
      lines.push(`${index + 1}. **${escapeMarkdown(card.content)}** - ${card.voteCount} ${voteText} (${card.columnName})`);
    });
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Frequent Words
  if (analytics?.topWords && analytics.topWords.length > 0) {
    lines.push('## Frequent Words');
    lines.push('');
    const wordList = analytics.topWords
      .map((w) => `${w.word} (${w.frequency})`)
      .join(', ');
    lines.push(wordList);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Footer
  lines.push(`*Exported from RetroBoard Pro on ${new Date().toISOString().split('T')[0]}*`);
  lines.push('');

  return lines.join('\n');
}
