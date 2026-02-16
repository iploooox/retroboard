import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser, createTeamAndBoard } from './helpers';

test.describe('Board Themes (S-027)', () => {
  test('E2E-THEME-1: User can change board theme via settings modal', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Theme Tester';
    const teamName = `Theme Team ${Date.now()}`;

    // Register user
    await registerUser(page, { email, password, displayName });

    // Create team and board
    await createTeamAndBoard(page, { teamName });

    // Wait for board to be ready
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });

    // Open board settings modal (only available to facilitators)
    const settingsButton = page.getByRole('button', { name: 'Board settings' });
    await settingsButton.click();

    // Wait for modal to open
    await expect(page.getByText('Board Settings')).toBeVisible();

    // Verify theme selector is visible
    await expect(page.getByText('Board Theme')).toBeVisible();

    // Get initial theme (should be ocean by default based on BoardSettingsModal)
    // The ocean theme button should be selected initially
    const oceanButton = page.locator('button:has-text("Ocean")');
    await expect(oceanButton).toBeVisible();

    // Click on a different theme (e.g., Sunset)
    const sunsetButton = page.locator('button:has-text("Sunset")');
    await sunsetButton.click();

    // Verify the theme button is now selected (should have different styling)
    // The selected theme has border-indigo-500 and bg-indigo-50
    await expect(sunsetButton).toHaveClass(/border-indigo-500/);

    // Save settings
    await page.getByRole('button', { name: /save settings/i }).click();

    // Wait for page reload and board to reappear
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });
  });

  test('E2E-THEME-2: Theme selection persists across sessions', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Theme Persistence Tester';
    const teamName = `Persistent Theme Team ${Date.now()}`;

    // Register user and create board
    await registerUser(page, { email, password, displayName });
    const { sprintName: _sprintName } = await createTeamAndBoard(page, { teamName });
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });

    // Change theme to Forest
    const settingsButton = page.getByRole('button', { name: 'Board settings' });
    await settingsButton.click();
    await expect(page.getByText('Board Settings')).toBeVisible();

    const forestButton = page.locator('button:has-text("Forest")');
    await forestButton.click();
    await expect(forestButton).toHaveClass(/border-indigo-500/);

    // Save and wait for reload
    await page.getByRole('button', { name: /save settings/i }).click();
    await page.waitForLoadState('networkidle');

    // Logout
    await page.locator('header button').filter({ has: page.locator('.rounded-full') }).click();
    await page.locator('div.absolute.right-0').filter({ hasText: 'Log out' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /log out/i }).click();
    await expect(page).toHaveURL('/login', { timeout: 5000 });

    // Login again
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /log\s?in|sign in/i }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Navigate back to the board
    // Click on team card
    await page.getByText(teamName).click();
    await page.waitForTimeout(500);
    // Click Board link for the sprint
    await page.getByRole('link', { name: 'Board', exact: true }).click();

    // Wait for board page to load
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });

    // Open settings again and verify Forest theme is still selected
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Board settings' }).click();
    await expect(page.getByText('Board Settings')).toBeVisible();

    const forestButtonAfterLogin = page.locator('button:has-text("Forest")');
    await expect(forestButtonAfterLogin).toHaveClass(/border-indigo-500/);

    // Close settings and verify Forest theme CSS is applied
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(500);

    const boardContainer = page.locator('div.flex.flex-col').first();
    const themeStyles = await boardContainer.evaluate((el) => {
      window.getComputedStyle(el);
      return {
        themeBg: (el as HTMLElement).style.getPropertyValue('--theme-bg'),
        themeAccent: (el as HTMLElement).style.getPropertyValue('--theme-accent'),
      };
    });

    // Verify Forest theme CSS variables are set (green colors)
    expect(themeStyles.themeBg).toBe('#f0fdf4');
    expect(themeStyles.themeAccent).toBe('#22c55e');
  });

  test('E2E-THEME-3: All 8 themes are available for selection', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Theme Options Tester';
    const teamName = `All Themes Team ${Date.now()}`;

    // Register user and create board
    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName });
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });

    // Open settings
    const settingsButton = page.getByRole('button', { name: 'Board settings' });
    await settingsButton.click();
    await expect(page.getByText('Board Settings')).toBeVisible();

    // Verify all 8 themes are present (based on BoardSettingsModal THEMES array)
    const expectedThemes = ['Default', 'Ocean', 'Sunset', 'Forest', 'Midnight', 'Lavender', 'Coral', 'Monochrome'];

    for (const themeName of expectedThemes) {
      const themeButton = page.locator(`button:has-text("${themeName}")`);
      await expect(themeButton).toBeVisible();
    }

    // Verify theme grid layout (should be 4 columns based on grid-cols-4)
    const themeContainer = page.locator('div.grid.grid-cols-4');
    await expect(themeContainer).toBeVisible();

    // Close modal without saving
    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});
