/**
 * Email Login E2E — valid/invalid credentials and provider conflicts.
 *
 * Run: npx playwright test src/tests/auth/login.e2e.ts
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createOAuthOnlyUser,
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

  test('completes login with valid credentials and redirects @push @critical @area(auth.core)', async ({
    page,
  }) => {
    await page.goto('/login');
    await loginAndWaitForRedirect(page, validUser.email, validUser.password, 15_000);

    const row = dbExec(`SELECT email, id FROM "user" WHERE id = '${validUser.id}'`);
    expect(row).toContain(validUser.email.toLowerCase());

    const verified = dbExec(
      `SELECT email_verified FROM email_account WHERE user_id = '${validUser.id}'`
    );
    expect(verified).toBe('t');
  });

  test('shows error for invalid password @critical @area(auth.core)', async ({ page }) => {
    await page.goto('/login');
    await login(page, validUser.email, 'WrongP@ssword99');

    await expect(page.getByTestId('email-auth-error')).toBeVisible({ timeout: 5000 });
    const errorText = await page.getByTestId('email-auth-error').textContent();
    expect(errorText).toMatch(/invalid|incorrect|failed/i);

    expect(page.url()).toContain('/login');
  });

  test('shows error when email is not registered @critical @area(auth.core)', async ({ page }) => {
    const fakeEmail = uniqueEmail('nonexistent');

    await page.goto('/login');
    await login(page, fakeEmail, 'SomeP@ss123');

    await expect(page.getByTestId('email-auth-error')).toBeVisible({ timeout: 5000 });

    const userExists = dbExec(
      `SELECT count(*) FROM "user" WHERE email = '${fakeEmail.toLowerCase()}'`
    );
    expect(userExists).toBe('0');
  });

  test('shows provider conflict when email is registered with OAuth only @critical @area(auth.core)', async ({
    page,
  }) => {
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
});
