import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error('Invalid environment variables:', formatted);
    process.exit(1);
  }
  return result.data;
}

export function getEnv(): Env {
  if (!_env) {
    _env = loadEnv();
  }
  return _env;
}

/** Lazy env proxy -- reads process.env on first access, not at import time. */
export const env: Env = new Proxy({} as Env, {
  get(_, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
