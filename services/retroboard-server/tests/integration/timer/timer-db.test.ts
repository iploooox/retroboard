import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../../../src/db/connection.js';
import {
  truncateTables,
  createTestUser,
  createTestTeam,
  createTestSprint,
  createTestBoard,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { seed } from '../../../src/db/seed.js';

describe('board_timers — Database Constraint Tests', () => {
  let user: { id: string };
  let board: Record<string, unknown>;

  beforeEach(async () => {
    await truncateTables();
    await seed();
    user = await createTestUser();
    const team = await createTestTeam(user.id);
    const sprint = await createTestSprint(team.id, user.id);
    const result = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, user.id);
    board = result.board;
  });

  it('3.5.1: Duration must be > 0 (duration=0 violates constraint)', async () => {
    await expect(
      sql`
        INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
        VALUES (${board.id as string}, 'write', 0, 0, ${user.id})
      `,
    ).rejects.toThrow();
  });

  it('3.5.2: Remaining must be >= 0 (negative violates constraint)', async () => {
    await expect(
      sql`
        INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
        VALUES (${board.id as string}, 'write', 300, -1, ${user.id})
      `,
    ).rejects.toThrow();
  });

  it('3.5.3: Cascade delete — deleting board deletes timer', async () => {
    // Insert a timer
    await sql`
      INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
      VALUES (${board.id as string}, 'write', 300, 300, ${user.id})
    `;

    // Verify timer exists
    const before = await sql`SELECT * FROM board_timers WHERE board_id = ${board.id as string}`;
    expect(before.length).toBe(1);

    // Delete the board (cascade should delete timer)
    await sql`DELETE FROM boards WHERE id = ${board.id as string}`;

    // Timer should be gone
    const after = await sql`SELECT * FROM board_timers WHERE board_id = ${board.id as string}`;
    expect(after.length).toBe(0);
  });

  it('3.5.4: One timer per board (PK conflict on second insert)', async () => {
    // Insert first timer
    await sql`
      INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
      VALUES (${board.id as string}, 'write', 300, 300, ${user.id})
    `;

    // Second insert with same board_id should fail (PK violation)
    await expect(
      sql`
        INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
        VALUES (${board.id as string}, 'group', 180, 180, ${user.id})
      `,
    ).rejects.toThrow();
  });

  it('3.5.5: Duration must be <= 3600 (3601 violates constraint)', async () => {
    await expect(
      sql`
        INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
        VALUES (${board.id as string}, 'write', 3601, 3601, ${user.id})
      `,
    ).rejects.toThrow();
  });

  it('3.5.6: Valid timer insert succeeds', async () => {
    const result = await sql`
      INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
      VALUES (${board.id as string}, 'write', 300, 300, ${user.id})
      RETURNING *
    `;

    expect(result.length).toBe(1);
    expect(result[0].duration_seconds).toBe(300);
    expect(result[0].remaining_seconds).toBe(300);
    expect(result[0].phase).toBe('write');
  });

  it('3.5.7: Phase must be valid (invalid phase violates constraint)', async () => {
    await expect(
      sql`
        INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
        VALUES (${board.id as string}, 'invalid', 300, 300, ${user.id})
      `,
    ).rejects.toThrow();
  });

  it('3.5.8: Negative duration violates constraint', async () => {
    await expect(
      sql`
        INSERT INTO board_timers (board_id, phase, duration_seconds, remaining_seconds, started_by)
        VALUES (${board.id as string}, 'write', -5, -5, ${user.id})
      `,
    ).rejects.toThrow();
  });
});
