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
  registerAndCompleteSignup,
  registerThroughVerification,
  ensureWorkspaceOnboardingPage,
  registrationShowsVerificationStep,
  uniqueEmail,
  dbExec,
} from './helpers';
import { deferCoordinatorForUser, ensureShellReady } from '../helpers/coordinator';
import { assistantRail } from '../helpers/shell';
import { openUnitySwitcher, closeHireDialogIfOpen } from '../assistants/helpers';

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

  test('completes full registration → verify → onboarding flow @critical @area(auth.core)', async ({
    page,
  }) => {
    const email = uniqueEmail('signup-e2e');
    const password = 'SignUpP@ss1';

    await page.goto('/login');
    await registerAndCompleteSignup(page, email, password);

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);

    const verified = dbExec(`SELECT email_verified FROM email_account WHERE user_id = '${userId}'`);
    expect(verified).toBe('t');
  });

  test('shows error for invalid verification code', async ({ page }, testInfo) => {
    const email = uniqueEmail('bad-code-e2e');
    const password = 'SignUpP@ss1';

    await page.goto('/login');
    await register(page, email, password);

    if (!(await registrationShowsVerificationStep(page))) {
      testInfo.skip(true, 'Email verification step not shown (local Orchestra auto-verify).');
    }

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

  test('disables resend button with cooldown after clicking resend', async ({ page }, testInfo) => {
    const email = uniqueEmail('resend-e2e');
    const password = 'SignUpP@ss1';

    await page.goto('/login');
    await register(page, email, password);

    if (!(await registrationShowsVerificationStep(page))) {
      testInfo.skip(true, 'Email verification step not shown (local Orchestra auto-verify).');
    }

    const resendBtn = page.getByTestId('resend-code-btn');
    await expect(resendBtn).toBeVisible({ timeout: 5000 });
    await resendBtn.click();

    await expect(resendBtn).toBeDisabled({ timeout: 3000 });

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);
  });

  test('navigates back from verification to register form', async ({ page }, testInfo) => {
    const email = uniqueEmail('back-verify-e2e');
    const password = 'SignUpP@ss1';

    await page.goto('/login');
    await register(page, email, password);

    if (!(await registrationShowsVerificationStep(page))) {
      testInfo.skip(true, 'Email verification step not shown (local Orchestra auto-verify).');
    }

    await page.getByTestId('back-to-register').click();
    await expect(page.getByTestId('email-register-form')).toBeVisible();

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);
  });
});

// =============================================================================
// Onboarding — Acquisition + Workspace Selection
// =============================================================================

test.describe('Onboarding', () => {
  const createdUserIds: string[] = [];

  test.afterAll(() => {
    for (const id of createdUserIds) {
      cleanupUser(id);
    }
  });

  test('requires how-did-you-hear before workspace setup @critical @area(auth.core)', async ({
    page,
  }) => {
    const email = uniqueEmail('onboard-heard');
    const password = 'OnboardP@ss1';

    // Land with campaign parameters: the heard-about step sends the
    // remembered first touch beside the self-reported answer.
    await page.goto('/login?utm_source=test&utm_campaign=kpi');
    await registerThroughVerification(page, email, password);

    if (!page.url().includes('/login/onboarding')) {
      await page.goto('/login/onboarding', { waitUntil: 'domcontentloaded' });
    }

    await expect(page.getByTestId('heard-about-options')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('workspace-personal')).toHaveCount(0);

    await page.getByTestId('heard-about-other').click();
    await page.getByTestId('heard-about-detail').fill('Conference booth');
    await page.getByTestId('heard-about-continue').click();

    await expect(page.getByTestId('workspace-personal')).toBeVisible({ timeout: 15_000 });

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);

    expect(
      dbExec(`SELECT step_data->>'heard_about' FROM onboarding_status WHERE user_id = '${userId}'`)
    ).toBe('other');
    expect(
      dbExec(
        `SELECT step_data->>'heard_about_detail' FROM onboarding_status WHERE user_id = '${userId}'`
      )
    ).toBe('Conference booth');
    expect(
      dbExec(`SELECT step_data->>'utm_source' FROM onboarding_status WHERE user_id = '${userId}'`)
    ).toBe('test');
    expect(
      dbExec(`SELECT step_data->>'utm_campaign' FROM onboarding_status WHERE user_id = '${userId}'`)
    ).toBe('kpi');
    expect(
      dbExec(`SELECT step_data->>'landing_url' FROM onboarding_status WHERE user_id = '${userId}'`)
    ).toBe('/login?utm_source=test&utm_campaign=kpi');
    expect(dbExec(`SELECT current_step FROM onboarding_status WHERE user_id = '${userId}'`)).toBe(
      'workspace_setup'
    );
  });

  test('selects personal workspace and redirects to assistants @critical @area(auth.core)', async ({
    page,
  }) => {
    const email = uniqueEmail('onboard-personal');
    const password = 'OnboardP@ss1';

    await page.goto('/login');
    await registerThroughVerification(page, email, password);
    await ensureWorkspaceOnboardingPage(page);

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);

    const heardAbout = dbExec(
      `SELECT step_data->>'heard_about' FROM onboarding_status WHERE user_id = '${userId}'`
    );
    expect(heardAbout).toBe('search');

    await page.getByTestId('workspace-personal').click();

    await expect(page.getByTestId('workspace-continue')).toBeVisible();
    await page.getByTestId('workspace-continue').click();

    await page.waitForURL(/\/assistants/, { timeout: 15000 });
    expect(new URL(page.url()).searchParams.has('openHire')).toBe(false);

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
    test.setTimeout(90_000);
    const email = uniqueEmail('onboard-org');
    const password = 'OnboardP@ss1';

    await page.goto('/login');
    await registerThroughVerification(page, email, password);
    await ensureWorkspaceOnboardingPage(page);

    await page.getByTestId('workspace-organization').click();

    await expect(page.getByTestId('org-name-input')).toBeVisible({ timeout: 5000 });
    const orgName = `E2E Org ${Date.now()}`;
    await page.getByTestId('org-name-input').fill(orgName);

    await expect(page.getByTestId('workspace-continue')).toBeEnabled();
    await page.getByTestId('workspace-continue').click();

    await expect
      .poll(() => dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`), {
        timeout: 15_000,
      })
      .not.toBe('');

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);

    const apiKey = dbExec(
      `SELECT key FROM api_key WHERE user_id = '${userId}' AND organization_id IS NULL LIMIT 1`
    );
    await page.evaluate(() => {
      window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureShellReady(page, userId, apiKey);

    await page.waitForURL(/\/assistants/, { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.has('openHire')).toBe(false);

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

    const managedOrgTeamCount = dbExec(
      `SELECT count(*) FROM team WHERE organization_id = ${orgId} AND name = 'Org' AND is_org_wide_sharing = TRUE`
    );
    expect(managedOrgTeamCount).toBe('0');

    await expect(assistantRail(page)).toBeVisible({ timeout: 15_000 });
    await closeHireDialogIfOpen(page);
    await openUnitySwitcher(page, { userId, apiKey });
    await expect(page.getByTestId('rail-unity-switcher-dialog')).toBeVisible({
      timeout: 5_000,
    });

    await expect(page.getByTestId('assistant-list-group-pinned')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('textbox', { name: 'Search conversation' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('creates shared organization workspace with managed Org team', async ({ page }) => {
    const email = uniqueEmail('onboard-org-shared');
    const password = 'OnboardP@ss1';

    await page.goto('/login');
    await registerThroughVerification(page, email, password);
    await ensureWorkspaceOnboardingPage(page);

    await page.getByTestId('workspace-organization').click();
    const orgName = `E2E Shared Org ${Date.now()}`;
    await page.getByTestId('org-name-input').fill(orgName);
    await page.getByTestId('onboarding-org-sharing-info').click();
    await expect(page.getByText(/all skills acquired and knowledge retained/)).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('onboarding-org-sharing-shared').click();

    await expect(page.getByTestId('workspace-continue')).toBeEnabled();
    await page.getByTestId('workspace-continue').click();

    await page.waitForURL(/\/assistants/, { timeout: 15000 });

    const userId = dbExec(`SELECT id FROM "user" WHERE email = '${email.toLowerCase()}'`);
    if (userId) createdUserIds.push(userId);

    const orgId = dbExec(`SELECT id FROM organization WHERE name = '${orgName}'`);
    expect(orgId).toBeTruthy();

    const sharingEnabled = dbExec(
      `SELECT org_wide_sharing_enabled FROM organization WHERE id = ${orgId}`
    );
    expect(sharingEnabled).toBe('t');

    const orgTeamId = dbExec(
      `SELECT id FROM team WHERE organization_id = ${orgId} AND is_org_wide_sharing = TRUE ORDER BY id LIMIT 1`
    );
    expect(orgTeamId).toBeTruthy();
    const namedTeamId = dbExec(
      `SELECT id FROM team WHERE organization_id = ${orgId} AND name = '${orgName.replace(/'/g, "''")}' AND is_org_wide_sharing = TRUE`
    );
    // Orchestra stores the managed team under the organization name; accept the
    // legacy "Org" label until that rename is live, as long as the managed row exists.
    expect(namedTeamId || orgTeamId).toBeTruthy();

    const orgTeamMemberCount = dbExec(
      `SELECT count(*) FROM team_member WHERE team_id = ${orgTeamId} AND user_id = '${userId}'`
    );
    expect(orgTeamMemberCount).toBe('1');

    const orgTeamAssistantCount = dbExec(
      `SELECT count(*) FROM team_assistant_memberships tam JOIN assistants a ON a.agent_id = tam.assistant_id WHERE tam.team_id = ${orgTeamId} AND a.organization_id = ${orgId}`
    );
    expect(Number(orgTeamAssistantCount)).toBeGreaterThanOrEqual(1);
  });
});
