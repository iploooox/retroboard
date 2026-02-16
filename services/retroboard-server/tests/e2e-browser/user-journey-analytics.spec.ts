import { test, expect, Page } from '@playwright/test';
import { registerUser, generateUniqueEmail, createTeamAndBoard } from './helpers';

async function completeFullRetro(
  page: Page,
  teamId: string,
  sprintName: string,
  cards: string[]
): Promise<void> {
  // Navigate to team page
  await page.goto(`/teams/${teamId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Create sprint
  const newSprintButton = page.getByRole('button', { name: /create sprint|new sprint/i });
  await expect(newSprintButton).toBeVisible({ timeout: 10000 });
  await newSprintButton.click();
  await page.getByLabel(/sprint name/i).fill(sprintName);
  const today = new Date().toISOString().split('T')[0];
  await page.getByLabel(/start date/i).fill(today);

  // Wait for form validation and button to become enabled
  const createButton = page.getByRole('button', { name: /create sprint/i });
  await expect(createButton).toBeEnabled({ timeout: 5000 });
  await createButton.click();
  await page.waitForTimeout(500);

  // Activate sprint
  await page.getByRole('button', { name: /activate/i }).click();
  await page.waitForTimeout(1000);

  // Click Board link (use first() in case multiple sprints have Board links)
  await page.getByRole('link', { name: 'Board', exact: true }).first().click();

  // Start Retro
  await page.getByRole('button', { name: /start retro/i }).click();

  // Wait for template modal (first template is auto-selected)
  await page.waitForTimeout(1000);

  // Click "Create Board" button
  await page.getByRole('button', { name: /create board/i }).click();
  await page.waitForTimeout(1500);

  // Dismiss icebreaker warmup
  const startWritingBtn = page.getByRole('button', { name: /start writing/i });
  if (await startWritingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startWritingBtn.click();
    await page.waitForTimeout(500);
  }

  // Add cards
  for (const cardText of cards) {
    await page.getByRole('button', { name: /add a card/i }).first().click();
    await page.getByPlaceholder(/what.*mind/i).fill(cardText);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }

  // Move to group phase
  await page.getByTestId('next-phase-button').click();
  await page.waitForTimeout(500);

  // Move to vote phase (facilitator action)
  await page.getByTestId('next-phase-button').click();
  await page.waitForTimeout(500);

  // Vote on first card (2 votes)
  const voteButtons = await page.locator('button[aria-label="Vote"]').all();
  if (voteButtons.length > 0) {
    await voteButtons[0].click();
    await page.waitForTimeout(300);
    await voteButtons[0].click();
    await page.waitForTimeout(300);
  }

  // Move to discuss phase
  await page.getByTestId('next-phase-button').click();
  await page.waitForTimeout(500);

  // Move to action phase
  await page.getByTestId('next-phase-button').click();
  await page.waitForTimeout(1000);

  // Navigate back to team page to complete the sprint
  await page.goto(`/teams/${teamId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Click "Complete" button for the active sprint
  const completeButton = page.getByRole('button', { name: 'Complete' });
  await expect(completeButton).toBeVisible({ timeout: 5000 });
  await completeButton.click();

  // Wait for the Complete button to disappear (sprint transitions from 'active' to 'completed')
  await expect(completeButton).not.toBeVisible({ timeout: 10000 });

  // Wait for materialized views to refresh
  await page.waitForTimeout(1000);
}

test.describe('Analytics Dashboard Journey', () => {
  // Helper function to create a completed sprint
  async function createCompletedSprint(
    page: Page,
    teamId: string,
    sprintName: string,
    cards: string[]
  ): Promise<string> {
    // Navigate to team page and reload to ensure fresh state
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Create sprint - wait for button to be visible (ensures previous sprint is completed)
    const createSprintButton = page.getByRole('button', { name: /create sprint|new sprint/i });
    await expect(createSprintButton).toBeVisible({ timeout: 10000 });
    await createSprintButton.click();
    await page.getByLabel(/sprint name/i).fill(sprintName);
    const today = new Date().toISOString().split('T')[0];
    await page.getByLabel(/start date/i).fill(today);

    // Wait for form validation and button to become enabled
    const createButton = page.getByRole('button', { name: /create sprint/i });
    await expect(createButton).toBeEnabled({ timeout: 5000 });
    await createButton.click();
    await page.waitForTimeout(500);

    // Activate sprint
    await page.getByRole('button', { name: /activate/i }).click();
    await page.waitForTimeout(500);

    // Navigate to board (use first() since there may be multiple Board links from completed sprints)
    await page.getByRole('link', { name: 'Board', exact: true }).first().click();

    // Start retro
    await page.getByRole('button', { name: /start retro/i }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /create board/i }).click();
    await page.waitForTimeout(1500);

    // Dismiss icebreaker warmup
    const startWritingBtn = page.getByRole('button', { name: /start writing/i });
    if (await startWritingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startWritingBtn.click();
      await page.waitForTimeout(500);
    }

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
    // write → group
    await page.getByTestId('next-phase-button').click();
    await page.waitForTimeout(500);

    // group → vote
    await page.getByTestId('next-phase-button').click();
    await page.waitForTimeout(500);

    // Vote on first card
    const voteButtons = await page.locator('button[aria-label="Vote"]').all();
    if (voteButtons.length > 0) {
      await voteButtons[0].click();
      await page.waitForTimeout(300);
    }

    // vote → discuss
    await page.getByTestId('next-phase-button').click();
    await page.waitForTimeout(500);

    // discuss → action
    await page.getByTestId('next-phase-button').click();
    await page.waitForTimeout(1000);

    // Navigate back to team page to complete the sprint
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click "Complete" button for the active sprint
    const completeButton = page.getByRole('button', { name: 'Complete' });
    await expect(completeButton).toBeVisible({ timeout: 5000 });
    await completeButton.click();

    // Wait for the Complete button to disappear (sprint transitions from 'active' to 'completed')
    await expect(completeButton).not.toBeVisible({ timeout: 10000 });

    // Wait for materialized views to refresh
    await page.waitForTimeout(1000);

    return sprintId;
  }

  test('full journey: view analytics with real data from 3 completed retros', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for 3 full retros
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
    await page.waitForTimeout(1000);

    // Navigate into the team by clicking the team card
    await page.getByRole('link', { name: new RegExp(teamName) }).click();
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

    // Wait longer for materialized views to refresh (CONCURRENT refresh can take time)
    await page.waitForTimeout(5000);

    // Navigate to analytics page
    await page.goto(`/teams/${teamId}/analytics`);
    await page.waitForLoadState('networkidle');

    // Verify analytics page loads
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();
    await expect(page.getByText(teamName)).toBeVisible();

    // Verify all 4 chart cards are present (not empty state)
    await expect(page.getByRole('heading', { name: 'Sprint Health Trend' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Participation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sentiment Distribution' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Word Cloud' })).toBeVisible();

    // Verify Health Trend Chart has data points (SVG circles for each sprint)
    const healthChart = page.locator('text=Sprint Health Trend').locator('..').locator('..');
    const circleCount = await healthChart.locator('circle').count();
    expect(circleCount).toBeGreaterThanOrEqual(3); // At least 3 sprints worth of data

    // Verify Participation Chart shows the user's name and card count
    const participationChart = page.locator('text=Participation').locator('..').locator('..');
    await expect(participationChart.getByText(displayName)).toBeVisible();
    // User created 5 cards per sprint × 3 sprints = 15 total cards
    await expect(participationChart.getByText(/15c/)).toBeVisible();

    // Verify Word Cloud has rendered with data (has text content)
    const wordCloud = page.locator('text=Word Cloud').locator('..').locator('..');
    // Word cloud should have text content (not be empty)
    const wordCloudText = await wordCloud.textContent();
    expect(wordCloudText).toBeTruthy();
    expect(wordCloudText!.length).toBeGreaterThan(20); // Should have actual word content
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
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();
    await expect(page.getByText(teamName)).toBeVisible();

    // Since we only have 1 sprint (need 3 minimum for analytics), we should see the "not enough data" message
    await expect(
      page.getByText(/not enough data yet for analytics/i)
    ).toBeVisible();

    await expect(
      page.getByText(/complete at least 3 retrospectives/i)
    ).toBeVisible();

    // Verify progress indicator shows 0 of 3 sprints (sprint is active, not completed)
    await expect(
      page.getByText(/sprints completed.*0.*of 3/i)
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
    await page.getByRole('tab', { name: 'Analytics' }).click();

    // Verify we're on the analytics page
    await expect(page).toHaveURL(/\/teams\/[\w-]+\/analytics/);
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();
  });

  test('sprint selector: navigate between team overview and sprint detail', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for 3 sprints
    const email = generateUniqueEmail();
    await registerUser(page, {
      email,
      password: 'SecurePass123!',
      displayName: 'Sprint Selector User',
    });

    // Create team
    const teamName = 'Sprint Selector Team';
    await page.getByRole('button', { name: 'Create Team' }).first().click();
    await page.getByLabel(/team name/i).fill(teamName);
    await page.getByRole('button', { name: 'Create Team' }).nth(1).click();
    await page.waitForTimeout(1000);

    // Navigate into the team to get the team ID
    await page.getByRole('link', { name: new RegExp(teamName) }).click();
    await expect(page).toHaveURL(/\/teams\/[a-f0-9-]+/, { timeout: 5000 });
    const teamId = page.url().split('/teams/')[1];

    // Create 3 completed sprints
    const sprintId1 = await createCompletedSprint(page, teamId, 'Sprint 1', [
      'Great collaboration',
      'Need better docs',
      'CI is slow',
    ]);
    await createCompletedSprint(page, teamId, 'Sprint 2', [
      'Good code reviews',
      'Testing works well',
      'More pairing needed',
    ]);
    await createCompletedSprint(page, teamId, 'Sprint 3', [
      'Fast deployments',
      'Strong collaboration',
      'Docs improved',
    ]);

    // Navigate to analytics page
    await page.goto(`/teams/${teamId}/analytics`);
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();

    // Verify sprint selector is visible
    const sprintSelector = page.locator('select#sprint-selector');
    await expect(sprintSelector).toBeVisible();

    // Verify team overview charts are visible
    await expect(page.getByText('Sprint Health Trend')).toBeVisible();
    await expect(page.getByText('Participation')).toBeVisible();

    // Select a specific sprint
    await sprintSelector.selectOption(sprintId1);
    await page.waitForTimeout(1000);

    // Verify URL changes to include sprint parameter
    await expect(page).toHaveURL(new RegExp(`sprint=${sprintId1}`));

    // Verify sprint-level charts appear
    await expect(page.getByText('Card Distribution')).toBeVisible();
    await expect(page.getByText('Top Voted Cards')).toBeVisible();
    await expect(page.getByText('Action Items Summary')).toBeVisible();
    await expect(page.getByText('Sentiment by Column')).toBeVisible();

    // Click back to team overview
    await page.getByRole('button', { name: /back to team overview/i }).click();
    await page.waitForTimeout(500);

    // Verify team-wide charts return
    await expect(page.getByText('Sprint Health Trend')).toBeVisible();
    await expect(page.getByText('Word Cloud')).toBeVisible();
  });

  test('filter controls: sprint range and date filters', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for 3 sprints
    const email = generateUniqueEmail();
    await registerUser(page, {
      email,
      password: 'SecurePass123!',
      displayName: 'Filter User',
    });

    const teamName = 'Filter Team';
    await page.getByRole('button', { name: 'Create Team' }).first().click();
    await page.getByLabel(/team name/i).fill(teamName);
    await page.getByRole('button', { name: 'Create Team' }).nth(1).click();
    await page.waitForTimeout(1000);

    // Navigate into the team to get the team ID
    await page.getByRole('link', { name: new RegExp(teamName) }).click();
    await expect(page).toHaveURL(/\/teams\/[a-f0-9-]+/, { timeout: 5000 });
    const teamId = page.url().split('/teams/')[1];

    // Create 3 sprints
    await createCompletedSprint(page, teamId, 'Sprint A', ['Card 1', 'Card 2']);
    await createCompletedSprint(page, teamId, 'Sprint B', ['Card 3', 'Card 4']);
    await createCompletedSprint(page, teamId, 'Sprint C', ['Card 5', 'Card 6']);

    await page.goto(`/teams/${teamId}/analytics`);

    // Verify sprint range selector is visible
    const sprintRangeSelector = page.locator('select#sprint-range');
    await expect(sprintRangeSelector).toBeVisible();

    // Change sprint range to "5 sprints"
    await sprintRangeSelector.selectOption('5');
    await page.waitForTimeout(500);

    // Verify date range inputs are visible
    await expect(page.locator('input#date-start')).toBeVisible();
    await expect(page.locator('input#date-end')).toBeVisible();

    // Set date range
    await page.locator('input#date-start').fill('2026-01-01');
    await page.locator('input#date-end').fill('2026-02-15');
    await page.waitForTimeout(500);

    // Verify charts still render after filter changes
    await expect(page.getByText('Sprint Health Trend')).toBeVisible();
  });

  test('sprint detail view: verify all new charts render with data', async ({ page }) => {
    const email = generateUniqueEmail();
    await registerUser(page, {
      email,
      password: 'SecurePass123!',
      displayName: 'Sprint Detail User',
    });

    const teamName = 'Sprint Detail Team';
    await page.getByRole('button', { name: 'Create Team' }).first().click();
    await page.getByLabel(/team name/i).fill(teamName);
    await page.getByRole('button', { name: 'Create Team' }).nth(1).click();
    await page.waitForTimeout(1000);

    // Navigate into the team to get the team ID
    await page.getByRole('link', { name: new RegExp(teamName) }).click();
    await expect(page).toHaveURL(/\/teams\/[a-f0-9-]+/, { timeout: 5000 });
    const teamId = page.url().split('/teams/')[1];

    // Create sprint with multiple cards
    const sprintId = await createCompletedSprint(page, teamId, 'Sprint Detail', [
      'Great teamwork this sprint',
      'Documentation needs improvement',
      'CI pipeline is faster now',
      'More code reviews needed',
      'Good sprint planning session',
    ]);

    // Navigate to sprint detail view
    await page.goto(`/teams/${teamId}/analytics?sprint=${sprintId}`);
    await page.waitForTimeout(1000);

    // Verify Card Distribution chart is visible and has data
    await expect(page.getByText('Card Distribution')).toBeVisible();
    const cardDistChart = page.locator('div').filter({ hasText: 'Card Distribution' }).first();
    // Should show column names and card counts
    await expect(cardDistChart).toBeVisible();

    // Verify Top Voted Cards list is visible
    await expect(page.getByText('Top Voted Cards')).toBeVisible();

    // Verify Action Items Summary is visible
    await expect(page.getByText('Action Items Summary')).toBeVisible();
    // Should show total, completed, completion rate
    await expect(page.getByText(/total/i)).toBeVisible();

    // Verify Sentiment by Column chart is visible
    await expect(page.getByText('Sentiment by Column')).toBeVisible();
  });

  test('enhanced participation chart: scrollable member list', async ({ page }) => {
    const email = generateUniqueEmail();
    await registerUser(page, {
      email,
      password: 'SecurePass123!',
      displayName: 'Participation User',
    });

    const teamName = 'Participation Team';
    await page.getByRole('button', { name: 'Create Team' }).first().click();
    await page.getByLabel(/team name/i).fill(teamName);
    await page.getByRole('button', { name: 'Create Team' }).nth(1).click();
    await page.waitForTimeout(1000);

    // Navigate into the team to get the team ID
    await page.getByRole('link', { name: new RegExp(teamName) }).click();
    await expect(page).toHaveURL(/\/teams\/[a-f0-9-]+/, { timeout: 5000 });
    const teamId = page.url().split('/teams/')[1];

    // Create 3 sprints
    await createCompletedSprint(page, teamId, 'Sprint 1', ['Card A', 'Card B', 'Card C']);
    await createCompletedSprint(page, teamId, 'Sprint 2', ['Card D', 'Card E']);
    await createCompletedSprint(page, teamId, 'Sprint 3', ['Card F', 'Card G', 'Card H']);

    await page.goto(`/teams/${teamId}/analytics`);

    // Find participation chart
    const participationChart = page.locator('div').filter({ hasText: 'Participation' }).first();
    await expect(participationChart).toBeVisible();

    // Verify engagement score is shown (should see numbers or percentages)
    await expect(participationChart.getByText(/engagement/i)).toBeVisible();

    // Verify privacy notice is visible
    await expect(page.getByText(/privacy.*individual participation/i)).toBeVisible();
  });

  test('CSV export: verify download from team and sprint views', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for 3 sprints
    const email = generateUniqueEmail();
    await registerUser(page, {
      email,
      password: 'SecurePass123!',
      displayName: 'Export CSV User',
    });

    const teamName = 'CSV Export Team';
    await page.getByRole('button', { name: 'Create Team' }).first().click();
    await page.getByLabel(/team name/i).fill(teamName);
    await page.getByRole('button', { name: 'Create Team' }).nth(1).click();
    await page.waitForTimeout(1000);

    // Navigate into the team to get the team ID
    await page.getByRole('link', { name: new RegExp(teamName) }).click();
    await expect(page).toHaveURL(/\/teams\/[a-f0-9-]+/, { timeout: 5000 });
    const teamId = page.url().split('/teams/')[1];

    // Create sprints
    const sprintId = await createCompletedSprint(page, teamId, 'Export Sprint', [
      'Export test card 1',
      'Export test card 2',
    ]);

    // Navigate to team analytics
    await page.goto(`/teams/${teamId}/analytics`);

    // Setup download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export CSV button
    await page.getByRole('button', { name: /export csv/i }).click();

    // Wait for download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');

    // Navigate to sprint detail view
    await page.goto(`/teams/${teamId}/analytics?sprint=${sprintId}`);
    await page.waitForTimeout(500);

    // Export from sprint view
    const sprintDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export csv/i }).click();

    const sprintDownload = await sprintDownloadPromise;
    expect(sprintDownload.suggestedFilename()).toContain('.csv');
  });

  test('recurring themes: identify patterns across sprints', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for 3 sprints
    const email = generateUniqueEmail();
    await registerUser(page, {
      email,
      password: 'SecurePass123!',
      displayName: 'Themes User',
    });

    const teamName = 'Recurring Themes Team';
    await page.getByRole('button', { name: 'Create Team' }).first().click();
    await page.getByLabel(/team name/i).fill(teamName);
    await page.getByRole('button', { name: 'Create Team' }).nth(1).click();
    await page.waitForTimeout(1000);

    // Navigate into the team to get the team ID
    await page.getByRole('link', { name: new RegExp(teamName) }).click();
    await expect(page).toHaveURL(/\/teams\/[a-f0-9-]+/, { timeout: 5000 });
    const teamId = page.url().split('/teams/')[1];

    // Create 3 sprints with overlapping keywords to generate recurring themes
    await createCompletedSprint(page, teamId, 'Sprint A', [
      'Great collaboration this sprint',
      'Need better documentation',
      'Testing coverage improved',
    ]);

    await createCompletedSprint(page, teamId, 'Sprint B', [
      'Excellent collaboration across teams',
      'Documentation still needs work',
      'Testing automation is helpful',
    ]);

    await createCompletedSprint(page, teamId, 'Sprint C', [
      'Team collaboration continues to improve',
      'Documentation has gotten better',
      'More testing needed',
    ]);

    // Navigate to analytics page
    await page.goto(`/teams/${teamId}/analytics`);
    await page.waitForTimeout(1000);

    // Verify Recurring Themes section is visible
    await expect(page.getByText('Recurring Themes')).toBeVisible();

    // Verify recurring words from our cards appear in the themes list
    // Words like "collaboration", "documentation", "testing" should be recurring
    const themesSection = page.locator('div').filter({ hasText: 'Recurring Themes' }).first();
    await expect(themesSection).toBeVisible();

    // Should show themes in ranked order (#1, #2, #3...)
    await expect(themesSection.getByText(/#\d+/)).toBeVisible();

    // Should show recurrence level badges (Very Common, Common, or Emerging)
    await expect(
      themesSection.locator('span').filter({ hasText: /Very Common|Common|Emerging/ })
    ).toBeVisible();

    // Should show sentiment indicators (✅, ⚠️, or 💬)
    await expect(themesSection.locator('span').filter({ hasText: /✅|⚠️|💬/ })).toBeVisible();

    // Verify help text is present
    await expect(
      page.getByText(/topics that appear frequently across your retrospectives/i)
    ).toBeVisible();
  });

  test('recurring themes: empty state for limited data', async ({ page }) => {
    const email = generateUniqueEmail();
    await registerUser(page, {
      email,
      password: 'SecurePass123!',
      displayName: 'Empty Themes User',
    });

    // Create team with just 1 sprint (minimal data)
    const { teamName } = await createTeamAndBoard(page, { teamName: 'Empty Themes Team' });

    // Add one card
    await page.getByRole('button', { name: /add a card/i }).first().click();
    await page.getByPlaceholder(/what.*mind/i).fill('Single card');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Navigate to team page
    await page.goto('/dashboard');
    await page.getByText(teamName).click();
    await page.waitForURL(/\/teams\/[\w-]+$/);

    const teamId = page.url().split('/teams/')[1];

    // Navigate to analytics
    await page.goto(`/teams/${teamId}/analytics`);
    await page.waitForTimeout(1000);

    // With only 1 sprint and minimal cards, should see empty state
    const themesCard = page.locator('div').filter({ hasText: 'Recurring Themes' }).first();

    // Should either show "not enough data" message or empty state for recurring themes
    // (depending on whether we have 3+ sprints for analytics to show at all)
    const hasAnalytics = await page.getByText('Sprint Health Trend').isVisible();

    if (hasAnalytics) {
      // If analytics are showing, recurring themes should show empty state
      await expect(
        themesCard.getByText(/No recurring themes detected|Complete more retrospectives/i)
      ).toBeVisible();
    }
  });
});
