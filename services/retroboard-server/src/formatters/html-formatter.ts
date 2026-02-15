import type { BoardExportData } from '../repositories/export-repository.js';

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHTML(text: string | null | undefined): string {
  if (text === null || text === undefined) {
    return '';
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format board export data as printer-friendly HTML
 */
export function formatAsHTML(boardData: BoardExportData): string {
  const { board, columns, groups, actionItems, analytics } = boardData;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset=UTF-8>
  <title>Retrospective: ${escapeHTML(board.name)}</title>
  <style>
    /* Screen styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      border-bottom: 2px solid #333;
      padding-bottom: 8px;
    }
    h2 {
      color: #2563eb;
      margin-top: 24px;
    }
    h3 {
      margin-top: 16px;
      margin-bottom: 8px;
    }
    .card {
      background: #f8f9fa;
      border-left: 3px solid #2563eb;
      padding: 12px;
      margin: 8px 0;
    }
    .votes {
      color: #059669;
      font-weight: bold;
    }
    .action-item {
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .status-open {
      color: #d97706;
    }
    .status-done {
      color: #059669;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px;
      text-align: left;
    }
    th {
      background: #f3f4f6;
    }
    .metadata {
      margin-bottom: 24px;
    }
    .metadata p {
      margin: 4px 0;
    }

    /* Print styles */
    @media print {
      body {
        max-width: 100%;
        padding: 0;
        font-size: 11pt;
      }
      h1 {
        font-size: 18pt;
      }
      h2 {
        font-size: 14pt;
        color: #000;
        break-after: avoid;
      }
      h3 {
        break-after: avoid;
      }
      .card {
        break-inside: avoid;
        border-left-color: #000;
      }
      .no-print {
        display: none;
      }
      table {
        font-size: 10pt;
      }
      @page {
        margin: 1.5cm;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background: #fef3c7; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
    ⚠️ Use your browser's Print function (Ctrl+P / Cmd+P) to save as PDF.
  </div>

  <h1>Retrospective: ${escapeHTML(board.name)}</h1>

  <div class="metadata">
    <p><strong>Team:</strong> ${escapeHTML(board.teamName)}</p>
    <p><strong>Sprint:</strong> ${escapeHTML(board.sprintName)} (${escapeHTML(board.sprintStartDate)} - ${escapeHTML(board.sprintEndDate)})</p>
    ${board.templateName ? `<p><strong>Template:</strong> ${escapeHTML(board.templateName)}</p>` : ''}
    ${board.facilitatorName ? `<p><strong>Facilitator:</strong> ${escapeHTML(board.facilitatorName)}</p>` : ''}
    <p><strong>Date:</strong> ${new Date().toISOString().split('T')[0]}</p>
    <p><strong>Participants:</strong> ${board.participantCount}</p>
  </div>

  <hr>

  ${analytics ? `
  <h2>Summary</h2>
  <table>
    <tr>
      <th>Metric</th>
      <th>Value</th>
    </tr>
    ${analytics.healthScore !== undefined ? `<tr>
      <td>Health Score</td>
      <td>${analytics.healthScore}/100</td>
    </tr>` : ''}
    ${analytics.totalCards !== undefined ? `<tr>
      <td>Cards</td>
      <td>${analytics.totalCards}</td>
    </tr>` : ''}
    ${analytics.totalVotes !== undefined ? `<tr>
      <td>Votes</td>
      <td>${analytics.totalVotes}</td>
    </tr>` : ''}
    ${analytics.participationRate !== undefined ? `<tr>
      <td>Participation</td>
      <td>${analytics.participationRate.toFixed(0)}%</td>
    </tr>` : ''}
    ${analytics.sentimentScore !== undefined ? `<tr>
      <td>Sentiment</td>
      <td>${analytics.sentimentScore}/100</td>
    </tr>` : ''}
  </table>
  ` : ''}

  ${columns.map((column) => `
  <h2>${escapeHTML(column.name)} (${column.cards.length} cards)</h2>
  ${column.cards.length === 0 ? '<p>No cards</p>' : column.cards.map((card) => `
  <div class="card">
    <h3>${escapeHTML(card.content)} <span class="votes">${card.voteCount} ${card.voteCount === 1 ? 'vote' : 'votes'}</span></h3>
    <p><strong>Author:</strong> ${escapeHTML(card.authorName || 'Anonymous')}</p>
    ${card.groupTitle ? `<p><strong>Group:</strong> ${escapeHTML(card.groupTitle)}</p>` : ''}
  </div>
  `).join('')}
  `).join('')}

  ${groups.length > 0 ? `
  <h2>Groups</h2>
  ${groups.map((group) => `
  <h3>${escapeHTML(group.title)} (${group.totalVotes} total ${group.totalVotes === 1 ? 'vote' : 'votes'})</h3>
  <p><em>Column: ${escapeHTML(group.columnName)}</em></p>
  <ul>
    ${group.cards.map((card) => `
    <li>${escapeHTML(card.content)} (${card.voteCount} ${card.voteCount === 1 ? 'vote' : 'votes'})</li>
    `).join('')}
  </ul>
  `).join('')}
  ` : ''}

  ${actionItems.length > 0 ? `
  <h2>Action Items</h2>
  <table>
    <tr>
      <th>#</th>
      <th>Title</th>
      <th>Assignee</th>
      <th>Due Date</th>
      <th>Status</th>
    </tr>
    ${actionItems.map((item, index) => {
      const status = item.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      const statusClass = item.status === 'done' ? 'status-done' : (item.status === 'open' ? 'status-open' : '');
      return `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHTML(item.title)}</td>
      <td>${escapeHTML(item.assigneeName || '-')}</td>
      <td>${escapeHTML(item.dueDate || '-')}</td>
      <td class="${statusClass}">${status}</td>
    </tr>
      `;
    }).join('')}
  </table>
  ` : ''}

  ${analytics?.topVotedCards && analytics.topVotedCards.length > 0 ? `
  <h2>Top Voted Cards</h2>
  <ol>
    ${analytics.topVotedCards.map((card) => `
    <li><strong>${escapeHTML(card.content)}</strong> - ${card.voteCount} ${card.voteCount === 1 ? 'vote' : 'votes'} (${escapeHTML(card.columnName)})</li>
    `).join('')}
  </ol>
  ` : ''}

  ${analytics?.topWords && analytics.topWords.length > 0 ? `
  <h2>Frequent Words</h2>
  <p>${analytics.topWords.map((w) => `${escapeHTML(w.word)} (${w.frequency})`).join(', ')}</p>
  ` : ''}

  <hr>
  <p><em>Exported from RetroBoard Pro on ${new Date().toISOString().split('T')[0]}</em></p>
</body>
</html>`;

  return html;
}
