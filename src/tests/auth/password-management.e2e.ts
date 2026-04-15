/**
 * Password Management E2E — change password from profile, wrong current
 * password, mismatched new passwords, weak password, re-login after change.
 *
 * Run: npx playwright test src/tests/auth/password-management.e2e.ts
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  loginAndNavigateTo,
  login,
  loginAndWaitForRedirect,
  switchToEmailTab,
  dbExec,
  type TestUser,
} from './helpers';

test.describe('Change Password', () => {
  const cleanupIds: string[] = [];

  test.afterAll(() => {
    for (const id of cleanupIds) {
      cleanupUser(id);
    }
  });

  test('changes password successfully and can re-login with new password', async ({ page }) => {
    const user = createTestUser({ name: 'PW', lastName: 'Change' });
    cleanupIds.push(user.id);

    await loginAndNavigateTo(page, user.email, user.password, '/account?tab=security');

    await page.getByTestId('open-password-modal-btn').click();
    await expect(page.getByTestId('change-password-section')).toBeVisible({ timeout: 5000 });

    const newPassword = 'NewStrongP@ss99';
    await page.getByTestId('current-password-input').fill(user.password);
    await page.getByTestId('new-password-input').fill(newPassword);
    await page.getByTestId('confirm-password-input').fill(newPassword);
    await page.getByTestId('change-password-btn').click();

    // Wait for the modal to close (indicating success)
    await expect(page.getByTestId('change-password-section')).not.toBeVisible({ timeout: 10000 });

    // Verify password_changed_at is set in the DB
    const changedAt = dbExec(
      `SELECT password_changed_at IS NOT NULL FROM email_account WHERE user_id = '${user.id}'`
    );
    expect(changedAt).toBe('t');

    // The session should be invalidated — navigate away and verify we're forced to re-login
    await page.goto('/assistants');
    await page.waitForURL(/\/login/, { timeout: 15000 });

    // Wait for any signout processing to complete before trying to login
    await page.waitForURL((url) => url.pathname === '/login' && !url.searchParams.has('signout'), {
      timeout: 15000,
    });

    await loginAndWaitForRedirect(page, user.email, newPassword, 20_000);
  });

  test('shows error for wrong current password', async ({ page }) => {
    const user = createTestUser({ name: 'PW', lastName: 'WrongCurrent' });
    cleanupIds.push(user.id);

    await loginAndNavigateTo(page, user.email, user.password, '/account?tab=security');

    await page.getByTestId('open-password-modal-btn').click();
    await expect(page.getByTestId('change-password-section')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('current-password-input').fill('WrongP@ss1');
    await page.getByTestId('new-password-input').fill('NewP@ss123');
    await page.getByTestId('confirm-password-input').fill('NewP@ss123');
    await page.getByTestId('change-password-btn').click();

    await expect(page.getByTestId('change-password-error')).toBeVisible({ timeout: 5000 });
  });

  test('shows error for mismatched new passwords', async ({ page }) => {
    const user = createTestUser({ name: 'PW', lastName: 'Mismatch' });
    cleanupIds.push(user.id);

    await loginAndNavigateTo(page, user.email, user.password, '/account?tab=security');

    await page.getByTestId('open-password-modal-btn').click();
    await expect(page.getByTestId('change-password-section')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('current-password-input').fill(user.password);
    await page.getByTestId('new-password-input').fill('NewP@ss123');
    await page.getByTestId('confirm-password-input').fill('DifferentP@ss456');
    await page.getByTestId('change-password-btn').click();

    await expect(page.getByTestId('change-password-error')).toBeVisible({ timeout: 5000 });
    const errorText = await page.getByTestId('change-password-error').textContent();
    expect(errorText).toMatch(/match/i);
  });

  test('shows error for weak new password', async ({ page }) => {
    const user = createTestUser({ name: 'PW', lastName: 'Weak' });
    cleanupIds.push(user.id);

    await loginAndNavigateTo(page, user.email, user.password, '/account?tab=security');

    await page.getByTestId('open-password-modal-btn').click();
    await expect(page.getByTestId('change-password-section')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('current-password-input').fill(user.password);
    await page.getByTestId('new-password-input').fill('abcdefgh');
    await page.getByTestId('confirm-password-input').fill('abcdefgh');
    await page.getByTestId('change-password-btn').click();

    await expect(page.getByTestId('change-password-error')).toBeVisible({ timeout: 5000 });
  });

  test('shows error when new password equals current password', async ({ page }) => {
    const user = createTestUser({ name: 'PW', lastName: 'Same' });
    cleanupIds.push(user.id);

    await loginAndNavigateTo(page, user.email, user.password, '/account?tab=security');

    await page.getByTestId('open-password-modal-btn').click();
    await expect(page.getByTestId('change-password-section')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('current-password-input').fill(user.password);
    await page.getByTestId('new-password-input').fill(user.password);
    await page.getByTestId('confirm-password-input').fill(user.password);
    await page.getByTestId('change-password-btn').click();

    await expect(page.getByTestId('change-password-error')).toBeVisible({ timeout: 5000 });
    const errorText = await page.getByTestId('change-password-error').textContent();
    expect(errorText).toMatch(/different/i);
  });
});
