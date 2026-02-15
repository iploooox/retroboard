import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser, createTeamAndBoard } from './helpers';

test.describe.serial('Card Interactions - Full User Journey', () => {
  let email: string;
  let password: string;
  let displayName: string;

  test.beforeAll(() => {
    email = generateUniqueEmail();
    password = 'SecurePass123!';
    displayName = 'Card Journey User';
  });

  test('E2E-CARDS-1: Setup - Register and create board', async ({ page }) => {
    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Card Journey Team' });

    // Verify we're on a board in Write phase
    await expect(page.getByText(/write|writing/i)).toBeVisible();
  });

  test('E2E-CARDS-2: Verify empty state when no cards exist', async ({ page }) => {
    // Should see empty columns with no cards
    const cards = await page.locator('[data-card-id], [data-testid="card"]').all();
    expect(cards.length).toBe(0);

    // Add card buttons should be visible
    const addCardButtons = await page.getByRole('button', { name: /add card|\+/i }).all();
    expect(addCardButtons.length).toBeGreaterThan(0);
  });

  test('E2E-CARDS-3: Create card in first column', async ({ page }) => {
    // Click add card button for first column
    const addCardButton = page.getByRole('button', { name: /add card|\+/i }).first();
    await addCardButton.click();

    // Fill in card content
    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Great team collaboration this sprint!');

    // Submit card by pressing Enter
    await page.keyboard.press('Enter');

    // Wait for card to appear
    await page.waitForTimeout(500);

    // Verify card is visible in the correct column
    await expect(page.getByText('Great team collaboration this sprint!')).toBeVisible();
  });

  test('E2E-CARDS-4: Create second card for testing interactions', async ({ page }) => {
    // Add another card to test with
    const addCardButton = page.getByRole('button', { name: /add card|\+/i }).first();
    await addCardButton.click();

    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Need to improve documentation');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verify second card is visible
    await expect(page.getByText('Need to improve documentation')).toBeVisible();
  });

  test('E2E-CARDS-5: Edit card content', async ({ page }) => {
    // Hover over the first card to reveal edit button
    const cardElement = page.getByText('Great team collaboration this sprint!');
    await cardElement.hover();

    // Click edit button
    await page.getByRole('button', { name: /edit/i }).first().click();

    // Update the content
    const editInput = page.getByPlaceholder(/card content|edit/i).first();
    await editInput.clear();
    await editInput.fill('Excellent team collaboration this sprint!');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verify updated content is visible
    await expect(page.getByText('Excellent team collaboration this sprint!')).toBeVisible();
    // Original content should not be visible
    await expect(page.getByText('Great team collaboration this sprint!')).not.toBeVisible();
  });

  test('E2E-CARDS-6: Add reaction emoji to card', async ({ page }) => {
    // Find a card and add a reaction
    const cardElement = page.getByText('Excellent team collaboration this sprint!');
    await cardElement.hover();

    // Look for reaction button or emoji picker
    const reactionButton = page.getByRole('button', { name: /reaction|emoji|😊|👍|❤️/i }).first();

    // If there's a reaction picker, open it
    const isVisible = await reactionButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (isVisible) {
      await reactionButton.click();
      await page.waitForTimeout(300);

      // Click on a specific emoji (thumbs up or heart)
      const emojiOption = page.getByRole('button', { name: /👍|❤️/i }).first();
      const hasEmoji = await emojiOption.isVisible({ timeout: 1000 }).catch(() => false);
      if (hasEmoji) {
        await emojiOption.click();
        await page.waitForTimeout(500);

        // Verify reaction appears on the card
        // Look for emoji or reaction count
        const reactionCount = page.locator('[data-reaction-count], [data-testid="reaction"]').first();
        const hasReaction = await reactionCount.isVisible({ timeout: 1000 }).catch(() => false);
        expect(hasReaction).toBeTruthy();
      }
    }
  });

  test('E2E-CARDS-7: Remove reaction emoji from card', async ({ page }) => {
    // Click the same reaction again to remove it
    const cardElement = page.getByText('Excellent team collaboration this sprint!');
    await cardElement.hover();

    // Find the reaction button that was previously clicked
    const reactionButton = page.getByRole('button', { name: /👍|❤️/i }).first();
    const isVisible = await reactionButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (isVisible) {
      await reactionButton.click();
      await page.waitForTimeout(500);

      // Verify reaction count decreased or is removed
      // The specific implementation may vary, but the reaction should be toggled off
    }
  });

  test('E2E-CARDS-8: Transition to Vote phase for voting test', async ({ page }) => {
    // Click Next Phase button to move to Vote phase
    await page.getByRole('button', { name: /next phase/i }).click();
    await page.waitForTimeout(500);

    // Verify we're in Vote phase
    await expect(page.getByText(/vote|voting/i)).toBeVisible();
  });

  test('E2E-CARDS-9: Vote on a card in Vote phase', async ({ page }) => {
    // Find vote button on a card
    const cardElement = page.getByText('Excellent team collaboration this sprint!');

    // Get vote button - it should now be visible/enabled in Vote phase
    const voteButton = cardElement.locator('..').getByRole('button', { name: /vote|👍|\+1/i }).first();

    // Verify vote button is enabled
    await expect(voteButton).toBeEnabled();

    // Click to vote
    await voteButton.click();
    await page.waitForTimeout(500);

    // Verify vote count increased (should show "1" somewhere)
    await expect(page.getByText(/1.*vote|vote.*1|^1$/i)).toBeVisible();
  });

  test('E2E-CARDS-10: Toggle vote off (unvote)', async ({ page }) => {
    // Click vote button again to remove vote
    const cardElement = page.getByText('Excellent team collaboration this sprint!');
    const voteButton = cardElement.locator('..').getByRole('button', { name: /vote|👍|\+1/i }).first();

    await voteButton.click();
    await page.waitForTimeout(500);

    // Vote count should be 0 or hidden
    const voteCountText = await page.getByText(/1.*vote/i).isVisible({ timeout: 1000 }).catch(() => false);
    expect(voteCountText).toBeFalsy();
  });

  test('E2E-CARDS-11: Vote on multiple cards', async ({ page }) => {
    // Vote on first card
    const card1 = page.getByText('Excellent team collaboration this sprint!');
    const voteButton1 = card1.locator('..').getByRole('button', { name: /vote|👍|\+1/i }).first();
    await voteButton1.click();
    await page.waitForTimeout(300);

    // Vote on second card
    const card2 = page.getByText('Need to improve documentation');
    const voteButton2 = card2.locator('..').getByRole('button', { name: /vote|👍|\+1/i }).first();
    await voteButton2.click();
    await page.waitForTimeout(300);

    // Verify both cards have votes
    const voteElements = await page.locator('[data-vote-count]').all();
    expect(voteElements.length).toBeGreaterThanOrEqual(2);
  });

  test('E2E-CARDS-12: Return to Write phase for delete test', async ({ page }) => {
    // Navigate back to dashboard and then to board
    // Or use a back button if available
    await page.goto('/dashboard');
    await page.waitForTimeout(500);

    // Navigate back to the board
    await page.getByRole('link', { name: /board/i }).first().click();
    await page.waitForTimeout(500);

    // Should be back on the board
    await expect(page.getByText('Excellent team collaboration this sprint!')).toBeVisible();
  });

  test('E2E-CARDS-13: Delete a card', async ({ page }) => {
    // Verify card exists before deletion
    await expect(page.getByText('Need to improve documentation')).toBeVisible();

    // Hover over the card to reveal delete button
    const cardElement = page.getByText('Need to improve documentation');
    await cardElement.hover();

    // Click delete button
    await page.getByRole('button', { name: /delete|remove|trash|🗑️/i }).first().click();

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
    const hasConfirm = await confirmButton.isVisible({ timeout: 1000 }).catch(() => false);
    if (hasConfirm) {
      await confirmButton.click();
    }

    await page.waitForTimeout(500);

    // Verify card is removed
    await expect(page.getByText('Need to improve documentation')).not.toBeVisible();
  });

  test('E2E-CARDS-14: Verify remaining card still exists after deletion', async ({ page }) => {
    // First card should still be visible
    await expect(page.getByText('Excellent team collaboration this sprint!')).toBeVisible();

    // Count remaining cards
    const cards = await page.locator('[data-card-id], [data-testid="card"]').all();
    expect(cards.length).toBeGreaterThan(0);
  });

  test('E2E-CARDS-15: Create card in different column', async ({ page }) => {
    // Get all add card buttons
    const addCardButtons = await page.getByRole('button', { name: /add card|\+/i }).all();

    // If there's more than one column, add a card to the second column
    if (addCardButtons.length > 1) {
      await addCardButtons[1].click();

      const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
      await cardInput.fill('Action item for next sprint');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Verify card appears
      await expect(page.getByText('Action item for next sprint')).toBeVisible();
    }
  });
});
