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
  await page.getByPlaceholder('Email').fill(options.email);
  await page.getByPlaceholder('Password').fill(options.password);
  await page.getByPlaceholder('Display Name').fill(options.displayName);
  await page.getByRole('button', { name: /register|sign up/i }).click();
  await expect(page).toHaveURL('/dashboard');
}

export async function loginUser(
  page: Page,
  options: { email: string; password: string }
): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(options.email);
  await page.getByPlaceholder('Password').fill(options.password);
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await expect(page).toHaveURL('/dashboard');
}

export async function createTeamAndBoard(
  page: Page,
  options: { teamName: string; templateName?: string }
): Promise<{ teamName: string; sprintName: string }> {
  // Assumes we're already on the dashboard
  // Create team
  await page.getByRole('button', { name: /create team|new team/i }).click();
  await page.getByPlaceholder(/team name/i).fill(options.teamName);
  await page.getByRole('button', { name: /create|save/i }).click();

  // Wait for team to be created and selected
  await page.waitForTimeout(500);

  // Create sprint
  await page.getByRole('button', { name: /create sprint|new sprint/i }).click();
  const sprintName = `Sprint ${Date.now()}`;
  await page.getByPlaceholder(/sprint name/i).fill(sprintName);
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
