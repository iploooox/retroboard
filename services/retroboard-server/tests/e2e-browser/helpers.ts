import { Page, expect } from '@playwright/test';

let emailCounter = 0;

export function generateUniqueEmail(): string {
  emailCounter++;
  return `test-${Date.now()}-${emailCounter}@example.com`;
}

export async function registerUser(
  page: Page,
  options: { email: string; password: string; displayName: string }
): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Display Name').fill(options.displayName);
  await page.getByLabel('Email').fill(options.email);
  // Use explicit ID selector to avoid matching the "Show password" button
  await page.locator('#register-password').fill(options.password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  // New users are redirected to onboarding - skip it to get to dashboard
  await expect(page).toHaveURL('/onboarding', { timeout: 15000 });
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
}

export async function loginUser(
  page: Page,
  options: { email: string; password: string }
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(options.email);
  // Use explicit ID selector to avoid matching the "Show password" button
  await page.locator('#password').fill(options.password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
}

export async function logoutUser(page: Page): Promise<void> {
  // Click the avatar button in the header (button containing rounded-full div with initials)
  await page.locator('header button').filter({ has: page.locator('.rounded-full') }).click();

  // Wait for dropdown menu to be visible
  await page.locator('div.absolute.right-0').filter({ hasText: 'Log out' }).waitFor({ state: 'visible' });

  // Click "Log out" button in the dropdown
  await page.getByRole('button', { name: /log out/i }).click();

  // Wait for navigation to login page
  await expect(page).toHaveURL('/login', { timeout: 5000 });
}

export async function createTeamAndBoard(
  page: Page,
  options: { teamName: string; templateName?: string }
): Promise<{ teamName: string; sprintName: string }> {
  // Assumes we're already on the dashboard

  // 1. Create team
  await page.getByRole('button', { name: 'Create Team' }).first().click();
  await page.getByLabel(/team name/i).fill(options.teamName);
  await page.getByRole('button', { name: 'Create Team' }).nth(1).click();

  // Wait for modal to close and team to appear
  await page.waitForTimeout(1000);

  // 2. Navigate into the team (CRITICAL FIX)
  // Click the team card - it's a link containing the team name
  await page.getByRole('link', { name: new RegExp(options.teamName) }).click();

  // Wait for TeamDetailPage to load and verify URL contains /teams/
  await expect(page).toHaveURL(/\/teams\/[a-f0-9-]+/, { timeout: 5000 });
  await page.waitForTimeout(500);

  // 3. Create sprint
  await page.getByRole('button', { name: /new sprint/i }).click();
  const sprintName = `Sprint ${Date.now()}`;
  await page.getByLabel(/sprint name/i).fill(sprintName);

  // Fill required start date (CRITICAL FIX)
  const today = new Date().toISOString().split('T')[0];
  await page.getByLabel(/start date/i).fill(today);

  await page.getByRole('button', { name: /^create sprint$/i }).click();

  // Wait for modal to close
  await page.waitForTimeout(2000);

  // 4. Activate sprint
  await page.getByRole('button', { name: /activate/i }).click();
  await page.waitForTimeout(500);

  // 5. Click Board link to navigate to board page (use exact match to avoid header links)
  await page.getByRole('link', { name: 'Board', exact: true }).click();

  // 6. Start Retro
  await page.getByRole('button', { name: /start retro/i }).click();

  // 7. Select template - first template is auto-selected, so just submit (CRITICAL FIX)
  // If specific template requested, click the radio button
  if (options.templateName) {
    await page.getByRole('radio', { name: new RegExp(options.templateName, 'i') }).click();
  }

  // 8. Create board
  await page.getByRole('button', { name: /create board/i }).click();

  // Wait for board to load by waiting for "Add a card" button to be visible
  await page.getByRole('button', { name: /add a card/i }).first().waitFor({ state: 'visible', timeout: 10000 });

  return { teamName: options.teamName, sprintName };
}
