/**
 * MFA Login Verification E2E — TOTP verification, recovery code verification,
 * invalid codes, switching between TOTP/recovery, back-to-login.
 *
 * Run: npx playwright test src/tests/auth/mfa-login.e2e.ts
 */

import { test, expect, type Page } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  enableMfa,
  generateTOTP,
  switchToEmailTab,
  login,
  loginAndWaitForRedirect,
  enterTOTP,
  ensureFreshTotp,
  dbExec,
  type TestUser,
} from './helpers';

async function loginToMfa(page: Page, email: string, password: string) {
  await page.goto('/login');
  await loginAndWaitForRedirect(page, email, password, 15_000);
  await expect(page).toHaveURL(/\/login\/mfa/, { timeout: 5_000 });
}

async function completeTotpAndWaitForRedirect(page: Page, totpSecret: string) {
  await ensureFreshTotp(page, totpSecret);
  const code = generateTOTP(totpSecret);
  await Promise.all([
    page.waitForURL(
      (url) => !url.pathname.startsWith('/login') || url.pathname.includes('onboarding'),
      { timeout: 15_000, waitUntil: 'domcontentloaded' }
    ),
    enterTOTP(page, code),
  ]);
}

async function submitRecoveryCodeAndWaitForRedirect(page: Page, recoveryCode: string) {
  await expect(page.getByTestId('recovery-code-input')).toBeVisible();
  await page.getByTestId('recovery-code-input').fill(recoveryCode);
  await Promise.all([
    page.waitForURL(
      (url) => !url.pathname.startsWith('/login') || url.pathname.includes('onboarding'),
      { timeout: 15_000, waitUntil: 'domcontentloaded' }
    ),
    page.getByTestId('recovery-submit').click(),
  ]);
}

test.describe('MFA Login Verification', () => {
  test.describe.configure({ mode: 'serial' });

  let user: TestUser;
  let totpSecret: string;
  let recoveryCodes: string[];

  test.beforeAll(async () => {
    user = createTestUser({ name: 'MFA', lastName: 'Login' });
    const mfa = await enableMfa(user.apiKey);
    totpSecret = mfa.secret;
    recoveryCodes = mfa.recoveryCodes;
  });

  test.afterAll(() => {
    cleanupUser(user.id);
  });

  test('completes TOTP verification and redirects after login', async ({ page }) => {
    await loginToMfa(page, user.email, user.password);
    await completeTotpAndWaitForRedirect(page, totpSecret);

    const mfaEnabled = dbExec(
      `SELECT enabled FROM mfa_credential WHERE user_id = '${user.id}' AND method_type = 'totp'`
    );
    expect(mfaEnabled).toBe('t');
  });

  test('shows error for invalid TOTP code', async ({ page }) => {
    await loginToMfa(page, user.email, user.password);

    await enterTOTP(page, '000000');

    await expect(page.getByTestId('totp-error')).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain('/login/mfa');
  });

  test('completes recovery code verification after login', async ({ page }) => {
    test.skip(recoveryCodes.length === 0, 'No recovery codes available');

    await loginToMfa(page, user.email, user.password);

    await page.getByTestId('use-recovery-code').click();
    await submitRecoveryCodeAndWaitForRedirect(page, recoveryCodes[0]);
  });

  test('shows error for invalid recovery code', async ({ page }) => {
    await loginToMfa(page, user.email, user.password);

    await page.getByTestId('use-recovery-code').click();
    await page.getByTestId('recovery-code-input').fill('not-a-real-code');
    await page.getByTestId('recovery-submit').click();

    await expect(page.getByTestId('recovery-error')).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain('/login/mfa');
  });

  test('switches between TOTP and recovery code views', async ({ page }) => {
    await loginToMfa(page, user.email, user.password);

    await expect(page.getByTestId('totp-input')).toBeVisible();
    await expect(page.getByTestId('recovery-code-input')).not.toBeVisible();

    await page.getByTestId('use-recovery-code').click();
    await expect(page.getByTestId('recovery-code-input')).toBeVisible();
    await expect(page.getByTestId('totp-input')).not.toBeVisible();

    await page.getByTestId('use-totp-code').click();
    await expect(page.getByTestId('totp-input')).toBeVisible();
    await expect(page.getByTestId('recovery-code-input')).not.toBeVisible();
  });

  test('recovery submit button is disabled when input is empty', async ({ page }) => {
    await loginToMfa(page, user.email, user.password);

    await page.getByTestId('use-recovery-code').click();
    await expect(page.getByTestId('recovery-submit')).toBeDisabled();

    await page.getByTestId('recovery-code-input').fill('something');
    await expect(page.getByTestId('recovery-submit')).toBeEnabled();
  });

  test('back-to-login signs out and redirects to login page', async ({ page }) => {
    await loginToMfa(page, user.email, user.password);

    await page.getByTestId('back-to-login').click();

    await page.waitForURL(/\/login(?!\/mfa)/, { timeout: 15000 });
    await expect(page.url()).toContain('/login');
  });

  test('forwards credit token to destination after TOTP verification', async ({ page }) => {
    await loginToMfa(page, user.email, user.password);

    const mfaUrl = new URL(page.url());
    mfaUrl.searchParams.set('token', 'test-credit-e2e');
    await page.goto(mfaUrl.toString());

    await completeTotpAndWaitForRedirect(page, totpSecret);

    expect(page.url()).toContain('token=test-credit-e2e');
  });
});
