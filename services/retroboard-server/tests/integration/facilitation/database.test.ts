import { describe, it, expect, beforeEach } from 'vitest';
import {
  truncateTables,
  createTestUser,
  createTestTeam,
  createTestSprint,
  createTestBoard,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { seed } from '../../../src/db/seed.js';
import { sql } from '../../../src/db/connection.js';

describe('Facilitation Database Constraints & Triggers', () => {
  let user: { id: string };
  let team: { id: string };
  let sprint: { id: string };
  let board: Record<string, unknown>;

  beforeEach(async () => {
    await truncateTables();
    await seed();
    user = await createTestUser({ displayName: 'DB Test User' });
    team = await createTestTeam(user.id);
    sprint = await createTestSprint(team.id, user.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, user.id);
    board = result.board;
  });

  // ─── Phase Constraint ──────────────────────────────────────────────

  it('3.7.1: Phase check constraint rejects invalid value', async () => {
    await expect(
      sql`UPDATE boards SET phase = 'invalid' WHERE id = ${board.id as string}`,
    ).rejects.toThrow();
  });

  // ─── Focus Consistency Constraints ─────────────────────────────────

  it('3.7.2: Focus consistency — type set, id null → rejected', async () => {
    await expect(
      sql.unsafe(
        `UPDATE boards SET focus_item_type = 'card', focus_item_id = NULL WHERE id = '${board.id}'`,
      ),
    ).rejects.toThrow();
  });

  it('3.7.3: Focus consistency — type null, id set → rejected', async () => {
    await expect(
      sql.unsafe(
        `UPDATE boards SET focus_item_type = NULL, focus_item_id = '00000000-0000-4000-8000-000000000001' WHERE id = '${board.id}'`,
      ),
    ).rejects.toThrow();
  });

  it('3.7.4: Focus consistency — both null → accepted', async () => {
    await expect(
      sql`UPDATE boards SET focus_item_type = NULL, focus_item_id = NULL WHERE id = ${board.id as string}`,
    ).resolves.not.toThrow();
  });

  // ─── Timer Constraints ─────────────────────────────────────────────

  it('3.7.5: Timer duration constraint — duration=0 rejected', async () => {
    await expect(
      sql`INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
          VALUES (${board.id as string}, 'write', 0, 0, ${user.id})`,
    ).rejects.toThrow();
  });

  it('3.7.6: Timer remaining <= duration — remaining > duration rejected', async () => {
    // remaining_seconds (400) > duration_seconds (300) should violate constraint
    await expect(
      sql`INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
          VALUES (${board.id as string}, 'write', 300, 400, ${user.id})`,
    ).rejects.toThrow();
  });

  it('3.7.7: Timer cascade delete — delete board deletes timer', async () => {
    await sql`INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
              VALUES (${board.id as string}, 'write', 300, 300, ${user.id})`;

    // Delete the board's sprint to cascade delete the board
    await sql`DELETE FROM boards WHERE id = ${board.id as string}`;

    const timers = await sql`SELECT * FROM board_timers WHERE board_id = ${board.id as string}`;
    expect(timers).toHaveLength(0);
  });

  it('3.7.8: One timer per board — PK conflict', async () => {
    await sql`INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
              VALUES (${board.id as string}, 'write', 300, 300, ${user.id})`;

    // Second insert should conflict on PK
    await expect(
      sql`INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
          VALUES (${board.id as string}, 'group', 180, 180, ${user.id})`,
    ).rejects.toThrow();
  });

  // ─── Trigger NOTIFY + board_events ─────────────────────────────────

  it('3.7.9: Phase change trigger fires and logs event', async () => {
    const beforeCount = await sql`
      SELECT COUNT(*)::int AS count FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'phase_changed'
    `;

    await sql`UPDATE boards SET phase = 'group' WHERE id = ${board.id as string}`;

    const afterCount = await sql`
      SELECT COUNT(*)::int AS count FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'phase_changed'
    `;

    expect(afterCount[0].count).toBe(beforeCount[0].count + 1);
  });

  it('3.7.10: Lock change trigger fires and logs event', async () => {
    const beforeCount = await sql`
      SELECT COUNT(*)::int AS count FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'board_locked'
    `;

    await sql`UPDATE boards SET is_locked = true WHERE id = ${board.id as string}`;

    const afterCount = await sql`
      SELECT COUNT(*)::int AS count FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'board_locked'
    `;

    expect(afterCount[0].count).toBe(beforeCount[0].count + 1);
  });

  it('3.7.11: Reveal trigger fires and logs event', async () => {
    // Set board as anonymous first
    await sql`UPDATE boards SET anonymous_mode = true WHERE id = ${board.id as string}`;

    const beforeCount = await sql`
      SELECT COUNT(*)::int AS count FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'cards_revealed'
    `;

    await sql`UPDATE boards SET cards_revealed = true WHERE id = ${board.id as string}`;

    const afterCount = await sql`
      SELECT COUNT(*)::int AS count FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'cards_revealed'
    `;

    expect(afterCount[0].count).toBe(beforeCount[0].count + 1);
  });

  it('3.7.12: Focus change trigger fires and logs event', async () => {
    // Create a card to focus on
    const [col] = await sql`SELECT id FROM columns WHERE board_id = ${board.id as string} LIMIT 1`;
    const [card] = await sql`
      INSERT INTO cards (board_id, column_id, content, author_id, position)
      VALUES (${board.id as string}, ${col.id}, 'Focus target', ${user.id}, 0)
      RETURNING id
    `;

    const beforeCount = await sql`
      SELECT COUNT(*)::int AS count FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'focus_changed'
    `;

    await sql`UPDATE boards SET focus_item_id = ${card.id}, focus_item_type = 'card' WHERE id = ${board.id as string}`;

    const afterCount = await sql`
      SELECT COUNT(*)::int AS count FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'focus_changed'
    `;

    expect(afterCount[0].count).toBe(beforeCount[0].count + 1);
  });

  it('3.7.13: Phase event logged in board_events with correct payload', async () => {
    await sql`UPDATE boards SET phase = 'vote' WHERE id = ${board.id as string}`;

    const events = await sql`
      SELECT * FROM board_events
      WHERE board_id = ${board.id as string} AND event_type = 'phase_changed'
      ORDER BY created_at DESC LIMIT 1
    `;

    expect(events).toHaveLength(1);
    expect(events[0].entity_type).toBe('board');
    expect(events[0].entity_id).toBe(board.id);
    // Payload should contain from/to phase info
    expect(events[0].payload).toBeDefined();
    expect(events[0].payload.from).toBe('write');
    expect(events[0].payload.to).toBe('vote');
  });

  it('3.7.14: Phase durations default value on new board', async () => {
    const [dbBoard] = await sql`SELECT phase_durations FROM boards WHERE id = ${board.id as string}`;
    expect(dbBoard.phase_durations).toBeDefined();
    expect(dbBoard.phase_durations.write).toBe(300);
    expect(dbBoard.phase_durations.group).toBe(300);
    expect(dbBoard.phase_durations.vote).toBe(180);
    expect(dbBoard.phase_durations.discuss).toBe(120);
    expect(dbBoard.phase_durations.action).toBe(300);
  });
});
