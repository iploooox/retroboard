import { sql } from '../db/connection.js';
import { BOARD_PHASES } from '../validation/boards.js';
import type { BoardPhase } from '../validation/boards.js';
import type { TimerService } from './timer-service.js';

export class FacilitationService {
  constructor(private timerService?: TimerService) {}

  async setPhase(boardId: string, phase: string, userId: string) {
    // Validate phase
    if (!BOARD_PHASES.includes(phase as BoardPhase)) {
      throw new Error('INVALID_PHASE');
    }

    // Find board
    const boardResult = await sql`SELECT * FROM boards WHERE id = ${boardId}`;
    if (!boardResult || boardResult.length === 0) {
      throw new Error('NOT_FOUND');
    }
    const board = boardResult[0];
    const previousPhase = board.phase as string;

    // Check for running timer and stop it
    let timerStopped = false;

    // Check both in-memory (timer service) and DB for timers
    const inMemoryTimer = this.timerService?.getState(boardId);
    const dbTimer = await sql`SELECT * FROM board_timers WHERE board_id = ${boardId}`;

    if (inMemoryTimer && this.timerService) {
      // Timer is running in memory - use timer service to stop it properly
      await this.timerService.stop(boardId, 'phase_change');
      timerStopped = true;
    } else if (dbTimer && dbTimer.length > 0) {
      // Timer exists in DB but not in memory - clean up DB directly
      await sql`DELETE FROM board_timers WHERE board_id = ${boardId}`;
      timerStopped = true;
    }

    // Update phase
    const updateResult = await sql`
      UPDATE boards
      SET phase = ${phase},
          focus_item_id = CASE WHEN ${phase} != 'discuss' THEN NULL ELSE focus_item_id END,
          focus_item_type = CASE WHEN ${phase} != 'discuss' THEN NULL ELSE focus_item_type END
      WHERE id = ${boardId}
      RETURNING *
    `;
    const updated = updateResult?.[0];

    return {
      phase: (updated?.phase as string) ?? phase,
      previous_phase: previousPhase,
      timerStopped,
    };
  }

  async setLock(boardId: string, isLocked: boolean, userId: string) {
    // Find board
    const boardResult = await sql`SELECT * FROM boards WHERE id = ${boardId}`;
    if (!boardResult || boardResult.length === 0) {
      throw new Error('NOT_FOUND');
    }

    // Update lock state
    const updateResult = await sql`
      UPDATE boards SET is_locked = ${isLocked} WHERE id = ${boardId} RETURNING *
    `;
    const updated = updateResult?.[0];

    return {
      isLocked: (updated?.is_locked as boolean) ?? isLocked,
    };
  }

  async revealCards(boardId: string, userId: string) {
    // Find board
    const boardResult = await sql`SELECT * FROM boards WHERE id = ${boardId}`;
    if (!boardResult || boardResult.length === 0) {
      throw new Error('NOT_FOUND');
    }
    const board = boardResult[0];

    if (!board.anonymous_mode) {
      throw new Error('NOT_ANONYMOUS');
    }
    if (board.cards_revealed) {
      throw new Error('ALREADY_REVEALED');
    }

    // Update cards_revealed
    await sql`UPDATE boards SET cards_revealed = true WHERE id = ${boardId}`;

    // Get card-author mapping
    const cards = await sql`
      SELECT c.id, c.author_id, u.display_name
      FROM cards c
      JOIN users u ON u.id = c.author_id
      WHERE c.board_id = ${boardId}
    `;

    const revealedCards = (cards || []).map((c: Record<string, unknown>) => ({
      cardId: c.id as string,
      authorId: c.author_id as string,
      authorName: c.display_name as string,
    }));

    return { cardsRevealed: true, revealedCards };
  }

  async setFocus(
    boardId: string,
    focusType: string | null,
    focusId: string | null,
    userId: string,
  ) {
    // Find board
    const boardResult = await sql`SELECT * FROM boards WHERE id = ${boardId}`;
    if (!boardResult || boardResult.length === 0) {
      throw new Error('NOT_FOUND');
    }

    // Validate focus target exists on this board
    if (focusType !== null && focusId !== null) {
      let targetResult;
      if (focusType === 'card') {
        targetResult = await sql`SELECT id, board_id FROM cards WHERE id = ${focusId}`;
      } else if (focusType === 'group') {
        targetResult = await sql`SELECT id, board_id FROM card_groups WHERE id = ${focusId}`;
      }

      if (
        !targetResult ||
        targetResult.length === 0 ||
        (targetResult[0].board_id as string) !== boardId
      ) {
        throw new Error('FOCUS_TARGET_NOT_FOUND');
      }
    }

    // Update focus
    const updateResult = await sql`
      UPDATE boards
      SET focus_item_type = ${focusType}, focus_item_id = ${focusId}
      WHERE id = ${boardId}
      RETURNING *
    `;
    const updated = updateResult?.[0];

    return {
      focusType: (updated?.focus_item_type as string | null) ?? focusType,
      focusId: (updated?.focus_item_id as string | null) ?? focusId,
    };
  }
}
