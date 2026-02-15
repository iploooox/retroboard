import { afterAll } from 'vitest';
import postgres from 'postgres';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

// Always connect to the default postgres DB for admin operations.
// process.env.DATABASE_URL may already point to a test DB from a prior file.
const ADMIN_URL = 'postgres://localhost:5432/postgres';
const TEST_DB_NAME = `retroboard_test_${process.pid}`;

const adminSql = postgres(ADMIN_URL, { onnotice: () => {} });

// Create test DB before any test files are loaded (top-level await)
await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
await adminSql.unsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);

const testDbUrl = ADMIN_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);
process.env.DATABASE_URL = testDbUrl;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-must-be-at-least-32-characters-long';
process.env.NODE_ENV = 'test';

// Run migrations and seeds on test DB
await migrate(testDbUrl);
await seed(testDbUrl);

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
