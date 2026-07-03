/**
 * Credit Grant Links E2E — claim valid token, invalid token,
 * already-claimed, max-claims-exhausted, unauthenticated.
 *
 * Run: npx playwright test src/tests/billing/credit-grants.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createBillingTest,
  createCreditGrantLink,
  deleteCreditGrantLink,
  clearUserGrantClaims,
  loginAndSaveState,
  dbExec,
} from './helpers';
import {
  deferCoordinatorAfterAssistantsLoad,
  dismissCoordinatorOnboardingIfOpen,
  deferCoordinatorForUser,
} from '../helpers/coordinator';

const user = createTestUser({ name: 'Grant', lastName: 'Main', credits: 100 });
const secondUser = createTestUser({ name: 'Grant', lastName: 'Second', credits: 100 });

const validToken = createCreditGrantLink({ credits: 50 });
const uiClaimToken = createCreditGrantLink({ credits: 25 });
const doubleToken = createCreditGrantLink({ credits: 30 });
const maxToken = createCreditGrantLink({ credits: 20, maxClaims: 1 });

const test = createBillingTest(user);

test.afterAll(() => {
  clearUserGrantClaims(user.id);
  clearUserGrantClaims(secondUser.id);
  deleteCreditGrantLink(validToken);
  deleteCreditGrantLink(uiClaimToken);
  deleteCreditGrantLink(doubleToken);
  deleteCreditGrantLink(maxToken);
  cleanupUser(user.id);
  cleanupUser(secondUser.id);
});

// ---------------------------------------------------------------------------
// UI claim flow (?token= on assistants)
// ---------------------------------------------------------------------------

test('?token= on assistants auto-claims credits and shows success toast @critical @area(billing.credit-grants)', async ({
  authedPage: page,
}) => {
  const creditsBefore = parseFloat(
    dbExec(
      `SELECT credits FROM billing_account WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${user.id}')`
    )
  );

  await deferCoordinatorForUser(user.id, user.apiKey);
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
      window.localStorage.setItem('referral-banner-dismissed', '1');
    } catch {
      /* private mode — ignore */
    }
  });
  await page.goto(`/assistants?token=${uiClaimToken}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('assistant-rail').first()).toBeVisible({ timeout: 20_000 });
  await deferCoordinatorAfterAssistantsLoad(page, user.id, user.apiKey);
  await dismissCoordinatorOnboardingIfOpen(page);

  await expect
    .poll(
      () =>
        parseFloat(
          dbExec(
            `SELECT credits FROM billing_account WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${user.id}')`
          )
        ),
      { timeout: 20_000 }
    )
    .toBeGreaterThanOrEqual(creditsBefore + 25);

  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: /credits claimed/i })
  ).toBeVisible({ timeout: 5_000 });

  const creditsAfter = parseFloat(
    dbExec(
      `SELECT credits FROM billing_account WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${user.id}')`
    )
  );
  expect(creditsAfter).toBeGreaterThanOrEqual(creditsBefore + 25);
});

// ---------------------------------------------------------------------------
// Valid Token
// ---------------------------------------------------------------------------

test('claims a credit grant link and credits are applied @critical @area(billing.credit-grants)', async ({
  authedPage: page,
}) => {
  await page.goto('/assistants');

  const response = await page.evaluate(async (t) => {
    const res = await fetch('/api/user/claim-credit-grant-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t }),
    });
    return { status: res.status, data: await res.json() };
  }, validToken);

  expect(response.status).toBe(200);
  expect(response.data.credits_granted ?? response.data.creditsGranted).toBe(50);

  const credits = dbExec(
    `SELECT credits FROM billing_account WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${user.id}')`
  );
  expect(parseFloat(credits)).toBeGreaterThanOrEqual(150);
});

// ---------------------------------------------------------------------------
// Already Claimed
// ---------------------------------------------------------------------------

test('second claim by same user returns already-claimed message @critical @area(billing.credit-grants)', async ({
  authedPage: page,
}) => {
  await page.goto('/assistants');

  const first = await page.evaluate(async (t) => {
    const res = await fetch('/api/user/claim-credit-grant-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t }),
    });
    return { status: res.status, data: await res.json() };
  }, doubleToken);

  expect(first.status).toBe(200);

  const second = await page.evaluate(async (t) => {
    const res = await fetch('/api/user/claim-credit-grant-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t }),
    });
    return { status: res.status, data: await res.json() };
  }, doubleToken);

  const msg = second.data.message || second.data.detail || '';
  expect(msg).toMatch(/already|claimed|consumed/i);
});

// ---------------------------------------------------------------------------
// Max Claims Exhausted
// ---------------------------------------------------------------------------

test('link with max_claims=1 rejects second user @critical @area(billing.credit-grants)', async ({
  authedPage: page,
  browser,
}, testInfo) => {
  testInfo.setTimeout(90_000);

  await page.goto('/assistants');

  const first = await page.evaluate(async (t) => {
    const res = await fetch('/api/user/claim-credit-grant-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t }),
    });
    return { status: res.status, data: await res.json() };
  }, maxToken);
  expect(first.status).toBe(200);

  const user2Auth = await loginAndSaveState(browser, secondUser.email, secondUser.password);
  const ctx2 = await browser.newContext({ storageState: user2Auth });
  const page2 = await ctx2.newPage();
  await page2.goto('/assistants');

  const second = await page2.evaluate(async (t) => {
    const res = await fetch('/api/user/claim-credit-grant-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t }),
    });
    return { status: res.status, data: await res.json() };
  }, maxToken);

  await ctx2.close();

  if (second.status === 200) {
    const msg = second.data.message || second.data.detail || '';
    expect(msg).toMatch(/already|benefit|consumed/i);
  } else {
    expect(second.status).toBeGreaterThanOrEqual(400);
    const msg = second.data.message || second.data.detail || '';
    expect(msg).toMatch(/exhaust|claimed|limit|already/i);
  }
});
