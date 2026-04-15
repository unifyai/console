/**
 * Email Login E2E — valid/invalid credentials, provider conflicts,
 * disabled states, error clearing, and view navigation.
 *
 * Run: npx playwright test src/tests/auth/login.e2e.ts
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createOAuthOnlyUser,
  switchToEmailTab,
  login,
  loginAndWaitForRedirect,
  uniqueEmail,
  dbExec,
  type TestUser,
} from './helpers';

// =============================================================================
// Email Login — Happy & Error Paths
// =============================================================================

test.describe('Email Login', () => {
  let validUser: TestUser;
  const cleanupIds: string[] = [];

  test.beforeAll(() => {
    validUser = createTestUser({ name: 'Login', lastName: 'Test' });
    cleanupIds.push(validUser.id);
  });

  test.afterAll(() => {
    for (const id of cleanupIds) {
      cleanupUser(id);
    }
  });

  test('completes login with valid credentials and redirects', async ({ page }) => {
    await page.goto('/login');
    await loginAndWaitForRedirect(page, validUser.email, validUser.password, 15_000);

    const row = dbExec(`SELECT email, id FROM "user" WHERE id = '${validUser.id}'`);
    expect(row).toContain(validUser.email.toLowerCase());

    const verified = dbExec(
      `SELECT email_verified FROM email_account WHERE user_id = '${validUser.id}'`
    );
    expect(verified).toBe('t');
  });

  test('shows error for invalid password', async ({ page }) => {
    await page.goto('/login');
    await login(page, validUser.email, 'WrongP@ssword99');

    await expect(page.getByTestId('email-auth-error')).toBeVisible({ timeout: 5000 });
    const errorText = await page.getByTestId('email-auth-error').textContent();
    expect(errorText).toMatch(/invalid|incorrect|failed/i);

    expect(page.url()).toContain('/login');
  });

  test('shows error when email is not registered', async ({ page }) => {
    const fakeEmail = uniqueEmail('nonexistent');

    await page.goto('/login');
    await login(page, fakeEmail, 'SomeP@ss123');

    await expect(page.getByTestId('email-auth-error')).toBeVisible({ timeout: 5000 });

    const userExists = dbExec(
      `SELECT count(*) FROM "user" WHERE email = '${fakeEmail.toLowerCase()}'`
    );
    expect(userExists).toBe('0');
  });

  test('shows provider conflict when email is registered with OAuth only', async ({ page }) => {
    const oauthUser = createOAuthOnlyUser({
      name: 'OAuthLogin',
      lastName: 'Conflict',
      provider: 'google',
    });
    cleanupIds.push(oauthUser.id);

    await page.goto('/login');
    await login(page, oauthUser.email, 'AnyP@ss123');

    await expect(page.getByTestId('email-auth-error')).toBeVisible({ timeout: 5000 });
    const errorText = await page.getByTestId('email-auth-error').textContent();
    expect(errorText).toMatch(/google/i);

    const hasEmailAccount = dbExec(
      `SELECT count(*) FROM email_account WHERE user_id = '${oauthUser.id}'`
    );
    expect(hasEmailAccount).toBe('0');

    const oauthAccount = dbExec(`SELECT provider FROM account WHERE user_id = '${oauthUser.id}'`);
    expect(oauthAccount).toBe('google');
  });

  test('keeps submit button disabled when email or password is empty', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);

    const submitBtn = page.getByTestId('email-submit-btn');
    await expect(submitBtn).toBeDisabled();

    await page.getByTestId('email-input').fill('someone@example.com');
    await expect(submitBtn).toBeDisabled();

    await page.getByTestId('email-input').clear();
    await page.getByTestId('email-password-input').fill('SomePass1');
    await expect(submitBtn).toBeDisabled();

    await page.getByTestId('email-input').fill('someone@example.com');
    await expect(submitBtn).toBeEnabled();
  });

  test('clears error message when email field changes', async ({ page }) => {
    await page.goto('/login');
    await login(page, validUser.email, 'WrongP@ss1');

    await expect(page.getByTestId('email-auth-error')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('email-input').fill('changed@example.com');

    await expect(page.getByTestId('email-auth-error')).not.toBeVisible();
  });
});

// =============================================================================
// View Navigation — login ↔ register ↔ forgot-password, OAuth ↔ email tabs
// =============================================================================

test.describe('Login Navigation', () => {
  test('navigates from login to register view and back', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);

    await expect(page.getByTestId('email-login-form')).toBeVisible();

    await page.getByTestId('switch-to-register').click();
    await expect(page.getByTestId('email-register-form')).toBeVisible();
    await expect(page.getByTestId('email-first-name-input')).toBeVisible();

    await page.getByTestId('switch-to-login').click();
    await expect(page.getByTestId('email-login-form')).toBeVisible();
  });

  test('navigates from login to forgot password and back', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);

    await page.getByTestId('forgot-password-link').click();
    await expect(page.getByTestId('forgot-password-form')).toBeVisible();

    await page.getByTestId('back-to-login-link').click();
    await expect(page.getByTestId('email-login-form')).toBeVisible();
  });

  test('switches between OAuth and email auth tabs', async ({ page }) => {
    await page.goto('/login');

    const emailTabBtn = page.getByTestId('email-auth-tab');
    if (await emailTabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailTabBtn.click();
      await expect(page.getByTestId('email-login-form')).toBeVisible();

      await page.getByTestId('switch-to-oauth').click();
      await expect(page.getByTestId('email-login-form')).not.toBeVisible();
      await expect(emailTabBtn).toBeVisible();
    }
  });
});
