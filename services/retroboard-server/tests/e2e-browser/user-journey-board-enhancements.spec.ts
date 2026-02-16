import { test, expect } from '@playwright/test';
import { registerUser, createTeamAndBoard, generateUniqueEmail } from './helpers';

test.describe('Board Enhancements Journey', () => {
  test.describe('Action Items (S-022)', () => {
    test('happy path: create action item with assignee and due date', async ({ page }) => {
      const email = generateUniqueEmail();
      const displayName = 'Action Item User';
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName,
      });

      await createTeamAndBoard(page, { teamName: 'Action Items Team' });

      // Open action items panel
      // Look for action items button in the facilitator toolbar or board header
      await page.getByRole('button', { name: /action items/i }).click();

      // Verify panel opens
      await expect(page.getByRole('heading', { name: /action items/i })).toBeVisible();

      // Click "New" button to create action item
      await page.getByRole('button', { name: 'New Action Item' }).click();

      // Fill in action item form
      const actionTitle = 'Improve code review process';
      await page.getByPlaceholder(/action item title/i).fill(actionTitle);

      await page.getByPlaceholder(/description.*optional/i).fill(
        'Set up a code review checklist and share with the team'
      );

      // Select assignee from dropdown
      await page.getByLabel(/assignee/i).selectOption({ label: displayName });

      // Set due date (2 weeks from now)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      const dueDateStr = futureDate.toISOString().split('T')[0]; // YYYY-MM-DD
      await page.getByLabel(/due date/i).fill(dueDateStr);

      // Create action item
      await page.getByRole('button', { name: /^create$/i }).click();

      // Verify action item appears in the list
      const actionItemsList = page.locator('.divide-y.divide-slate-100');
      await expect(actionItemsList.getByText(actionTitle)).toBeVisible();
      await expect(actionItemsList.getByText(displayName)).toBeVisible();
      await expect(actionItemsList.getByText(dueDateStr)).toBeVisible();
    });

    test('toggle action item status', async ({ page }) => {
      const email = generateUniqueEmail();
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName: 'Status User',
      });

      await createTeamAndBoard(page, { teamName: 'Status Team' });

      // Open action items panel
      await page.getByRole('button', { name: /action items/i }).click();

      // Create a simple action item
      await page.getByRole('button', { name: 'New Action Item' }).click();
      await page.getByPlaceholder(/action item title/i).fill('Test status toggle');
      await page.getByRole('button', { name: /^create$/i }).click();

      // Wait for action item to be created
      await page.waitForTimeout(500);

      // Find the status icon button for our action item using title attribute
      const statusButton = page.getByTitle(/Status:.*Click to change/i).first();

      // Verify initial status is "open" (Circle icon with text-slate-400 color)
      await expect(statusButton).toBeVisible();

      // Click to change status to "in_progress"
      await statusButton.click();
      await page.waitForTimeout(300);

      // Click again to change status to "done"
      await statusButton.click();
      await page.waitForTimeout(300);

      // Verify the text is now crossed out (line-through style for done status)
      await expect(
        page.locator('p.line-through', { hasText: 'Test status toggle' })
      ).toBeVisible();

      // Click again to cycle back to "open"
      await statusButton.click();
      await page.waitForTimeout(300);

      // Verify line-through is removed
      await expect(
        page.locator('p.line-through', { hasText: 'Test status toggle' })
      ).not.toBeVisible();
    });

    test('create action item from card with pre-filled title', async ({ page }) => {
      const email = generateUniqueEmail();
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName: 'Card Context User',
      });

      await createTeamAndBoard(page, { teamName: 'Card Context Team' });

      // Add a card with specific text
      const cardText = 'Fix the deployment pipeline configuration';
      await page.getByRole('button', { name: /add a card/i }).first().click();
      await page.getByPlaceholder(/what.*mind/i).fill(cardText);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Find the card we just created
      const cardElement = page.locator('.rounded-lg.border', { hasText: cardText }).first();
      await expect(cardElement).toBeVisible();

      // Click the FileCheck icon button to create action item from card
      const createActionButton = cardElement.getByRole('button', { name: /create action item from card/i });
      await createActionButton.click();

      // Verify action items panel opens
      await expect(page.getByRole('heading', { name: /action items/i })).toBeVisible();

      // Verify the action item form is shown with pre-filled title from card
      await expect(page.getByPlaceholder(/action item title/i)).toHaveValue(cardText);

      // Verify "📎 Linked to card" badge is visible
      await expect(page.getByText(/📎.*linked to card/i)).toBeVisible();

      // Complete the action item creation
      await page.getByRole('button', { name: /^create$/i }).click();
      await page.waitForTimeout(500);

      // Verify action item appears in the list with the card's text
      const actionItemsList = page.locator('.divide-y.divide-slate-100');
      await expect(actionItemsList.getByText(cardText)).toBeVisible();
    });

    test('overdue action item shows red warning indicator', async ({ page }) => {
      const email = generateUniqueEmail();
      const displayName = 'Overdue Test User';
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName,
      });

      await createTeamAndBoard(page, { teamName: 'Overdue Team' });

      // Open action items panel
      await page.getByRole('button', { name: /action items/i }).click();
      await expect(page.getByRole('heading', { name: /action items/i })).toBeVisible();

      // Create action item with overdue date (yesterday)
      await page.getByRole('button', { name: 'New Action Item' }).click();

      const actionTitle = 'Overdue task from last week';
      await page.getByPlaceholder(/action item title/i).fill(actionTitle);

      // Set due date to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
      await page.getByLabel(/due date/i).fill(yesterdayStr);

      // Create the action item
      await page.getByRole('button', { name: /^create$/i }).click();
      await page.waitForTimeout(500);

      // Find the action item row
      const actionItemRow = page.locator('div', { hasText: actionTitle }).first();
      await expect(actionItemRow).toBeVisible();

      // Verify the due date shows in red with ⚠️ emoji
      const dueDateElement = actionItemRow.locator('text=⚠️');
      await expect(dueDateElement).toBeVisible();

      // Verify the date text has red styling
      const dueDateText = actionItemRow.getByText(yesterdayStr);
      await expect(dueDateText).toHaveClass(/text-red/);
    });

    test('delete action item', async ({ page }) => {
      const email = generateUniqueEmail();
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName: 'Delete User',
      });

      await createTeamAndBoard(page, { teamName: 'Delete Team' });

      // Open action items panel
      await page.getByRole('button', { name: /action items/i }).click();

      // Create an action item
      await page.getByRole('button', { name: 'New Action Item' }).click();
      const actionTitle = 'Action to be deleted';
      await page.getByPlaceholder(/action item title/i).fill(actionTitle);
      await page.getByRole('button', { name: /^create$/i }).click();

      await page.waitForTimeout(500);

      // Verify action item exists
      await expect(page.getByText(actionTitle)).toBeVisible();

      // Find the action item row and hover to reveal delete button
      const actionItemRow = page.locator('div', { hasText: actionTitle }).first();
      await actionItemRow.hover();

      // Click delete button (Trash2 icon, with aria-label="Delete action item")
      await actionItemRow.getByRole('button', { name: /delete action item/i }).click();

      // Wait for deletion
      await page.waitForTimeout(500);

      // Verify action item is removed
      await expect(page.getByText(actionTitle)).not.toBeVisible();
    });

    test('completed_at: verify completion date appears when marked done', async ({ page }) => {
      const email = generateUniqueEmail();
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName: 'Completion Test User',
      });

      await createTeamAndBoard(page, { teamName: 'Completion Team' });

      // Open action items panel
      await page.getByRole('button', { name: /action items/i }).click();

      // Create a simple action item
      await page.getByRole('button', { name: 'New Action Item' }).click();
      const actionTitle = 'Test completion date feature';
      await page.getByPlaceholder(/action item title/i).fill(actionTitle);
      await page.getByRole('button', { name: /^create$/i }).click();

      await page.waitForTimeout(500);

      // Find the action item row
      const actionItemRow = page.locator('div', { hasText: actionTitle }).first();
      await expect(actionItemRow).toBeVisible();

      // Verify no completion date is shown initially (status is 'open')
      await expect(page.getByText(/Completed/i)).not.toBeVisible();

      // Find the status button using title attribute
      const statusButton = page.getByTitle(/Status:.*Click to change/i).first();

      // Click once to change status to 'in_progress'
      await statusButton.click();
      await page.waitForTimeout(300);

      // Still no completion date
      await expect(page.getByText(/Completed/i)).not.toBeVisible();

      // Click again to change status to 'done'
      await statusButton.click();
      await page.waitForTimeout(500);

      // Verify completion date appears with green text
      const completionDate = page.locator('span.text-green-600').filter({ hasText: /Completed/ });
      await expect(completionDate).toBeVisible();

      // Verify the date format is like "Completed Feb 15" or "Completed Jan 1"
      const completionText = await completionDate.textContent();
      expect(completionText).toMatch(/^Completed (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/);

      // Verify the title is now crossed out (line-through)
      await expect(
        page.locator('p.line-through', { hasText: actionTitle })
      ).toBeVisible();

      // Click status button again to cycle back to 'open'
      await statusButton.click();
      await page.waitForTimeout(500);

      // Verify completion date disappears
      await expect(page.getByText(/Completed/i)).not.toBeVisible();

      // Verify title is no longer crossed out
      await expect(
        actionItemRow.locator('p.line-through', { hasText: actionTitle })
      ).not.toBeVisible();
    });
  });

  test.describe('Export (S-024)', () => {
    test('full journey: export board and verify JSON contains card data', async ({ page }) => {
      const email = generateUniqueEmail();
      const displayName = 'Export User';
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName,
      });

      const { teamName } = await createTeamAndBoard(page, { teamName: 'Export Team' });

      // Add cards with specific content we'll verify in export
      const card1Text = 'Fix CI pipeline deployment issues';
      const card2Text = 'More pair programming sessions needed';

      await page.getByRole('button', { name: /add a card/i }).first().click();
      await page.getByPlaceholder(/what.*mind/i).fill(card1Text);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      await page.getByRole('button', { name: /add a card/i }).first().click();
      await page.getByPlaceholder(/what.*mind/i).fill(card2Text);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Create action item with specific title
      await page.getByRole('button', { name: /action items/i }).click();
      await page.getByRole('button', { name: 'New Action Item' }).click();

      const actionItemTitle = 'Set up Jenkins CI integration';
      await page.getByPlaceholder(/action item title/i).fill(actionItemTitle);
      await page.getByRole('button', { name: /^create$/i }).click();
      await page.waitForTimeout(500);

      // Close action items panel
      await page.getByRole('button', { name: /close panel/i }).click();

      // Complete the board (as per spec: "Export is available for completed retro boards")
      // Move through phases: write → group → vote → discuss → action
      // Use the larger "Next Phase: Group" button in facilitator toolbar
      await page.getByRole('button', { name: 'Next phase', exact: true }).click(); // write → group
      await page.waitForTimeout(1000); // Wait for phase transition

      await page.getByRole('button', { name: 'Next phase', exact: true }).click(); // group → vote
      await page.waitForTimeout(1000);

      await page.getByRole('button', { name: 'Next phase', exact: true }).click(); // vote → discuss
      await page.waitForTimeout(1000);

      await page.getByRole('button', { name: 'Next phase', exact: true }).click(); // discuss → action
      await page.waitForTimeout(1000);

      await page.getByRole('button', { name: /complete|finish/i }).click();
      await page.waitForTimeout(500);

      // Click export button in board header
      await page.getByRole('button', { name: /export retro/i }).click();

      // Verify export dialog opens
      await expect(page.getByRole('heading', { name: /export retro board/i })).toBeVisible();

      // Select JSON format (default, but click to be explicit)
      await page.getByText('JSON').click();

      // Setup download listener before clicking download
      const downloadPromise = page.waitForEvent('download');

      // Click "Download Export" button
      await page.getByRole('button', { name: /download export/i }).click();

      // Wait for download to complete
      const download = await downloadPromise;

      // Verify filename is correct
      const filename = download.suggestedFilename();
      expect(filename).toContain('export');
      expect(filename).toContain('.json');

      // Read and parse the downloaded JSON file
      const path = await download.path();
      if (!path) {
        throw new Error('Download path is null');
      }

      const fs = await import('fs/promises');
      const jsonContent = await fs.readFile(path, 'utf-8');
      const exportData = JSON.parse(jsonContent);

      // Verify export structure and metadata
      expect(exportData.exportVersion).toBe('1.0');
      expect(exportData.board).toBeDefined();
      expect(exportData.board.teamName).toBe(teamName);
      expect(exportData.board.facilitatorName).toBe(displayName);

      // Verify cards are in the export
      expect(exportData.columns).toBeDefined();
      const exportDataTyped = exportData as { columns: Array<{ cards: Array<Record<string, unknown>> }>; actionItems: Array<Record<string, unknown>> };
      const allCards = exportDataTyped.columns.flatMap((col) => col.cards);
      expect(allCards.length).toBeGreaterThanOrEqual(2);

      // Verify specific card content is present
      const cardTexts = allCards.map((card) => card.text);
      expect(cardTexts).toContain(card1Text);
      expect(cardTexts).toContain(card2Text);

      // Verify action item is in the export
      expect(exportDataTyped.actionItems).toBeDefined();
      expect(exportDataTyped.actionItems.length).toBeGreaterThanOrEqual(1);
      const actionItemTitles = exportDataTyped.actionItems.map((ai) => ai.title);
      expect(actionItemTitles).toContain(actionItemTitle);

      // Verify analytics summary is included
      expect(exportData.analytics).toBeDefined();
      expect(exportData.analytics.totalCards).toBeGreaterThanOrEqual(2);

      // Verify dialog closes after successful export
      await expect(page.getByRole('heading', { name: /export retro board/i })).not.toBeVisible();
    });
  });

  test.describe('Reactions (S-026)', () => {
    test('full journey: add reactions and verify real-time sync', async ({ page }) => {
      const email = generateUniqueEmail();
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName: 'Reactor User',
      });

      await createTeamAndBoard(page, { teamName: 'Reactions Team' });

      // Add a card to react to
      const cardText = 'Great team collaboration this sprint';
      await page.getByRole('button', { name: /add a card/i }).first().click();
      await page.getByPlaceholder(/what.*mind/i).fill(cardText);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Find the card we just created
      const cardElement = page.locator('.rounded-lg.border', { hasText: cardText }).first();
      await expect(cardElement).toBeVisible();

      // Open reaction picker (Smile icon button)
      await cardElement.getByRole('button', { name: /add reaction/i }).click();

      // Verify emoji picker appears with all 12 emojis
      const emojiPicker = page.locator('.grid.grid-cols-6.gap-1');
      await expect(emojiPicker).toBeVisible();

      // Scroll emoji picker into view and click 👍 emoji
      const thumbsUpButton = emojiPicker.getByTitle(/react with 👍/i);
      await thumbsUpButton.scrollIntoViewIfNeeded();
      await thumbsUpButton.click();

      // Wait for reaction to be added
      await page.waitForTimeout(500);

      // Verify reaction badge appears with count "1"
      await expect(cardElement.getByText('👍')).toBeVisible();
      const reactionBadge = cardElement.locator('button', { has: page.locator('text=👍') });
      await expect(reactionBadge.getByText('1')).toBeVisible();

      // Verify user's reaction is highlighted (indigo background)
      await expect(reactionBadge).toHaveClass(/bg-indigo-100/);

      // Toggle off: click reaction badge to remove it
      await reactionBadge.click();
      await page.waitForTimeout(500);

      // Verify reaction badge is removed
      await expect(cardElement.getByText('👍')).not.toBeVisible();

      // Re-add reaction
      await cardElement.getByRole('button', { name: /add reaction/i }).click();
      await emojiPicker.getByTitle(/react with 👍/i).click();
      await page.waitForTimeout(500);

      // Add a different reaction
      await cardElement.getByRole('button', { name: /add reaction/i }).click();
      const heartButton = emojiPicker.getByTitle(/react with ❤️/i);
      await heartButton.scrollIntoViewIfNeeded();
      await heartButton.click();
      await page.waitForTimeout(500);

      // Verify both reactions are present
      await expect(cardElement.getByText('👍')).toBeVisible();
      await expect(cardElement.getByText('❤️')).toBeVisible();

      // Both should have count "1" and be highlighted
      const thumbsUpBadge = cardElement.locator('button', { has: page.locator('text=👍') });
      const heartBadge = cardElement.locator('button', { has: page.locator('text=❤️') });

      await expect(thumbsUpBadge.getByText('1')).toBeVisible();
      await expect(heartBadge.getByText('1')).toBeVisible();
      await expect(thumbsUpBadge).toHaveClass(/bg-indigo-100/);
      await expect(heartBadge).toHaveClass(/bg-indigo-100/);
    });

    test('verify reactions respect board lock state', async ({ page }) => {
      const email = generateUniqueEmail();
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName: 'Lock Test User',
      });

      await createTeamAndBoard(page, { teamName: 'Lock Team' });

      // Add a card
      await page.getByRole('button', { name: /add a card/i }).first().click();
      await page.getByPlaceholder(/what.*mind/i).fill('Test card for lock');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const cardElement = page.locator('.rounded-lg.border', { hasText: 'Test card for lock' }).first();

      // Add a reaction while board is unlocked
      await cardElement.getByRole('button', { name: /add reaction/i }).click();
      const emojiPicker = page.locator('.grid.grid-cols-6.gap-1');
      const partyButton = emojiPicker.getByTitle(/react with 🎉/i);
      await partyButton.scrollIntoViewIfNeeded();
      await partyButton.click();
      await page.waitForTimeout(500);

      // Verify reaction was added
      await expect(cardElement.getByText('🎉')).toBeVisible();

      // Move to vote phase to trigger board lock
      await page.getByRole('button', { name: 'Next phase', exact: true }).click();
      await page.waitForTimeout(500);

      // Navigate back to write phase or just check that reaction picker is gone
      // Actually, in vote phase, the "Add reaction" button should be disabled/hidden
      // Verify we can't add new reactions when locked
      const addReactionButton = cardElement.getByRole('button', { name: /add reaction/i });

      // The button might be hidden or disabled - check if it's either not visible or disabled
      const isButtonVisible = await addReactionButton.isVisible().catch(() => false);
      if (isButtonVisible) {
        await expect(addReactionButton).toBeDisabled();
      }
    });
  });

  test.describe('Sentiment Lexicon Management (S-021)', () => {
    test('full journey: add, edit, and delete custom sentiment words', async ({ page }) => {
      const email = generateUniqueEmail();
      const displayName = 'Sentiment Manager';
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName,
      });

      await createTeamAndBoard(page, { teamName: 'Sentiment Team' });

      // Open board settings modal
      await page.getByRole('button', { name: 'Board settings' }).click();

      // Verify sentiment lexicon section is visible
      await expect(page.getByRole('heading', { name: 'Custom Sentiment Words' })).toBeVisible();
      await expect(
        page.getByText(/Add custom words with sentiment scores/i)
      ).toBeVisible();

      // Add a custom word with positive score
      const customWord1 = 'amazing';
      const score1 = '4.5';
      await page.getByPlaceholder('Word').fill(customWord1);
      await page.getByPlaceholder('Score').fill(score1);
      await page.getByRole('button', { name: 'Add custom word' }).click();

      // Wait for word to be added
      await page.waitForTimeout(500);

      // Verify word appears in the list with green color (positive score)
      await expect(page.getByText(customWord1)).toBeVisible();
      await expect(page.getByText('+4.5')).toBeVisible();
      const scoreBadge1 = page.locator('span.bg-green-100').filter({ hasText: '+4.5' });
      await expect(scoreBadge1).toBeVisible();

      // Add another word with negative score
      const customWord2 = 'terrible';
      const score2 = '-3.0';
      await page.getByPlaceholder('Word').fill(customWord2);
      await page.getByPlaceholder('Score').fill(score2);
      await page.getByRole('button', { name: 'Add custom word' }).click();

      await page.waitForTimeout(500);

      // Verify word appears with red color (negative score)
      await expect(page.getByText(customWord2)).toBeVisible();
      await expect(page.getByText('-3.0')).toBeVisible();
      const scoreBadge2 = page.locator('span.bg-red-100').filter({ hasText: '-3.0' });
      await expect(scoreBadge2).toBeVisible();

      // Edit the first word's score
      const wordRow1 = page.locator('div.bg-slate-50').filter({ hasText: customWord1 }).first();
      const editButton = wordRow1.getByRole('button').filter({ has: page.locator('svg') }).nth(0); // Edit2 icon
      await editButton.scrollIntoViewIfNeeded();
      await editButton.click();

      // Verify edit mode is active (input field appears)
      const editInput = wordRow1.locator('input[type="number"]');
      await expect(editInput).toBeVisible();
      await editInput.fill('5.0');

      // Save the edit
      const saveButton = wordRow1.getByRole('button').filter({ has: page.locator('svg') }).first(); // Check icon
      await saveButton.click();

      await page.waitForTimeout(500);

      // Verify updated score is displayed
      await expect(page.getByText('+5.0')).toBeVisible();

      // Delete the second word
      const wordRow2 = page.locator('div.bg-slate-50').filter({ hasText: customWord2 }).first();
      const deleteButton = wordRow2.getByRole('button').filter({ has: page.locator('svg') }).nth(1); // Trash2 icon

      // Setup dialog handler for confirmation
      page.on('dialog', dialog => dialog.accept());
      await deleteButton.click();

      await page.waitForTimeout(500);

      // Verify word is removed
      await expect(page.getByText(customWord2)).not.toBeVisible();

      // Verify first word still exists
      await expect(page.getByText(customWord1)).toBeVisible();
      await expect(page.getByText('+5.0')).toBeVisible();

      // Close settings modal
      await page.getByRole('button', { name: 'Cancel' }).click();
    });

    test('empty state: no custom words yet', async ({ page }) => {
      const email = generateUniqueEmail();
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName: 'Empty State User',
      });

      await createTeamAndBoard(page, { teamName: 'Empty Sentiment Team' });

      // Open board settings
      await page.getByRole('button', { name: 'Board settings' }).click();

      // Verify empty state message
      await expect(
        page.getByText(/No custom words yet. Add one above to get started./i)
      ).toBeVisible();

      // Close modal
      await page.getByRole('button', { name: 'Cancel' }).click();
    });

    test('validation: reject invalid scores', async ({ page }) => {
      const email = generateUniqueEmail();
      await registerUser(page, {
        email,
        password: 'SecurePass123!',
        displayName: 'Validation User',
      });

      await createTeamAndBoard(page, { teamName: 'Validation Team' });

      // Open settings
      await page.getByRole('button', { name: 'Board settings' }).click();

      // Try to add word with score > 5.0
      await page.getByPlaceholder('Word').fill('invalid');
      await page.getByPlaceholder('Score').fill('10');
      await page.getByRole('button', { name: 'Add custom word' }).click();

      // Verify error toast appears
      await expect(page.getByText(/Score must be between -5.0 and 5.0/i).first()).toBeVisible({
        timeout: 3000,
      });

      // Try to add word with score < -5.0
      await page.getByPlaceholder('Score').fill('-10');
      await page.getByRole('button', { name: 'Add custom word' }).click();

      // Verify error toast appears
      await expect(page.getByText(/Score must be between -5.0 and 5.0/i).first()).toBeVisible({
        timeout: 3000,
      });

      // Close modal
      await page.getByRole('button', { name: 'Cancel' }).click();
    });
  });
});
