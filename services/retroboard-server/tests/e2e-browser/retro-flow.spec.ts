import { test, expect, type Page } from '@playwright/test';
import { generateUniqueEmail, registerUser } from './helpers';

test.describe.serial('Retro Flow - Happy Path', () => {
  let page: Page;
  let email: string;
  let password: string;
  let displayName: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    email = generateUniqueEmail();
    password = 'SecurePass123!';
    displayName = 'Retro Flow User';
  });

  test('E2E-FLOW-1: Register and reach dashboard', async () => {
    await registerUser(page, { email, password, displayName });
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('E2E-FLOW-2: Create team via UI modal', async () => {
    await page.goto('/dashboard');

    // Verify we're on dashboard and wait for it to load
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Wait for Create Team button to be visible before clicking
    const createTeamButton = page.getByRole('button', { name: 'Create Team' }).first();
    await expect(createTeamButton).toBeVisible({ timeout: 10000 });
    await createTeamButton.click();
    await page.waitForTimeout(300);

    await page.getByLabel(/team name/i).fill('Flow Test Team');
    await page.getByRole('button', { name: 'Create Team' }).nth(1).click();

    // Wait for team creation
    await page.waitForTimeout(500);
    await expect(page.getByText('Flow Test Team')).toBeVisible();
  });

  test('E2E-FLOW-3: Create sprint via UI modal', async () => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Navigate to the team we created in FLOW-2
    await page.getByText('Flow Test Team').click();
    await page.waitForTimeout(500);

    // Should be on team detail page
    await expect(page.url()).toContain('/teams/');

    // Click "New Sprint" button
    const newSprintButton = page.getByRole('button', { name: /new sprint/i });
    await expect(newSprintButton).toBeVisible({ timeout: 10000 });
    await newSprintButton.click();

    // Fill sprint form
    await page.getByPlaceholder(/e\.g\. Sprint/i).fill('Sprint 1');

    // Fill required start date
    const today = new Date().toISOString().split('T')[0];
    await page.getByLabel(/start date/i).fill(today);

    await page.getByRole('button', { name: /create sprint/i }).click();

    // Wait for sprint creation and verify it appears in the list
    await page.waitForTimeout(1000);
    await expect(page.getByText('Sprint 1')).toBeVisible();
  });

  test('E2E-FLOW-4: Activate sprint and navigate to board', async () => {
    // Should still be on team detail page from FLOW-3
    await expect(page.url()).toContain('/teams/');

    // Wait for Activate button to be visible
    const activateButton = page.getByRole('button', { name: /activate/i });
    await expect(activateButton).toBeVisible({ timeout: 10000 });
    await activateButton.click();
    await page.waitForTimeout(500);

    // Verify sprint is now active
    await expect(page.getByText(/active/i)).toBeVisible();

    // Wait for board link to be visible before clicking (use exact match to avoid "RetroBoard Pro" link)
    const boardLink = page.getByRole('link', { name: 'Board', exact: true });
    await expect(boardLink).toBeVisible({ timeout: 5000 });
    await boardLink.click();
    await expect(page.url()).toContain('/board');
  });

  test('E2E-FLOW-5: Start retro and select template', async () => {
    // Should already be on board page from previous test
    await expect(page.url()).toContain('/board');

    // Wait for "Start Retro" button to be visible and click it
    const startRetroButton = page.getByRole('button', { name: /start retro/i });
    await expect(startRetroButton).toBeVisible({ timeout: 10000 });
    await startRetroButton.click();

    // Wait for template modal to load (first template is auto-selected)
    await page.waitForTimeout(1000);

    // Click "Create Board" button to create board with first template
    const createBoardButton = page.getByRole('button', { name: /create board/i });
    await expect(createBoardButton).toBeVisible({ timeout: 10000 });
    await createBoardButton.click();

    // Wait for board to load — icebreaker warmup shows first
    await page.waitForTimeout(1500);

    // Dismiss icebreaker warmup to reveal columns
    const startWritingBtn = page.getByRole('button', { name: /start writing/i });
    await startWritingBtn.waitFor({ state: 'visible', timeout: 10000 }).then(() => startWritingBtn.click()).catch(() => {});
    await page.waitForTimeout(500);

    await expect(page.getByText(/what went well|went well/i)).toBeVisible();
  });

  test('E2E-FLOW-6: Add 2 cards to different columns', async () => {
    // Add cards to both columns (What Went Well and Delta templates have 2 columns)
    const addButtons = await page.getByRole('button', { name: /add a card/i }).all();

    // Card 1 - first column
    await addButtons[0].click();
    await page.getByPlaceholder(/what.*your mind/i).fill('Great teamwork!');
    await page.getByRole('button', { name: /^add card$/i }).click();
    await expect(page.getByText('Great teamwork!')).toBeVisible();

    // Card 2 - second column
    await addButtons[1].click();
    await page.getByPlaceholder(/what.*your mind/i).fill('Improve documentation');
    await page.getByRole('button', { name: /^add card$/i }).click();
    await expect(page.getByText('Improve documentation')).toBeVisible();
  });

  test('E2E-FLOW-7: Change phase from write to group', async () => {
    // Click Next Phase button (use aria-label to be specific)
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();

    // Wait for phase transition (no modal confirmation needed)
    await page.waitForTimeout(1000);
  });

  test('E2E-FLOW-8: Change phase from group to vote', async () => {
    // Click Next Phase button (use aria-label to be specific)
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();

    // Wait for phase transition
    await page.waitForTimeout(1000);
  });

  test('E2E-FLOW-9: Vote on 2 cards and verify count updates', async () => {
    // Find vote buttons on cards (use aria-label to avoid phase stepper buttons)
    const voteButtons = await page.locator('button[aria-label="Vote"]').all();

    // Vote on first card
    await voteButtons[0].click();
    await page.waitForTimeout(500);

    // Vote on second card
    await voteButtons[1].click();
    await page.waitForTimeout(500);

    // Verify vote count appears (at least one card should show "1")
    const voteCountSpan = page.locator('span').filter({ hasText: /^1$/ });
    await expect(voteCountSpan.first()).toBeVisible({ timeout: 2000 });
  });

  test('E2E-FLOW-10: Change phase through discuss to action', async () => {
    // Move to discuss phase
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();
    await page.waitForTimeout(1000);

    // Move to action phase
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();
    await page.waitForTimeout(1000);
  });

  test('E2E-FLOW-11: Open action items panel and create action item', async () => {
    // Open action items panel
    const actionItemsButton = page.getByRole('button', { name: /action items/i });
    await expect(actionItemsButton).toBeVisible({ timeout: 5000 });
    await actionItemsButton.click();

    // Wait for panel to open and click "New" button to show create form
    const newActionButton = page.getByRole('button', { name: 'New Action Item' });
    await expect(newActionButton).toBeVisible({ timeout: 5000 });
    await newActionButton.click();

    // Wait for create form input to be visible
    const actionItemInput = page.getByPlaceholder('Action item title');
    await expect(actionItemInput).toBeVisible({ timeout: 5000 });
    await actionItemInput.fill('Review and update docs');

    // Click Create button
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Verify action item appears
    await page.waitForTimeout(500);
    await expect(page.getByText('Review and update docs')).toBeVisible();
  });

  test('E2E-FLOW-12: Verify board displays all content', async () => {
    // Verify cards
    await expect(page.getByText('Great teamwork!')).toBeVisible();
    await expect(page.getByText('Improve documentation')).toBeVisible();

    // Verify action item (action items panel should still be open from FLOW-11)
    await expect(page.getByText('Review and update docs')).toBeVisible();
  });
});
