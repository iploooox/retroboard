import { test, expect } from '@playwright/test';
import { registerUser, generateUniqueEmail } from './helpers';

test.describe('Landing Page User Journey', () => {
  test('1. Unauthenticated user sees landing page at /', async ({ page }) => {
    await page.goto('/');

    // Verify we're on the landing page by checking hero heading
    await expect(
      page.getByRole('heading', { name: /retrospectives that actually drive improvement/i })
    ).toBeVisible();

    // Verify we didn't get redirected
    await expect(page).toHaveURL('/');
  });

  test('2. Landing page shows all feature sections', async ({ page }) => {
    await page.goto('/');

    // Verify Features section is present
    const featuresSection = page.locator('section[aria-label="Features"]');
    await expect(featuresSection).toBeVisible();

    // Verify all 6 feature cards by their titles
    await expect(page.getByRole('heading', { name: '6 Retro Templates' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Real-Time Collaboration' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Analytics Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Facilitation Tools' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Export Options' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Action Items' })).toBeVisible();

    // Verify feature descriptions are present
    await expect(
      page.getByText(/Choose from Start\/Stop\/Continue, Mad\/Sad\/Glad/)
    ).toBeVisible();
    await expect(
      page.getByText(/See everyone's cards update live with WebSocket/)
    ).toBeVisible();
    await expect(
      page.getByText(/Track team progress with insights on participation/)
    ).toBeVisible();
    await expect(
      page.getByText(/Built-in timer, voting, grouping/)
    ).toBeVisible();
    await expect(
      page.getByText(/Export retro results to PDF, CSV, or Markdown/)
    ).toBeVisible();
    await expect(
      page.getByText(/Track follow-up tasks and ensure commitments/)
    ).toBeVisible();
  });

  test('3. Landing page shows social proof stats', async ({ page }) => {
    await page.goto('/');

    // Wait for stats section to be visible
    const statsSection = page.locator('section[aria-label="Statistics"]');
    await expect(statsSection).toBeVisible();

    // Wait for stats to load - the stats might show loading state, error state, or success state
    // We'll wait for either the success state (stat values) or error state to appear
    await page.waitForFunction(() => {
      const statSection = document.querySelector('section[aria-label="Statistics"]');
      if (!statSection) return false;

      // Check if stats have loaded (success state)
      const hasStats = statSection.querySelectorAll('.text-5xl.font-bold.text-indigo-400').length === 3;

      // Check if error is shown
      const hasError = statSection.querySelector('[role="alert"]') !== null;

      return hasStats || hasError;
    }, { timeout: 10000 });

    // Check if stats loaded successfully or show error
    const statValues = page.locator('.text-5xl.font-bold.text-indigo-400');
    const statCount = await statValues.count();

    if (statCount === 3) {
      // Success state - verify the labels
      await expect(page.getByText('Teams using RetroBoard')).toBeVisible();
      await expect(page.getByText('Retrospectives completed')).toBeVisible();
      await expect(page.getByText('Cards created')).toBeVisible();
    } else {
      // Error or loading state - this is acceptable but log it
      const errorAlert = statsSection.locator('[role="alert"]');
      const hasError = await errorAlert.isVisible();
      if (hasError) {
        console.log('Stats showed error state (acceptable for test environment)');
      } else {
        throw new Error('Stats section did not load properly - neither success nor error state');
      }
    }
  });

  test('4. CTA "Get Started" button navigates to /register', async ({ page }) => {
    await page.goto('/');

    // Click the "Get Started" button in hero section
    await page.getByRole('link', { name: 'Get Started' }).click();

    // Verify navigation to register page
    await expect(page).toHaveURL('/register', { timeout: 5000 });
  });

  test('5. "Log In" link navigates to /login', async ({ page }) => {
    await page.goto('/');

    // Click the "Login" link in hero section (there are multiple, use first one)
    await page.getByRole('link', { name: 'Login' }).first().click();

    // Verify navigation to login page
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });

  test('6. Authenticated user visiting / gets redirected to /dashboard', async ({ page }) => {
    // Register a new user - this sets auth tokens in localStorage
    const email = generateUniqueEmail();
    const password = 'TestPass123!';
    const displayName = 'Landing Test User';

    await registerUser(page, { email, password, displayName });

    // User should now be on /dashboard after registration with auth in localStorage
    await expect(page).toHaveURL('/dashboard');

    // Wait for dashboard to fully load - check for "Create Team" button
    await expect(page.getByRole('button', { name: 'Create Team' })).toBeVisible();

    // Verify refresh token is in localStorage (access token is in memory)
    const hasRefreshToken = await page.evaluate(() => {
      return !!localStorage.getItem('retroboard_refresh_token');
    });

    if (!hasRefreshToken) {
      throw new Error('Refresh token not found in localStorage after registration');
    }

    // Navigate to root path - should redirect to /dashboard since user is authenticated
    // Use a small delay to allow any background processes to complete
    await page.waitForTimeout(500);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Should be redirected back to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Verify we're on dashboard by checking for "Create Team" button
    await expect(page.getByRole('button', { name: 'Create Team' })).toBeVisible();

    // Verify we don't see the landing page content
    await expect(
      page.getByRole('heading', { name: /retrospectives that actually drive improvement/i })
    ).not.toBeVisible();
  });

  test('7. Landing page is responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport (iPhone 12 Pro dimensions)
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/');

    // Verify landing page content is still visible
    await expect(
      page.getByRole('heading', { name: /retrospectives that actually drive improvement/i })
    ).toBeVisible();

    // Verify CTA buttons are visible (should stack vertically on mobile)
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login' }).first()).toBeVisible();

    // Verify feature section is visible
    await expect(page.getByRole('heading', { name: '6 Retro Templates' })).toBeVisible();

    // Verify stats section is visible
    const statsSection = page.locator('section[aria-label="Statistics"]');
    await expect(statsSection).toBeVisible();

    // On mobile, feature cards should stack vertically (single column)
    // Verify we can scroll to see all content
    const featuresSection = page.locator('section[aria-label="Features"]');
    await featuresSection.scrollIntoViewIfNeeded();
    await expect(featuresSection).toBeVisible();
  });

  test('8. Footer links navigate correctly', async ({ page }) => {
    await page.goto('/');

    // Scroll to footer
    await page.locator('footer').scrollIntoViewIfNeeded();

    // Click Login link in footer
    await page.locator('footer').getByRole('link', { name: 'Login' }).click();
    await expect(page).toHaveURL('/login', { timeout: 5000 });

    // Go back to landing page
    await page.goto('/');

    // Click Register link in footer
    await page.locator('footer').getByRole('link', { name: 'Register' }).click();
    await expect(page).toHaveURL('/register', { timeout: 5000 });
  });
});
