import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser, loginUser, logoutUser } from './helpers';

test.describe('Authentication', () => {
  test('E2E-AUTH-1: Register with valid credentials succeeds', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Test User';

    await registerUser(page, { email, password, displayName });

    // Should be on dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(displayName)).toBeVisible();
  });

  test('E2E-AUTH-2: Register with duplicate email shows error', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Test User';

    // First registration
    await registerUser(page, { email, password, displayName });

    // Logout
    await logoutUser(page);

    // Try to register again with same email
    await page.goto('/register');
    await page.getByLabel('Display Name').fill('Another Name');
    await page.getByLabel('Email').fill(email);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: /register|sign up|create account/i }).click();

    // Should show error
    await expect(page.getByText(/already exists|already registered/i)).toBeVisible();
  });

  test('E2E-AUTH-3: Login with wrong password shows error', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Test User';

    // Register first
    await registerUser(page, { email, password, displayName });

    // Logout
    await logoutUser(page);

    // Try to login with wrong password (don't use loginUser — it expects dashboard redirect)
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill('WrongPassword123!');
    await page.getByRole('button', { name: /log\s?in|sign in/i }).click();

    // Should show error (we stay on login page)
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({ timeout: 5000 });
  });

  test('E2E-AUTH-4: Login with valid credentials succeeds', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Test User';

    // Register first
    await registerUser(page, { email, password, displayName });

    // Logout
    await logoutUser(page);

    // Login
    await loginUser(page, { email, password });

    // Should be on dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(displayName)).toBeVisible();
  });

  test('E2E-AUTH-5: Logout redirects to login', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Test User';

    // Register and login
    await registerUser(page, { email, password, displayName });

    // Logout
    await logoutUser(page);

    // Should be redirected to login
    await expect(page).toHaveURL('/login');
  });
});
