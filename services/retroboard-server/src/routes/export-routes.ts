import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import * as exportRepo from '../repositories/export-repository.js';
import { formatAsJSON } from '../formatters/json-formatter.js';
import { formatAsMarkdown } from '../formatters/markdown-formatter.js';
import { formatAsHTML } from '../formatters/html-formatter.js';
import {
  formatReportAsJSON,
  formatReportAsMarkdown,
} from '../formatters/report-formatter.js';
import { z } from 'zod';

const exportRouter = new Hono();
exportRouter.use('*', requireAuth);

// UUID validator
const uuidParam = z.string().uuid();

// Date validator (YYYY-MM-DD)
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sanitize filename to remove special characters
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

/**
 * Generate filename for board export
 */
function generateBoardFilename(boardData: { board: { sprintName: string } }, format: string): string {
  const sanitized = sanitizeFilename(boardData.board.sprintName);
  const date = new Date().toISOString().split('T')[0];
  return `retro-${sanitized}-${date}.${format}`;
}

/**
 * Generate filename for team report
 */
function generateReportFilename(teamName: string, format: string): string {
  const sanitized = sanitizeFilename(teamName);
  const date = new Date().toISOString().split('T')[0];
  return `team-report-${sanitized}-${date}.${format}`;
}

// GET /api/v1/boards/:id/export
exportRouter.get('/boards/:id/export', async (c) => {
  const boardId = c.req.param('id');
  const user = c.get('user');
  const format = c.req.query('format');
  const includeAnalyticsParam = c.req.query('includeAnalytics');
  const includeActionItemsParam = c.req.query('includeActionItems');

  // Validate UUID
  if (!uuidParam.safeParse(boardId).success) {
    return c.json({ error: 'VALIDATION_ERROR' }, 400);
  }

  // Validate format parameter
  if (!format) {
    return c.json({ error: 'INVALID_FORMAT' }, 400);
  }

  if (!['json', 'markdown', 'html'].includes(format)) {
    return c.json({ error: 'INVALID_FORMAT' }, 400);
  }

  // Parse boolean parameters (default to true)
  const includeAnalytics = includeAnalyticsParam !== 'false';
  const includeActionItems = includeActionItemsParam !== 'false';

  // Check team membership
  const teamId = await exportRepo.getTeamIdForBoard(boardId);
  if (!teamId) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  const isMember = await exportRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  try {
    // Fetch board data (repository enforces 5000 card limit)
    const boardData = await exportRepo.fetchBoardExportData(
      boardId,
      includeAnalytics,
      includeActionItems
    );

    // Format and return based on format type
    if (format === 'json') {
      const jsonContent = formatAsJSON(boardData, user.id);
      const filename = generateBoardFilename(boardData, 'json');

      c.header('Content-Type', 'application/json; charset=utf-8');
      c.header('Content-Disposition', `attachment; filename="${filename}"`);
      return c.body(jsonContent);
    } else if (format === 'markdown') {
      const markdownContent = formatAsMarkdown(boardData);
      const filename = generateBoardFilename(boardData, 'md');

      c.header('Content-Type', 'text/markdown; charset=utf-8');
      c.header('Content-Disposition', `attachment; filename="${filename}"`);
      return c.body(markdownContent);
    } else if (format === 'html') {
      const htmlContent = formatAsHTML(boardData);

      // HTML does NOT have Content-Disposition (renders in browser for printing)
      c.header('Content-Type', 'text/html; charset=utf-8');
      return c.body(htmlContent);
    }
  } catch (err: unknown) {
    if (err instanceof Error && 'status' in err) {
      const appError = err as { status: number; code: string; message: string };
      return c.json({ error: appError.code }, appError.status);
    }
    throw err;
  }
});

// GET /api/v1/teams/:teamId/report
exportRouter.get('/teams/:teamId/report', async (c) => {
  const teamId = c.req.param('teamId');
  const user = c.get('user');
  const format = c.req.query('format') || 'json';
  const fromParam = c.req.query('from');
  const toParam = c.req.query('to');

  // Validate UUID
  if (!uuidParam.safeParse(teamId).success) {
    return c.json(
      formatErrorResponse('VALIDATION_ERROR', 'Invalid team ID format'),
      422
    );
  }

  // Validate format
  if (!['json', 'markdown'].includes(format)) {
    return c.json({ error: 'INVALID_FORMAT' }, 400);
  }

  // Default date range: 6 months ago to today
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const from =
    fromParam || sixMonthsAgo.toISOString().split('T')[0];
  const to = toParam || today.toISOString().split('T')[0];

  // Validate date format
  if (!datePattern.test(from) || !datePattern.test(to)) {
    return c.json({ error: 'INVALID_DATE' }, 400);
  }

  // Validate date range
  if (from > to) {
    return c.json({ error: 'INVALID_DATE_RANGE' }, 400);
  }

  // Check team exists
  const exists = await exportRepo.teamExists(teamId);
  if (!exists) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }

  // Check team membership
  const isMember = await exportRepo.isTeamMember(teamId, user.id);
  if (!isMember) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  try {
    // Fetch report data
    const reportData = await exportRepo.fetchTeamReportData(teamId, from, to);

    // Format and return
    if (format === 'json') {
      const jsonContent = formatReportAsJSON(reportData, user.id);
      const filename = generateReportFilename(reportData.team.name, 'json');

      c.header('Content-Type', 'application/json; charset=utf-8');
      c.header('Content-Disposition', `attachment; filename="${filename}"`);
      return c.body(jsonContent);
    } else if (format === 'markdown') {
      const markdownContent = formatReportAsMarkdown(reportData);
      const filename = generateReportFilename(reportData.team.name, 'md');

      c.header('Content-Type', 'text/markdown; charset=utf-8');
      c.header('Content-Disposition', `attachment; filename="${filename}"`);
      return c.body(markdownContent);
    }
  } catch (err: unknown) {
    if (err instanceof Error && 'status' in err) {
      const appError = err as { status: number; code: string; message: string };
      return c.json({ error: appError.code }, appError.status);
    }
    throw err;
  }
});

export { exportRouter };
