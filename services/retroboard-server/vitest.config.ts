import { defineConfig } from 'vitest/config';
import path from 'node:path';
import os from 'node:os';

// CI (GitHub free): 2 cores, 7GB RAM. Local M5: 12+ cores.
const cpus = os.cpus().length;
const forks = process.env.CI ? Math.min(cpus, 2) : Math.min(cpus, 10);

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: process.env.CI ? 30000 : 15000,
    hookTimeout: process.env.CI ? 60000 : 30000,
    bail: 1,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: forks,
        minForks: forks,
      },
    },
    exclude: ['client/**', 'node_modules/**', 'tests/e2e-browser/**'],
  },
});
