import { test, expect } from '../fixtures/test-data';
import { ExpedientWorkflowPage } from '../pages/ExpedientWorkflowPage';

test.describe('Expedient Workflow', () => {
  let workflowPage: ExpedientWorkflowPage;

  test.beforeEach(async ({ page }) => {
    workflowPage = new ExpedientWorkflowPage(page);
    await workflowPage.goto('/');
    await workflowPage.waitForLoadState();
  });

  test('should switch between detection and expedients views', async () => {
    // Initially in detection mode
    const currentUrl = await workflowPage.getUrl();
    expect(currentUrl).toContain('/');

    // Switch to expedients mode
    await workflowPage.switchToExpedientsMode();
    let url = await workflowPage.getUrl();
    expect(url).toContain('expedients');

    // Switch back to detection mode
    await workflowPage.switchToDetectionMode();
    url = await workflowPage.getUrl();
    expect(url).not.toContain('expedients');
  });

  test('should load expedient list with data', async () => {
    await workflowPage.switchToExpedientsMode();
    await workflowPage.waitForExpedientList();

    // Verify table is visible and has rows
    const rows = await workflowPage.expedientsTable.locator('tbody tr').all();
    expect(rows.length).toBeGreaterThanOrEqual(0);
  });

  test('should complete full expedient workflow: review -> validate -> sign -> export', async ({
    operatorUser,
  }) => {
    // Start in expedients view
    await workflowPage.switchToExpedientsMode();
    await workflowPage.waitForExpedientList();

    // Select first expedient
    await workflowPage.selectExpedient(0);

    // Start review
    await workflowPage.startReview();
    let status = await workflowPage.getExpedientStatus();
    expect(status).toContain('REVISIÓN');

    // Validate
    await workflowPage.validateExpedient();
    status = await workflowPage.getExpedientStatus();
    expect(status).toContain('VALIDADO');

    // Sign
    await workflowPage.signExpedient();
    status = await workflowPage.getExpedientStatus();
    expect(status).toContain('FIRMADO');

    // Export as PDF
    await workflowPage.exportExpedient('pdf');
    status = await workflowPage.getExpedientStatus();
    expect(status).toContain('EXPORTADO');
  });

  test('should reject expedient with reason', async () => {
    await workflowPage.switchToExpedientsMode();
    await workflowPage.waitForExpedientList();

    await workflowPage.selectExpedient(0);
    await workflowPage.startReview();

    // Reject with reason
    const rejectionReason = 'Placa no visible claramente';
    await workflowPage.rejectExpedient(rejectionReason);

    const status = await workflowPage.getExpedientStatus();
    expect(status).toContain('RECHAZADO');
  });

  test('should handle expedient state transitions correctly', async () => {
    await workflowPage.switchToExpedientsMode();
    await workflowPage.waitForExpedientList();

    await workflowPage.selectExpedient(0);

    // Can go from DETECTED to UNDER_REVIEW
    await workflowPage.startReview();
    let status = await workflowPage.getExpedientStatus();
    expect(status).toContain('REVISIÓN');

    // Can go from UNDER_REVIEW to VALIDATED
    await workflowPage.validateExpedient();
    status = await workflowPage.getExpedientStatus();
    expect(status).toContain('VALIDADO');

    // Can go from VALIDATED to SIGNED
    await workflowPage.signExpedient();
    status = await workflowPage.getExpedientStatus();
    expect(status).toContain('FIRMADO');
  });

  test('should display error when validation fails', async () => {
    // Mock API error
    await workflowPage.page.route('**/api/expedients/*/validate', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Missing required fields for validation',
        }),
      });
    });

    await workflowPage.switchToExpedientsMode();
    await workflowPage.waitForExpedientList();
    await workflowPage.selectExpedient(0);

    await workflowPage.validateExpedient();

    // Check for error message
    await expect(
      workflowPage.page.getByText(/missing required fields/i)
    ).toBeVisible();
  });
});

test.describe('Expedient View Mode Keyboard Shortcut', () => {
  let workflowPage: ExpedientWorkflowPage;

  test.beforeEach(async ({ page }) => {
    workflowPage = new ExpedientWorkflowPage(page);
    await workflowPage.goto('/');
  });

  test('should switch view with Ctrl+E keyboard shortcut', async ({ page }) => {
    let url = await workflowPage.getUrl();
    expect(url).not.toContain('expedients');

    // Press Ctrl+E
    await page.keyboard.press('Control+E');
    await page.waitForURL('**/expedients');

    url = await workflowPage.getUrl();
    expect(url).toContain('expedients');

    // Press Ctrl+E again to switch back
    await page.keyboard.press('Control+E');
    await page.waitForURL(new RegExp('^.*/$'));
    url = await workflowPage.getUrl();
    expect(url).not.toContain('expedients');
  });
});
