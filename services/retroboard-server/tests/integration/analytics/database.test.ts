import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../../../src/db/connection.js';
import {
  truncateTables,
  createTestTeam,
  createTestSprint,
  createTestBoard,
  createTestCard,
  createTestVote,
  SYSTEM_TEMPLATE_WWD,
} from '../../helpers/db.js';
import { getAuthToken } from '../../helpers/auth.js';
import { seed } from '../../../src/db/seed.js';

describe('Analytics Database — Schema and Function Tests', () => {
  beforeEach(async () => {
    await truncateTables();
    await seed();
  });

  describe('sentiment_lexicon table constraints', () => {
    it('11.1: Score constraint rejects value < -5.0', async () => {
      await expect(
        sql`INSERT INTO sentiment_lexicon (word, score) VALUES ('test', -5.1)`
      ).rejects.toThrow();
    });

    it('11.2: Score constraint rejects value > 5.0', async () => {
      await expect(
        sql`INSERT INTO sentiment_lexicon (word, score) VALUES ('test', 5.1)`
      ).rejects.toThrow();
    });

    it('11.3: Score boundary min (-5.0) is valid', async () => {
      await sql`INSERT INTO sentiment_lexicon (word, score) VALUES ('testmin', -5.0)`;
      const [result] = await sql`SELECT score FROM sentiment_lexicon WHERE word = 'testmin'`;
      expect(Number(result.score)).toBe(-5.0);
    });

    it('11.4: Score boundary max (5.0) is valid', async () => {
      await sql`INSERT INTO sentiment_lexicon (word, score) VALUES ('testmax', 5.0)`;
      const [result] = await sql`SELECT score FROM sentiment_lexicon WHERE word = 'testmax'`;
      expect(Number(result.score)).toBe(5.0);
    });

    it('11.5: Duplicate word violates primary key constraint', async () => {
      await sql`INSERT INTO sentiment_lexicon (word, score) VALUES ('duplicate', 2.0)`;
      await expect(
        sql`INSERT INTO sentiment_lexicon (word, score) VALUES ('duplicate', 3.0)`
      ).rejects.toThrow();
    });

    it('11.6: Seed data loaded with ~100+ entries', async () => {
      const [result] = await sql`SELECT COUNT(*) AS count FROM sentiment_lexicon`;
      expect(Number(result.count)).toBeGreaterThan(100);
    });
  });

  describe('calculate_card_sentiment function', () => {
    it('12.1: Known positive text returns score > 3', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('excellent amazing wonderful') AS score`;
      expect(Number(result.score)).toBeGreaterThan(3);
    });

    it('12.2: Known negative text returns score < -3', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('terrible awful horrible') AS score`;
      expect(Number(result.score)).toBeLessThan(-3);
    });

    it('12.3: Empty text returns score of 0', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('') AS score`;
      expect(Number(result.score)).toBe(0);
    });

    it('12.4: Only stop words returns score of 0', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('the and from with') AS score`;
      expect(Number(result.score)).toBe(0);
    });

    it('12.5: Mixed text returns score near 0', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('great but terrible') AS score`;
      expect(Number(result.score)).toBeGreaterThan(-2);
      expect(Number(result.score)).toBeLessThan(2);
    });

    it('12.6: Function is STABLE (can be cached)', async () => {
      // Verify function volatility is STABLE
      const [result] = await sql`
        SELECT provolatile
        FROM pg_proc
        WHERE proname = 'calculate_card_sentiment'
      `;
      // 's' = STABLE, 'i' = IMMUTABLE, 'v' = VOLATILE
      expect(result.provolatile).toBe('s');
    });
  });

  describe('Materialized views', () => {
    it('13.1: mv_sprint_health populated after board creation', async () => {
      const { user } = await getAuthToken();
      const team = await createTestTeam(user.id);
      const sprint = await createTestSprint(team.id, user.id);
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, user.id);
      await createTestCard(board.id, columns[0].id, user.id, { content: 'good work' });
      await createTestVote((await createTestCard(board.id, columns[0].id, user.id, { content: 'test' })).id, user.id);

      // Refresh materialized view
      await sql`REFRESH MATERIALIZED VIEW mv_sprint_health`;

      const [result] = await sql`SELECT * FROM mv_sprint_health WHERE sprint_id = ${sprint.id}`;
      expect(result).toBeDefined();
      expect(result.health_score).toBeDefined();
    });

    it('13.2: mv_sprint_health unique index allows concurrent refresh', async () => {
      // Verify unique index exists for CONCURRENTLY refresh
      const [result] = await sql`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'mv_sprint_health'
          AND indexname = 'idx_mv_sprint_health_sprint_id'
      `;
      expect(result).toBeDefined();
    });

    it('13.3: mv_participation_stats populated after board creation', async () => {
      const { user } = await getAuthToken();
      const team = await createTestTeam(user.id);
      const sprint = await createTestSprint(team.id, user.id);
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, user.id);
      await createTestCard(board.id, columns[0].id, user.id, { content: 'test card' });

      // Refresh materialized view
      await sql`REFRESH MATERIALIZED VIEW mv_participation_stats`;

      const [result] = await sql`SELECT * FROM mv_participation_stats WHERE sprint_id = ${sprint.id}`;
      expect(result).toBeDefined();
    });

    it('13.4: mv_word_frequency populated after cards with text', async () => {
      const { user } = await getAuthToken();
      const team = await createTestTeam(user.id);
      const sprint = await createTestSprint(team.id, user.id);
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, user.id);

      // Create cards with repeated words
      await createTestCard(board.id, columns[0].id, user.id, { content: 'deployment deployment' });
      await createTestCard(board.id, columns[0].id, user.id, { content: 'deployment testing' });

      // Refresh materialized view
      await sql`REFRESH MATERIALIZED VIEW mv_word_frequency`;

      const results = await sql`SELECT * FROM mv_word_frequency WHERE sprint_id = ${sprint.id}`;
      expect(results.length).toBeGreaterThan(0);
    });

    it('13.5: Concurrent refresh does not lock readers', async () => {
      const { user } = await getAuthToken();
      const team = await createTestTeam(user.id);
      const sprint = await createTestSprint(team.id, user.id);
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, user.id);
      await createTestCard(board.id, columns[0].id, user.id, { content: 'test' });

      // Initial refresh
      await sql`REFRESH MATERIALIZED VIEW mv_sprint_health`;

      // Start concurrent refresh and read at same time
      const refreshPromise = sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sprint_health`;
      const readPromise = sql`SELECT * FROM mv_sprint_health WHERE sprint_id = ${sprint.id}`;

      // Both should succeed without blocking
      const [refreshResult, readResult] = await Promise.all([refreshPromise, readPromise]);

      expect(readResult).toBeDefined();
    });

    it('13.6: Empty state refreshes without errors', async () => {
      // Refresh views with no data
      await expect(sql`REFRESH MATERIALIZED VIEW mv_sprint_health`).resolves.not.toThrow();
      await expect(sql`REFRESH MATERIALIZED VIEW mv_participation_stats`).resolves.not.toThrow();
      await expect(sql`REFRESH MATERIALIZED VIEW mv_word_frequency`).resolves.not.toThrow();
    });

    it('13.7: Index used for team_id query on mv_sprint_health', async () => {
      const { user } = await getAuthToken();
      const team = await createTestTeam(user.id);

      // Explain query to verify index usage
      const plan = await sql`
        EXPLAIN
        SELECT * FROM mv_sprint_health
        WHERE team_id = ${team.id}
        ORDER BY start_date DESC
      `;

      // Check if Index Scan is in the plan
      const planText = plan.map((p: any) => p['QUERY PLAN']).join(' ');
      expect(planText).toContain('Index');
    });
  });

  describe('calculate_sprint_health function', () => {
    it('14.1: Returns all required fields', async () => {
      const { user } = await getAuthToken();
      const team = await createTestTeam(user.id);
      const sprint = await createTestSprint(team.id, user.id);
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, user.id);
      const card = await createTestCard(board.id, columns[0].id, user.id, { content: 'excellent' });
      await createTestVote(card.id, user.id);

      const [result] = await sql`SELECT * FROM calculate_sprint_health(${sprint.id})`;

      expect(result).toHaveProperty('health_score');
      expect(result).toHaveProperty('sentiment_score');
      expect(result).toHaveProperty('vote_distribution_score');
      expect(result).toHaveProperty('participation_score');
      expect(result).toHaveProperty('card_count');
      expect(result).toHaveProperty('total_members');
      expect(result).toHaveProperty('active_members');
    });

    it('14.2: Health score is weighted average (0.4, 0.3, 0.3)', async () => {
      const { user } = await getAuthToken();
      const team = await createTestTeam(user.id);
      const sprint = await createTestSprint(team.id, user.id);
      const { board, columns } = await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, user.id);
      const card = await createTestCard(board.id, columns[0].id, user.id, { content: 'excellent' });
      await createTestVote(card.id, user.id);

      const [result] = await sql`SELECT * FROM calculate_sprint_health(${sprint.id})`;

      const expectedHealth =
        Number(result.sentiment_score) * 0.4 +
        Number(result.vote_distribution_score) * 0.3 +
        Number(result.participation_score) * 0.3;

      expect(Math.abs(Number(result.health_score) - expectedHealth)).toBeLessThan(0.5);
    });

    it('14.3: Returns defaults for sprint with no activity', async () => {
      const { user } = await getAuthToken();
      const team = await createTestTeam(user.id);
      const sprint = await createTestSprint(team.id, user.id);
      await createTestBoard(sprint.id, SYSTEM_TEMPLATE_WWD, user.id);

      const [result] = await sql`SELECT * FROM calculate_sprint_health(${sprint.id})`;

      expect(Number(result.card_count)).toBe(0);
      expect(Number(result.sentiment_score)).toBe(50); // default when no cards
    });
  });
});
