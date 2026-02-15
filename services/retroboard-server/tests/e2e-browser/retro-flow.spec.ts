import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser } from './helpers';

test.describe.serial('Retro Flow - Happy Path', () => {
  let email: string;
  let password: string;
  let displayName: string;

  test.beforeAll(() => {
    email = generateUniqueEmail();
    password = 'SecurePass123!';
    displayName = 'Retro Flow User';
  });

  test('E2E-FLOW-1: Register and reach dashboard', async ({ page }) => {
    await page.goto('/register');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByPlaceholder('Display Name').fill(displayName);
    await page.getByRole('button', { name: /register|sign up/i }).click();

    await expect(page).toHaveURL('/dashboard');
  });

  test('E2E-FLOW-2: Create team via UI modal', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /create team|new team/i }).click();
    await page.getByPlaceholder(/team name/i).fill('Flow Test Team');
    await page.getByRole('button', { name: /create|save/i }).click();

    // Wait for team creation
    await page.waitForTimeout(500);
    await expect(page.getByText('Flow Test Team')).toBeVisible();
  });

  test('E2E-FLOW-3: Create sprint via UI modal', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /create sprint|new sprint/i }).click();
    await page.getByPlaceholder(/sprint name/i).fill('Sprint 1');
    await page.getByRole('button', { name: /create|save/i }).click();

    // Wait for sprint creation
    await page.waitForTimeout(500);
    await expect(page.getByText('Sprint 1')).toBeVisible();
  });

  test('E2E-FLOW-4: Activate sprint and navigate to board', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /activate/i }).click();
    await expect(page.getByText(/active/i)).toBeVisible();

    await page.getByRole('link', { name: /board/i }).click();
    await expect(page.url()).toContain('/board');
  });

  test('E2E-FLOW-5: Start retro and select template', async ({ page }) => {
    // Should already be on board page from previous test
    await page.getByRole('button', { name: /start retro/i }).click();

    // Select first template
    await page.locator('[data-template]').first().click();

    // Create board
    await page.getByRole('button', { name: /create board|start/i }).click();

    // Wait for board to load
    await page.waitForTimeout(1000);

    // Should see columns
    await expect(page.getByText(/what went well|went well|positive/i)).toBeVisible();
  });

  test('E2E-FLOW-6: Add 3 cards to different columns', async ({ page }) => {
    // Add card to first column
    const addButtons = await page.getByRole('button', { name: /add card|\+/i }).all();

    // Card 1
    await addButtons[0].click();
    await page.getByPlaceholder(/enter your card|card content/i).fill('Great teamwork!');
    await page.keyboard.press('Enter');

    // Wait for card to appear
    await expect(page.getByText('Great teamwork!')).toBeVisible();

    // Card 2
    await addButtons[1].click();
    await page.getByPlaceholder(/enter your card|card content/i).fill('Improve documentation');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Improve documentation')).toBeVisible();

    // Card 3
    await addButtons[2].click();
    await page.getByPlaceholder(/enter your card|card content/i).fill('Action: Review PRs faster');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Action: Review PRs faster')).toBeVisible();
  });

  test('E2E-FLOW-7: Change phase from write to group', async ({ page }) => {
    // Click Next Phase button
    await page.getByRole('button', { name: /next phase|group/i }).click();

    // Confirm modal
    await page.getByRole('button', { name: /confirm|yes|proceed/i }).click();

    // Should see grouping UI
    await page.waitForTimeout(500);
    await expect(page.getByText(/group|grouping/i)).toBeVisible();
  });

  test('E2E-FLOW-8: Change phase from group to vote', async ({ page }) => {
    // Click Next Phase button
    await page.getByRole('button', { name: /next phase|vote/i }).click();

    // Confirm modal
    await page.getByRole('button', { name: /confirm|yes|proceed/i }).click();

    // Should see voting UI
    await page.waitForTimeout(500);
    await expect(page.getByText(/vote|voting/i)).toBeVisible();
  });

  test('E2E-FLOW-9: Vote on 2 cards and verify count updates', async ({ page }) => {
    // Find vote buttons on cards
    const voteButtons = await page.getByRole('button', { name: /vote|\+1/i }).all();

    // Vote on first card
    await voteButtons[0].click();
    await page.waitForTimeout(300);

    // Vote on second card
    await voteButtons[1].click();
    await page.waitForTimeout(300);

    // Verify vote counts
    const voteCountElements = await page.locator('[data-vote-count]').all();
    const counts = await Promise.all(voteCountElements.map(el => el.textContent()));

    expect(counts.some(count => count?.includes('1'))).toBeTruthy();
  });

  test('E2E-FLOW-10: Change phase through discuss to action', async ({ page }) => {
    // Move to discuss phase
    await page.getByRole('button', { name: /next phase|discuss/i }).click();
    await page.getByRole('button', { name: /confirm|yes|proceed/i }).click();
    await page.waitForTimeout(500);

    // Move to action phase
    await page.getByRole('button', { name: /next phase|action/i }).click();
    await page.getByRole('button', { name: /confirm|yes|proceed/i }).click();
    await page.waitForTimeout(500);

    // Should see action items UI
    await expect(page.getByText(/action item|action/i)).toBeVisible();
  });

  test('E2E-FLOW-11: Open action items panel and create action item', async ({ page }) => {
    // Open action items panel
    await page.getByRole('button', { name: /action items/i }).click();

    // Create action item
    await page.getByPlaceholder(/action item|new action/i).fill('Review and update docs');
    await page.getByRole('button', { name: /add action|create/i }).click();

    // Verify action item appears
    await expect(page.getByText('Review and update docs')).toBeVisible();
  });

  test('E2E-FLOW-12: Verify board displays all content', async ({ page }) => {
    // Verify cards
    await expect(page.getByText('Great teamwork!')).toBeVisible();
    await expect(page.getByText('Improve documentation')).toBeVisible();
    await expect(page.getByText('Action: Review PRs faster')).toBeVisible();

    // Verify votes exist (at least one vote count visible)
    const voteCountElements = await page.locator('[data-vote-count]').all();
    expect(voteCountElements.length).toBeGreaterThan(0);

    // Verify action item
    await expect(page.getByText('Review and update docs')).toBeVisible();
  });
});
