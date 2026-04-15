/**
 * Forgot-password E2E — full reset flow, wrong code, weak password,
 * mismatched passwords, resend code, back-navigation from every step.
 *
 * Run: npx playwright test src/tests/auth/forgot-password.e2e.ts
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  setKnownVerificationCode,
  switchToEmailTab,
  login,
  loginAndWaitForRedirect,
  enterVerificationCode,
  dbExec,
  type TestUser,
} from './helpers';

test.describe('Forgot Password', () => {
  let user: TestUser;

  test.beforeAll(() => {
    user = createTestUser({ name: 'Forgot', lastName: 'PwTest' });
  });

  test.afterAll(() => {
    cleanupUser(user.id);
  });

  // ---------------------------------------------------------------------------
  // Full flow
  // ---------------------------------------------------------------------------

  test('completes full forgot → code → reset → re-login flow', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);

    await page.getByTestId('forgot-password-link').click();
    await expect(page.getByTestId('forgot-password-form')).toBeVisible();

    await page.getByTestId('forgot-email-input').fill(user.email);
    await page.getByTestId('send-reset-btn').click();

    await expect(page.getByTestId('reset-code-view')).toBeVisible({ timeout: 10000 });

    const code = setKnownVerificationCode(user.email, 'password_reset');
    await enterVerificationCode(page, code);

    await expect(page.getByTestId('reset-new-password-view')).toBeVisible({ timeout: 10000 });

    const newPassword = 'NewResetP@ss1';
    await page.getByTestId('new-password-input').fill(newPassword);
    await page.getByTestId('confirm-password-input').fill(newPassword);
    await page.getByTestId('reset-password-btn').click();

    await expect(page.getByTestId('reset-success')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('back-to-login-btn').click();
    await expect(page.getByTestId('email-login-form')).toBeVisible({ timeout: 5000 });

    await loginAndWaitForRedirect(page, user.email, newPassword, 20_000);

    const changedAt = dbExec(
      `SELECT password_changed_at IS NOT NULL FROM email_account WHERE user_id = '${user.id}'`
    );
    expect(changedAt).toBe('t');
  });

  // ---------------------------------------------------------------------------
  // Error paths
  // ---------------------------------------------------------------------------

  test('shows error for wrong reset code', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);
    await page.getByTestId('forgot-password-link').click();

    await page.getByTestId('forgot-email-input').fill(user.email);
    await page.getByTestId('send-reset-btn').click();
    await expect(page.getByTestId('reset-code-view')).toBeVisible({ timeout: 10000 });

    await enterVerificationCode(page, '000000');

    await expect(page.getByTestId('verification-error')).toBeVisible({ timeout: 5000 });
  });

  test('shows error for mismatched passwords', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);
    await page.getByTestId('forgot-password-link').click();

    await page.getByTestId('forgot-email-input').fill(user.email);
    await page.getByTestId('send-reset-btn').click();
    await expect(page.getByTestId('reset-code-view')).toBeVisible({ timeout: 10000 });

    const code = setKnownVerificationCode(user.email, 'password_reset');
    await enterVerificationCode(page, code);
    await expect(page.getByTestId('reset-new-password-view')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('new-password-input').fill('OneP@ss123');
    await page.getByTestId('confirm-password-input').fill('DifferentP@ss456');
    await page.getByTestId('reset-password-btn').click();

    await expect(page.getByTestId('password-error')).toBeVisible();
  });

  test('rejects weak new password', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);
    await page.getByTestId('forgot-password-link').click();

    await page.getByTestId('forgot-email-input').fill(user.email);
    await page.getByTestId('send-reset-btn').click();
    await expect(page.getByTestId('reset-code-view')).toBeVisible({ timeout: 10000 });

    const code = setKnownVerificationCode(user.email, 'password_reset');
    await enterVerificationCode(page, code);
    await expect(page.getByTestId('reset-new-password-view')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('new-password-input').fill('abcdefgh');
    await page.getByTestId('confirm-password-input').fill('abcdefgh');
    await page.getByTestId('reset-password-btn').click();

    await expect(page.getByTestId('password-error')).toBeVisible();
    await expect(page.getByTestId('reset-new-password-view')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  test('navigates back to login from forgot password form', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);
    await page.getByTestId('forgot-password-link').click();
    await expect(page.getByTestId('forgot-password-form')).toBeVisible();

    await page.getByTestId('back-to-login-link').click();
    await expect(page.getByTestId('email-login-form')).toBeVisible();
  });

  test('navigates back to login from code view', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);
    await page.getByTestId('forgot-password-link').click();

    await page.getByTestId('forgot-email-input').fill(user.email);
    await page.getByTestId('send-reset-btn').click();
    await expect(page.getByTestId('reset-code-view')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('back-to-login-link').click();
    await expect(page.getByTestId('email-login-form')).toBeVisible();
  });

  test('navigates back to login from new-password view', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);
    await page.getByTestId('forgot-password-link').click();

    await page.getByTestId('forgot-email-input').fill(user.email);
    await page.getByTestId('send-reset-btn').click();
    await expect(page.getByTestId('reset-code-view')).toBeVisible({ timeout: 10000 });

    const code = setKnownVerificationCode(user.email, 'password_reset');
    await enterVerificationCode(page, code);
    await expect(page.getByTestId('reset-new-password-view')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('back-to-login-link').click();
    await expect(page.getByTestId('email-login-form')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Resend
  // ---------------------------------------------------------------------------

  test('resends code and disables resend button temporarily', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);
    await page.getByTestId('forgot-password-link').click();

    await page.getByTestId('forgot-email-input').fill(user.email);
    await page.getByTestId('send-reset-btn').click();
    await expect(page.getByTestId('reset-code-view')).toBeVisible({ timeout: 10000 });

    const resendBtn = page.getByTestId('resend-code-btn');
    await expect(resendBtn).toBeVisible({ timeout: 5000 });
    await resendBtn.click();

    await expect(resendBtn).toBeDisabled({ timeout: 3000 });
  });
});
