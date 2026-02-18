import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser, createTeamAndBoard } from './helpers';

test.describe('Vote Real-time Sync', () => {
  test('E2E-VOTE-SYNC-1: Vote counts sync between two users in real-time', async ({ browser }) => {
    // Setup: Create two browser contexts for two different users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // User 1: Register and create team/board
    const email1 = generateUniqueEmail();
    const password1 = 'SecurePass123!';
    const displayName1 = 'Vote User 1';

    await registerUser(page1, { email: email1, password: password1, displayName: displayName1 });
    await createTeamAndBoard(page1, { teamName: 'Vote Sync Test Team' });

    // Get the board URL from User 1
    const boardUrl = page1.url();

    // User 1: Create a card in write phase
    const addCardButton = page1.getByRole('button', { name: /add a card/i }).first();
    await addCardButton.click();
    const cardInput = page1.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Test card for voting');
    await page1.getByRole('button', { name: /^add card$/i }).click();
    await page1.waitForTimeout(500);

    // Verify card is visible to User 1
    await expect(page1.getByText('Test card for voting')).toBeVisible();

    // User 1: Get invite link from board (simpler than Members tab flow)
    await page1.getByRole('button', { name: /invite/i }).click();
    const inviteLink = await page1.locator('input[value*="/invite/"]').inputValue();
    const inviteCode = inviteLink.split('/invite/')[1];

    // Close invite modal
    await page1.keyboard.press('Escape');
    await page1.waitForTimeout(500);

    const email2 = generateUniqueEmail();

    // User 2: Register
    const password2 = 'SecurePass123!';
    const displayName2 = 'Vote User 2';
    await registerUser(page2, { email: email2, password: password2, displayName: displayName2 });

    // User 2: Join team via invite link
    await page2.goto(`/invite/${inviteCode}`);
    await page2.waitForTimeout(500);

    // Click "Join Team" button on invite page
    const joinButton = page2.getByRole('button', { name: /join team/i });
    if (await joinButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await joinButton.click();
      await page2.waitForTimeout(1000);
    }

    // User 2: Navigate to the board
    await page2.goto(boardUrl);
    await page2.waitForTimeout(1000);

    // Dismiss icebreaker warmup for User 2
    const nextPhaseBtn2 = page2.getByRole('button', { name: /next phase/i });
    await nextPhaseBtn2.waitFor({ state: 'visible', timeout: 10000 }).then(() => nextPhaseBtn2.click()).catch(() => {});
    await page2.waitForTimeout(500);

    // Verify User 2 can see the card
    await expect(page2.getByText('Test card for voting')).toBeVisible();

    // User 1: Transition to vote phase
    await page1.goto(boardUrl);
    await page1.waitForTimeout(500);

    // Dismiss icebreaker warmup for User 1 (reloaded)
    const nextPhaseBtn1 = page1.getByRole('button', { name: /next phase/i });
    await nextPhaseBtn1.waitFor({ state: 'visible', timeout: 10000 }).then(() => nextPhaseBtn1.click()).catch(() => {});
    await page1.waitForTimeout(500);

    // Click Vote button in facilitator toolbar to change phase
    await page1.getByRole('button', { name: 'Vote' }).click();
    await page1.waitForTimeout(500);

    // Confirm phase change in modal
    await page1.getByRole('button', { name: 'Change Phase' }).click();
    await page1.waitForTimeout(2000);

    // Verify both users see the vote phase (longer timeout for WebSocket under parallel load)
    await expect(page1.getByTestId('phase-badge')).toContainText(/vote/i, { timeout: 15000 });
    await expect(page2.getByTestId('phase-badge')).toContainText(/vote/i, { timeout: 15000 });

    // Get initial vote count on both pages (should be 0)
    const card1 = page1.getByText('Test card for voting').locator('..');
    const card2 = page2.getByText('Test card for voting').locator('..');

    // User 1: Vote on the card using the card-level Vote button (aria-label="Vote")
    await card1.hover();
    const voteButton1 = page1.locator('button[aria-label="Vote"]').first();
    await voteButton1.click();
    await page1.waitForTimeout(2000); // Allow time for vote API + WebSocket propagation

    // Verify User 1 sees vote count = 1
    await expect(page1.getByTestId('card-votes').first()).toContainText('1', { timeout: 5000 });

    // **THE KEY ASSERTION**: Verify User 2 ALSO sees vote count = 1 without refreshing
    await expect(page2.getByTestId('card-votes').first()).toContainText('1', { timeout: 5000 });

    // User 2: Vote on the same card
    await card2.hover();
    const voteButton2 = page2.locator('button[aria-label="Vote"]').first();
    await voteButton2.click();
    await page2.waitForTimeout(2000); // Allow time for vote API + WebSocket propagation

    // Verify both users see vote count = 2
    await expect(page1.getByTestId('card-votes').first()).toContainText('2', { timeout: 5000 });
    await expect(page2.getByTestId('card-votes').first()).toContainText('2', { timeout: 5000 });

    // User 1: Remove their vote
    await card1.hover();
    const removeVoteButton1 = page1.locator('button[aria-label="Remove vote"]').first();
    await removeVoteButton1.click();
    await page1.waitForTimeout(2000); // Allow time for vote API + WebSocket propagation

    // Verify both users see vote count = 1 after User 1 removed their vote
    await expect(page1.getByTestId('card-votes').first()).toContainText('1', { timeout: 5000 });
    await expect(page2.getByTestId('card-votes').first()).toContainText('1', { timeout: 5000 });

    // Cleanup
    await context1.close();
    await context2.close();
  });

  test('E2E-VOTE-SYNC-2: Multiple votes sync with vote limits', async ({ browser }) => {
    // Setup: Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // User 1: Register and create team/board with custom vote limits
    const email1 = generateUniqueEmail();
    const password1 = 'SecurePass123!';
    const displayName1 = 'Limit User 1';

    await registerUser(page1, { email: email1, password: password1, displayName: displayName1 });
    await createTeamAndBoard(page1, { teamName: 'Vote Limit Test Team' });

    const boardUrl = page1.url();

    // User 1: Create two cards
    for (let i = 1; i <= 2; i++) {
      const addCardButton = page1.getByRole('button', { name: /add a card/i }).first();
      await addCardButton.click();
      const cardInput = page1.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
      await cardInput.fill(`Card ${i}`);
      await page1.getByRole('button', { name: /^add card$/i }).first().click();
      await page1.waitForTimeout(500);
    }

    // User 2: Register and join team
    const email2 = generateUniqueEmail();
    const password2 = 'SecurePass123!';
    const displayName2 = 'Limit User 2';

    // User 1: Get invite link from board
    await page1.getByRole('button', { name: /invite/i }).click();
    const inviteLink = await page1.locator('input[value*="/invite/"]').inputValue();
    const inviteCode = inviteLink.split('/invite/')[1];

    // Close invite modal
    await page1.keyboard.press('Escape');
    await page1.waitForTimeout(500);

    await registerUser(page2, { email: email2, password: password2, displayName: displayName2 });

    // User 2: Join team via invite link
    await page2.goto(`/invite/${inviteCode}`);
    await page2.waitForTimeout(500);

    // Click "Join Team" button on invite page
    const joinButton = page2.getByRole('button', { name: /join team/i });
    if (await joinButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await joinButton.click();
      await page2.waitForTimeout(1000);
    }

    // Both users navigate to board
    await page1.goto(boardUrl);
    await page2.goto(boardUrl);
    await page1.waitForTimeout(500);
    await page2.waitForTimeout(500);

    // Dismiss icebreaker warmup for both users
    const npBtn1 = page1.getByRole('button', { name: /next phase/i });
    await npBtn1.waitFor({ state: 'visible', timeout: 10000 }).then(() => npBtn1.click()).catch(() => {});
    const npBtn2 = page2.getByRole('button', { name: /next phase/i });
    await npBtn2.waitFor({ state: 'visible', timeout: 10000 }).then(() => npBtn2.click()).catch(() => {});
    await page1.waitForTimeout(500);

    // User 1: Jump directly to Vote phase using phase stepper (same approach as SYNC-1)
    await page1.getByRole('button', { name: 'Vote' }).click();
    await page1.waitForTimeout(500);
    await page1.getByRole('button', { name: 'Change Phase' }).click();
    await page1.waitForTimeout(1000);

    // Verify both users see Vote phase
    await expect(page1.getByTestId('phase-badge')).toContainText(/vote/i, { timeout: 5000 });
    await expect(page2.getByTestId('phase-badge')).toContainText(/vote/i, { timeout: 5000 });

    // User 1: Vote on Card 1 (toggle UI: single vote per card per user)
    await page1.locator('button[aria-label="Vote"]').first().click();
    await page1.waitForTimeout(2000);
    await expect(page1.getByTestId('card-votes').first()).toContainText('1', { timeout: 5000 });

    // Verify User 2 sees vote on Card 1 via WebSocket
    await expect(page2.getByTestId('card-votes').first()).toContainText('1', { timeout: 10000 });

    // User 1: Vote on Card 2 (re-query: Card 1's button is now "Remove vote")
    await page1.locator('button[aria-label="Vote"]').first().click();
    await page1.waitForTimeout(3000);

    // Verify both users see votes on both cards (2 vote badges visible)
    await expect(page1.getByTestId('card-votes')).toHaveCount(2, { timeout: 10000 });
    await expect(page2.getByTestId('card-votes')).toHaveCount(2, { timeout: 15000 });

    // Cleanup
    await context1.close();
    await context2.close();
  });
});
