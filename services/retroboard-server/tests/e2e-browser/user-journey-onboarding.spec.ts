import { test, expect } from '@playwright/test';
import { generateUniqueEmail } from './helpers';

/**
 * E2E tests for Onboarding Flow (S-029)
 *
 * Component: OnboardingPage
 * Location: services/retroboard-server/client/src/pages/OnboardingPage.tsx
 * Route: /onboarding (auto-redirects after registration if not completed)
 *
 * Onboarding steps:
 * 1. welcome - "Welcome to RetroBoard Pro!" heading
 * 2. create-team - Team name input (#team-name)
 * 3. invite-members - (Shown in progress but combined with create-sprint)
 * 4. create-sprint - Sprint name input (#sprint-name)
 * 5. start-retro - "You're All Set! 🎉" heading
 *
 * Key selectors:
 * - Progress icons: Sparkles, Users, UserPlus, Calendar, Rocket
 * - Team name input: #team-name
 * - Sprint name input: #sprint-name
 * - Buttons: "Get Started", "Create Team", "Create Sprint", "Start First Retro", "Skip for now", "Back"
 * - Step indicators: Icons change color based on completion (green = done, indigo = current, gray = pending)
 */

test.describe('Onboarding Flow (S-029)', () => {
  test('E2E-ONBOARDING-1: First-time user is redirected to onboarding after registration', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'New User';

    // Register new user
    await page.goto('/register');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should be redirected to onboarding (not dashboard)
    await expect(page).toHaveURL('/onboarding', { timeout: 15000 });

    // Verify welcome step is shown
    await expect(page.getByRole('heading', { name: /welcome to retroboard pro/i })).toBeVisible();
    await expect(page.getByText(/let's get you set up/i)).toBeVisible();

    // Verify "Get Started" button is present
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();

    // Verify "Skip for now" button is present
    await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();
  });

  test('E2E-ONBOARDING-2: User can complete full onboarding flow', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Onboarding Completer';
    const teamName = `Onboarding Team ${Date.now()}`;
    const sprintName = `Sprint ${Date.now()}`;

    // Register
    await page.goto('/register');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15000 });

    // Step 1 - Welcome
    await expect(page.getByRole('heading', { name: /welcome to retroboard pro/i })).toBeVisible();
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Step 2 - Create Team
    await expect(page.getByRole('heading', { name: /create your team/i })).toBeVisible();
    await page.locator('#team-name').fill(teamName);
    await page.getByRole('button', { name: 'Create Team' }).click();

    // Wait for team creation
    await page.waitForTimeout(1000);

    // Step 3 - Create Sprint (invite-members step is skipped in implementation)
    await expect(page.getByRole('heading', { name: /create your sprint/i })).toBeVisible();
    await page.locator('#sprint-name').fill(sprintName);
    await page.getByRole('button', { name: 'Create Sprint' }).click();

    // Wait for sprint creation
    await page.waitForTimeout(1000);

    // Step 4 - Start Retro (completion step)
    await expect(page.getByRole('heading', { name: /you're all set/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start First Retro' })).toBeVisible();

    // Start retro and verify redirect to board
    await page.getByRole('button', { name: 'Start First Retro' }).click();

    // Should be redirected to the board page
    await expect(page).toHaveURL(/\/teams\/.*\/sprints\/.*\/board/, { timeout: 10000 });
  });

  test('E2E-ONBOARDING-3: User can skip onboarding', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Skip Tester';

    await page.goto('/register');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15000 });

    // Verify welcome step is shown
    await expect(page.getByRole('heading', { name: /welcome to retroboard pro/i })).toBeVisible();

    // Click "Skip for now"
    await page.getByRole('button', { name: 'Skip for now' }).click();

    // Should be redirected to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
  });

  test('E2E-ONBOARDING-4: User can navigate back through onboarding steps', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Back Button Tester';
    const teamName = `Back Team ${Date.now()}`;

    await page.goto('/register');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15000 });

    // Start onboarding
    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page.getByRole('heading', { name: /create your team/i })).toBeVisible();

    // Create team
    await page.locator('#team-name').fill(teamName);
    await page.getByRole('button', { name: 'Create Team' }).click();
    await page.waitForTimeout(1000);

    // Now on create sprint step
    await expect(page.getByRole('heading', { name: /create your sprint/i })).toBeVisible();

    // Click "Back" button
    await page.getByRole('button', { name: 'Back' }).click();

    // Should be back on create team step
    await expect(page.getByRole('heading', { name: /create your team/i })).toBeVisible();

    // Verify team name is still filled (state preserved)
    await expect(page.locator('#team-name')).toHaveValue(teamName);
  });

  test('E2E-ONBOARDING-5: Progress bar updates as user completes steps', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Progress Tester';
    const teamName = `Progress Team ${Date.now()}`;

    await page.goto('/register');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15000 });

    // Initial state: welcome step active (indigo), others pending (gray)
    // Note: Step indicators use bg-indigo-600 for current, bg-green-500 for completed, bg-slate-200 for pending

    // Complete welcome step
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Now on create team step
    await page.locator('#team-name').fill(teamName);
    await page.getByRole('button', { name: 'Create Team' }).click();
    await page.waitForTimeout(1000);

    // Now on create sprint step - verify progress bar shows team step as completed
    // The first icon should now be green (Check icon)
    const completedSteps = page.locator('div.bg-green-500');
    await expect(completedSteps).toHaveCount({ min: 1 });
  });

  test('E2E-ONBOARDING-6: Onboarding is only shown once per user', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'One-time Tester';
    const teamName = `One-time Team ${Date.now()}`;
    const sprintName = `One-time Sprint ${Date.now()}`;

    // Complete onboarding
    await page.goto('/register');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15000 });

    // Go through all steps
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.locator('#team-name').fill(teamName);
    await page.getByRole('button', { name: 'Create Team' }).click();
    await page.waitForTimeout(1000);

    await page.locator('#sprint-name').fill(sprintName);
    await page.getByRole('button', { name: 'Create Sprint' }).click();
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'Start First Retro' }).click();
    await expect(page).toHaveURL(/\/teams\/.*\/sprints\/.*\/board/, { timeout: 10000 });

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

    // Should go to dashboard, NOT onboarding
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Verify onboarding is not shown
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL('/onboarding');
  });

  test.skip('E2E-ONBOARDING-RESTART: User can restart onboarding from settings', async ({ page }) => {
    // TODO: Requires "Restart Onboarding" feature in user settings
    // Acceptance criteria: "Onboarding is only shown once per user (can be re-triggered from settings)"
    // Backend endpoint exists: Can reset onboarding_completed_at
    // Frontend UI not found: need user settings page with "Restart Onboarding" button

    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Restart Tester';

    // Complete onboarding first
    await page.goto('/register');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15000 });

    // Skip onboarding
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });

    // TODO: Navigate to user settings and click "Restart Onboarding"
    // await page.locator('header button').filter({ has: page.locator('.rounded-full') }).click();
    // await page.getByRole('button', { name: /settings/i }).click();
    // await page.getByRole('button', { name: /restart onboarding/i }).click();

    // TODO: Verify onboarding wizard appears again
    // await expect(page).toHaveURL('/onboarding');
    // await expect(page.getByRole('heading', { name: /welcome to retroboard pro/i })).toBeVisible();
  });

  test.skip('E2E-ONBOARDING-DEMO: Demo board is available for exploration', async ({ page }) => {
    // TODO: Demo board feature not implemented
    // Acceptance criteria: "Interactive demo board option: pre-populated board to explore features"
    // This is an optional feature that may not be implemented yet

    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Demo Tester';

    await page.goto('/register');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15000 });

    // TODO: Look for "Try Demo Board" or similar button
    // TODO: Verify demo board has pre-populated sample data
    // TODO: Verify demo board is read-only or clearly marked as demo
  });
});
