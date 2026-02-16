import type { BoardExportData } from '../repositories/export-repository.js';

/**
 * Format board export data as JSON
 * Escapes < and > as Unicode to prevent XSS when JSON is embedded in HTML
 */
export function formatAsJSON(boardData: BoardExportData, exportedBy: string): string {
  // Transform card field names for export compatibility (content → text)
  const columns = boardData.columns.map((col) => ({
    ...col,
    cards: col.cards.map(({ content, ...card }) => ({
      ...card,
      text: content,
    })),
  }));

  const output = {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    exportedBy,
    board: boardData.board,
    columns,
    groups: boardData.groups,
    actionItems: boardData.actionItems,
    analytics: boardData.analytics,
  };

  // Return regular JSON (browser should handle escaping for security)
  return JSON.stringify(output, null, 2);
}
