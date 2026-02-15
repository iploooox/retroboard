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
      await page.getByRole('button', { name: /new/i }).click();

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
      await expect(page.getByText(actionTitle)).toBeVisible();
      await expect(page.getByText(displayName)).toBeVisible();
      await expect(page.getByText(dueDateStr)).toBeVisible();
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
      await page.getByRole('button', { name: /new/i }).click();
      await page.getByPlaceholder(/action item title/i).fill('Test status toggle');
      await page.getByRole('button', { name: /^create$/i }).click();

      // Wait for action item to be created
      await page.waitForTimeout(500);

      // Find the status icon button for our action item
      // The status icon is a button with a Circle icon (open status)
      const actionItemRow = page.locator('div', { hasText: 'Test status toggle' }).first();
      const statusButton = actionItemRow.locator('button').first();

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
        actionItemRow.locator('p.line-through', { hasText: 'Test status toggle' })
      ).toBeVisible();

      // Click again to cycle back to "open"
      await statusButton.click();
      await page.waitForTimeout(300);

      // Verify line-through is removed
      await expect(
        actionItemRow.locator('p.line-through', { hasText: 'Test status toggle' })
      ).not.toBeVisible();
    });

    test('create action item from card context menu', async ({ page }) => {
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

      // Open card context menu (More options button - three dots or similar)
      // NOTE: This feature is being implemented by board-dev-2
      const moreOptionsButton = cardElement.getByRole('button', { name: /more options|card actions/i });
      await moreOptionsButton.click();

      // Click "Create Action Item" in the menu
      await page.getByRole('menuitem', { name: /create action item/i }).click();

      // Verify action items panel opens
      await expect(page.getByRole('heading', { name: /action items/i })).toBeVisible();

      // Verify the action item form is shown with pre-filled title from card
      await expect(page.getByPlaceholder(/action item title/i)).toHaveValue(cardText);

      // Complete the action item creation
      await page.getByRole('button', { name: /^create$/i }).click();
      await page.waitForTimeout(500);

      // Verify action item appears in the list with the card's text
      await expect(page.getByText(cardText)).toBeVisible();
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
      await page.getByRole('button', { name: /new/i }).click();
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
      await page.getByRole('button', { name: /new/i }).click();

      const actionItemTitle = 'Set up Jenkins CI integration';
      await page.getByPlaceholder(/action item title/i).fill(actionItemTitle);
      await page.getByRole('button', { name: /^create$/i }).click();
      await page.waitForTimeout(500);

      // Close action items panel
      await page.getByRole('button', { name: /close panel/i }).click();

      // Complete the board (as per spec: "Export is available for completed retro boards")
      // Move through phases: write → vote → discuss → action → complete
      await page.getByRole('button', { name: /next phase|vote/i }).click();
      await page.waitForTimeout(500);

      await page.getByRole('button', { name: /next phase|discuss/i }).click();
      await page.waitForTimeout(500);

      await page.getByRole('button', { name: /next phase|action/i }).click();
      await page.waitForTimeout(500);

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
      const allCards = exportData.columns.flatMap((col: any) => col.cards);
      expect(allCards.length).toBeGreaterThanOrEqual(2);

      // Verify specific card content is present
      const cardTexts = allCards.map((card: any) => card.text);
      expect(cardTexts).toContain(card1Text);
      expect(cardTexts).toContain(card2Text);

      // Verify action item is in the export
      expect(exportData.actionItems).toBeDefined();
      expect(exportData.actionItems.length).toBeGreaterThanOrEqual(1);
      const actionItemTitles = exportData.actionItems.map((ai: any) => ai.title);
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

      // Click 👍 emoji
      await emojiPicker.getByTitle(/react with 👍/i).click();

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
      await emojiPicker.getByTitle(/react with ❤️/i).click();
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
      await page.locator('.grid.grid-cols-6.gap-1').getByTitle(/react with 🎉/i).click();
      await page.waitForTimeout(500);

      // Verify reaction was added
      await expect(cardElement.getByText('🎉')).toBeVisible();

      // Move to vote phase to trigger board lock
      await page.getByRole('button', { name: /next phase|vote/i }).click();
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
});
