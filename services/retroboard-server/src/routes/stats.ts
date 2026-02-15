import { Hono } from 'hono';
import { sql } from '../db/connection.js';

const statsRouter = new Hono();

// Cache for stats
interface CachedStats {
  teams: number;
  retros: number;
  cards: number;
  actionItems: number;
}

let statsCache: CachedStats | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchStats(): Promise<CachedStats> {
  const now = Date.now();

  // Return cached stats if within TTL
  if (statsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return statsCache;
  }

  // Fetch fresh stats
  const [teamsResult] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text as count FROM teams
  `;

  const [retrosResult] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text as count
    FROM boards b
    JOIN sprints s ON b.sprint_id = s.id
    WHERE s.status = 'completed'
  `;

  const [cardsResult] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text as count FROM cards
  `;

  const [actionItemsResult] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text as count FROM action_items
  `;

  const stats: CachedStats = {
    teams: parseInt(teamsResult.count, 10),
    retros: parseInt(retrosResult.count, 10),
    cards: parseInt(cardsResult.count, 10),
    actionItems: parseInt(actionItemsResult.count, 10),
  };

  // Update cache
  statsCache = stats;
  cacheTimestamp = now;

  return stats;
}

// GET /stats - Public endpoint (no auth required)
statsRouter.get('/stats', async (c) => {
  const stats = await fetchStats();
  return c.json({ ok: true, data: stats });
});

// Export function to clear cache (for testing)
export function clearStatsCache() {
  statsCache = null;
  cacheTimestamp = null;
}

export { statsRouter };
