import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser } from './helpers';

test.describe('User Journey: Signup → Create Team → Invite → Join', () => {
  test('E2E-JOURNEY-1: Full new user flow with team invite', async ({ browser }) => {
    // ============================================================
    // USER 1: Register and create team
    // ============================================================

    const user1Email = generateUniqueEmail();
    const user1Password = 'SecurePass123!';
    const user1Name = 'Team Owner';
    const teamName = `Test Team ${Date.now()}`;

    const context1 = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const page1 = await context1.newPage();

    // Step 1 & 2: Register new user → create account
    await registerUser(page1, {
      email: user1Email,
      password: user1Password,
      displayName: user1Name,
    });

    // Step 3: On dashboard → see empty state or team creation option
    await expect(page1).toHaveURL('/dashboard');
    await expect(page1.getByText(user1Name)).toBeVisible();

    // Step 4: Create a new team
    await page1.getByRole('button', { name: /create team|new team/i }).click();
    await page1.getByLabel('Team Name').fill(teamName);
    // Use .nth(1) to select the submit button inside the modal (second "Create Team" button)
    await page1.getByRole('button', { name: /create team/i }).nth(1).click();

    // Wait for team creation
    await page1.waitForTimeout(500);
    await expect(page1.getByText(teamName)).toBeVisible();

    // Navigate to team detail page (click on team name or navigate)
    await page1.getByText(teamName).click();
    await page1.waitForTimeout(500);

    // Should be on team detail page
    await expect(page1.url()).toContain('/teams/');

    // Navigate to Members tab
    await page1.getByRole('tab', { name: /members/i }).click();
    await page1.waitForTimeout(300);

    // Step 5: Get invite link
    // Click "Invite Member" button
    await page1.getByRole('button', { name: /invite member/i }).click();

    // Fill invite form
    await page1.locator('select#invite-role').selectOption('member');
    await page1.locator('select#invite-expires').selectOption('168'); // 7 days

    // Intercept the invite creation response to get the URL
    const inviteResponsePromise = page1.waitForResponse(
      (response) => response.url().includes('/invitations') && response.status() === 201
    );

    // Submit invite creation
    await page1.getByRole('button', { name: /create invite/i }).click();

    // Wait for API response
    const inviteResponse = await inviteResponsePromise;
    const inviteData = await inviteResponse.json();
    const inviteUrl = inviteData.invitation.invite_url;

    // Wait for the copy button to appear (confirms invite was created)
    await page1.waitForTimeout(500);
    const copyButton = page1.getByRole('button', { name: /copy invite link/i }).first();
    await expect(copyButton).toBeVisible();

    // Verify URL is valid (not example.com) - this tests the bug fix
    expect(inviteUrl).toContain('localhost');
    expect(inviteUrl).toContain('/join/');
    expect(inviteUrl).not.toContain('example.com');

    // Close the modal
    await page1.keyboard.press('Escape');
    await page1.waitForTimeout(300);

    // ============================================================
    // USER 2: Open invite link and join team
    // ============================================================

    const user2Email = generateUniqueEmail();
    const user2Password = 'SecurePass456!';
    const user2Name = 'New Team Member';

    // Step 7: Open invite link in new browser context (second user)
    const context2 = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const page2 = await context2.newPage();

    // Navigate to invite URL
    await page2.goto(inviteUrl);

    // Step 8: Verify page loads and shows invite message
    await expect(page2.getByText(/you've been invited to a team/i)).toBeVisible();
    await expect(page2.getByRole('link', { name: /create account/i })).toBeVisible();

    // Step 9: Second user registers via invite page
    await page2.getByRole('link', { name: /create account/i }).click();

    // Should be on register page with redirect parameter
    await expect(page2.url()).toContain('/register');
    await expect(page2.url()).toContain('redirect');

    // Fill registration form
    await page2.getByLabel('Display Name').fill(user2Name);
    await page2.getByLabel('Email').fill(user2Email);
    await page2.locator('#register-password').fill(user2Password);
    await page2.getByRole('button', { name: /register|sign up|create account/i }).click();

    // Step 10: After registration, user goes through onboarding
    await page2.waitForTimeout(1000);

    // Skip onboarding if present
    const skipButton = page2.getByRole('button', { name: /skip/i });
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
      await page2.waitForTimeout(500);
    }

    // Navigate to the invite URL again to join the team
    await page2.goto(inviteUrl);
    await page2.waitForTimeout(1000);

    // Step 11: Verify user 2 is on the team page
    await expect(page2.url()).toContain('/teams/');

    // Should see team name
    await expect(page2.getByRole('heading', { name: teamName })).toBeVisible();

    // ============================================================
    // VERIFICATION: Both users see each other
    // ============================================================

    // Step 12: User 2 navigates to Members tab and sees both members
    await page2.getByRole('tab', { name: /members/i }).click();
    await page2.waitForTimeout(300);

    // Should see both users
    await expect(page2.getByText(user1Name).first()).toBeVisible();
    await expect(page2.getByText(user2Name).first()).toBeVisible();
    await expect(page2.getByText(/members \(2\)/i)).toBeVisible();

    // Step 13: User 1 refreshes and sees user 2 in members
    await page1.reload();
    await page1.waitForTimeout(500);

    // Navigate back to Members tab
    await page1.getByRole('tab', { name: /members/i }).click();
    await page1.waitForTimeout(300);

    // Should see both users
    await expect(page1.getByText(user1Name).first()).toBeVisible();
    await expect(page1.getByText(user2Name).first()).toBeVisible();
    await expect(page1.getByText(/members \(2\)/i)).toBeVisible();

    // Cleanup
    await context1.close();
    await context2.close();
  });
});
