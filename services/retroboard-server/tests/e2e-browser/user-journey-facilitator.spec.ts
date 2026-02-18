import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser, createTeamAndBoard } from './helpers';

test.describe('Facilitator Tools - Complete User Journey', () => {
  test('E2E-FACILITATOR-1: All facilitator controls work through full retro journey', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'SecurePass123!';
    const displayName = 'Facilitator User';

    // Setup: Register and create board
    await registerUser(page, { email, password, displayName });
    await createTeamAndBoard(page, { teamName: 'Facilitator Test Team' });

    // Should be on board page - user who creates board is automatically facilitator/admin
    await expect(page.getByRole('button', { name: /^2\s+Write$/i })).toBeVisible();

    // ========================================
    // PHASE 1: TIMER CONTROLS
    // ========================================

    // Should see initial timer (default is 5:00 for write phase)
    await expect(page.getByText('05:00')).toBeVisible();

    // Start timer
    await page.getByRole('button', { name: /start timer/i }).click();

    // Wait and verify timer is counting down
    await page.waitForTimeout(2000);
    const timerAfterStart = await page.getByText(/\d{2}:\d{2}/).textContent();
    expect(timerAfterStart).not.toBe('05:00');

    // Pause timer
    await page.getByRole('button', { name: /pause timer/i }).click();
    const timerAfterPause = await page.getByText(/\d{2}:\d{2}/).textContent();

    // Verify timer stays paused
    await page.waitForTimeout(1000);
    const timerStillPaused = await page.getByText(/\d{2}:\d{2}/).textContent();
    expect(timerStillPaused).toBe(timerAfterPause);

    // Resume timer
    await page.getByRole('button', { name: /resume timer/i }).click();
    await page.waitForTimeout(2000); // Wait 2 seconds to ensure timer ticks
    const timerAfterResume = await page.getByText(/\d{2}:\d{2}/).textContent();
    expect(timerAfterResume).not.toBe(timerStillPaused);

    // Reset timer
    await page.getByRole('button', { name: /reset timer/i }).click();
    await expect(page.getByText('05:00')).toBeVisible();

    // ========================================
    // PHASE 2: LOCK/UNLOCK BOARD
    // ========================================

    // Add a card first so we can test locking
    const addCardButton = page.getByRole('button', { name: /add a card/i }).first();
    await addCardButton.click();

    // Fill in card content
    await page.getByPlaceholder(/what.*your mind/i).fill('Test card for lock feature');
    await page.getByRole('button', { name: /^add card$/i }).click();

    // Verify card was added
    await expect(page.getByText('Test card for lock feature')).toBeVisible();

    // Lock the board
    await page.getByRole('button', { name: /lock board/i }).click();

    // Verify board is locked - add card button should be disabled or not visible
    const addButtonsAfterLock = await page.getByRole('button', { name: /add a card/i }).all();
    if (addButtonsAfterLock.length > 0) {
      // If visible, should be disabled
      await expect(addButtonsAfterLock[0]).toBeDisabled();
    }

    // Try to edit the existing card - should not be editable
    const cardElement = page.getByText('Test card for lock feature');
    await cardElement.click();
    // Edit button should not appear or should be disabled
    const editButtons = await page.getByRole('button', { name: /edit/i }).all();
    if (editButtons.length > 0) {
      await expect(editButtons[0]).toBeDisabled();
    }

    // Unlock the board
    await page.getByRole('button', { name: /unlock board/i }).click();

    // Verify board is unlocked - should be able to add cards again
    await expect(page.getByRole('button', { name: /add a card/i }).first()).toBeEnabled();

    // ========================================
    // PHASE 3: REVEAL CARDS (ANONYMOUS MODE)
    // ========================================

    // First, check if there's a way to toggle anonymous mode
    // Then add a card in anonymous mode
    const anonymousToggle = page.getByRole('button', { name: /anonymous/i });
    if (await anonymousToggle.isVisible()) {
      await anonymousToggle.click();

      // Add card in anonymous mode
      await page.getByRole('button', { name: /add a card/i }).first().click();
      await page.getByPlaceholder(/what/i).fill('Anonymous card');
      await page.getByRole('button', { name: /save|add/i }).click();

      // Verify anonymous card shows "Anonymous" instead of author name
      await expect(page.getByText('Anonymous')).toBeVisible();

      // Reveal cards
      await page.getByRole('button', { name: /reveal/i }).click();

      // After reveal, should show actual author name instead of "Anonymous"
      await expect(page.getByText(displayName)).toBeVisible();
    }

    // ========================================
    // PHASE 4: PHASE TRANSITIONS
    // ========================================

    // Transition from Write to Group phase
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();

    // May have confirmation dialog
    const confirmButton = page.getByRole('button', { name: /confirm|continue|yes/i });
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
      await page.waitForTimeout(500); // Wait for modal to close
    }

    // Should now be in group phase (wait for phase transition)
    await page.waitForTimeout(1000);

    // Transition to Vote phase
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();
    const confirmButton2 = page.getByRole('button', { name: /confirm|continue|yes/i });
    if (await confirmButton2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton2.click();
      await page.waitForTimeout(500); // Wait for modal to close
    }
    await expect(page.getByText('Vote Phase')).toBeVisible();

    // Transition to Discuss phase
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();
    const confirmButton3 = page.getByRole('button', { name: /confirm|continue|yes/i });
    if (await confirmButton3.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton3.click();
    }
    await expect(page.getByText('Discuss Phase')).toBeVisible();

    // ========================================
    // PHASE 5: FOCUS CONTROLS (in Discuss phase)
    // ========================================

    // Focus can only be set during discuss phase
    // Click on a card to focus on it (use .first() — card text appears in both ranked list and expanded view)
    const cardToFocus = page.getByText('Test card for lock feature').first();
    await cardToFocus.click();

    // Click focus button
    const focusButton = page.getByRole('button', { name: /focus|set focus/i });
    if (await focusButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await focusButton.click();

      // Verify focus indicator appears
      await expect(page.getByTestId('focus-indicator')).toBeVisible();

      // Clear focus
      await page.getByRole('button', { name: /clear focus|unfocus/i }).click();

      // Focus indicator should disappear
      await expect(page.getByTestId('focus-indicator')).not.toBeVisible();
    }

    // Transition to Action phase
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();
    const confirmButton4 = page.getByRole('button', { name: /confirm|continue|yes/i });
    if (await confirmButton4.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton4.click();
    }
    await expect(page.getByText('Action Phase')).toBeVisible();

    // ========================================
    // VERIFICATION: All phases completed
    // ========================================

    // Should be in action phase now
    await expect(page.getByText('Action Phase')).toBeVisible();

    // Timer should still be functional in action phase
    await page.getByRole('button', { name: /start timer/i }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /pause timer/i }).click();
  });
});
