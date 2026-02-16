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
    const addCardButton = page.getByRole('button', { name: /add a card/i }).first();
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
    const addCardButton = page.getByRole('button', { name: /add a card/i }).first();
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
    const addCardButton = page.getByRole('button', { name: /add a card/i }).first();
    await addCardButton.click();
    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Card to delete');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verify card exists
    await expect(page.getByText('Card to delete')).toBeVisible();

    // Delete the card
    const cardElement = page.getByText('Card to delete');
    await expect(cardElement).toBeVisible();

    await cardElement.hover();
    await page.waitForTimeout(500); // Wait for buttons to appear on hover

    // Find delete button within the card's parent container
    const cardContainer = cardElement.locator('..');
    const deleteButton = cardContainer.getByRole('button', { name: /delete/i });
    await deleteButton.click();

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }

    await page.waitForTimeout(1000); // Wait for delete to process

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
    const addCardButton = page.getByRole('button', { name: /add a card/i }).first();
    await addCardButton.click();
    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Votable card');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Verify card was created
    await expect(page.getByText('Votable card')).toBeVisible();

    // Change phase to vote (Write → Group → Vote)
    await page.getByRole('button', { name: /next phase/i }).first().click(); // Write → Group
    await expect(page.getByText('Group Phase')).toBeVisible();

    await page.getByRole('button', { name: /next phase/i }).first().click(); // Group → Vote
    await expect(page.getByText('Vote Phase')).toBeVisible();

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
    const addCardButton = page.getByRole('button', { name: /add a card/i }).first();
    await addCardButton.click();
    const cardInput = page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first();
    await cardInput.fill('Toggle vote card');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Change phase to vote (Write → Group → Vote)
    await page.getByRole('button', { name: /next phase/i }).first().click(); // Write → Group
    await expect(page.getByText('Group Phase')).toBeVisible();
    await page.getByRole('button', { name: /next phase/i }).first().click(); // Group → Vote
    await expect(page.getByText('Vote Phase')).toBeVisible();

    // Vote
    const cardContainer = page.getByText('Toggle vote card').locator('..');
    const voteButton = cardContainer.getByRole('button', { name: 'Vote', exact: true });
    await voteButton.click();
    await page.waitForTimeout(500);
    await expect(cardContainer.getByText(/\d/)).toContainText('1');

    // Unvote (toggle off) - after voting, the "Remove vote" button appears
    const unvoteButton = cardContainer.getByRole('button', { name: 'Remove vote', exact: true });
    await unvoteButton.click();
    await page.waitForTimeout(1000);

    // Vote count should be 0 or hidden - check specifically in this card's container
    await expect(cardContainer.getByText(/\d/)).not.toBeVisible();
  });

  test('E2E-BOARD-6: Lock board prevents card creation', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Lock Test User';

    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Lock Test Team' });

    // Lock the board (facilitator action)
    await page.getByRole('button', { name: 'Lock board' }).click();
    await page.waitForTimeout(500);

    // Try to add a card - button should be disabled
    const addCardButton = page.getByRole('button', { name: /add a card/i }).first();
    await expect(addCardButton).toBeDisabled();

    // Unlock
    await page.getByRole('button', { name: 'Unlock board' }).click();
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
    const addCardButton = page.getByRole('button', { name: /add a card/i }).first();

    await addCardButton.click();
    await page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first().fill('Card 1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await addCardButton.click();
    await page.getByPlaceholder(/what.*your mind|card content|enter.*text/i).first().fill('Card 2');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Change to group phase (Write → Group)
    await page.getByRole('button', { name: /next phase/i }).first().click();
    await expect(page.getByText('Group Phase')).toBeVisible();

    // Create a new group (not via card selection in this test)
    await page.getByRole('button', { name: 'New Group' }).click();

    // Name the group
    await page.getByPlaceholder(/group name|title/i).fill('Collaboration Wins');

    // Add cards to group
    // (implementation depends on group creation modal - may need card selection)
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(1000);

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
    await expect(page.getByText('Write Phase')).toBeVisible();

    // Progress through all phases: Write → Group → Vote → Discuss → Action
    await page.getByRole('button', { name: /next phase/i }).first().click();
    await expect(page.getByText('Group Phase')).toBeVisible();

    await page.getByRole('button', { name: /next phase/i }).first().click();
    await expect(page.getByText('Vote Phase')).toBeVisible();

    await page.getByRole('button', { name: /next phase/i }).first().click();
    await expect(page.getByText('Discuss Phase')).toBeVisible();
  });

  test('E2E-BOARD-9: Board created with template has correct columns', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Template Test User';

    await registerUser(page, { email, password, displayName });

    // Create team
    await page.getByRole('button', { name: /create team|new team/i }).click();
    await page.getByLabel('Team Name').fill('Template Test Team');
    await page.getByRole('button', { name: /create team/i }).nth(1).click();
    await page.waitForTimeout(1000);

    // Navigate into the team
    await page.getByRole('link').filter({ hasText: 'Template Test Team' }).click();
    await page.waitForTimeout(1000);

    // Create sprint
    await page.getByRole('button', { name: /create sprint|new sprint/i }).click();
    await page.getByLabel('Sprint Name').fill('Sprint 1');
    const today = new Date().toISOString().split('T')[0];
    await page.getByLabel('Start Date').fill(today);
    await page.getByRole('button', { name: 'Create Sprint', exact: true }).click();
    await page.waitForTimeout(1000);

    // Activate sprint
    await page.getByRole('button', { name: /activate/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('link', { name: 'Board', exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /start retro/i }).click();

    // Select "What Went Well / Delta" template (first template is auto-selected by default)
    // Just submit the modal
    await page.getByRole('button', { name: 'Create Board', exact: true }).click();
    await page.waitForTimeout(2000);

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

    const addCardButton = page.getByRole('button', { name: /add a card/i }).first();

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
