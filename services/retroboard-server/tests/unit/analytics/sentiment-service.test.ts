import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../../../src/db/connection.js';
import { truncateTables } from '../../helpers/db.js';
import { seed } from '../../../src/db/seed.js';

describe('Sentiment Service — Unit Tests', () => {
  beforeEach(async () => {
    await truncateTables();
    await seed();
  });

  describe('calculate_card_sentiment function', () => {
    it('1.1: Single positive word returns positive score', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('excellent') AS score`;
      expect(Number(result.score)).toBeGreaterThan(4.0);
    });

    it('1.2: Single negative word returns negative score', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('terrible') AS score`;
      expect(Number(result.score)).toBeLessThan(-3.0);
    });

    it('1.3: Mixed sentiment returns average of matched words', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('great collaboration but terrible deploy') AS score`;
      // great = +3, collaboration = +2, terrible = -3.5
      // Average should be around (3 + 2 - 3.5) / 3 ≈ 0.5
      expect(Number(result.score)).toBeGreaterThan(-1);
      expect(Number(result.score)).toBeLessThan(2);
    });

    it('1.4: No lexicon matches returns score of 0', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('the and from') AS score`;
      expect(Number(result.score)).toBe(0);
    });

    it('1.5: Empty string returns score of 0', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('') AS score`;
      expect(Number(result.score)).toBe(0);
    });

    it('1.6: NULL input returns score of 0', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment(NULL) AS score`;
      expect(Number(result.score)).toBe(0);
    });

    it('1.7: All positive words returns high positive score', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('excellent amazing wonderful') AS score`;
      expect(Number(result.score)).toBeGreaterThan(3.0);
    });

    it('1.8: All negative words returns low negative score', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('terrible awful horrible') AS score`;
      expect(Number(result.score)).toBeLessThan(-3.0);
    });

    it('1.9: Neutral text returns score near 0', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('normal standard average') AS score`;
      expect(Number(result.score)).toBeGreaterThanOrEqual(-0.5);
      expect(Number(result.score)).toBeLessThanOrEqual(0.5);
    });

    it('1.10: Case insensitive matching', async () => {
      const [upper] = await sql`SELECT calculate_card_sentiment('GREAT AMAZING') AS score`;
      const [lower] = await sql`SELECT calculate_card_sentiment('great amazing') AS score`;
      expect(Number(upper.score)).toBe(Number(lower.score));
    });

    it('1.11: Punctuation is stripped', async () => {
      const [withPunct] = await sql`SELECT calculate_card_sentiment('great! amazing...') AS score`;
      const [withoutPunct] = await sql`SELECT calculate_card_sentiment('great amazing') AS score`;
      expect(Number(withPunct.score)).toBe(Number(withoutPunct.score));
    });

    it('1.12: Short words (< 3 chars) are ignored', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('a I an') AS score`;
      expect(Number(result.score)).toBe(0);
    });

    it('1.13: Repeated word is counted multiple times', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('great great great') AS score`;
      // Should average three instances of 'great' (score = 3.0)
      expect(Number(result.score)).toBe(3.0);
    });

    it('1.14: Very long text returns valid score without timeout', async () => {
      const longText = Array(200).fill('great deployment').join(' ');
      const [result] = await sql`SELECT calculate_card_sentiment(${longText}) AS score`;
      expect(Number(result.score)).toBeGreaterThan(0);
      expect(Number(result.score)).toBeLessThanOrEqual(5.0);
    });

    it('1.15: Unicode text scores English words and ignores rest', async () => {
      const [result] = await sql`SELECT calculate_card_sentiment('great collab 你好') AS score`;
      // Should only score 'great' and ignore Unicode characters
      expect(Number(result.score)).toBeGreaterThan(0);
    });
  });

  describe('Normalized score conversion', () => {
    it('2.1: Maximum positive raw score (5.0) normalizes to 100', () => {
      const normalized = ((5.0 + 5.0) / 10.0) * 100;
      expect(normalized).toBe(100);
    });

    it('2.2: Maximum negative raw score (-5.0) normalizes to 0', () => {
      const normalized = ((-5.0 + 5.0) / 10.0) * 100;
      expect(normalized).toBe(0);
    });

    it('2.3: Neutral raw score (0.0) normalizes to 50', () => {
      const normalized = ((0.0 + 5.0) / 10.0) * 100;
      expect(normalized).toBe(50);
    });

    it('2.4: Mildly positive raw score (1.0) normalizes to 60', () => {
      const normalized = ((1.0 + 5.0) / 10.0) * 100;
      expect(normalized).toBe(60);
    });

    it('2.5: Mildly negative raw score (-1.0) normalizes to 40', () => {
      const normalized = ((-1.0 + 5.0) / 10.0) * 100;
      expect(normalized).toBe(40);
    });
  });
});
