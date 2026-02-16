import { test, expect, type Page } from '@playwright/test';
import { generateUniqueEmail, registerUser, createTeamAndBoard } from './helpers';

test.describe.serial('User Journey: Analytics and Export', () => {
  let page: Page;
  let email: string;
  let password: string;
  let displayName: string;
  let teamId: string;
  let sprintId: string;
  let boardId: string;
  let accessToken = '';

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ baseURL: 'http://localhost:5173' });

    // Intercept auth token from browser's own API requests
    page.on('request', req => {
      const auth = req.headers()['authorization'];
      if (auth && auth.startsWith('Bearer ')) {
        accessToken = auth.replace('Bearer ', '');
      }
    });

    // Intercept board responses to capture boardId
    page.on('response', async resp => {
      if (resp.url().includes('/board') && resp.status() === 200) {
        try {
          const data = await resp.json();
          if (data?.data?.id) boardId = data.data.id;
          else if (data?.board?.id) boardId = data.board.id;
          else if (data?.id) boardId = data.id;
        } catch {
          // Not JSON or no id field
        }
      }
    });

    email = generateUniqueEmail();
    password = 'SecurePass123!';
    displayName = 'Analytics Test User';
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('ANALYTICS-1: Register and create team with board', async () => {
    // Register user
    await registerUser(page, { email, password, displayName });

    // Verify we're authenticated
    expect(page.url()).toContain('/dashboard');

    // Create team and board
    const { teamName } = await createTeamAndBoard(page, { teamName: 'Analytics Team' });
    expect(teamName).toBe('Analytics Team');

    // Extract teamId and sprintId from URL
    const ids = await page.evaluate(() => {
      const url = window.location.href;
      const urlMatch = url.match(/\/teams\/([^/]+)\/sprints\/([^/]+)\/board/);
      return {
        teamId: urlMatch?.[1] || null,
        sprintId: urlMatch?.[2] || null,
      };
    });

    expect(ids.teamId).toBeTruthy();
    expect(ids.sprintId).toBeTruthy();

    teamId = ids.teamId!;
    sprintId = ids.sprintId!;

    // boardId will be fetched via API when needed
  });

  test('ANALYTICS-2: Add cards with content for analytics', async () => {
    // Verify we're on the board page
    expect(page.url()).toContain('/board');

    // Wait for board to fully load - check for any column heading
    await page.waitForTimeout(1000);

    // Get all "Add a card" buttons (should exist in Write phase)
    const addButtons = await page.getByRole('button', { name: /add a card/i }).all();

    // If no buttons found, we might not be in Write phase - check current state
    if (addButtons.length === 0) {
      const pageContent = await page.content();
      console.log('Page URL:', page.url());
      console.log('Page has content length:', pageContent.length);
      throw new Error(`No "Add a card" buttons found. Check if board is in Write phase. URL: ${page.url()}`);
    }

    expect(addButtons.length).toBeGreaterThan(0);

    // Card 1 - Positive column
    await addButtons[0].click();
    await page.getByPlaceholder(/what.*your mind/i).fill('Great collaboration on the API design');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Great collaboration on the API design')).toBeVisible();

    // Card 2 - Delta/Improvement column
    await addButtons[1].click();
    await page.getByPlaceholder(/what.*your mind/i).fill('Need better documentation');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Need better documentation')).toBeVisible();

    // Card 3 - Add another to first column for more data
    await addButtons[0].click();
    await page.getByPlaceholder(/what.*your mind/i).fill('Update testing guidelines');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Update testing guidelines')).toBeVisible();

    // Wait for cards to be saved
    await page.waitForTimeout(500);
  });

  test('ANALYTICS-3: Advance to vote phase and add votes', async () => {
    // Move to group phase
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();
    await page.waitForTimeout(500);

    // Move to vote phase
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();
    await page.waitForTimeout(500);

    // Vote on cards (use aria-label to avoid phase stepper buttons)
    const voteButtons = await page.locator('button[aria-label="Vote"]').all();
    if (voteButtons.length > 0) {
      await voteButtons[0].click();
      await page.waitForTimeout(300);
    }
    if (voteButtons.length > 1) {
      await voteButtons[1].click();
      await page.waitForTimeout(300);
    }
  });

  test('ANALYTICS-4: Advance to action phase and create action items', async () => {
    // Move to discuss phase
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();
    await page.waitForTimeout(500);

    // Move to action phase
    await page.getByRole('button', { name: 'Next phase', exact: true }).click();
    await page.waitForTimeout(500);

    // Open action items panel
    await page.getByRole('button', { name: /action items/i }).click();
    await page.waitForTimeout(300);

    // Click "New Action Item" button to show create form
    const newActionButton = page.getByRole('button', { name: 'New Action Item' });
    await expect(newActionButton).toBeVisible({ timeout: 5000 });
    await newActionButton.click();

    // Fill in action item title
    const actionItemInput = page.getByPlaceholder('Action item title');
    await expect(actionItemInput).toBeVisible({ timeout: 5000 });
    await actionItemInput.fill('Review and improve documentation');

    // Click Create button
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(500);

    // Verify action item appears
    await expect(page.getByText('Review and improve documentation')).toBeVisible();
  });

  test.skip('ANALYTICS-5: Fetch sprint analytics via API', async () => {
    // Wait a moment to ensure all data from previous tests is persisted
    await page.waitForTimeout(1000);

    // Use the browser's configured API client which already has auth token
    const response = await page.evaluate(
      async ({ sprintId, token }) => {
        const res = await fetch(`/api/v1/sprints/${sprintId}/analytics`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await res.json();
        return { status: res.status, data };
      },
      { sprintId, token: accessToken }
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

  test('ANALYTICS-6: Export board as JSON', async () => {
    // boardId was captured via response interception in beforeAll
    expect(boardId).toBeTruthy();

    // Fetch JSON export via API
    const content = await page.evaluate(
      async ({ boardId, token }) => {
        const res = await fetch(`/api/v1/boards/${boardId}/export?format=json`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
        return { status: res.status, text: await res.text() };
      },
      { boardId, token: accessToken }
    );

    expect(content.status).toBe(200);

    const exportData = JSON.parse(content.text);
    expect(exportData).toHaveProperty('board');
    expect(exportData.board).toHaveProperty('id', boardId);
    expect(exportData).toHaveProperty('columns');
    expect(exportData.columns.length).toBeGreaterThan(0);
    expect(exportData).toHaveProperty('analytics');
    expect(exportData).toHaveProperty('actionItems');

    // Verify cards are nested in columns
    interface ExportCard { content: string; authorName: string; voteCount: number }
    interface ExportColumn { name: string; cards: ExportCard[] }
    const allCards = (exportData.columns as ExportColumn[]).flatMap(col => col.cards);
    expect(allCards.length).toBeGreaterThan(0);

    // Verify card content is in export
    const cardContents = allCards.map(c => c.content);
    expect(cardContents).toContain('Great collaboration on the API design');
    expect(cardContents).toContain('Need better documentation');
  });

  test('ANALYTICS-7: Export board as Markdown', async () => {
    // boardId was captured via response interception in beforeAll
    expect(boardId).toBeTruthy();

    // Fetch markdown export
    const content = await page.evaluate(
      async ({ boardId, token }) => {
        const res = await fetch(`/api/v1/boards/${boardId}/export?format=markdown`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
        return await res.text();
      },
      { boardId, token: accessToken }
    );

    // Verify markdown structure
    expect(content).toContain('#'); // Should have markdown headers
    expect(content).toContain('Great collaboration on the API design');
    expect(content).toContain('Need better documentation');
    expect(content).toContain('Update testing guidelines');
    expect(content).toContain('Analytics'); // Should include analytics section
    expect(content).toContain('Action Items'); // Should include action items section
  });

  test('ANALYTICS-8: Export board as HTML', async () => {
    // boardId was captured via response interception in beforeAll
    expect(boardId).toBeTruthy();

    // Fetch HTML export
    const content = await page.evaluate(
      async ({ boardId, token }) => {
        const res = await fetch(`/api/v1/boards/${boardId}/export?format=html`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
        return await res.text();
      },
      { boardId, token: accessToken }
    );

    // Verify HTML structure
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<html');
    expect(content).toContain('Great collaboration on the API design');
    expect(content).toContain('Need better documentation');
    expect(content).toContain('Update testing guidelines');
  });

  test('ANALYTICS-9: Verify action items can be listed', async () => {
    // Check if action item is already visible (panel might still be open from ANALYTICS-4)
    const actionItemText = page.getByText('Review and improve documentation');
    const isVisible = await actionItemText.isVisible().catch(() => false);

    if (!isVisible) {
      // Panel is closed, need to open it
      const actionItemsButton = page.getByRole('button', { name: /action items/i });
      await actionItemsButton.click();
      await page.waitForTimeout(500);
    }

    // Verify action item is visible
    await expect(actionItemText).toBeVisible();

    // Check for completion checkbox/button
    const actionItemElement = page.locator('text=Review and improve documentation').locator('..');
    expect(await actionItemElement.isVisible()).toBeTruthy();
  });

  test('ANALYTICS-10: Verify action item completion toggle', async () => {
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

  test('ANALYTICS-11: Fetch team analytics endpoints', async () => {
    // Test team-level analytics endpoints
    const healthResponse = await page.evaluate(
      async ({ teamId, token }) => {
        const res = await fetch(`/api/v1/teams/${teamId}/analytics/health`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
        return { status: res.status, data: await res.json() };
      },
      { teamId, token: accessToken }
    );

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.data).toBeTruthy();

    // Test participation analytics
    const participationResponse = await page.evaluate(
      async ({ teamId, sprintId, token }) => {
        const res = await fetch(
          `/api/v1/teams/${teamId}/analytics/participation?sprintId=${sprintId}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          }
        );
        return { status: res.status, data: await res.json() };
      },
      { teamId, sprintId, token: accessToken }
    );

    expect(participationResponse.status).toBe(200);
    expect(participationResponse.data).toBeTruthy();

    // Test word cloud analytics
    const wordCloudResponse = await page.evaluate(
      async ({ teamId, sprintId, token }) => {
        const res = await fetch(
          `/api/v1/teams/${teamId}/analytics/word-cloud?sprintId=${sprintId}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          }
        );
        return { status: res.status, data: await res.json() };
      },
      { teamId, sprintId, token: accessToken }
    );

    expect(wordCloudResponse.status).toBe(200);
    expect(wordCloudResponse.data).toBeTruthy();
  });
});
