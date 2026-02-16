import { afterAll } from 'vitest';
import postgres from 'postgres';

// Derive admin URL from DATABASE_URL (CI sets postgres:postgres credentials) or use local default
const ADMIN_URL = process.env.DATABASE_URL?.replace(/\/[^/]+$/, '/postgres') ?? 'postgres://localhost:5432/postgres';
const TEMPLATE_DB = 'retroboard_test_template';
const TEST_DB_NAME = `retroboard_test_${process.pid}`;

const adminSql = postgres(ADMIN_URL, { onnotice: () => {} });

// Copy the pre-migrated template — near instant vs running 29 migrations
await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
await adminSql.unsafe(`CREATE DATABASE "${TEST_DB_NAME}" TEMPLATE "${TEMPLATE_DB}"`);

const testDbUrl = ADMIN_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);
process.env.DATABASE_URL = testDbUrl;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-must-be-at-least-32-characters-long';
process.env.NODE_ENV = 'test';

afterAll(async () => {
  // Shut down WS server if it was started (by integration tests)
  if (globalThis.__wsServerCleanup) {
    await globalThis.__wsServerCleanup();
  }

  // Close lazy connection if it was opened
  const { closeDatabase } = await import('../src/db/connection.js');
  await closeDatabase();

  // Drop test database
  await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await adminSql.end();
});
