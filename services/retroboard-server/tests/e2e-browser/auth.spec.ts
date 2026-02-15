import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser, loginUser } from './helpers';

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
    await page.getByRole('button', { name: /logout|sign out/i }).click();

    // Try to register again with same email
    await page.goto('/register');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByPlaceholder('Display Name').fill('Another Name');
    await page.getByRole('button', { name: /register|sign up/i }).click();

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
    await page.getByRole('button', { name: /logout|sign out/i }).click();

    // Try to login with wrong password
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill('WrongPassword');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should show error
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible();
  });

  test('E2E-AUTH-4: Login with valid credentials succeeds', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Test User';

    // Register first
    await registerUser(page, { email, password, displayName });

    // Logout
    await page.getByRole('button', { name: /logout|sign out/i }).click();

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
    await page.getByRole('button', { name: /logout|sign out/i }).click();

    // Should be redirected to login
    await expect(page).toHaveURL('/login');
  });
});
