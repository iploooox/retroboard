import { test, expect } from '@playwright/test';
import { generateUniqueEmail, registerUser, createTeamAndBoard } from './helpers';

test.describe.serial('User Journey: Analytics and Export', () => {
  let email: string;
  let password: string;
  let displayName: string;
  let teamId: string;
  let sprintId: string;
  let boardId: string;

  test.beforeAll(() => {
    email = generateUniqueEmail();
    password = 'SecurePass123!';
    displayName = 'Analytics Test User';
  });

  test('ANALYTICS-1: Register and create team with board', async ({ page }) => {
    // Register user
    await registerUser(page, { email, password, displayName });

    // Verify we're authenticated
    expect(page.url()).toContain('/dashboard');

    // Create team and board
    const { teamName } = await createTeamAndBoard(page, { teamName: 'Analytics Team' });
    expect(teamName).toBe('Analytics Team');

    // Extract teamId, sprintId, and boardId from page state
    const ids = await page.evaluate(() => {
      // Get teamId and sprintId from URL
      const url = window.location.href;
      const urlMatch = url.match(/\/teams\/([^/]+)\/sprints\/([^/]+)\/board/);

      // Get boardId from Zustand store if available
      let boardId = null;
      try {
        const boardStorage = localStorage.getItem('board-storage');
        if (boardStorage) {
          const parsed = JSON.parse(boardStorage);
          boardId = parsed?.state?.board?.id || null;
        }
      } catch {
        // Ignore parsing errors
      }

      return {
        teamId: urlMatch?.[1] || null,
        sprintId: urlMatch?.[2] || null,
        boardId,
      };
    });

    expect(ids.teamId).toBeTruthy();
    expect(ids.sprintId).toBeTruthy();
    expect(ids.boardId).toBeTruthy();

    teamId = ids.teamId!;
    sprintId = ids.sprintId!;
    boardId = ids.boardId!;
  });

  test('ANALYTICS-2: Add cards with content for analytics', async ({ page }) => {
    // Wait for board to be loaded
    await expect(page.getByText(/what went well|went well|positive/i)).toBeVisible();

    // Add multiple cards to different columns
    const addButtons = await page.getByRole('button', { name: /add card|\+/i }).all();
    expect(addButtons.length).toBeGreaterThan(0);

    // Card 1 - Positive column
    await addButtons[0].click();
    await page.getByPlaceholder(/what.*your mind/i).fill('Great collaboration on the API design');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Great collaboration on the API design')).toBeVisible();

    // Card 2 - Negative/Improvement column
    await addButtons[1].click();
    await page.getByPlaceholder(/what.*your mind/i).fill('Need better documentation');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Need better documentation')).toBeVisible();

    // Card 3 - Action items column
    await addButtons[2].click();
    await page.getByPlaceholder(/what.*your mind/i).fill('Update testing guidelines');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Update testing guidelines')).toBeVisible();

    // Wait for cards to be saved
    await page.waitForTimeout(500);
  });

  test('ANALYTICS-3: Advance to vote phase and add votes', async ({ page }) => {
    // Move to group phase
    await page.getByRole('button', { name: /next phase|group/i }).click();
    await page.getByRole('button', { name: /confirm|yes|proceed/i }).click();
    await page.waitForTimeout(500);

    // Move to vote phase
    await page.getByRole('button', { name: /next phase|vote/i }).click();
    await page.getByRole('button', { name: /confirm|yes|proceed/i }).click();
    await page.waitForTimeout(500);

    // Vote on cards
    const voteButtons = await page.getByRole('button', { name: /vote|\+1/i }).all();
    if (voteButtons.length > 0) {
      await voteButtons[0].click();
      await page.waitForTimeout(300);
    }
    if (voteButtons.length > 1) {
      await voteButtons[1].click();
      await page.waitForTimeout(300);
    }
  });

  test('ANALYTICS-4: Advance to action phase and create action items', async ({ page }) => {
    // Move to discuss phase
    await page.getByRole('button', { name: /next phase|discuss/i }).click();
    await page.getByRole('button', { name: /confirm|yes|proceed/i }).click();
    await page.waitForTimeout(500);

    // Move to action phase
    await page.getByRole('button', { name: /next phase|action/i }).click();
    await page.getByRole('button', { name: /confirm|yes|proceed/i }).click();
    await page.waitForTimeout(500);

    // Open action items panel
    await page.getByRole('button', { name: /action items/i }).click();
    await page.waitForTimeout(300);

    // Create action item
    await page.getByPlaceholder(/action item|new action/i).fill('Review and improve documentation');
    await page.getByRole('button', { name: /add action|create/i }).click();
    await page.waitForTimeout(500);

    // Verify action item appears
    await expect(page.getByText('Review and improve documentation')).toBeVisible();
  });

  test('ANALYTICS-5: Fetch sprint analytics via API', async ({ page }) => {
    // Use the browser's configured API client which already has auth token
    const response = await page.evaluate(
      async (sprintId) => {
        // Import the api helper from the frontend
        const res = await fetch(`/api/v1/sprints/${sprintId}/analytics`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies if used
        });
        const data = await res.json();
        return { status: res.status, data };
      },
      sprintId
    );

    // Verify response structure
    expect(response.status).toBe(200);
    expect(response.data).toBeTruthy();

    // Verify analytics data structure
    const analytics = response.data;
    expect(analytics).toHaveProperty('sprintId');
    expect(analytics.sprintId).toBe(sprintId);
    expect(analytics).toHaveProperty('totalCards');
    expect(analytics.totalCards).toBeGreaterThan(0);
    expect(analytics).toHaveProperty('totalVotes');
    expect(analytics).toHaveProperty('cardsByColumn');
    expect(analytics).toHaveProperty('participationRate');
  });

  test('ANALYTICS-6: Export board as JSON', async ({ page, context }) => {
    // Fetch JSON export via API
    const content = await page.evaluate(
      async (boardId) => {
        const res = await fetch(`/api/v1/boards/${boardId}/export?format=json`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        return { status: res.status, text: await res.text() };
      },
      boardId
    );

    expect(content.status).toBe(200);

    const exportData = JSON.parse(content.text);
    expect(exportData).toHaveProperty('board');
    expect(exportData.board).toHaveProperty('id', boardId);
    expect(exportData).toHaveProperty('columns');
    expect(exportData.columns.length).toBeGreaterThan(0);
    expect(exportData).toHaveProperty('cards');
    expect(exportData.cards.length).toBeGreaterThan(0);
    expect(exportData).toHaveProperty('analytics');
    expect(exportData).toHaveProperty('actionItems');

    // Verify card content is in export
    const cardContents = exportData.cards.map((c: any) => c.content);
    expect(cardContents).toContain('Great collaboration on the API design');
    expect(cardContents).toContain('Need better documentation');
  });

  test('ANALYTICS-7: Export board as Markdown', async ({ page }) => {
    // Fetch markdown export
    const content = await page.evaluate(
      async (boardId) => {
        const res = await fetch(`/api/v1/boards/${boardId}/export?format=markdown`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        return await res.text();
      },
      boardId
    );

    // Verify markdown structure
    expect(content).toContain('#'); // Should have markdown headers
    expect(content).toContain('Great collaboration on the API design');
    expect(content).toContain('Need better documentation');
    expect(content).toContain('Update testing guidelines');
    expect(content).toContain('Analytics'); // Should include analytics section
    expect(content).toContain('Action Items'); // Should include action items section
  });

  test('ANALYTICS-8: Export board as HTML', async ({ page }) => {
    // Fetch HTML export
    const content = await page.evaluate(
      async (boardId) => {
        const res = await fetch(`/api/v1/boards/${boardId}/export?format=html`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        return await res.text();
      },
      boardId
    );

    // Verify HTML structure
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<html');
    expect(content).toContain('Great collaboration on the API design');
    expect(content).toContain('Need better documentation');
    expect(content).toContain('Update testing guidelines');
  });

  test('ANALYTICS-9: Verify action items can be listed', async ({ page }) => {
    // Open action items panel if not already open
    const actionItemsButton = page.getByRole('button', { name: /action items/i });
    await actionItemsButton.click();
    await page.waitForTimeout(300);

    // Verify action item is visible
    await expect(page.getByText('Review and improve documentation')).toBeVisible();

    // Check for completion checkbox/button
    const actionItemElement = page.locator('text=Review and improve documentation').locator('..');
    expect(await actionItemElement.isVisible()).toBeTruthy();
  });

  test('ANALYTICS-10: Verify action item completion toggle', async ({ page }) => {
    // Find and click the completion toggle for the action item
    const actionItemRow = page.locator('text=Review and improve documentation').locator('..');
    const checkbox = actionItemRow.locator('input[type="checkbox"], button').first();

    if (await checkbox.isVisible()) {
      // Get initial state
      const initialChecked = await checkbox.isChecked().catch(() => false);

      // Toggle completion
      await checkbox.click();
      await page.waitForTimeout(500);

      // Verify state changed (if checkbox)
      if (await checkbox.getAttribute('type') === 'checkbox') {
        const newChecked = await checkbox.isChecked();
        expect(newChecked).not.toBe(initialChecked);
      }
    }
  });

  test('ANALYTICS-11: Fetch team analytics endpoints', async ({ page }) => {
    // Test team-level analytics endpoints
    const healthResponse = await page.evaluate(
      async (teamId) => {
        const res = await fetch(`/api/v1/teams/${teamId}/analytics/health`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        return { status: res.status, data: await res.json() };
      },
      teamId
    );

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.data).toBeTruthy();

    // Test participation analytics
    const participationResponse = await page.evaluate(
      async ({ teamId, sprintId }) => {
        const res = await fetch(
          `/api/v1/teams/${teamId}/analytics/participation?sprintId=${sprintId}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          }
        );
        return { status: res.status, data: await res.json() };
      },
      { teamId, sprintId }
    );

    expect(participationResponse.status).toBe(200);
    expect(participationResponse.data).toBeTruthy();

    // Test word cloud analytics
    const wordCloudResponse = await page.evaluate(
      async ({ teamId, sprintId }) => {
        const res = await fetch(
          `/api/v1/teams/${teamId}/analytics/word-cloud?sprintId=${sprintId}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          }
        );
        return { status: res.status, data: await res.json() };
      },
      { teamId, sprintId }
    );

    expect(wordCloudResponse.status).toBe(200);
    expect(wordCloudResponse.data).toBeTruthy();
  });
});
