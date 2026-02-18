import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Derive admin URL from DATABASE_URL (CI sets postgres:postgres credentials) or use local default
const ADMIN_URL = process.env.DATABASE_URL?.replace(/\/[^/]+$/, '/postgres') ?? 'postgres://localhost:5432/postgres';
const TEMPLATE_DB = 'retroboard_test_template';

/**
 * Compute a hash of all migration files + seed to detect changes.
 * If the template DB already exists with the same hash, skip rebuild.
 */
function getMigrationHash(): string {
  const migrationsDir = path.join(__dirname, '../src/db/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  const contents = files.map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf-8')).join('');
  // Simple hash — fast enough for this purpose
  let hash = 0;
  for (let i = 0; i < contents.length; i++) {
    hash = ((hash << 5) - hash + contents.charCodeAt(i)) | 0;
  }
  return `v${hash}`;
}

export async function setup() {
  const adminSql = postgres(ADMIN_URL, { onnotice: () => {} });
  const hash = getMigrationHash();

  // Check if a cached template exists with matching hash
  const existing = await adminSql`
    SELECT 1 FROM pg_database WHERE datname = ${TEMPLATE_DB}
  `;

  if (existing.length > 0) {
    // Template exists — check if hash matches via a comment table
    try {
      const tplSql = postgres(ADMIN_URL.replace(/\/[^/]+$/, `/${TEMPLATE_DB}`), { onnotice: () => {} });
      const rows = await tplSql`
        SELECT value FROM _test_meta WHERE key = 'migration_hash'
      `;
      await tplSql.end();
      if (rows.length > 0 && rows[0].value === hash) {
        // Template is up-to-date, skip rebuild
        await adminSql.end();
        return;
      }
    } catch {
      // Table doesn't exist or DB is corrupt — rebuild
    }

    // Hash mismatch or error — drop and rebuild
    // Terminate any lingering connections first
    await adminSql.unsafe(`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = '${TEMPLATE_DB}' AND pid <> pg_backend_pid()
    `);
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEMPLATE_DB}"`);
  }

  // Create fresh template
  await adminSql.unsafe(`CREATE DATABASE "${TEMPLATE_DB}"`);
  await adminSql.end();

  const templateUrl = ADMIN_URL.replace(/\/[^/]+$/, `/${TEMPLATE_DB}`);
  await migrate(templateUrl, process.env.DB_SCHEMA);
  await seed(templateUrl, process.env.DB_SCHEMA);

  // Store the hash so future runs can skip rebuild
  const tplSql = postgres(templateUrl, { onnotice: () => {} });
  await tplSql`CREATE TABLE IF NOT EXISTS _test_meta (key TEXT PRIMARY KEY, value TEXT)`;
  await tplSql`INSERT INTO _test_meta (key, value) VALUES ('migration_hash', ${hash}) ON CONFLICT (key) DO UPDATE SET value = ${hash}`;
  await tplSql.end();
}

export async function teardown() {
  // In CI, clean up the template (no persistent filesystem).
  // Locally, keep it cached for faster subsequent runs.
  if (process.env.CI) {
    const adminSql = postgres(ADMIN_URL, { onnotice: () => {} });
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEMPLATE_DB}"`);
    await adminSql.end();
  }
}
