import { test, expect, Page } from '@playwright/test';
import { registerUser, generateUniqueEmail } from './helpers';

async function completeFullRetro(
  page: Page,
  teamId: string,
  sprintName: string,
  cards: string[]
): Promise<void> {
  // Navigate to team page
  await page.goto(`/teams/${teamId}`);

  // Create sprint
  await page.getByRole('button', { name: /create sprint|new sprint/i }).click();
  await page.getByLabel(/sprint name/i).fill(sprintName);
  await page.getByRole('button', { name: /create|save/i }).click();
  await page.waitForTimeout(500);

  // Activate sprint
  await page.getByRole('button', { name: /activate/i }).click();
  await page.waitForTimeout(300);

  // Click Board link
  await page.getByRole('link', { name: /board/i }).click();

  // Start Retro
  await page.getByRole('button', { name: /start retro/i }).click();

  // Select first template
  await page.locator('[data-template]').first().click();
  await page.getByRole('button', { name: /create board|start/i }).click();
  await page.waitForTimeout(1000);

  // Add cards
  for (const cardText of cards) {
    await page.getByRole('button', { name: /add a card/i }).first().click();
    await page.getByPlaceholder(/what.*mind/i).fill(cardText);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }

  // Move to vote phase (facilitator action)
  // Look for phase transition button or next phase button
  await page.getByRole('button', { name: /next phase|vote/i }).click();
  await page.waitForTimeout(500);

  // Vote on first card (2 votes)
  const voteButtons = page.getByRole('button', { name: /^vote$/i });
  await voteButtons.first().click();
  await page.waitForTimeout(300);
  await voteButtons.first().click();
  await page.waitForTimeout(300);

  // Move to discuss phase
  await page.getByRole('button', { name: /next phase|discuss/i }).click();
  await page.waitForTimeout(500);

  // Move to action phase
  await page.getByRole('button', { name: /next phase|action/i }).click();
  await page.waitForTimeout(500);

  // Complete board
  await page.getByRole('button', { name: /complete|finish/i }).click();
  await page.waitForTimeout(500);
}

test.describe('Analytics Dashboard Journey', () => {
  // Helper function to create a completed sprint
  async function createCompletedSprint(
    page: Page,
    teamId: string,
    sprintName: string,
    cards: string[]
  ): Promise<string> {
    await page.goto(`/teams/${teamId}`);

    // Create sprint
    await page.getByRole('button', { name: /create sprint|new sprint/i }).click();
    await page.getByLabel(/sprint name/i).fill(sprintName);
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(500);

    // Activate sprint
    await page.getByRole('button', { name: /activate/i }).click();
    await page.waitForTimeout(300);

    // Navigate to board
    await page.getByRole('link', { name: /board/i }).click();

    // Start retro
    await page.getByRole('button', { name: /start retro/i }).click();
    await page.locator('[data-template]').first().click();
    await page.getByRole('button', { name: /create board|start/i }).click();
    await page.waitForTimeout(1000);

    // Extract sprint ID from URL
    const url = page.url();
    const sprintIdMatch = url.match(/\/sprints\/([^/]+)\/board/);
    const sprintId = sprintIdMatch?.[1] || '';

    // Add cards
    for (const cardText of cards) {
      await page.getByRole('button', { name: /add a card/i }).first().click();
      await page.getByPlaceholder(/what.*mind/i).fill(cardText);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
    }

    // Move through phases to complete
    await page.getByRole('button', { name: /next phase|vote/i }).click();
    await page.waitForTimeout(500);

    // Vote on first card
    const voteButtons = page.getByRole('button', { name: /^vote$/i });
    if (await voteButtons.first().isVisible()) {
      await voteButtons.first().click();
      await page.waitForTimeout(300);
    }

    await page.getByRole('button', { name: /next phase|discuss/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /next phase|action/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /complete|finish/i }).click();
    await page.waitForTimeout(500);

    return sprintId;
  }

test.describe('Analytics Dashboard Journey', () => {
  test('full journey: view analytics with real data from 3 completed retros', async ({ page }) => {
    const email = generateUniqueEmail();
    const displayName = 'Analytics Lead';
    await registerUser(page, {
      email,
      password: 'SecurePass123!',
      displayName,
    });

    // Create team
    const teamName = 'Analytics Team';
    await page.getByRole('button', { name: 'Create Team' }).first().click();
    await page.getByLabel(/team name/i).fill(teamName);
    await page.getByRole('button', { name: 'Create Team' }).nth(1).click();
    await page.waitForTimeout(500);

    // Extract team ID from URL (we're now on team detail page)
    await page.waitForURL(/\/teams\/[\w-]+$/);
    const teamId = page.url().split('/teams/')[1];

    // Complete 3 full retros with different cards
    await completeFullRetro(page, teamId, 'Sprint 1', [
      'Great deployment automation',
      'Need better testing coverage',
      'Team collaboration improved',
      'Documentation needs update',
      'CI pipeline is slow',
    ]);

    await completeFullRetro(page, teamId, 'Sprint 2', [
      'Excellent code reviews',
      'Testing framework works well',
      'More collaboration needed',
      'Deployment was smooth',
      'Good sprint planning',
    ]);

    await completeFullRetro(page, teamId, 'Sprint 3', [
      'Deployment frequency increased',
      'Testing automation helps',
      'Strong team collaboration',
      'Documentation improved',
      'Fast CI builds now',
    ]);

    // Navigate to analytics page
    await page.goto(`/teams/${teamId}/analytics`);

    // Verify analytics page loads
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
    await expect(page.getByText(teamName)).toBeVisible();

    // Verify all 4 chart cards are present (not empty state)
    await expect(page.getByText('Sprint Health Trend')).toBeVisible();
    await expect(page.getByText('Participation')).toBeVisible();
    await expect(page.getByText('Sentiment Distribution')).toBeVisible();
    await expect(page.getByText('Word Cloud')).toBeVisible();

    // Verify Health Trend Chart has data points (SVG circles for each sprint)
    const healthChart = page.locator('text=Sprint Health Trend').locator('..').locator('..');
    await expect(healthChart.locator('circle')).toHaveCount(3, { timeout: 10000 });

    // Verify Participation Chart shows the user's name and card count
    const participationChart = page.locator('text=Participation').locator('..').locator('..');
    await expect(participationChart.getByText(displayName)).toBeVisible();
    // User created 5 cards per sprint × 3 sprints = 15 total cards
    await expect(participationChart.getByText(/15c/)).toBeVisible();

    // Verify Word Cloud shows actual words from our cards
    const wordCloud = page.locator('text=Word Cloud').locator('..').locator('..');
    // These words appear in multiple cards across sprints
    await expect(wordCloud.getByText(/deployment/i)).toBeVisible();
    await expect(wordCloud.getByText(/testing/i)).toBeVisible();
    await expect(wordCloud.getByText(/collaboration/i)).toBeVisible();
  });

  test('empty state: not enough sprints for analytics', async ({ page }) => {
    const email = generateUniqueEmail();
    await registerUser(page, {
      email,
      password: 'SecurePass123!',
      displayName: 'Analytics User',
    });

    const { teamName } = await createTeamAndBoard(page, { teamName: 'Analytics Team' });

    // Add some cards to the board to generate analytics data
    // Click "Add a card" button for first column
    await page.getByRole('button', { name: /add a card/i }).first().click();
    await page.getByPlaceholder(/what.*mind/i).fill('Great teamwork this sprint');
    await page.keyboard.press('Enter');

    // Wait for card to be created
    await page.waitForTimeout(500);

    // Add another card
    await page.getByRole('button', { name: /add a card/i }).first().click();
    await page.getByPlaceholder(/what.*mind/i).fill('Need better communication');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(500);

    // Navigate to team detail page by clicking back/team name or using URL
    // First, go back to dashboard
    await page.goto('/dashboard');

    // Click on the team we created
    await page.getByText(teamName).click();

    // Wait for team detail page to load
    await page.waitForURL(/\/teams\/[\w-]+$/);

    // Extract teamId from URL
    const teamId = page.url().split('/teams/')[1];

    // Navigate to analytics page
    await page.goto(`/teams/${teamId}/analytics`);

    // Verify analytics page loads
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
    await expect(page.getByText(teamName)).toBeVisible();

    // Since we only have 1 sprint (need 3 minimum for analytics), we should see the "not enough data" message
    await expect(
      page.getByText(/not enough data yet for analytics/i)
    ).toBeVisible();

    await expect(
      page.getByText(/complete at least 3 retrospectives/i)
    ).toBeVisible();

    // Verify progress indicator shows 1 of 3 sprints
    await expect(
      page.getByText(/sprints completed.*1.*of 3/i)
    ).toBeVisible();

    // Verify back to team link exists
    await expect(page.getByRole('link', { name: /back to team/i })).toBeVisible();
  });

  test('tab navigation: access analytics from team page', async ({ page }) => {
    const email = generateUniqueEmail();
    await registerUser(page, {
      email,
      password: 'SecurePass123!',
      displayName: 'Tab Nav User',
    });

    const { teamName } = await createTeamAndBoard(page, { teamName: 'Tab Team' });

    // Go back to dashboard
    await page.goto('/dashboard');

    // Click on the team
    await page.getByText(teamName).click();

    // Wait for team detail page to load
    await page.waitForURL(/\/teams\/[\w-]+$/);

    // Click Analytics tab button
    await page.getByRole('button', { name: 'Analytics' }).click();

    // Verify we're on the analytics page
    await expect(page).toHaveURL(/\/teams\/[\w-]+\/analytics/);
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
  });
});
