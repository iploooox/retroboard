import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { requireTeamRole } from '../middleware/team-auth.js';
import { formatErrorResponse } from '../utils/errors.js';
import * as sentimentRepo from '../repositories/sentiment.repository.js';
import { z } from 'zod';

const sentimentLexiconRouter = new Hono();
sentimentLexiconRouter.use('*', requireAuth);

// Validation schemas
const wordScoreSchema = z.object({
  word: z.string().min(2).max(50).regex(/^[a-zA-Z]+$/, 'Word must contain only letters'),
  score: z.number().min(-5.0).max(5.0),
});

const updateScoreSchema = z.object({
  score: z.number().min(-5.0).max(5.0),
});

// GET /api/v1/teams/:teamId/sentiment/lexicon - List custom words
sentimentLexiconRouter.get(
  '/teams/:teamId/sentiment/lexicon',
  requireTeamRole(['admin', 'facilitator', 'member']),
  async (c) => {
    const teamId = c.req.param('teamId');

    const customWords = await sentimentRepo.listCustomWords(teamId);

    return c.json({
      ok: true,
      data: customWords,
    });
  },
);

// POST /api/v1/teams/:teamId/sentiment/lexicon - Add custom word
sentimentLexiconRouter.post(
  '/teams/:teamId/sentiment/lexicon',
  requireTeamRole(['admin', 'facilitator']),
  async (c) => {
    const teamId = c.req.param('teamId');
    const body = await c.req.json();

    // Validate input
    const validation = wordScoreSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: validation.error.errors[0]?.message || 'Invalid input',
          details: validation.error.errors,
        },
        422,
      );
    }

    const { word, score } = validation.data;

    try {
      const customWord = await sentimentRepo.addCustomWord(teamId, word, score);

      return c.json({
        ok: true,
        data: customWord,
      }, 201);
    } catch (err: any) {
      // Handle unique constraint violation
      if (err.code === '23505') {
        return c.json(
          formatErrorResponse(
            'WORD_ALREADY_EXISTS',
            'This word already exists in your custom lexicon',
          ),
          409,
        );
      }
      throw err;
    }
  },
);

// PUT /api/v1/teams/:teamId/sentiment/lexicon/:word - Update word score
sentimentLexiconRouter.put(
  '/teams/:teamId/sentiment/lexicon/:word',
  requireTeamRole(['admin', 'facilitator']),
  async (c) => {
    const teamId = c.req.param('teamId');
    const word = c.req.param('word');
    const body = await c.req.json();

    // Validate input
    const validation = updateScoreSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: validation.error.errors[0]?.message || 'Invalid input',
          details: validation.error.errors,
        },
        422,
      );
    }

    const { score } = validation.data;

    const updatedWord = await sentimentRepo.updateCustomWord(teamId, word, score);

    if (!updatedWord) {
      return c.json(formatErrorResponse('WORD_NOT_FOUND', 'Custom word not found'), 404);
    }

    return c.json({
      ok: true,
      data: updatedWord,
    });
  },
);

// DELETE /api/v1/teams/:teamId/sentiment/lexicon/:word - Delete custom word
sentimentLexiconRouter.delete(
  '/teams/:teamId/sentiment/lexicon/:word',
  requireTeamRole(['admin', 'facilitator']),
  async (c) => {
    const teamId = c.req.param('teamId');
    const word = c.req.param('word');

    const deleted = await sentimentRepo.deleteCustomWord(teamId, word);

    if (!deleted) {
      return c.json(formatErrorResponse('WORD_NOT_FOUND', 'Custom word not found'), 404);
    }

    return c.json({
      ok: true,
      data: { word },
    });
  },
);

export { sentimentLexiconRouter };
