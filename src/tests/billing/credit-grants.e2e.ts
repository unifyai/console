/**
 * Credit Grant Links E2E — claim valid token, invalid token,
 * already-claimed, max-claims-exhausted, unauthenticated.
 *
 * Run: npx playwright test src/tests/billing/credit-grants.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createBillingTest,
  createCreditGrantLink,
  deleteCreditGrantLink,
  clearUserGrantClaims,
  loginAndSaveState,
  dbExec,
  type TestUser,
} from './helpers';

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

test('?token= on assistants auto-claims credits and shows success toast', async ({
  authedPage: page,
}) => {
  const creditsBefore = parseFloat(
    dbExec(
      `SELECT credits FROM billing_account WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${user.id}')`
    )
  );

  await page.goto(`/assistants?token=${uiClaimToken}`);

  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: /credits claimed/i })
  ).toBeVisible({ timeout: 15_000 });

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

test('claims a credit grant link and credits are applied', async ({ authedPage: page }) => {
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
// Invalid Token
// ---------------------------------------------------------------------------

test('returns error for non-existent token', async ({ authedPage: page }) => {
  await page.goto('/assistants');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/user/claim-credit-grant-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'totally-bogus-token-xyz' }),
    });
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(404);
});

test('returns error when token is missing from request', async ({ authedPage: page }) => {
  await page.goto('/assistants');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/user/claim-credit-grant-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(400);
});

// ---------------------------------------------------------------------------
// Already Claimed
// ---------------------------------------------------------------------------

test('second claim by same user returns already-claimed message', async ({ authedPage: page }) => {
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

test('link with max_claims=1 rejects second user', async ({
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

// ---------------------------------------------------------------------------
// Unauthenticated
// ---------------------------------------------------------------------------

unauthTest('credit grant claim returns 401 for unauthenticated request', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/user/claim-credit-grant-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'some-token' }),
    });
    return { status: res.status };
  });

  expect(response.status).toBe(401);
});
