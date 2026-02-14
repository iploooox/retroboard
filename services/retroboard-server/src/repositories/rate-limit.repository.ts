import { sql } from '../db/connection.js';

export async function checkAndIncrement(key: string, windowMs: number, maxRequests: number): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const [result] = await sql<{ count: number }[]>`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `;

  return result.count <= maxRequests;
}

export async function cleanup(olderThan: Date): Promise<void> {
  await sql`
    DELETE FROM rate_limits WHERE window_start < ${olderThan}
  `;
}
