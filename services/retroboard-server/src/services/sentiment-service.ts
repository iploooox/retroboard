import * as sentimentRepo from '../repositories/sentiment.repository.js';

/**
 * Sentiment Service
 * Provides sentiment analysis for card text using PostgreSQL-based lexicon
 */
export class SentimentService {
  /**
   * Calculate sentiment score for text
   * Returns raw score (-5 to +5)
   */
  async calculateSentiment(text: string): Promise<number> {
    return sentimentRepo.calculateSentiment(text);
  }

  /**
   * Normalize raw sentiment score to 0-100 scale
   * -5 -> 0, 0 -> 50, +5 -> 100
   */
  normalize(rawScore: number): number {
    return sentimentRepo.normalizeSentiment(rawScore);
  }

  /**
   * Get top positive and negative cards for a sprint
   */
  async getTopSentimentCards(sprintId: string, limit: number = 5) {
    return sentimentRepo.getTopSentimentCards(sprintId, limit);
  }

  /**
   * Get sentiment breakdown by board column
   */
  async getSentimentByColumn(sprintId: string) {
    return sentimentRepo.getSentimentByColumn(sprintId);
  }
}

export const sentimentService = new SentimentService();
