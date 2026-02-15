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
  await page.getByLabel('Password').fill(options.password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
}

export async function loginUser(
  page: Page,
  options: { email: string; password: string }
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(options.email);
  await page.getByLabel('Password').fill(options.password);
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
  // Create team
  await page.getByRole('button', { name: 'Create Team' }).first().click();
  await page.getByLabel(/team name/i).fill(options.teamName);
  await page.getByRole('button', { name: 'Create Team' }).nth(1).click();

  // Wait for team to be created and selected
  await page.waitForTimeout(500);

  // Create sprint
  await page.getByRole('button', { name: /create sprint|new sprint/i }).click();
  const sprintName = `Sprint ${Date.now()}`;
  await page.getByLabel(/sprint name/i).fill(sprintName);
  await page.getByRole('button', { name: /create|save/i }).click();

  // Wait for sprint to be created
  await page.waitForTimeout(500);

  // Activate sprint
  await page.getByRole('button', { name: /activate/i }).click();

  // Click Board link to navigate to board page
  await page.getByRole('link', { name: /board/i }).click();

  // Start Retro
  await page.getByRole('button', { name: /start retro/i }).click();

  // Select template (default to first template or specified)
  if (options.templateName) {
    await page.getByText(options.templateName).click();
  } else {
    // Click first template option
    await page.locator('[data-template]').first().click();
  }

  // Create board
  await page.getByRole('button', { name: /create board|start/i }).click();

  // Wait for board to load
  await page.waitForTimeout(1000);

  return { teamName: options.teamName, sprintName };
}
