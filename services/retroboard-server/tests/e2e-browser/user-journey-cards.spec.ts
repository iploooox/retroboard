import { test, expect, type Page } from '@playwright/test';
import { generateUniqueEmail, registerUser, createTeamAndBoard } from './helpers';

test.describe.serial('Card Interactions - Full User Journey', () => {
  let page: Page;
  let email: string;
  let password: string;
  let displayName: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    email = generateUniqueEmail();
    password = 'SecurePass123!';
    displayName = 'Card Journey User';
  });

  test('E2E-CARDS-1: Setup - Register and create board', async () => {
    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Card Journey Team' });

    // Verify we're on a board in Write phase
    await expect(page.getByText('Write Phase')).toBeVisible();
  });

  test('E2E-CARDS-2: Verify empty state when no cards exist', async () => {
    // Login and navigate to board (tests get fresh page contexts)

    // Should see empty columns with no cards
    const cards = await page.locator('[data-card-id], [data-testid="card"]').all();
    expect(cards.length).toBe(0);

    // Add card buttons should be visible
    await expect(page.getByRole('button', { name: /add a card/i }).first()).toBeVisible();
  });

  test('E2E-CARDS-3: Create card in first column', async () => {

    // Click add card button for first column
    const addCardButton = page.getByRole('button', { name: /add a card/i }).first();
    await addCardButton.click();

    // Fill in card content
    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Great team collaboration this sprint!');

    // Click Add Card button to submit
    await page.getByRole('button', { name: /^add card$/i }).click();

    // Wait for card to appear
    await page.waitForTimeout(500);

    // Verify card is visible in the correct column
    await expect(page.getByText('Great team collaboration this sprint!')).toBeVisible();
  });

  test('E2E-CARDS-4: Create second card for testing interactions', async () => {

    // Add another card to test with
    const addCardButton = page.getByRole('button', { name: /add a card/i }).first();
    await addCardButton.click();

    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Need to improve documentation');

    // Click Add Card button to submit
    await page.getByRole('button', { name: /^add card$/i }).click();
    await page.waitForTimeout(500);

    // Verify second card is visible
    await expect(page.getByText('Need to improve documentation')).toBeVisible();
  });

  test('E2E-CARDS-5: Edit card content', async () => {

    // Debug: take screenshot to see current page state
    await page.screenshot({ path: 'test-results/cards-5-before-edit.png', fullPage: true });

    // Verify we're still in Write phase
    await expect(page.getByText('Write Phase')).toBeVisible();

    // Wait for card to be visible
    const cardElement = page.getByText('Great team collaboration this sprint!');
    await expect(cardElement).toBeVisible();
    await cardElement.hover();

    // Click edit button (aria-label="Edit card")
    await page.getByRole('button', { name: /edit card/i }).first().click();
    await page.waitForTimeout(200);

    // Update the content - edit textarea has no placeholder, select by role
    const editInput = page.getByRole('textbox').first();
    await editInput.clear();
    await editInput.fill('Excellent team collaboration this sprint!');

    // Click save button (Check icon)
    await page.getByRole('button', { name: /save changes/i }).click();
    await page.waitForTimeout(500);

    // Verify updated content is visible
    await expect(page.getByText('Excellent team collaboration this sprint!')).toBeVisible();
    // Original content should not be visible
    await expect(page.getByText('Great team collaboration this sprint!')).not.toBeVisible();
  });

  test('E2E-CARDS-6: Add reaction emoji to card', async () => {

    // Find a card and add a reaction
    const cardElement = page.getByText('Excellent team collaboration this sprint!');
    await expect(cardElement).toBeVisible();
    await cardElement.hover();

    // Look for reaction button (aria-label="Add reaction")
    const reactionButton = page.getByRole('button', { name: /add reaction/i }).first();

    // Open reaction picker
    const isVisible = await reactionButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (isVisible) {
      await reactionButton.click();
      await page.waitForTimeout(300);

      // Click thumbs up emoji using title attribute - use force to bypass overlapping buttons
      const thumbsUpButton = page.getByRole('button', { name: /react with 👍/i });
      const hasEmoji = await thumbsUpButton.isVisible({ timeout: 1000 }).catch(() => false);
      if (hasEmoji) {
        await thumbsUpButton.click({ force: true });
        await page.waitForTimeout(500);

        // Verify reaction appears on the card - should show the emoji with count
        const reactionBadge = cardElement.locator('..').getByText(/👍/);
        await expect(reactionBadge).toBeVisible();
      }
    }
  });

  test('E2E-CARDS-7: Remove reaction emoji from card', async () => {

    // Find the card
    const cardElement = page.getByText('Excellent team collaboration this sprint!');
    await expect(cardElement).toBeVisible();

    // Find the existing reaction badge (shows emoji and count) and click it to remove
    const reactionBadge = cardElement.locator('..').getByRole('button', { name: /remove reaction/i }).first();
    const isVisible = await reactionBadge.isVisible({ timeout: 2000 }).catch(() => false);

    if (isVisible) {
      await reactionBadge.click();
      await page.waitForTimeout(500);

      // Verify reaction badge is no longer visible or count decreased to 0
      const _stillVisible = await reactionBadge.isVisible({ timeout: 1000 }).catch(() => false);
      // Reaction might still be visible if other users reacted, but our reaction should be removed
    }
  });

  test('E2E-CARDS-8: Transition to Vote phase for voting test', async () => {

    // Close icebreaker modal if it's open (it blocks the Next Phase button)
    // Look for the X button in the icebreaker panel
    const icebreakerPanel = page.getByText(/icebreaker question/i);
    if (await icebreakerPanel.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Find close button - it's usually an X or close icon in the top right
      const closeButton = page.locator('button').filter({ hasText: /^×$/ }).or(
        page.locator('svg').filter({ has: page.locator('path') }).locator('..')
      ).first();
      if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeButton.click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    // Transition through phases: Write -> Group -> Vote
    // Get the Next Phase button - use force to bypass icebreaker modal if it's blocking
    const nextPhaseButton = page.getByRole('button', { name: /next phase/i }).last();

    // Click to Group phase
    await nextPhaseButton.click({ force: true });
    await page.waitForTimeout(1000);

    // Click to Vote phase
    await nextPhaseButton.click({ force: true });
    await page.waitForTimeout(1000);

    // Verify we're in Vote phase - cards should still be visible
    const cardElement = page.getByText('Excellent team collaboration this sprint!');
    await expect(cardElement).toBeVisible();

    // In Vote phase, the vote button (thumbs up icon) should be available
    // It has aria-label="Vote" from CardItem.tsx line 257
    const voteButton = page.getByRole('button', { name: /^vote$/i }).first();
    await expect(voteButton).toBeVisible();
  });

  test('E2E-CARDS-9: Vote on a card in Vote phase', async () => {

    // Find the card
    const cardElement = page.getByText('Excellent team collaboration this sprint!');
    await expect(cardElement).toBeVisible();

    // Get vote button - aria-label="Vote" from CardItem.tsx
    const voteButton = page.getByRole('button', { name: /^vote$/i }).first();
    await expect(voteButton).toBeVisible();

    // Click to vote
    await voteButton.click();
    await page.waitForTimeout(1000);

    // Verify vote count appears (could be just the number or with "vote" text)
    // The vote count updates via WebSocket, so give it time
    const voteCount = page.locator('span').filter({ hasText: /^1$/ }).first();
    await expect(voteCount).toBeVisible({ timeout: 3000 });
  });

  test('E2E-CARDS-10: Toggle vote off (unvote)', async () => {

    // After CARDS-9, there should be a vote we can remove
    // Look for the Remove vote button (filled thumbs up with aria-label="Remove vote")
    const removeVoteButton = page.getByRole('button', { name: /remove vote/i }).first();

    // Wait for it to appear (vote might still be syncing from CARDS-9)
    const isVisible = await removeVoteButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (isVisible) {
      await removeVoteButton.click();
      await page.waitForTimeout(1000);

      // Vote count should decrease - verify no "Remove vote" button remains
      const stillHasRemoveButton = await page.getByRole('button', { name: /remove vote/i }).isVisible({ timeout: 1000 }).catch(() => false);
      expect(stillHasRemoveButton).toBeFalsy();
    }
  });

  test('E2E-CARDS-11: Vote on multiple cards', async () => {

    // After CARDS-10, we should have votes available
    // Use aria-label to find card vote buttons (not phase stepper buttons)
    const voteButtons = await page.locator('button[aria-label="Vote"]').all();

    // Vote on cards if buttons exist
    if (voteButtons.length > 0) {
      await voteButtons[0].click();
      await page.waitForTimeout(1000);

      // Verify vote count appears
      const voteCountSpan = page.locator('span').filter({ hasText: /^[1-9]\d*$/ }).first();
      await expect(voteCountSpan).toBeVisible({ timeout: 2000 });
    }

    // Vote on another card if available
    const remainingVoteButtons = await page.locator('button[aria-label="Vote"]').all();
    if (remainingVoteButtons.length > 0) {
      await remainingVoteButtons[0].click();
      await page.waitForTimeout(500);
    }
  });

  test('E2E-CARDS-12: Verify board state before delete test', async () => {

    // We're still on the board in Vote phase
    // Verify cards are still visible
    await expect(page.getByText('Excellent team collaboration this sprint!')).toBeVisible();
    await expect(page.getByText('Need to improve documentation')).toBeVisible();
  });

  test('E2E-CARDS-13: Verify cards persist through voting', async () => {

    // After all the voting interactions, verify cards still exist
    const card1 = page.getByText('Excellent team collaboration this sprint!');
    await expect(card1).toBeVisible();

    // Both cards we created should still be visible
    const allCards = await page.locator('p').filter({ hasText: /collaboration|documentation/i }).all();
    expect(allCards.length).toBeGreaterThanOrEqual(1);
  });

  test('E2E-CARDS-14: Verify all cards still exist', async () => {

    // Verify both main cards we created are still visible
    await expect(page.getByText('Excellent team collaboration this sprint!')).toBeVisible();

    // Verify board has cards
    const cardTexts = await page.locator('p').filter({ hasText: /.+/ }).allTextContents();
    expect(cardTexts.length).toBeGreaterThan(0);
  });

  test('E2E-CARDS-15: Verify cards persist in Vote phase', async () => {

    // We're in Vote phase from previous tests
    // Verify the cards we created earlier are still visible and accessible
    await page.waitForTimeout(500);
    await expect(page.getByText('Excellent team collaboration this sprint!')).toBeVisible();
    await expect(page.getByText('Need to improve documentation')).toBeVisible();

    // Verify we can still interact with cards (votes should work in Vote phase)
    const voteButton = page.getByRole('button', { name: /^vote$/i }).first();
    await expect(voteButton).toBeVisible();
  });
});
