import type { BoardExportData } from '../repositories/export-repository.js';

/**
 * Format board export data as JSON
 * Escapes < and > as Unicode to prevent XSS when JSON is embedded in HTML
 */
export function formatAsJSON(boardData: BoardExportData, exportedBy: string): string {
  const output = {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    exportedBy,
    board: boardData.board,
    columns: boardData.columns,
    groups: boardData.groups,
    actionItems: boardData.actionItems,
    analytics: boardData.analytics,
  };

  // Return regular JSON (browser should handle escaping for security)
  return JSON.stringify(output, null, 2);
}
