import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser, createTeamAndBoard } from './helpers';

test.describe('Board Operations', () => {
  test('E2E-BOARD-1: Create card in board column', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Board Test User';

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Board Test Team' });

    // Add a card to the first column
    const addCardButton = page.getByRole('button', { name: /add card|\+/i }).first();
    await addCardButton.click();

    // Fill in card content
    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Great team collaboration this sprint!');

    // Submit card
    await page.keyboard.press('Enter');
    // Or click submit if there's a button
    // await page.getByRole('button', { name: /submit|add|create/i }).click();

    // Wait for card to appear
    await page.waitForTimeout(500);

    // Verify card is visible
    await expect(page.getByText('Great team collaboration this sprint!')).toBeVisible();
  });

  test('E2E-BOARD-2: Update card content', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Update Test User';

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Update Test Team' });

    // Create a card
    const addCardButton = page.getByRole('button', { name: /add card|\+/i }).first();
    await addCardButton.click();
    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Original content');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Click edit on the card (might be an icon or menu)
    const cardElement = page.getByText('Original content');
    await cardElement.hover();
    await page.getByRole('button', { name: /edit/i }).first().click();

    // Update the content
    const editInput = page.getByPlaceholder(/card content|edit/i).first();
    await editInput.clear();
    await editInput.fill('Updated content');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verify updated content
    await expect(page.getByText('Updated content')).toBeVisible();
    await expect(page.getByText('Original content')).not.toBeVisible();
  });

  test('E2E-BOARD-3: Delete card', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Delete Test User';

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Delete Test Team' });

    // Create a card
    const addCardButton = page.getByRole('button', { name: /add card|\+/i }).first();
    await addCardButton.click();
    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Card to delete');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verify card exists
    await expect(page.getByText('Card to delete')).toBeVisible();

    // Delete the card
    const cardElement = page.getByText('Card to delete');
    await cardElement.hover();
    await page.getByRole('button', { name: /delete|remove/i }).first().click();

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }

    await page.waitForTimeout(500);

    // Verify card is gone
    await expect(page.getByText('Card to delete')).not.toBeVisible();
  });

  test('E2E-BOARD-4: Phase transition to vote enables voting', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Phase Test User';

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Phase Test Team' });

    // Create a card
    const addCardButton = page.getByRole('button', { name: /add card|\+/i }).first();
    await addCardButton.click();
    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Votable card');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Try to vote in write phase (should not work or button disabled)
    const cardElement = page.getByText('Votable card');
    const voteButtonBefore = cardElement.locator('..').getByRole('button', { name: /vote|👍/i }).first();

    // Check if vote button is disabled or not present
    const isDisabledOrHidden = await voteButtonBefore.isDisabled().catch(() => true) ||
                                !(await voteButtonBefore.isVisible().catch(() => false));
    expect(isDisabledOrHidden).toBeTruthy();

    // Change phase to vote
    await page.getByRole('button', { name: /next phase|vote/i }).click();
    await page.waitForTimeout(500);

    // Verify we're in vote phase
    await expect(page.getByText(/vote|voting/i)).toBeVisible();

    // Now voting should be enabled
    const voteButton = page.getByText('Votable card').locator('..').getByRole('button', { name: /vote|👍/i }).first();
    await expect(voteButton).toBeEnabled();

    // Cast a vote
    await voteButton.click();
    await page.waitForTimeout(500);

    // Verify vote count increased
    await expect(page.getByText(/1.*vote|vote.*1/i)).toBeVisible();
  });

  test('E2E-BOARD-5: Voting toggles on/off', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Vote Toggle User';

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Vote Toggle Team' });

    // Create a card
    const addCardButton = page.getByRole('button', { name: /add card|\+/i }).first();
    await addCardButton.click();
    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Toggle vote card');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Change phase to vote
    await page.getByRole('button', { name: /next phase|vote/i }).click();
    await page.waitForTimeout(500);

    // Vote
    const voteButton = page.getByText('Toggle vote card').locator('..').getByRole('button', { name: /vote|👍/i }).first();
    await voteButton.click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/1.*vote|vote.*1/i)).toBeVisible();

    // Unvote (toggle off)
    await voteButton.click();
    await page.waitForTimeout(500);

    // Vote count should be 0 or hidden
    await expect(page.getByText(/1.*vote/i)).not.toBeVisible();
  });

  test('E2E-BOARD-6: Lock board prevents card creation', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Lock Test User';

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Lock Test Team' });

    // Lock the board (facilitator action)
    await page.getByRole('button', { name: /lock|🔒/i }).click();
    await page.waitForTimeout(500);

    // Try to add a card
    const addCardButton = page.getByRole('button', { name: /add card|\+/i }).first();

    // Button should be disabled or not clickable
    const isDisabled = await addCardButton.isDisabled().catch(() => true);
    expect(isDisabled).toBeTruthy();

    // Unlock
    await page.getByRole('button', { name: /unlock|🔓/i }).click();
    await page.waitForTimeout(500);

    // Now should be able to add card
    await expect(addCardButton).toBeEnabled();
  });

  test('E2E-BOARD-7: Create group with multiple cards', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Group Test User';

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Group Test Team' });

    // Create two cards
    const addCardButton = page.getByRole('button', { name: /add card|\+/i }).first();

    await addCardButton.click();
    await page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first().fill('Card 1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await addCardButton.click();
    await page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first().fill('Card 2');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Change to group phase
    await page.getByRole('button', { name: /next phase/i }).click(); // to vote
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /next phase/i }).click(); // to group
    await page.waitForTimeout(500);

    // Verify we're in group phase
    await expect(page.getByText(/group|grouping/i)).toBeVisible();

    // Select both cards for grouping (drag and drop or selection)
    await page.getByText('Card 1').click({ modifiers: ['Control'] });
    await page.getByText('Card 2').click({ modifiers: ['Control'] });

    // Create group
    await page.getByRole('button', { name: /create group|group/i }).click();

    // Name the group
    await page.getByPlaceholder(/group name|title/i).fill('Collaboration Wins');
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(500);

    // Verify group exists
    await expect(page.getByText('Collaboration Wins')).toBeVisible();
  });

  test('E2E-BOARD-8: Phase progression write → vote → group → discuss', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Phase Progress User';

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Phase Progress Team' });

    // Verify starting in write phase
    await expect(page.getByText(/write|writing/i)).toBeVisible();

    // Progress to vote
    await page.getByRole('button', { name: /next phase/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/vote|voting/i)).toBeVisible();

    // Progress to group
    await page.getByRole('button', { name: /next phase/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/group|grouping/i)).toBeVisible();

    // Progress to discuss
    await page.getByRole('button', { name: /next phase/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/discuss|discussion/i)).toBeVisible();
  });

  test('E2E-BOARD-9: Board created with template has correct columns', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Template Test User';

    await registerUser(page, { email, password, displayName });

    // Create team
    await page.getByRole('button', { name: /create team|new team/i }).click();
    await page.getByPlaceholder(/team name/i).fill('Template Test Team');
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(500);

    // Create sprint
    await page.getByRole('button', { name: /create sprint|new sprint/i }).click();
    await page.getByPlaceholder(/sprint name/i).fill('Sprint 1');
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(500);

    // Activate sprint
    await page.getByRole('button', { name: /activate/i }).click();
    await page.getByRole('link', { name: /board/i }).click();
    await page.getByRole('button', { name: /start retro/i }).click();

    // Select "What Went Well / Delta" template
    await page.getByText(/what went well.*delta|went well.*delta/i).click();
    await page.getByRole('button', { name: /create board|start/i }).click();
    await page.waitForTimeout(1000);

    // Verify template columns exist
    await expect(page.getByText(/what went well|went well/i)).toBeVisible();
    await expect(page.getByText(/delta|what to change/i)).toBeVisible();
  });

  test('E2E-BOARD-10: Multiple cards can be added to same column', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Multi Card User';

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Multi Card Team' });

    const addCardButton = page.getByRole('button', { name: /add card|\+/i }).first();

    // Add 3 cards
    for (let i = 1; i <= 3; i++) {
      await addCardButton.click();
      await page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first().fill(`Card ${i}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    // Verify all cards are visible
    await expect(page.getByText('Card 1')).toBeVisible();
    await expect(page.getByText('Card 2')).toBeVisible();
    await expect(page.getByText('Card 3')).toBeVisible();
  });
});
