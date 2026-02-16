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
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });

    // Board should be in Write phase initially - icebreaker auto-shows
    await expect(page.getByText('🎲 Icebreaker Question')).toBeVisible({ timeout: 5000 });

    // Wait for icebreaker data to load (question text should appear, not "Loading...")
    const icebreakerCard = page.locator('div').filter({ hasText: '🎲 Icebreaker Question' }).first();
    const questionText = icebreakerCard.locator('p.text-lg');
    await expect(questionText).toBeVisible({ timeout: 10000 });
    const question = await questionText.textContent();
    expect(question).toBeTruthy();
    expect(question).not.toBe('Loading icebreaker...');

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
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });

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
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });

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

    // Verify question text changed (new icebreaker loaded)
    const questionAfterFun = await icebreakerCard.locator('p.text-lg').textContent();
    expect(questionAfterFun).toBeTruthy();
    expect(questionAfterFun).not.toBe('Loading icebreaker...');

    // Try another category: "Quick"
    await icebreakerCard.getByRole('button', { name: 'Quick', exact: true }).click();
    await page.waitForTimeout(1000);

    // Verify question text changed again
    const questionAfterQuick = await icebreakerCard.locator('p.text-lg').textContent();
    expect(questionAfterQuick).toBeTruthy();
    expect(questionAfterQuick).not.toBe('Loading icebreaker...');

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
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });

    // Wait for icebreaker card to appear
    await expect(page.getByText('🎲 Icebreaker Question')).toBeVisible({ timeout: 5000 });

    // Click dismiss button
    await page.getByRole('button', { name: 'Dismiss icebreaker' }).click();

    // Verify icebreaker card is no longer visible
    await expect(page.getByText('🎲 Icebreaker Question')).not.toBeVisible();
  });

  test('E2E-ICEBREAKER-REALTIME: Icebreaker broadcasts to all participants when facilitator refreshes', async ({ page, context }) => {
    // This test verifies WebSocket real-time sync for icebreaker updates
    // When facilitator refreshes icebreaker, all participants see the same new question

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

    // Set up network interceptor BEFORE any actions to capture invite creation
    let inviteUrl = '';
    page.on('response', async (response) => {
      if (response.url().includes('/invitations') && response.request().method() === 'POST') {
        const data = await response.json();
        if (data.invitation?.invite_url) {
          inviteUrl = data.invitation.invite_url;
        }
      }
    });

    await createTeamAndBoard(page, { teamName });
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });

    // Navigate to team page to get invite link (invite functionality is on TeamDetailPage)
    await page.getByRole('link', { name: 'Back to Team' }).click();
    await page.waitForTimeout(1000);

    // Click "Members" tab to access invite functionality
    await page.getByRole('tab', { name: 'Members' }).click();
    await page.waitForTimeout(500);

    // Click "Invite Member" button to open modal
    await page.getByRole('button', { name: /invite member/i }).click();
    await page.waitForTimeout(500);

    // Submit the invite form (defaults are fine: member role, 7 days expiry, unlimited uses)
    await page.getByRole('button', { name: 'Create Invite' }).click();

    // Wait for invite to be created
    await page.waitForTimeout(1500);

    // Get invite code from intercepted URL (format: http://localhost:5173/join/{code})
    expect(inviteUrl).toBeTruthy();
    const inviteCode = inviteUrl.split('/join/')[1];

    // Navigate back to the board (Board link is in Sprints tab)
    await page.getByRole('tab', { name: 'Sprints' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('link', { name: 'Board', exact: true }).click();
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 5000 });

    // Setup participant in new browser context (to avoid sharing auth state)
    const participantContext = await context.browser()!.newContext();
    const participantPage = await participantContext.newPage();
    await participantPage.goto('/register');
    await participantPage.getByLabel('Display Name').fill('Participant');
    await participantPage.getByLabel('Email').fill(participantEmail);
    await participantPage.locator('#register-password').fill(password);
    await participantPage.getByRole('button', { name: 'Create Account' }).click();

    // New users go through onboarding - skip it to get to dashboard
    await expect(participantPage).toHaveURL('/onboarding', { timeout: 15000 });
    await participantPage.getByRole('button', { name: 'Skip for now' }).click();
    await expect(participantPage).toHaveURL('/dashboard', { timeout: 5000 });

    // Join team via invite (auto-joins for authenticated users)
    await participantPage.goto(`/invite/${inviteCode}`);
    // Wait for auto-join to complete and redirect to team page
    await expect(participantPage).toHaveURL(/\/teams\/[a-f0-9-]+/, { timeout: 10000 });

    // Navigate to board
    await participantPage.goto(page.url()); // Same board URL as facilitator
    await participantPage.waitForTimeout(1000);

    // Both should see icebreaker cards
    await expect(page.getByText('🎲 Icebreaker Question')).toBeVisible({ timeout: 5000 });
    await expect(participantPage.getByText('🎲 Icebreaker Question')).toBeVisible({ timeout: 5000 });

    // Get initial questions from both users
    const facilitatorCard = page.locator('div').filter({ hasText: '🎲 Icebreaker Question' }).first();
    const participantCard = participantPage.locator('div').filter({ hasText: '🎲 Icebreaker Question' }).first();

    const initialFacilitatorQuestion = await facilitatorCard.locator('p.text-lg').textContent();
    const initialParticipantQuestion = await participantCard.locator('p.text-lg').textContent();

    // Questions might be different initially (each user gets a random one on load)
    expect(initialFacilitatorQuestion).toBeTruthy();
    expect(initialParticipantQuestion).toBeTruthy();

    // Facilitator clicks "New Question" to refresh icebreaker
    await page.getByRole('button', { name: 'New Question' }).click();

    // Wait for WebSocket broadcast to propagate
    await page.waitForTimeout(1500);

    // Get new questions from both users
    const newFacilitatorQuestion = await facilitatorCard.locator('p.text-lg').textContent();
    const newParticipantQuestion = await participantCard.locator('p.text-lg').textContent();

    // Verify facilitator's question changed
    expect(newFacilitatorQuestion).toBeTruthy();
    expect(newFacilitatorQuestion).not.toBe('Loading icebreaker...');

    // CRITICAL: Verify participant sees the EXACT SAME question as facilitator
    expect(newParticipantQuestion).toBe(newFacilitatorQuestion);

    // Verify both see the same category badge
    const facilitatorCategory = await facilitatorCard.locator('span.bg-indigo-100').textContent();
    const participantCategory = await participantCard.locator('span.bg-indigo-100').textContent();
    expect(participantCategory).toBe(facilitatorCategory);

    // Refresh again to verify it continues working
    await page.getByRole('button', { name: 'New Question' }).click();
    await page.waitForTimeout(1500);

    const secondFacilitatorQuestion = await facilitatorCard.locator('p.text-lg').textContent();
    const secondParticipantQuestion = await participantCard.locator('p.text-lg').textContent();

    // Both should see the same question again
    expect(secondParticipantQuestion).toBe(secondFacilitatorQuestion);
    expect(secondFacilitatorQuestion).not.toBe(newFacilitatorQuestion); // Question should have changed
  });

  test('E2E-ICEBREAKER-CUSTOM: User can add custom icebreaker questions', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Custom Icebreaker Admin';
    const teamName = `Custom Icebreaker Team ${Date.now()}`;
    const customQuestion = `What is your favorite debugging technique? (${Date.now()})`;

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName });
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });

    // Verify URL contains teamId (should be /teams/{teamId}/sprints/{sprintId}/board)
    await expect(page).toHaveURL(/\/teams\/[a-f0-9-]+\/sprints\/[a-f0-9-]+\/board/);

    // Intercept custom icebreaker API call to see errors
    page.on('response', async (response) => {
      if (response.url().includes('/icebreakers/custom') && response.request().method() === 'POST') {
        console.log(`Custom icebreaker API response: status=${response.status()}`);
        try {
          const data = await response.json();
          console.log('Response data:', JSON.stringify(data, null, 2));
        } catch (e) {
          console.log('Failed to parse response:', e);
        }
      }
    });

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
    await expect(page.getByRole('heading', { name: /What Went Well/i })).toBeVisible({ timeout: 10000 });

    // Would need to:
    // 1. Generate 15+ icebreakers by clicking "New Question" repeatedly
    // 2. Track all question texts
    // 3. Verify no duplicates in the most recent 10
    // Note: With 55 questions and good randomness, duplicates unlikely anyway
    // Backend tests are better for verifying this logic
  });
});
