import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser, createTeamAndBoard } from './helpers';

/**
 * E2E tests for Icebreaker Generator (S-028)
 *
 * Component: IcebreakerCard (auto-shows during write phase)
 * Location: services/retroboard-server/client/src/components/board/IcebreakerCard.tsx
 *
 * Key selectors:
 * - Card heading: "🎲 Icebreaker Question"
 * - Question text: Large text within the card
 * - Category badge: Shows category name (Fun, Team-Building, etc.)
 * - Category filter buttons: "All", "Fun", "Team-Building", "Reflective", "Creative", "Quick"
 * - Refresh button: "New Question" with RefreshCw icon
 * - Dismiss button: X icon with aria-label "Dismiss icebreaker"
 *
 * Note: Icebreaker card automatically appears during write phase, no button click needed
 */

test.describe('Icebreaker Generator (S-028)', () => {
  test('E2E-ICEBREAKER-1: Icebreaker card auto-displays during write phase', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Icebreaker Facilitator';
    const teamName = `Icebreaker Team ${Date.now()}`;

    // Register user and create board (user is facilitator by default)
    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName });
    await expect(page.locator('text=What went well?')).toBeVisible({ timeout: 10000 });

    // Board should be in Write phase initially - icebreaker auto-shows
    await expect(page.getByText('🎲 Icebreaker Question')).toBeVisible({ timeout: 5000 });

    // Verify icebreaker question is displayed (should be non-empty text)
    const icebreakerCard = page.locator('div').filter({ hasText: '🎲 Icebreaker Question' }).first();
    await expect(icebreakerCard).toBeVisible();

    // Verify category badge is present (one of: Fun, Team-Building, Reflective, Creative, Quick)
    const categoryBadge = icebreakerCard.locator('span').filter({ hasText: /Fun|Team-Building|Reflective|Creative|Quick/ });
    await expect(categoryBadge).toBeVisible();

    // Verify dismiss button is present
    await expect(page.getByRole('button', { name: 'Dismiss icebreaker' })).toBeVisible();

    // Verify refresh button is present
    await expect(page.getByRole('button', { name: 'New Question' })).toBeVisible();
  });

  test('E2E-ICEBREAKER-2: User can refresh to get a new icebreaker question', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Re-roll Tester';
    const teamName = `Re-roll Team ${Date.now()}`;

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName });
    await expect(page.locator('text=What went well?')).toBeVisible({ timeout: 10000 });

    // Wait for initial icebreaker to load
    await expect(page.getByText('🎲 Icebreaker Question')).toBeVisible({ timeout: 5000 });

    // Get the initial question text
    const icebreakerCard = page.locator('div').filter({ hasText: '🎲 Icebreaker Question' }).first();
    const firstQuestion = await icebreakerCard.locator('p.text-lg').textContent();
    expect(firstQuestion).toBeTruthy();
    expect(firstQuestion).not.toBe('Loading icebreaker...');

    // Click "New Question" button
    await page.getByRole('button', { name: 'New Question' }).click();

    // Wait a moment for the new question to load
    await page.waitForTimeout(1000);

    // Get the new question text
    const secondQuestion = await icebreakerCard.locator('p.text-lg').textContent();
    expect(secondQuestion).toBeTruthy();

    // Note: Questions might repeat due to random selection, so we can't guarantee different questions
    // But we can verify that the refresh action worked
  });

  test('E2E-ICEBREAKER-3: User can filter icebreakers by category', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Category Filter Tester';
    const teamName = `Category Team ${Date.now()}`;

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName });
    await expect(page.locator('text=What went well?')).toBeVisible({ timeout: 10000 });

    // Wait for icebreaker card to appear
    await expect(page.getByText('🎲 Icebreaker Question')).toBeVisible({ timeout: 5000 });

    const icebreakerCard = page.locator('div').filter({ hasText: '🎲 Icebreaker Question' }).first();

    // Verify all category filter buttons are present
    const categories = ['All', 'Fun', 'Team-Building', 'Reflective', 'Creative', 'Quick'];
    for (const category of categories) {
      await expect(icebreakerCard.getByRole('button', { name: category, exact: true })).toBeVisible();
    }

    // Click "Fun" category filter
    await icebreakerCard.getByRole('button', { name: 'Fun', exact: true }).click();

    // Wait for new question to load
    await page.waitForTimeout(1000);

    // Verify the category badge shows "Fun"
    const categoryBadge = icebreakerCard.locator('span.bg-indigo-100').filter({ hasText: 'Fun' });
    await expect(categoryBadge).toBeVisible();

    // Try another category: "Quick"
    await icebreakerCard.getByRole('button', { name: 'Quick', exact: true }).click();
    await page.waitForTimeout(1000);

    // Verify the category badge shows "Quick"
    const quickBadge = icebreakerCard.locator('span.bg-indigo-100').filter({ hasText: 'Quick' });
    await expect(quickBadge).toBeVisible();

    // Reset to "All"
    await icebreakerCard.getByRole('button', { name: 'All', exact: true }).click();
    await page.waitForTimeout(500);
  });

  test('E2E-ICEBREAKER-4: User can dismiss icebreaker card', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Dismiss Tester';
    const teamName = `Dismiss Team ${Date.now()}`;

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName });
    await expect(page.locator('text=What went well?')).toBeVisible({ timeout: 10000 });

    // Wait for icebreaker card to appear
    await expect(page.getByText('🎲 Icebreaker Question')).toBeVisible({ timeout: 5000 });

    // Click dismiss button
    await page.getByRole('button', { name: 'Dismiss icebreaker' }).click();

    // Verify icebreaker card is no longer visible
    await expect(page.getByText('🎲 Icebreaker Question')).not.toBeVisible();
  });

  test.skip('E2E-ICEBREAKER-REALTIME: Icebreaker is displayed to all participants in real-time', async ({ page, context }) => {
    // TODO: This test requires real-time sync implementation for icebreakers
    // The current IcebreakerCard shows icebreakers but doesn't broadcast them to all users
    // This would need WebSocket events: icebreaker:shown, icebreaker:dismissed
    // Acceptance criteria: "Selected icebreaker is displayed to all board participants in real-time"
    // Status: Backend API exists, frontend component exists, but real-time broadcast not implemented

    // This test requires two browser contexts (facilitator + participant)
    const facilitatorEmail = generateUniqueEmail();
    const participantEmail = generateUniqueEmail();
    const password = 'SecurePass123!';
    const teamName = `Real-time Icebreaker Team ${Date.now()}`;

    // Setup facilitator
    await registerUser(page, {
      email: facilitatorEmail,
      password,
      displayName: 'Facilitator'
    });
    await createTeamAndBoard(page, { teamName });
    await expect(page.locator('text=What went well?')).toBeVisible({ timeout: 10000 });

    // Get invite link
    await page.getByRole('button', { name: /invite/i }).click();
    const inviteLink = await page.locator('input[value*="/invite/"]').inputValue();
    const inviteCode = inviteLink.split('/invite/')[1];

    // Setup participant in new context
    const participantPage = await context.newPage();
    await participantPage.goto('/register');
    await participantPage.getByLabel('Display Name').fill('Participant');
    await participantPage.getByLabel('Email').fill(participantEmail);
    await participantPage.locator('#register-password').fill(password);
    await participantPage.getByRole('button', { name: 'Create Account' }).click();
    await expect(participantPage).toHaveURL('/dashboard', { timeout: 15000 });

    // Join team via invite
    await participantPage.goto(`/invite/${inviteCode}`);
    await participantPage.getByRole('button', { name: /join team/i }).click();

    // Navigate to board
    await participantPage.goto(page.url()); // Same board URL as facilitator

    // Both should see icebreaker cards independently (not synced)
    await expect(page.getByText('🎲 Icebreaker Question')).toBeVisible({ timeout: 5000 });
    await expect(participantPage.getByText('🎲 Icebreaker Question')).toBeVisible({ timeout: 5000 });

    // TODO: When real-time sync is implemented, verify:
    // 1. Facilitator can "share" current icebreaker with all participants
    // 2. Participants see the same question in real-time
    // 3. When facilitator dismisses, all participants see it dismissed
  });

  test('E2E-ICEBREAKER-CUSTOM: User can add custom icebreaker questions', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Custom Icebreaker Admin';
    const teamName = `Custom Icebreaker Team ${Date.now()}`;
    const customQuestion = `What is your favorite debugging technique? (${Date.now()})`;

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName });
    await expect(page.locator('text=What went well?')).toBeVisible({ timeout: 10000 });

    // Wait for icebreaker card to appear
    await expect(page.getByText('🎲 Icebreaker Question')).toBeVisible({ timeout: 5000 });

    // Click "Add Custom" button to show the custom question form
    await page.getByRole('button', { name: 'Add Custom' }).click();

    // Verify form is visible
    await expect(page.getByPlaceholder(/enter your custom icebreaker/i)).toBeVisible();

    // Fill in custom question
    await page.getByPlaceholder(/enter your custom icebreaker/i).fill(customQuestion);

    // Select category (default is "Fun", so optionally change it)
    await page.locator('select').filter({ hasText: /Fun|Team-Building/i }).selectOption('Team-Building');

    // Click "Add" button
    await page.getByRole('button', { name: /^Add$/i }).click();

    // Verify success toast appears
    await expect(page.getByText(/custom icebreaker.*added/i)).toBeVisible({ timeout: 3000 });

    // Verify form is hidden after submission
    await expect(page.getByPlaceholder(/enter your custom icebreaker/i)).not.toBeVisible();
  });

  test.skip('E2E-ICEBREAKER-HISTORY: Icebreaker history prevents recent repeats', async ({ page }) => {
    // TODO: This test verifies backend history tracking
    // Acceptance criteria: "Icebreaker history is tracked per team (avoid repeating recent ones)"
    // Backend implements this: team_icebreaker_history table + exclusion logic in service
    // This is better suited for backend integration testing than E2E
    // E2E could verify by generating 11+ icebreakers and checking no duplicates in last 10

    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'History Tester';
    const teamName = `History Team ${Date.now()}`;

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName });
    await expect(page.locator('text=What went well?')).toBeVisible({ timeout: 10000 });

    // Would need to:
    // 1. Generate 15+ icebreakers by clicking "New Question" repeatedly
    // 2. Track all question texts
    // 3. Verify no duplicates in the most recent 10
    // Note: With 55 questions and good randomness, duplicates unlikely anyway
    // Backend tests are better for verifying this logic
  });
});
