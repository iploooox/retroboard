import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e-browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 120000, // 2 minutes — multi-sprint tests need more than the default 30s
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // NOTE: webServer config removed - start servers manually before running tests:
  // Backend: DATABASE_URL=postgres://localhost:5432/retroboard JWT_SECRET=dev-secret-must-be-at-least-32-characters-long npm run dev
  // Frontend: cd client && npm run dev
});
