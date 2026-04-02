/**
 * MFA Profile Management E2E — enable 2FA from profile, wrong confirmation
 * code, disable 2FA, recovery code acknowledgement.
 *
 * Run: npx playwright test src/tests/auth/mfa-profile.e2e.ts
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  enableMfa,
  disableMfa,
  generateTOTP,
  loginAndNavigateTo,
  loginWithMfaAndNavigateTo,
  enterTOTP,
  enterTOTPWithRetry,
  dbExec,
  type TestUser,
} from './helpers';

test.describe('MFA Setup from Profile', () => {
  const cleanupIds: string[] = [];

  test.afterAll(() => {
    for (const id of cleanupIds) {
      cleanupUser(id);
    }
  });

  test('completes full MFA setup: QR → confirm → recovery codes → done', async ({ page }) => {
    const user = createTestUser({ name: 'MFA', lastName: 'Setup' });
    cleanupIds.push(user.id);

    await loginAndNavigateTo(page, user.email, user.password, '/account?tab=security');

    await page.getByTestId('open-2fa-modal-btn').click();

    // QR step auto-starts via API call — allow extra time for the request
    await expect(page.getByTestId('totp-qr-step')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('totp-qr-image')).toBeVisible({ timeout: 5000 });

    // Reveal the manual secret
    const details = page.locator('details').filter({ hasText: /scan/i });
    await details.click();
    const secretEl = page.getByTestId('totp-secret');
    await expect(secretEl).toBeVisible({ timeout: 5000 });
    const secret = (await secretEl.textContent())!.trim();
    expect(secret.length).toBeGreaterThan(0);

    // Advance to confirm step
    await page.getByTestId('qr-scanned-btn').click();
    await expect(page.getByTestId('totp-confirm-step')).toBeVisible({ timeout: 5000 });

    // Generate a valid TOTP code from the displayed secret and confirm
    const code = generateTOTP(secret);
    await enterTOTP(page, code);

    // Recovery codes should appear
    await expect(page.getByTestId('recovery-codes-display')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('recovery-code-0')).toBeVisible();

    // Acknowledge and finish
    await page.getByTestId('acknowledge-codes-checkbox').check();
    await page.getByTestId('codes-done-btn').click();

    const mfaEnabled = dbExec(
      `SELECT enabled FROM mfa_credential WHERE user_id = '${user.id}' AND method_type = 'totp'`
    );
    expect(mfaEnabled).toBe('t');
  });

  test('shows error for wrong confirmation code during setup', async ({ page }) => {
    const user = createTestUser({ name: 'MFA', lastName: 'BadCode' });
    cleanupIds.push(user.id);

    await loginAndNavigateTo(page, user.email, user.password, '/account?tab=security');

    await page.getByTestId('open-2fa-modal-btn').click();
    await expect(page.getByTestId('totp-qr-step')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('qr-scanned-btn').click();
    await expect(page.getByTestId('totp-confirm-step')).toBeVisible({ timeout: 5000 });

    await enterTOTP(page, '000000');

    await expect(page.getByTestId('totp-error')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('totp-confirm-step')).toBeVisible();
  });
});

test.describe('MFA Disable from Profile', () => {
  let user: TestUser;
  let totpSecret: string;

  test.beforeAll(async () => {
    user = createTestUser({ name: 'MFA', lastName: 'Disable' });
    const mfa = await enableMfa(user.apiKey);
    totpSecret = mfa.secret;
  });

  test.afterAll(() => {
    cleanupUser(user.id);
  });

  test('disables 2FA with a valid TOTP code', async ({ page }) => {
    await loginWithMfaAndNavigateTo(
      page,
      user.email,
      user.password,
      totpSecret,
      '/account?tab=security'
    );

    await page.getByTestId('open-2fa-modal-btn').click();
    await expect(page.getByTestId('mfa-enabled-section')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('disable-2fa-btn').click();

    await enterTOTPWithRetry(page, totpSecret);

    // After disable, SecuritySettings re-fetches status and renders TotpSetup
    // with autoStart, which jumps directly to the QR step
    await expect(page.getByTestId('totp-qr-step')).toBeVisible({ timeout: 15000 });

    const mfaEnabled = dbExec(
      `SELECT count(*) FROM mfa_credential WHERE user_id = '${user.id}' AND enabled = true`
    );
    expect(mfaEnabled).toBe('0');
  });
});

test.describe('MFA Recovery Code Management', () => {
  let user: TestUser;
  let totpSecret: string;

  test.beforeAll(async () => {
    user = createTestUser({ name: 'MFA', lastName: 'Recovery' });
    const mfa = await enableMfa(user.apiKey);
    totpSecret = mfa.secret;
  });

  test.afterAll(() => {
    cleanupUser(user.id);
  });

  test('displays recovery codes after setup with copy and download buttons', async ({ page }) => {
    const freshUser = createTestUser({ name: 'MFA', lastName: 'CodesUI' });

    await loginAndNavigateTo(page, freshUser.email, freshUser.password, '/account?tab=security');

    await page.getByTestId('open-2fa-modal-btn').click();
    await expect(page.getByTestId('totp-qr-step')).toBeVisible({ timeout: 10000 });

    await page.locator('summary').filter({ hasText: /scan/i }).click();
    const secret = (await page.getByTestId('totp-secret').textContent())!.trim();

    await page.getByTestId('qr-scanned-btn').click();
    const code = generateTOTP(secret);
    await enterTOTP(page, code);

    await expect(page.getByTestId('recovery-codes-display')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('copy-codes-btn')).toBeVisible();
    await expect(page.getByTestId('download-codes-btn')).toBeVisible();

    // Done button is disabled until acknowledgement
    await expect(page.getByTestId('codes-done-btn')).toBeDisabled();
    await page.getByTestId('acknowledge-codes-checkbox').check();
    await expect(page.getByTestId('codes-done-btn')).toBeEnabled();

    await page.getByTestId('codes-done-btn').click();
    cleanupUser(freshUser.id);
  });

  test('regenerates recovery codes from profile security settings', async ({ page }) => {
    await loginWithMfaAndNavigateTo(
      page,
      user.email,
      user.password,
      totpSecret,
      '/account?tab=security'
    );

    await page.getByTestId('open-2fa-modal-btn').click();
    await expect(page.getByTestId('mfa-enabled-section')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('regenerate-codes-btn').click();

    // Regeneration requires TOTP confirmation
    await enterTOTPWithRetry(page, totpSecret);

    await expect(page.getByTestId('recovery-codes-display')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('recovery-code-0')).toBeVisible();

    await page.getByTestId('acknowledge-codes-checkbox').check();
    await page.getByTestId('codes-done-btn').click();

    await expect(page.getByTestId('mfa-enabled-section')).toBeVisible({ timeout: 10000 });
  });
});
