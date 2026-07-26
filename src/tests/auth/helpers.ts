/**
 * Shared Playwright helpers for auth E2E tests.
 *
 * Prerequisites (use local.sh to start the full stack):
 *   - Console running at http://localhost:3000
 *   - Orchestra running at http://localhost:8000
 *   - PostgreSQL (orchestra-local-db container)
 *   - Console and Playwright seeds must use ORCHESTRA_URL as the API **origin**
 *     only, e.g. http://127.0.0.1:8000 — not …/v0 (local.sh’s UNIFY_BASE_URL includes /v0;
 *     do not copy that value into ORCHESTRA_URL).
 */

import { expect, type Page } from '@playwright/test';
import { setKnownVerificationCode } from '../helpers/e2e-helpers';

export {
  createTestUser,
  cleanupUser,
  createOAuthOnlyUser,
  setKnownVerificationCode,
  generateTOTP,
  needsFreshTotpWindow,
} from '../helpers/e2e-helpers';
export type { TestUser } from '../helpers/e2e-helpers';
export {
  uniqueEmail,
  dbExec,
  apiJson,
  orchestraFetch,
  createUser,
  createOrg,
  createEmailLogin,
  deleteOrg,
} from '../helpers/seeds/client';
export type { SeededOrg } from '../helpers/seeds/types';

// =============================================================================
// UI Helpers
// =============================================================================

/** Wait until the login page leaves the sign-out / session-loading spinner. */
export async function waitForLoginSurface(page: Page, timeout = 30_000): Promise<void> {
  await expect(
    page
      .locator(
        '[data-testid="dev-quick-login"], [data-testid="email-auth-tab"], [data-testid="email-login-form"]'
      )
      .first()
  ).toBeVisible({ timeout });
}

/** Switch to the email sign-in form (the surface may open on OAuth or register). */
export async function switchToEmailTab(page: Page) {
  if (!page.url().includes('/login')) return;

  const emailForm = page.getByTestId('email-login-form');
  const registerForm = page.getByTestId('email-register-form');
  const emailTab = page.getByTestId('email-auth-tab');

  // The login fragment is client-rendered; on a cold or loaded dev server it can
  // take several seconds to hydrate. Wait for any auth control to appear before
  // probing individual states so we don't race hydration and mis-route.
  await page
    .locator(
      '[data-testid="email-login-form"], [data-testid="email-register-form"], [data-testid="email-auth-tab"]'
    )
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });

  if (await emailForm.isVisible().catch(() => false)) return;

  // Surfaces that show OAuth buttons gate the email form behind an "email" tab.
  if (await emailTab.isVisible().catch(() => false)) {
    await emailTab.scrollIntoViewIfNeeded();
    try {
      await emailTab.click({ timeout: 5_000 });
    } catch {
      if (!page.url().includes('/login')) return;
      await emailTab.click({ force: true, timeout: 5_000 });
    }
  }

  // The managed / self-host surface opens in register mode — flip to sign-in.
  if (await registerForm.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByTestId('switch-to-login').click();
  }

  await expect(emailForm).toBeVisible({ timeout: 10_000 });
}

async function fillLoginForm(page: Page, email: string, password: string) {
  await switchToEmailTab(page);
  if (!page.url().includes('/login')) return;
  await page.getByTestId('email-input').fill(email, { timeout: 5_000 });
  const passwordInput = page.getByTestId('email-password-input');
  if (await passwordInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await passwordInput.fill(password, { timeout: 5_000 });
  }
}

/** Fill the email login form and submit. */
export async function login(page: Page, email: string, password: string) {
  await fillLoginForm(page, email, password);
  await page.getByTestId('email-submit-btn').click();
}

/**
 * Mint a session via the pre-auth API + NextAuth credentials callback.
 *
 * Avoids the login UI, which can push the email tab off-screen when the dev
 * quick-login panel lists many seeded users. Returns false when Orchestra rejects
 * the credentials so callers can fall back to the browser form.
 */
export async function loginWithPreAuthApi(
  page: Page,
  email: string,
  password: string,
  timeout = 30_000
): Promise<boolean> {
  const origin = process.env.BASE_URL || 'http://localhost:3000';

  const authRes = await page.request.post(`${origin}/api/auth/email/authenticate`, {
    data: { email, password },
  });
  if (!authRes.ok()) return false;

  const { preAuthToken } = (await authRes.json()) as { preAuthToken?: string };
  if (!preAuthToken) return false;

  const csrfRes = await page.request.get(`${origin}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrfToken) return false;

  const callbackRes = await page.request.post(`${origin}/api/auth/callback/credentials`, {
    form: {
      csrfToken,
      email,
      password,
      preAuthToken,
      callbackUrl: `${origin}/assistants`,
      json: 'true',
    },
  });
  if (!callbackRes.ok()) return false;

  await page.goto('/assistants', { waitUntil: 'domcontentloaded', timeout });
  return new URL(page.url()).pathname !== '/login';
}

/**
 * Submit the email login form and wait for the post-login redirect.
 *
 * Use this in fixtures that expect authentication to succeed. It starts
 * waiting before clicking submit so fast client-side redirects cannot race
 * past the assertion.
 */
export async function loginAndWaitForRedirect(
  page: Page,
  email: string,
  password: string,
  timeout = 30_000
) {
  if (await loginWithPreAuthApi(page, email, password, timeout)) return;

  await fillLoginForm(page, email, password);
  if (!page.url().includes('/login')) return;
  const loginFormHidden = page
    .getByTestId('email-login-form')
    .waitFor({ state: 'hidden', timeout });
  await Promise.all([
    Promise.race([
      page.waitForURL((url) => url.pathname !== '/login', {
        timeout,
        waitUntil: 'domcontentloaded',
      }),
      loginFormHidden,
    ]),
    page.getByTestId('email-submit-btn').click(),
  ]);
}

/** Fill the registration form and submit. */
export async function register(
  page: Page,
  email: string,
  password: string,
  firstName = 'Test',
  lastName = 'User'
) {
  await switchToEmailTab(page);
  const switchBtn = page.getByTestId('switch-to-register');
  if (await switchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await switchBtn.click();
  }
  await expect(page.getByTestId('email-register-form')).toBeVisible({ timeout: 3000 });

  await page.getByTestId('email-first-name-input').fill(firstName);
  await page.getByTestId('email-last-name-input').fill(lastName);
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('email-password-input').fill(password);
  await page.getByTestId('email-submit-btn').click();
}

/** Enter a 6-digit code into the verification code input (auto-submits on 6th digit). */
export async function enterVerificationCode(page: Page, code: string) {
  for (let i = 0; i < 6; i++) {
    await page.getByTestId(`code-digit-${i}`).fill(code[i]);
  }
}

/**
 * Submit registration and reach post-auth state. Handles both Orchestra paths:
 * email verification UI, or auto-verify + redirect when verification is skipped.
 */
export async function registerAndCompleteSignup(
  page: Page,
  email: string,
  password: string
): Promise<'verified' | 'auto'> {
  await register(page, email, password);

  await expect
    .poll(
      async () => {
        const url = page.url();
        if (/onboarding|\/assistants/.test(url)) return 'done';
        if (
          await page
            .getByTestId('verification-code-input')
            .isVisible()
            .catch(() => false)
        ) {
          return 'verify';
        }
        if (
          await page
            .getByTestId('email-auth-error')
            .isVisible()
            .catch(() => false)
        ) {
          return 'error';
        }
        return 'pending';
      },
      { timeout: 20_000 }
    )
    .not.toBe('pending');

  if (
    await page
      .getByTestId('email-auth-error')
      .isVisible()
      .catch(() => false)
  ) {
    const message = await page.getByTestId('email-auth-error').textContent();
    throw new Error(`Registration failed: ${message ?? 'unknown error'}`);
  }

  if (
    await page
      .getByTestId('verification-code-input')
      .isVisible()
      .catch(() => false)
  ) {
    const code = setKnownVerificationCode(email, 'signup');
    await enterVerificationCode(page, code);
    await page.waitForURL(/onboarding|\/assistants/, { timeout: 20_000 });
    return 'verified';
  }

  return 'auto';
}

/**
 * Complete email registration through verification, without assuming a
 * particular post-auth landing page (onboarding vs assistants).
 */
export async function registerThroughVerification(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await register(page, email, password);

  await expect
    .poll(
      async () => {
        const url = page.url();
        if (/onboarding|\/assistants/.test(url)) return 'done';
        if (
          await page
            .getByTestId('verification-code-input')
            .isVisible()
            .catch(() => false)
        ) {
          return 'verify';
        }
        if (
          await page
            .getByTestId('email-auth-error')
            .isVisible()
            .catch(() => false)
        ) {
          return 'error';
        }
        return 'pending';
      },
      { timeout: 20_000 }
    )
    .not.toBe('pending');

  if (
    await page
      .getByTestId('email-auth-error')
      .isVisible()
      .catch(() => false)
  ) {
    const message = await page.getByTestId('email-auth-error').textContent();
    throw new Error(`Registration failed: ${message ?? 'unknown error'}`);
  }

  if (
    await page
      .getByTestId('verification-code-input')
      .isVisible()
      .catch(() => false)
  ) {
    const code = setKnownVerificationCode(email, 'signup');
    await enterVerificationCode(page, code);
    await page.waitForURL(/onboarding|\/assistants/, { timeout: 20_000 });
  }
}

/** Complete the acquisition survey when it is the current onboarding step. */
export async function completeHeardAboutOnboardingIfNeeded(page: Page): Promise<void> {
  const heardContinue = page.getByTestId('heard-about-continue');
  if (!(await heardContinue.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return;
  }
  await page.getByTestId('heard-about-search').click();
  await heardContinue.click();
  await expect(page.getByTestId('workspace-personal')).toBeVisible({ timeout: 15_000 });
}

/** Open workspace onboarding when middleware does not auto-redirect there. */
export async function ensureWorkspaceOnboardingPage(page: Page): Promise<void> {
  if (!page.url().includes('/login/onboarding')) {
    await page.goto('/login/onboarding', { waitUntil: 'domcontentloaded' });
  }
  await completeHeardAboutOnboardingIfNeeded(page);
  await expect(page.getByTestId('workspace-personal')).toBeVisible({ timeout: 15_000 });
}

/**
 * If the browser landed on /login/onboarding, finish heard-about + personal
 * workspace so the test can continue into the product.
 */
export async function completeAccountOnboardingIfPresent(page: Page): Promise<void> {
  if (!page.url().includes('/login/onboarding')) return;
  await completeHeardAboutOnboardingIfNeeded(page);
  const personalBtn = page.getByTestId('workspace-personal');
  if (await personalBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await personalBtn.click();
    await page.getByTestId('workspace-continue').click();
    await page.waitForURL((url) => !url.pathname.includes('onboarding'), { timeout: 15_000 });
  }
}

/** Whether the registration flow landed on the email verification step. */
export async function registrationShowsVerificationStep(page: Page): Promise<boolean> {
  return page
    .getByTestId('verification-code-input')
    .isVisible({ timeout: 10_000 })
    .catch(() => false);
}

/** Enter a 6-digit TOTP code (auto-submits on 6th digit). */
export async function enterTOTP(page: Page, code: string) {
  for (let i = 0; i < 6; i++) {
    await page.getByTestId(`totp-digit-${i}`).fill(code[i]);
  }
}

// =============================================================================
// Async Setup Helpers (Orchestra API)
// =============================================================================

/**
 * Enable MFA for a user via Orchestra's API.
 * Returns the base32 TOTP secret (for generating codes) and recovery codes.
 */
export async function enableMfa(
  apiKey: string
): Promise<{ secret: string; recoveryCodes: string[] }> {
  const { orchestraFetch: oFetch } = await import('../helpers/seeds/client');
  const { generateTOTP: genTOTP } = await import('../helpers/e2e-helpers');

  const setupRes = await oFetch('/v0/auth/mfa/setup', { method: 'POST' }, apiKey);
  if (!setupRes.ok) throw new Error(`MFA setup failed: ${setupRes.status}`);
  const setupData = await setupRes.json();

  const qrUri: string = setupData.qr_code_uri ?? setupData.qrCodeUri;
  const url = new URL(qrUri);
  const secret = url.searchParams.get('secret')!;

  const code = genTOTP(secret);
  const confirmRes = await oFetch(
    '/v0/auth/mfa/confirm',
    { method: 'POST', body: JSON.stringify({ code }) },
    apiKey
  );
  if (!confirmRes.ok) throw new Error(`MFA confirm failed: ${confirmRes.status}`);
  const confirmData = await confirmRes.json();

  return {
    secret,
    recoveryCodes: confirmData.recovery_codes ?? confirmData.recoveryCodes ?? [],
  };
}

/**
 * Disable MFA for a user via Orchestra's API.
 */
export async function disableMfa(apiKey: string, totpCode: string): Promise<void> {
  const { orchestraFetch: oFetch } = await import('../helpers/seeds/client');
  const res = await oFetch(
    '/v0/auth/mfa',
    { method: 'DELETE', body: JSON.stringify({ code: totpCode }) },
    apiKey
  );
  if (!res.ok) throw new Error(`MFA disable failed: ${res.status}`);
}

/**
 * Create an org invite via Orchestra's API. Returns the invite token.
 */
export async function createInviteToken(
  orgApiKey: string,
  orgId: number,
  email: string
): Promise<string> {
  const { orchestraFetch: oFetch, dbExec: db } = await import('../helpers/seeds/client');

  const roleId = db(`SELECT id FROM role WHERE name = 'Member' AND is_system_role = true LIMIT 1`);

  const res = await oFetch(
    `/v0/organizations/${orgId}/invites`,
    { method: 'POST', body: JSON.stringify({ email, role_id: parseInt(roleId, 10) }) },
    orgApiKey
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Invite creation failed: ${res.status} ${text}`);
  }

  const token = db(
    `SELECT token FROM organization_invite WHERE invitee_email = '${email.toLowerCase()}' AND organization_id = ${orgId} ORDER BY created_at DESC LIMIT 1`
  );
  return token;
}

/**
 * Login via the browser for an MFA-enabled user.
 * Handles the MFA gate and onboarding, then navigates to targetUrl.
 */
export async function loginWithMfaAndNavigateTo(
  page: Page,
  email: string,
  password: string,
  totpSecret: string,
  targetUrl: string
) {
  const { generateTOTP: genTOTP } = await import('../helpers/e2e-helpers');

  await page.goto('/login');
  await loginAndWaitForRedirect(page, email, password, 20_000);

  if (page.url().includes('/login/mfa')) {
    await completeMfaChallenge(page, totpSecret, genTOTP);
  }

  await completeAccountOnboardingIfPresent(page);

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  if (page.url().includes('/login/mfa')) {
    await completeMfaChallenge(page, totpSecret, genTOTP);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  }
}

/**
 * Enter TOTP on the MFA challenge page with retry logic.
 * If the server rejects the code (replay protection or expiry),
 * waits for the next TOTP time window and retries once.
 */
async function completeMfaChallenge(
  page: Page,
  totpSecret: string,
  genTOTP: (s: string) => string
) {
  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await ensureFreshTotp(page, totpSecret);
    const code = genTOTP(totpSecret);
    const navigation = page
      .waitForURL((url) => !url.pathname.includes('/login/mfa'), {
        timeout: 5_000,
        waitUntil: 'domcontentloaded',
      })
      .then(() => true)
      .catch(() => false);
    await enterTOTP(page, code);

    const navigated = await navigation;

    if (navigated) return;

    const errorVisible = await page
      .locator('text=/invalid|expired/i')
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (errorVisible && attempt < maxAttempts - 1) {
      for (let i = 0; i < 6; i++) {
        await page.getByTestId(`totp-digit-${i}`).fill('');
      }
      continue;
    }

    await page.waitForURL((url) => !url.pathname.includes('/login/mfa'), {
      timeout: 20_000,
      waitUntil: 'domcontentloaded',
    });
    return;
  }
}

/**
 * Wait for the TOTP counter to advance past the last-used value for `secret`.
 * Skips the wait entirely when the counter has already advanced naturally
 * (e.g., enough time elapsed between setup and the test action).
 */
export async function ensureFreshTotp(page: Page, secret: string) {
  const { needsFreshTotpWindow: needsWait } = await import('../helpers/e2e-helpers');
  if (!needsWait(secret)) return;
  const msIntoWindow = Date.now() % 30_000;
  await page.waitForTimeout(30_000 - msIntoWindow + 500);
}

/** @deprecated Use {@link ensureFreshTotp} instead. */
export const waitForNextTotpWindow = ensureFreshTotp;

/**
 * Ensure a fresh TOTP window for `secret`, then generate and enter the code.
 * Only waits when the current counter was already consumed by a prior operation.
 */
export async function enterTOTPWithRetry(page: Page, totpSecret: string) {
  const { generateTOTP: genTOTP } = await import('../helpers/e2e-helpers');
  await ensureFreshTotp(page, totpSecret);
  const code = genTOTP(totpSecret);
  await enterTOTP(page, code);
}

export async function waitForSecurityTabReady(page: Page): Promise<void> {
  await expect(page.getByTestId('open-password-modal-btn')).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByTestId('open-2fa-modal-btn')).toBeVisible({ timeout: 10_000 });
}

export async function loginAndNavigateTo(
  page: Page,
  email: string,
  password: string,
  targetUrl: string
) {
  await page.goto('/login');
  await loginAndWaitForRedirect(page, email, password, 20_000);

  await completeAccountOnboardingIfPresent(page);

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  if (targetUrl.includes('/account') && targetUrl.includes('tab=security')) {
    await waitForSecurityTabReady(page);
  }
}
