/**
 * Support Ticket E2E — dialog lifecycle and submission.
 *
 * Run: npx playwright test src/tests/account/support-ticket.e2e.ts
 */

import { test, expect } from '@playwright/test';
import { createTestUser, cleanupUser, loginAndNavigateTo, type TestUser } from './helpers';

const SUPPORT_ROUTE = '/account?tab=profile';

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

  test('opens dialog with expected fields @area(account.support)', async ({ page }) => {
    await loginAndNavigateTo(page, user.email, user.password, SUPPORT_ROUTE);

    const trigger = page.getByTestId('support-ticket-trigger');
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    const dialog = page.getByTestId('support-ticket-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('Report an Issue')).toBeVisible();
    await expect(page.getByTestId('support-ticket-description')).toBeVisible();
    await expect(page.getByTestId('support-ticket-submit')).toBeDisabled();
  });

  test('submits ticket and shows success toast (local mode) @critical @area(account.support)', async ({
    page,
  }) => {
    await loginAndNavigateTo(page, user.email, user.password, SUPPORT_ROUTE);

    await page.getByTestId('support-ticket-trigger').click();
    await expect(page.getByTestId('support-ticket-dialog')).toBeVisible({ timeout: 10_000 });

    await page
      .getByTestId('support-ticket-description')
      .fill('The billing page shows incorrect balance after recharge.');
    await expect(page.getByTestId('support-ticket-submit')).toBeEnabled();
    await page.getByTestId('support-ticket-submit').click();

    await expect(page.getByTestId('support-ticket-dialog')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/support ticket submitted/i)).toBeVisible({ timeout: 5_000 });
  });
});
