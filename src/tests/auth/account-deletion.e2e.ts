/**
 * Account Deletion E2E — delete account, verify user is removed from DB,
 * redirect to login after deletion.
 *
 * Run: npx playwright test src/tests/auth/account-deletion.e2e.ts
 */

import { test, expect } from '@playwright/test';
import { createTestUser, loginAndNavigateTo, dbExec } from './helpers';

test.describe('Account Deletion', () => {
  test('deletes account and redirects to login', async ({ page }) => {
    const user = createTestUser({ name: 'Delete', lastName: 'Me' });

    await loginAndNavigateTo(page, user.email, user.password, '/account?tab=security');

    await page.getByTestId('delete-account-btn').click();

    // Confirm in the alert dialog
    await expect(page.getByTestId('confirm-delete-btn')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('confirm-delete-btn').click();

    // Should redirect to /login?signout=true and then to /login
    await page.waitForURL(/\/login/, { timeout: 15000 });

    // Verify user no longer exists in the DB
    const userCount = dbExec(`SELECT count(*) FROM "user" WHERE id = '${user.id}'`);
    expect(userCount).toBe('0');
  });

  test('can cancel account deletion without effect', async ({ page }) => {
    const user = createTestUser({ name: 'Cancel', lastName: 'Delete' });

    try {
      await loginAndNavigateTo(page, user.email, user.password, '/account?tab=security');

      await page.getByTestId('delete-account-btn').click();
      await expect(page.getByTestId('confirm-delete-btn')).toBeVisible({ timeout: 5000 });

      // Cancel instead of confirming
      await page.locator('button:has-text("Cancel")').click();

      // User should still exist
      const userCount = dbExec(`SELECT count(*) FROM "user" WHERE id = '${user.id}'`);
      expect(userCount).toBe('1');
    } finally {
      // Clean up — delete via DB since we cancelled the UI deletion
      dbExec(`DELETE FROM "user" WHERE id = '${user.id}'`);
    }
  });
});
