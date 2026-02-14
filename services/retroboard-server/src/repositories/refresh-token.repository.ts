import { sql } from '../db/connection.js';

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export async function create(userId: string, tokenHash: string, expiresAt: Date): Promise<RefreshTokenRow> {
  const [token] = await sql<RefreshTokenRow[]>`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
    RETURNING *
  `;
  return token;
}

export async function findByHash(tokenHash: string): Promise<RefreshTokenRow | undefined> {
  const [token] = await sql<RefreshTokenRow[]>`
    SELECT * FROM refresh_tokens WHERE token_hash = ${tokenHash}
  `;
  return token;
}

export async function revoke(id: string): Promise<void> {
  await sql`
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE id = ${id} AND revoked_at IS NULL
  `;
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await sql`
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
}
