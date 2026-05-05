import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ExpedientWorkflowPage extends BasePage {
  readonly viewModeToggle: Locator;
  readonly detectionModeButton: Locator;
  readonly expedientsModeButton: Locator;
  readonly expedientList: Locator;
  readonly expedientsTable: Locator;
  readonly reviewButton: Locator;
  readonly validateButton: Locator;
  readonly rejectButton: Locator;
  readonly signButton: Locator;
  readonly exportButton: Locator;

  constructor(page: Page) {
    super(page);
    this.viewModeToggle = page.locator('[data-testid="view-mode-toggle"]');
    this.detectionModeButton = page.getByRole('button', { name: /detección/i });
    this.expedientsModeButton = page.getByRole('button', { name: /expedientes/i });
    this.expedientList = page.locator('[data-testid="expedient-list"]');
    this.expedientsTable = page.locator('[data-testid="expedients-table"]');
    this.reviewButton = page.getByRole('button', { name: /revisión/i });
    this.validateButton = page.getByRole('button', { name: /validar/i });
    this.rejectButton = page.getByRole('button', { name: /rechazar/i });
    this.signButton = page.getByRole('button', { name: /firmar/i });
    this.exportButton = page.getByRole('button', { name: /exportar/i });
  }

  async switchToExpedientsMode() {
    await this.expedientsModeButton.click();
    await this.page.waitForURL('**/expedients');
    await this.expedientList.waitFor({ state: 'visible' });
  }

  async switchToDetectionMode() {
    await this.detectionModeButton.click();
    await this.page.waitForURL('**/');
  }

  async selectExpedient(index: number) {
    const rows = await this.expedientsTable.locator('tbody tr').all();
    if (rows.length > index) {
      await rows[index].click();
    }
  }

  async startReview() {
    await this.reviewButton.click();
    await expect(this.page.getByText(/revisión iniciada/i)).toBeVisible();
  }

  async validateExpedient() {
    await this.validateButton.click();
    await expect(this.page.getByText(/validado/i)).toBeVisible();
  }

  async rejectExpedient(reason: string) {
    await this.rejectButton.click();
    const reasonInput = this.page.getByPlaceholder(/razón|motivo/i);
    await reasonInput.fill(reason);
    await this.page.getByRole('button', { name: /confirmar|rechazar/i }).click();
  }

  async signExpedient() {
    await this.signButton.click();
    await expect(this.page.getByText(/firmado/i)).toBeVisible();
  }

  async exportExpedient(format: 'pdf' | 'excel') {
    await this.exportButton.click();
    if (format === 'pdf') {
      await this.page.getByRole('button', { name: /pdf/i }).click();
    } else {
      await this.page.getByRole('button', { name: /excel/i }).click();
    }
  }

  async getExpedientStatus() {
    const status = await this.page.locator('[data-testid="expedient-status"]').textContent();
    return status?.trim();
  }

  async waitForExpedientList() {
    await this.expedientList.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }
}
