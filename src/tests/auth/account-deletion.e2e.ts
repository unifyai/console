/**
 * Account Deletion E2E — delete account, verify user is removed from DB,
 * redirect to login after deletion, and session is invalidated.
 *
 * Run: npx playwright test src/tests/auth/account-deletion.e2e.ts
 */

import { test, expect } from '@playwright/test';
import { createTestUser, loginAndNavigateTo, dbExec, cleanupUser } from './helpers';

test.describe('Account Deletion', () => {
  test('deletes account and redirects to login', async ({ page }) => {
    const user = createTestUser({ name: 'Delete', lastName: 'Me' });

    await loginAndNavigateTo(page, user.email, user.password, '/account?tab=security');

    await page.getByTestId('delete-account-btn').click();

    await expect(page.getByTestId('confirm-delete-btn')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('confirm-delete-btn').click();

    await page.waitForURL(/\/login/, { timeout: 15_000 });

    const userCount = dbExec(`SELECT count(*) FROM "user" WHERE id = '${user.id}'`);
    expect(userCount).toBe('0');

    await page.goto('/assistants', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('can cancel account deletion without effect', async ({ page }) => {
    const user = createTestUser({ name: 'Cancel', lastName: 'Delete' });

    try {
      await loginAndNavigateTo(page, user.email, user.password, '/account?tab=security');

      await page.getByTestId('delete-account-btn').click();
      await expect(page.getByTestId('confirm-delete-btn')).toBeVisible({ timeout: 5_000 });

      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();

      const userCount = dbExec(`SELECT count(*) FROM "user" WHERE id = '${user.id}'`);
      expect(userCount).toBe('1');

      await page.goto('/assistants');
      await expect(page.getByTestId('assistant-rail').first()).toBeVisible({ timeout: 15_000 });
    } finally {
      cleanupUser(user.id);
    }
  });
});
