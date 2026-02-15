import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser, createTeamAndBoard } from './helpers';

test.describe('Timer Functionality', () => {
  test('E2E-TIMER-1: Timer controls work correctly', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Timer Test User';

    // Setup: Register and create board
    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Timer Test Team' });

    // Should be on board page with timer
    await expect(page.getByText('05:00')).toBeVisible();

    // 1. Start timer
    await page.getByRole('button', { name: /start timer/i }).click();

    // Timer should start (display should change)
    await page.waitForTimeout(1000);
    const timerAfterStart = await page.getByTestId('timer-display').textContent();
    expect(timerAfterStart).not.toBe('05:00');

    // 2. Wait 2 seconds and verify timer decreased
    await page.waitForTimeout(2000);
    const timerAfter2Sec = await page.getByTestId('timer-display').textContent();
    expect(timerAfter2Sec).not.toBe(timerAfterStart);

    // 3. Pause timer
    await page.getByRole('button', { name: /pause timer/i }).click();
    const timerAfterPause = await page.getByTestId('timer-display').textContent();

    // Wait and verify it doesn't change
    await page.waitForTimeout(1000);
    const timerStillPaused = await page.getByTestId('timer-display').textContent();
    expect(timerStillPaused).toBe(timerAfterPause);

    // 4. Resume timer
    await page.getByRole('button', { name: /resume timer/i }).click();

    // Wait and verify it continues
    await page.waitForTimeout(1000);
    const timerAfterResume = await page.getByTestId('timer-display').textContent();
    expect(timerAfterResume).not.toBe(timerStillPaused);

    // 5. Reset timer
    await page.getByRole('button', { name: /reset timer/i }).click();

    // Should show 05:00 again
    await expect(page.getByText('05:00')).toBeVisible();
  });
});
