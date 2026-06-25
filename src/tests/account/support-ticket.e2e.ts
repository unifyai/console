/**
 * Support Ticket E2E — dialog lifecycle, form validation,
 * screenshot capture, and submission flow.
 *
 * Run: npx playwright test src/tests/account/support-ticket.e2e.ts
 *
 * These tests exercise the full support ticket UI against the running
 * console.  In local mode (no DISCORD_SUPPORT_WEBHOOK_URL configured),
 * the server action logs to stdout instead of posting to Discord, so
 * the end-to-end flow works without external dependencies.
 */

import { test, expect } from '@playwright/test';
import { createTestUser, cleanupUser, loginAndNavigateTo, type TestUser } from './helpers';

const SUPPORT_ROUTE = '/account?tab=profile';

// =============================================================================
// Support Ticket Dialog
// =============================================================================

test.describe('Support Ticket', () => {
  let user: TestUser;
  const cleanupIds: string[] = [];

  test.beforeAll(() => {
    user = createTestUser({ name: 'Support', lastName: 'Tester' });
    cleanupIds.push(user.id);
  });

  test.afterAll(() => {
    for (const id of cleanupIds) {
      cleanupUser(id);
    }
  });

  test('trigger button is visible in the shell header', async ({ page }) => {
    await loginAndNavigateTo(page, user.email, user.password, SUPPORT_ROUTE);

    const trigger = page.getByTestId('support-ticket-trigger');
    await expect(trigger).toBeVisible({ timeout: 10_000 });
  });

  test('opens dialog on click and shows expected fields', async ({ page }) => {
    await loginAndNavigateTo(page, user.email, user.password, SUPPORT_ROUTE);

    const trigger = page.getByTestId('support-ticket-trigger');
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    const dialog = page.getByTestId('support-ticket-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await expect(dialog.getByText('Report an Issue')).toBeVisible();
    await expect(page.getByTestId('support-ticket-description')).toBeVisible();
    await expect(page.getByTestId('support-ticket-submit')).toBeVisible();
  });

  test('opens after attempting screenshot capture', async ({ page }) => {
    await loginAndNavigateTo(page, user.email, user.password, SUPPORT_ROUTE);

    await page.getByTestId('support-ticket-trigger').click();
    await expect(page.getByTestId('support-ticket-dialog')).toBeVisible({ timeout: 10_000 });

    const screenshot = page.getByTestId('support-ticket-screenshot');
    if ((await screenshot.count()) > 0) {
      await expect(screenshot).toBeVisible();
      const src = await screenshot.getAttribute('src');
      expect(src).toMatch(/^data:image\/png;base64,/);
    }
  });

  test('submit button is disabled when description is empty', async ({ page }) => {
    await loginAndNavigateTo(page, user.email, user.password, SUPPORT_ROUTE);

    await page.getByTestId('support-ticket-trigger').click();
    await expect(page.getByTestId('support-ticket-dialog')).toBeVisible({ timeout: 10_000 });

    const submitBtn = page.getByTestId('support-ticket-submit');
    await expect(submitBtn).toBeDisabled();
  });

  test('enables submit after typing a description', async ({ page }) => {
    await loginAndNavigateTo(page, user.email, user.password, SUPPORT_ROUTE);

    await page.getByTestId('support-ticket-trigger').click();
    await expect(page.getByTestId('support-ticket-dialog')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('support-ticket-description').fill('Test issue description');
    const submitBtn = page.getByTestId('support-ticket-submit');
    await expect(submitBtn).toBeEnabled();
  });

  test('submits ticket and shows success toast (local mode)', async ({ page }) => {
    await loginAndNavigateTo(page, user.email, user.password, SUPPORT_ROUTE);

    await page.getByTestId('support-ticket-trigger').click();
    await expect(page.getByTestId('support-ticket-dialog')).toBeVisible({ timeout: 10_000 });

    await page
      .getByTestId('support-ticket-description')
      .fill('The billing page shows incorrect balance after recharge.');
    await page.getByTestId('support-ticket-submit').click();

    // Dialog should close on success
    await expect(page.getByTestId('support-ticket-dialog')).not.toBeVisible({ timeout: 10_000 });

    // Success toast should appear
    await expect(page.getByText(/support ticket submitted/i)).toBeVisible({ timeout: 5_000 });
  });

  test('dialog closes when cancel is clicked', async ({ page }) => {
    await loginAndNavigateTo(page, user.email, user.password, SUPPORT_ROUTE);

    await page.getByTestId('support-ticket-trigger').click();
    await expect(page.getByTestId('support-ticket-dialog')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('support-ticket-dialog')).not.toBeVisible({ timeout: 5_000 });
  });

  test('dialog closes when backdrop X button is clicked', async ({ page }) => {
    await loginAndNavigateTo(page, user.email, user.password, SUPPORT_ROUTE);

    await page.getByTestId('support-ticket-trigger').click();
    await expect(page.getByTestId('support-ticket-dialog')).toBeVisible({ timeout: 10_000 });

    // Radix dialog close button (sr-only "Close" label)
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('support-ticket-dialog')).not.toBeVisible({ timeout: 5_000 });
  });

  test('character counter updates as user types', async ({ page }) => {
    await loginAndNavigateTo(page, user.email, user.password, SUPPORT_ROUTE);

    await page.getByTestId('support-ticket-trigger').click();
    await expect(page.getByTestId('support-ticket-dialog')).toBeVisible({ timeout: 10_000 });

    const textarea = page.getByTestId('support-ticket-description');
    await textarea.fill('Hello');
    await expect(page.getByText('5/2000')).toBeVisible();
  });
});
