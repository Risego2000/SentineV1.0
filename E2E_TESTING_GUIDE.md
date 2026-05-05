# E2E Testing Guide - Sentinel AI

## Overview

Sentinel AI uses **Playwright** for end-to-end testing. Tests are located in `e2e/` directory and use the Page Object Model pattern for maintainability.

## Setup

```bash
# Install dependencies
npm install -D @playwright/test

# Install browsers
npx playwright install

# Run tests
npx playwright test

# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug

# Run specific test file
npx playwright test e2e/tests/expedient-workflow.spec.ts

# Run with specific browser
npx playwright test --project=chromium
```

## Project Structure

```
e2e/
├── pages/          # Page Objects
│   ├── BasePage.ts
│   └── ExpedientWorkflowPage.ts
├── fixtures/       # Test data and fixtures
│   └── test-data.ts
├── tests/          # Test files
│   ├── expedient-workflow.spec.ts
│   └── ...
└── README.md       # This file
```

## Page Objects

### BasePage
Base class for all pages with common utilities:
- `goto(url)` - Navigate to URL
- `fillInput(placeholder, value)` - Fill input by placeholder
- `clickButton(label)` - Click button by label
- `isVisible(selector)` - Check element visibility

### ExpedientWorkflowPage
Specific page for Expedient workflow:

```typescript
// Switch views
await workflowPage.switchToExpedientsMode();
await workflowPage.switchToDetectionMode();

// Manage expedients
await workflowPage.selectExpedient(0);
await workflowPage.startReview();
await workflowPage.validateExpedient();
await workflowPage.rejectExpedient('Reason');
await workflowPage.signExpedient();
await workflowPage.exportExpedient('pdf');

// Get status
const status = await workflowPage.getExpedientStatus();
```

## Test Fixtures

### operatorUser
Standard operator test user:
```typescript
test('operator can review expedients', async ({ operatorUser }) => {
  // Email: operator-{timestamp}@sentinel.local
  // Password: Test123!@#
  // Role: OPERATOR
});
```

### supervisorUser
Supervisor test user with higher permissions:
```typescript
test('supervisor can approve validations', async ({ supervisorUser }) => {
  // Email: supervisor-{timestamp}@sentinel.local
  // Password: Test123!@#
  // Role: SUPERVISOR
});
```

### sampleInfraction
Sample infraction data for testing:
```typescript
test('create infraction report', async ({ sampleInfraction }) => {
  // Plate: TEST{random}
  // Make/Model: Honda Civic 2020
  // Severity: ALTA
  // Color: Blanco
});
```

## Critical User Journeys to Test

### 1. Expedient Workflow
- [x] Switch between detection and expedients views
- [x] Load expedient list
- [x] Review expedient
- [x] Validate expedient
- [x] Reject expedient with reason
- [x] Sign expedient
- [x] Export expedient (PDF/Excel)

### 2. View Switching
- [x] Keyboard shortcut Ctrl+E switches views
- [x] Button click switches views
- [x] State persists across navigation

### 3. Error Handling
- [ ] Handle API errors gracefully
- [ ] Show user-friendly error messages
- [ ] Allow retry after failure

### 4. Data Validation
- [ ] Required fields are validated
- [ ] Invalid data shows error messages
- [ ] Form state is preserved on error

## Best Practices

### 1. Use Data Attributes for Selection
```typescript
// ❌ Brittle
await page.locator('.btn.btn-primary').click();
await page.locator('div > form > input:nth-child(2)').fill('text');

// ✅ Stable
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByLabel('Email').fill('test@example.com');
await page.locator('[data-testid="email-input"]').fill('test@example.com');
```

### 2. Wait for Conditions, Not Time
```typescript
// ❌ Flaky
await page.waitForTimeout(3000);

// ✅ Reliable
await page.waitForLoadState('networkidle');
await expect(page.getByText('Loaded')).toBeVisible();
await page.waitForURL('**/success');
```

### 3. Independent Tests
```typescript
// ❌ Coupled
test('step 1', async ({ page }) => {
  // Creates data for next test
});
test('step 2', async ({ page }) => {
  // Depends on step 1
});

// ✅ Independent
test('full workflow', async ({ page, operatorUser }) => {
  // Complete workflow in one test
});
```

### 4. Test User Behavior
```typescript
// ❌ Implementation details
expect(page.locator('.expedient-state')).toHaveClass('under-review');

// ✅ User-visible behavior
expect(page.getByText('REVISIÓN')).toBeVisible();
```

## Running Tests in CI/CD

```yaml
# GitHub Actions example
- name: Run E2E tests
  run: npx playwright test
  
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Debugging Failed Tests

### 1. Run in Headed Mode
```bash
npx playwright test --headed
```

### 2. Use Inspector
```bash
npx playwright test --debug
# Inspector opens - step through test
```

### 3. Screenshot on Failure
```typescript
// Automatically captured in playwright.config.ts
// See screenshots in test-results/
```

### 4. Video Recording
```typescript
// Automatically recorded on failure
// See videos in test-results/
```

### 5. Traces
```typescript
// Recorded on first retry
// Open with: npx playwright show-trace test-results/trace.zip
```

## Adding New Tests

### 1. Create Page Object
```typescript
// e2e/pages/NewPage.ts
export class NewPage extends BasePage {
  readonly element: Locator;

  constructor(page: Page) {
    super(page);
    this.element = page.locator('[data-testid="element"]');
  }

  async doSomething() {
    // Implementation
  }
}
```

### 2. Create Test File
```typescript
// e2e/tests/new-feature.spec.ts
import { test, expect } from '../fixtures/test-data';
import { NewPage } from '../pages/NewPage';

test.describe('New Feature', () => {
  let page: NewPage;

  test.beforeEach(async ({ page: playwrightPage }) => {
    page = new NewPage(playwrightPage);
    await page.goto('/feature');
  });

  test('should do something', async () => {
    await page.doSomething();
    // Assert
  });
});
```

### 3. Run Test
```bash
npx playwright test e2e/tests/new-feature.spec.ts
```

## Network Mocking

### Mock API Response
```typescript
await page.route('**/api/expedients', (route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify([
      { id: '1', state: 'DETECTED' },
      { id: '2', state: 'VALIDATED' },
    ]),
  });
});
```

### Simulate Network Error
```typescript
await page.route('**/api/expedients', (route) => {
  route.fulfill({
    status: 500,
    body: JSON.stringify({ error: 'Internal Server Error' }),
  });
});
```

### Simulate Slow Network
```typescript
await page.route('**/api/expedients', (route) => {
  route.continue();
  // Delay happens before continue
}, { 
  // Delay options
});
```

## Performance Testing

### Measure Navigation Time
```typescript
const startTime = Date.now();
await page.goto('/');
const navigationTime = Date.now() - startTime;
expect(navigationTime).toBeLessThan(3000); // 3 second max
```

### Measure API Response Time
```typescript
const responsePromise = page.waitForResponse(
  response => response.url().includes('/api/expedients')
);
const response = await responsePromise;
const timings = response.timings();
expect(timings.response).toBeLessThan(500); // 500ms max
```

## Common Issues

### Issue: "Element not found"
**Solution**: Use more specific selector or add wait condition
```typescript
await page.waitForSelector('[data-testid="element"]');
```

### Issue: "Timeout waiting for condition"
**Solution**: Check network requests, use appropriate waits
```typescript
await page.waitForLoadState('networkidle');
```

### Issue: "Flaky tests"
**Solution**: Replace fixed timeouts with waits
```typescript
// ❌ Flaky
await page.waitForTimeout(2000);

// ✅ Reliable
await expect(element).toBeVisible();
```

## Test Coverage Goals

- [x] Critical user workflows (100%)
- [ ] Error handling paths (80%)
- [ ] Edge cases (60%)
- [ ] Accessibility (40%)
- [ ] Visual regression (30%)

## Next Steps

1. **Add API mocking** for offline testing
2. **Add accessibility tests** with axe-core
3. **Add visual regression** with visual comparisons
4. **Add performance tests** to catch regressions
5. **Expand test coverage** to all critical flows
