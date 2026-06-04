/**
 * Signup E2E — registration → verify → onboarding, weak password,
 * duplicate email, provider conflict, invalid verification code,
 * resend cooldown, back-navigation, and onboarding workspace selection.
 *
 * Run: npx playwright test src/tests/auth/signup.e2e.ts
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createOAuthOnlyUser,
  setKnownVerificationCode,
  switchToEmailTab,
  register,
  enterVerificationCode,
  uniqueEmail,
  dbExec,
} from './helpers';

// =============================================================================
// Registration
// =============================================================================

test.describe('Signup', () => {
  const createdUserIds: string[] = [];

  test.afterAll(() => {
    for (const id of createdUserIds) {
      cleanupUser(id);
    }
  });

  test('completes full registration → verify → onboarding flow', async ({ page }) => {
    const email = uniqueEmail('signup-e2e');
    const password = 'SignUpP@ss1';

    await page.goto('/login');
    await register(page, email, password);

    await expect(page.getByTestId('verification-code-input')).toBeVisible({ timeout: 10000 });

    const code = setKnownVerificationCode(email, 'signup');
    await enterVerificationCode(page, code);

    await page.waitForURL(
      (url) => !url.pathname.startsWith('/login') || url.pathname.includes('onboarding'),
      { timeout: 15000 }
    );

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);

    const verified = dbExec(`SELECT email_verified FROM email_account WHERE user_id = '${userId}'`);
    expect(verified).toBe('t');
  });

  test('shows error for invalid verification code', async ({ page }) => {
    const email = uniqueEmail('bad-code-e2e');
    const password = 'SignUpP@ss1';

    await page.goto('/login');
    await register(page, email, password);

    await expect(page.getByTestId('verification-code-input')).toBeVisible({ timeout: 10000 });

    await enterVerificationCode(page, '999999');

    await expect(page.getByTestId('verification-error')).toBeVisible({ timeout: 5000 });
    const errorText = await page.getByTestId('verification-error').textContent();
    expect(errorText).toMatch(/invalid|expired/i);

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);
  });

  test('rejects weak password client-side', async ({ page }) => {
    await page.goto('/login');
    await switchToEmailTab(page);
    await page.getByTestId('switch-to-register').click();
    await expect(page.getByTestId('email-register-form')).toBeVisible({ timeout: 3000 });

    await page.getByTestId('email-first-name-input').fill('Weak');
    await page.getByTestId('email-last-name-input').fill('Password');
    await page.getByTestId('email-input').fill('weak-pw-test@example.com');
    await page.getByTestId('email-password-input').fill('short');

    await expect(page.getByTestId('password-strength')).toBeVisible();

    await page.getByTestId('email-submit-btn').click();

    await expect(page.getByTestId('email-register-form')).toBeVisible();
  });

  test('shows error when registering with existing email', async ({ page }) => {
    const existingUser = createTestUser({ name: 'Existing', lastName: 'User' });
    createdUserIds.push(existingUser.id);

    await page.goto('/login');
    await register(page, existingUser.email, 'AnotherP@ss1');

    await expect(page.getByTestId('email-auth-error')).toBeVisible({ timeout: 5000 });
  });

  test('shows provider conflict when registering with OAuth-only email', async ({ page }) => {
    const oauthUser = createOAuthOnlyUser({
      name: 'OAuthReg',
      lastName: 'Conflict',
      provider: 'google',
    });
    createdUserIds.push(oauthUser.id);

    await page.goto('/login');
    await register(page, oauthUser.email, 'StrongP@ss1');

    await expect(page.getByTestId('email-auth-error')).toBeVisible({ timeout: 5000 });
    const errorText = await page.getByTestId('email-auth-error').textContent();
    expect(errorText).toMatch(/already exists|sign in/i);
  });

  test('disables resend button with cooldown after clicking resend', async ({ page }) => {
    const email = uniqueEmail('resend-e2e');
    const password = 'SignUpP@ss1';

    await page.goto('/login');
    await register(page, email, password);

    await expect(page.getByTestId('verification-code-input')).toBeVisible({ timeout: 10000 });

    const resendBtn = page.getByTestId('resend-code-btn');
    await expect(resendBtn).toBeVisible({ timeout: 5000 });
    await resendBtn.click();

    await expect(resendBtn).toBeDisabled({ timeout: 3000 });

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);
  });

  test('navigates back from verification to register form', async ({ page }) => {
    const email = uniqueEmail('back-verify-e2e');
    const password = 'SignUpP@ss1';

    await page.goto('/login');
    await register(page, email, password);

    await expect(page.getByTestId('verification-code-input')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('back-to-register').click();
    await expect(page.getByTestId('email-register-form')).toBeVisible();

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);
  });
});

// =============================================================================
// Onboarding — Workspace Selection
// =============================================================================

test.describe('Onboarding', () => {
  const createdUserIds: string[] = [];

  test.afterAll(() => {
    for (const id of createdUserIds) {
      cleanupUser(id);
    }
  });

  test('selects personal workspace and redirects to assistants', async ({ page }) => {
    const email = uniqueEmail('onboard-personal');
    const password = 'OnboardP@ss1';

    await page.goto('/login');
    await register(page, email, password);
    await expect(page.getByTestId('verification-code-input')).toBeVisible({ timeout: 10000 });
    const code = setKnownVerificationCode(email, 'signup');
    await enterVerificationCode(page, code);

    await page.waitForURL(/onboarding/, { timeout: 15000 });

    await expect(page.getByTestId('workspace-personal')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('workspace-personal').click();

    await expect(page.getByTestId('workspace-continue')).toBeVisible();
    await page.getByTestId('workspace-continue').click();

    await page.waitForURL(/\/assistants/, { timeout: 15000 });
    expect(new URL(page.url()).searchParams.has('openHire')).toBe(false);

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);

    const personalCoordinatorId = dbExec(
      `SELECT agent_id FROM assistants WHERE user_id = '${userId}' AND organization_id IS NULL AND is_coordinator = TRUE`
    );
    expect(personalCoordinatorId).toBeTruthy();

    const personalCoordinatorCount = dbExec(
      `SELECT count(*) FROM assistants WHERE user_id = '${userId}' AND organization_id IS NULL AND is_coordinator = TRUE`
    );
    expect(personalCoordinatorCount).toBe('1');
  });

  test('creates organization workspace with personal Coordinator pinned and redirects to assistants', async ({
    page,
  }) => {
    const email = uniqueEmail('onboard-org');
    const password = 'OnboardP@ss1';

    await page.goto('/login');
    await register(page, email, password);
    await expect(page.getByTestId('verification-code-input')).toBeVisible({ timeout: 10000 });
    const code = setKnownVerificationCode(email, 'signup');
    await enterVerificationCode(page, code);

    await page.waitForURL(/onboarding/, { timeout: 15000 });

    await expect(page.getByTestId('workspace-organization')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('workspace-organization').click();

    await expect(page.getByTestId('org-name-input')).toBeVisible({ timeout: 5000 });
    const orgName = `E2E Org ${Date.now()}`;
    await page.getByTestId('org-name-input').fill(orgName);

    await expect(page.getByTestId('workspace-continue')).toBeEnabled();
    await page.getByTestId('workspace-continue').click();

    await page.waitForURL(/\/assistants/, { timeout: 15000 });
    expect(new URL(page.url()).searchParams.has('openHire')).toBe(false);

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);

    const orgId = dbExec(`SELECT id FROM organization WHERE name = '${orgName}'`);
    expect(orgId).toBeTruthy();

    const coordinatorId = dbExec(
      `SELECT agent_id FROM assistants WHERE user_id = '${userId}' AND organization_id IS NULL AND is_coordinator = TRUE`
    );
    expect(coordinatorId).toBeTruthy();

    const coordinatorCount = dbExec(
      `SELECT count(*) FROM assistants WHERE user_id = '${userId}' AND organization_id IS NULL AND is_coordinator = TRUE`
    );
    expect(coordinatorCount).toBe('1');

    const orgCoordinatorCount = dbExec(
      `SELECT count(*) FROM assistants WHERE organization_id = ${orgId} AND is_coordinator = TRUE`
    );
    expect(orgCoordinatorCount).toBe('0');

    const coordinatorRow = page.getByTestId(`assistant-list-item-${coordinatorId}`);
    await expect(coordinatorRow).toBeVisible({ timeout: 15000 });
    await expect(coordinatorRow).toContainText('Unity');
  });

  test('keeps Create Organization button disabled with whitespace-only name', async ({ page }) => {
    const email = uniqueEmail('onboard-ws');
    const password = 'OnboardP@ss1';

    await page.goto('/login');
    await register(page, email, password);
    await expect(page.getByTestId('verification-code-input')).toBeVisible({ timeout: 10000 });
    const code = setKnownVerificationCode(email, 'signup');
    await enterVerificationCode(page, code);

    await page.waitForURL(/onboarding/, { timeout: 15000 });

    await page.getByTestId('workspace-organization').click();
    await expect(page.getByTestId('org-name-input')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('org-name-input').fill('   ');
    await expect(page.getByTestId('workspace-continue')).toBeDisabled();

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);
  });

  test('switches between personal and organization choices', async ({ page }) => {
    const email = uniqueEmail('onboard-switch');
    const password = 'OnboardP@ss1';

    await page.goto('/login');
    await register(page, email, password);
    await expect(page.getByTestId('verification-code-input')).toBeVisible({ timeout: 10000 });
    const code = setKnownVerificationCode(email, 'signup');
    await enterVerificationCode(page, code);

    await page.waitForURL(/onboarding/, { timeout: 15000 });

    await page.getByTestId('workspace-personal').click();
    await expect(page.getByTestId('org-name-input')).not.toBeVisible();

    await page.getByTestId('workspace-organization').click();
    await expect(page.getByTestId('org-name-input')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('workspace-personal').click();
    await expect(page.getByTestId('org-name-input')).not.toBeVisible();

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);
  });
});
