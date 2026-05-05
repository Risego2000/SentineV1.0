import { Page } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(url: string) {
    await this.page.goto(url);
  }

  async getUrl() {
    return this.page.url();
  }

  async waitForSelector(selector: string) {
    await this.page.waitForSelector(selector);
  }

  async fillInput(placeholder: string, value: string) {
    await this.page.getByPlaceholder(placeholder).fill(value);
  }

  async clickButton(label: string) {
    await this.page.getByRole('button', { name: label }).click();
  }

  async getText(selector: string) {
    return await this.page.locator(selector).textContent();
  }

  async isVisible(selector: string) {
    return await this.page.locator(selector).isVisible();
  }

  async waitForLoadState() {
    await this.page.waitForLoadState('networkidle');
  }
}
