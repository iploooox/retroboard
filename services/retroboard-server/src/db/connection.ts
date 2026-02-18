import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;

export function getSql(): ReturnType<typeof postgres> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    const schema = process.env.DB_SCHEMA;
    const connectionOpts: Record<string, string> = {};
    if (schema) {
      connectionOpts.search_path = `${schema}, public`;
    }
    _sql = postgres(url, {
      max: process.env.NODE_ENV === 'test' ? 3 : 20,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
      connection: connectionOpts,
    });
  }
  return _sql;
}

function _noop() {}

/**
 * Lazy postgres tagged template proxy.
 * Connection is created on first use, not at import time.
 * Supports: sql`...`, sql.begin(...), sql.end(), etc.
 */
export const sql = new Proxy(_noop, {
  apply(_, __, args) {
    return (getSql() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_, prop) {
    const real = getSql();
    const val = Reflect.get(real, prop);
    return typeof val === 'function' ? (val as (...a: unknown[]) => unknown).bind(real) : val;
  },
}) as unknown as ReturnType<typeof postgres>;

export async function closeDatabase() {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
}
