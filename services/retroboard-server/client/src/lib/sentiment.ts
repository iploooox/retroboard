/**
 * Client-side sentiment analysis for card content
 * Uses a simple lexicon-based approach matching the backend's calculate_card_sentiment() function
 */

// Simplified sentiment lexicon (subset of AFINN)
const POSITIVE_WORDS = new Set([
  'good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'wonderful',
  'love', 'happy', 'excited', 'thrilled', 'delighted', 'pleased', 'glad',
  'success', 'successful', 'achieve', 'achieved', 'progress', 'improved',
  'better', 'best', 'perfect', 'outstanding', 'exceptional', 'brilliant',
  'helpful', 'effective', 'efficient', 'productive', 'smooth', 'easy',
  'thank', 'thanks', 'appreciate', 'appreciated', 'gratitude', 'grateful',
  'win', 'won', 'victory', 'accomplish', 'accomplished', 'milestone',
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'poor', 'terrible', 'horrible', 'awful', 'disappointing',
  'problem', 'problems', 'issue', 'issues', 'bug', 'bugs', 'error', 'errors',
  'fail', 'failed', 'failure', 'broken', 'stuck', 'blocked', 'blocker',
  'difficult', 'hard', 'challenging', 'struggle', 'struggled', 'struggling',
  'slow', 'confusing', 'confused', 'unclear', 'frustrating', 'frustrated',
  'concern', 'concerned', 'worry', 'worried', 'anxious', 'stress', 'stressed',
  'lack', 'lacking', 'missing', 'missed', 'delay', 'delayed', 'late',
  'pain', 'painful', 'annoying', 'annoyed', 'upset', 'angry', 'sad',
]);

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

/**
 * Calculate sentiment for card text
 * Returns label: positive (score > 0.5), negative (score < -0.5), or neutral
 * Matches backend logic: score > 0.5 = positive, < -0.5 = negative, else neutral
 */
export function calculateSentiment(text: string): SentimentLabel {
  if (!text || text.trim().length === 0) {
    return 'neutral';
  }

  // Normalize text: lowercase, remove punctuation, split into words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2); // Filter short words

  let score = 0;
  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) {
      score += 1;
    } else if (NEGATIVE_WORDS.has(word)) {
      score -= 1;
    }
  }

  // Normalize score by word count (similar to backend's approach)
  const normalizedScore = words.length > 0 ? score / Math.sqrt(words.length) : 0;

  // Classify based on normalized score
  if (normalizedScore > 0.5) {
    return 'positive';
  } else if (normalizedScore < -0.5) {
    return 'negative';
  } else {
    return 'neutral';
  }
}

/**
 * Get color class for sentiment indicator dot
 */
export function getSentimentColor(sentiment: SentimentLabel): string {
  switch (sentiment) {
    case 'positive':
      return 'bg-green-500';
    case 'negative':
      return 'bg-red-500';
    case 'neutral':
      return 'bg-slate-400';
  }
}

/**
 * Get human-readable label for sentiment
 */
export function getSentimentLabel(sentiment: SentimentLabel): string {
  switch (sentiment) {
    case 'positive':
      return 'Positive sentiment';
    case 'negative':
      return 'Negative sentiment';
    case 'neutral':
      return 'Neutral sentiment';
  }
}
