import { test, expect, Browser } from '@playwright/test';
import { generateUniqueEmail, registerUser, createTeamAndBoard, loginUser } from './helpers';

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
    const { teamName, sprintName } = await createTeamAndBoard(page1, { teamName: 'Vote Sync Test Team' });

    // Get the board URL from User 1
    const boardUrl = page1.url();

    // User 1: Create a card in write phase
    const addCardButton = page1.getByRole('button', { name: /add card|\+/i }).first();
    await addCardButton.click();
    const cardInput = page1.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Test card for voting');
    await page1.keyboard.press('Enter');
    await page1.waitForTimeout(500);

    // Verify card is visible to User 1
    await expect(page1.getByText('Test card for voting')).toBeVisible();

    // User 1: Navigate to team dashboard to invite User 2
    await page1.getByRole('link', { name: /dashboard|home/i }).click();
    await page1.waitForTimeout(500);

    // User 1: Invite User 2 to the team
    const email2 = generateUniqueEmail();
    const inviteButton = page1.getByRole('button', { name: /invite|add member/i }).first();
    await inviteButton.click();
    await page1.getByLabel(/email/i).fill(email2);
    await page1.getByRole('button', { name: /send invite|invite/i }).click();
    await page1.waitForTimeout(500);

    // User 2: Register with the invited email
    const password2 = 'SecurePass123!';
    const displayName2 = 'Vote User 2';
    await registerUser(page2, { email: email2, password: password2, displayName: displayName2 });

    // User 2: Accept the team invitation (should be on dashboard)
    await page2.waitForTimeout(500);
    const acceptButton = page2.getByRole('button', { name: /accept/i }).first();
    if (await acceptButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptButton.click();
      await page2.waitForTimeout(500);
    }

    // User 2: Navigate to the board
    await page2.goto(boardUrl);
    await page2.waitForTimeout(1000);

    // Verify User 2 can see the card
    await expect(page2.getByText('Test card for voting')).toBeVisible();

    // User 1: Transition to vote phase
    await page1.goto(boardUrl);
    await page1.waitForTimeout(500);

    // Click phase dropdown/toolbar to change phase
    const phaseButton = page1.getByRole('button', { name: /write|phase/i }).first();
    await phaseButton.click();
    await page1.waitForTimeout(200);

    // Select vote phase
    await page1.getByText(/vote/i).click();
    await page1.waitForTimeout(1000);

    // Verify both users see the vote phase
    await expect(page1.getByText(/vote phase|voting/i)).toBeVisible({ timeout: 5000 });
    await expect(page2.getByText(/vote phase|voting/i)).toBeVisible({ timeout: 5000 });

    // Get initial vote count on both pages (should be 0)
    const card1 = page1.getByText('Test card for voting').locator('..');
    const card2 = page2.getByText('Test card for voting').locator('..');

    // User 1: Vote on the card
    await card1.hover();
    const voteButton1 = page1.getByRole('button', { name: /vote|👍|\+/i }).first();
    await voteButton1.click();
    await page1.waitForTimeout(500);

    // **CRITICAL TEST**: User 2 should see the vote count update in real-time WITHOUT any interaction
    // Wait for the vote count to appear/update on User 2's screen
    await page2.waitForTimeout(1000); // Allow time for WebSocket message

    // Verify User 1 sees vote count = 1
    await expect(page1.getByText(/1.*vote|vote.*1/i)).toBeVisible({ timeout: 2000 });

    // **THE KEY ASSERTION**: Verify User 2 ALSO sees vote count = 1 without refreshing
    await expect(page2.getByText(/1.*vote|vote.*1/i)).toBeVisible({ timeout: 2000 });

    // User 2: Vote on the same card
    await card2.hover();
    const voteButton2 = page2.getByRole('button', { name: /vote|👍|\+/i }).first();
    await voteButton2.click();
    await page2.waitForTimeout(500);

    // Verify both users see vote count = 2
    await expect(page1.getByText(/2.*vote|vote.*2/i)).toBeVisible({ timeout: 2000 });
    await expect(page2.getByText(/2.*vote|vote.*2/i)).toBeVisible({ timeout: 2000 });

    // User 1: Remove their vote
    await card1.hover();
    const removeVoteButton1 = page1.getByRole('button', { name: /remove vote|-|unvote/i }).first();
    if (await removeVoteButton1.isVisible({ timeout: 1000 }).catch(() => false)) {
      await removeVoteButton1.click();
    } else {
      // If no explicit remove button, clicking vote again might toggle
      await voteButton1.click();
    }
    await page1.waitForTimeout(500);

    // Verify both users see vote count = 1 after User 1 removed their vote
    await expect(page1.getByText(/1.*vote|vote.*1/i)).toBeVisible({ timeout: 2000 });
    await expect(page2.getByText(/1.*vote|vote.*1/i)).toBeVisible({ timeout: 2000 });

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
    const { teamName } = await createTeamAndBoard(page1, { teamName: 'Vote Limit Test Team' });

    const boardUrl = page1.url();

    // User 1: Create two cards
    for (let i = 1; i <= 2; i++) {
      const addCardButton = page1.getByRole('button', { name: /add card|\+/i }).first();
      await addCardButton.click();
      const cardInput = page1.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
      await cardInput.fill(`Card ${i}`);
      await page1.keyboard.press('Enter');
      await page1.waitForTimeout(300);
    }

    // User 2: Register and join team
    const email2 = generateUniqueEmail();
    const password2 = 'SecurePass123!';
    const displayName2 = 'Limit User 2';

    // User 1: Invite User 2
    await page1.getByRole('link', { name: /dashboard|home/i }).click();
    await page1.waitForTimeout(500);
    const inviteButton = page1.getByRole('button', { name: /invite|add member/i }).first();
    await inviteButton.click();
    await page1.getByLabel(/email/i).fill(email2);
    await page1.getByRole('button', { name: /send invite|invite/i }).click();
    await page1.waitForTimeout(500);

    await registerUser(page2, { email: email2, password: password2, displayName: displayName2 });
    await page2.waitForTimeout(500);
    const acceptButton = page2.getByRole('button', { name: /accept/i }).first();
    if (await acceptButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptButton.click();
    }

    // Both users navigate to board
    await page1.goto(boardUrl);
    await page2.goto(boardUrl);
    await page1.waitForTimeout(500);
    await page2.waitForTimeout(500);

    // User 1: Transition to vote phase
    const phaseButton = page1.getByRole('button', { name: /write|phase/i }).first();
    await phaseButton.click();
    await page1.waitForTimeout(200);
    await page1.getByText(/vote/i).click();
    await page1.waitForTimeout(1000);

    // User 1: Cast multiple votes (default limit is usually 5 per user)
    const card1Element = page1.getByText('Card 1').locator('..');
    await card1Element.hover();

    // Vote 3 times on Card 1
    for (let i = 0; i < 3; i++) {
      const voteBtn = page1.getByRole('button', { name: /vote|👍|\+/i }).first();
      await voteBtn.click();
      await page1.waitForTimeout(300);
    }

    // Verify User 2 sees 3 votes on Card 1 in real-time
    await page2.waitForTimeout(1000);
    await expect(page2.getByText(/3.*vote|vote.*3/i)).toBeVisible({ timeout: 2000 });

    // Verify User 2 sees their remaining votes decreased (if UI shows this)
    // This depends on UI implementation - adjust selector as needed

    // Cleanup
    await context1.close();
    await context2.close();
  });
});
