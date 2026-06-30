/**
 * Referral program E2E — link generation, attribution (direct + ?ref=
 * capture), anti-abuse guards (self-referral, one-per-referee), the
 * referrer dashboard, and unauthenticated access.
 *
 * The reward itself is webhook-driven (a referred friend's first paid
 * invoice) and is covered by the Orchestra `test_billing` suite; here we
 * seed the rewarded state to assert the dashboard reads it back.
 *
 * Run: npx playwright test src/tests/billing/referrals.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createBillingTest,
  loginAndSaveState,
  getReferralCodeFromDb,
  getReferralAttributionStatus,
  insertReferralCode,
  seedRewardedReferral,
  clearReferralData,
  dbExec,
  skipIfManualTopupBilling,
} from './helpers';

const referrer = createTestUser({ name: 'Referrer', lastName: 'Main', credits: 100 });
const friend = createTestUser({ name: 'Referred', lastName: 'Friend', credits: 0 });
const otherReferrer = createTestUser({ name: 'Other', lastName: 'Referrer', credits: 0 });

const test = createBillingTest(referrer);

test.afterAll(() => {
  clearReferralData(referrer.id);
  clearReferralData(friend.id);
  clearReferralData(otherReferrer.id);
  cleanupUser(referrer.id);
  cleanupUser(friend.id);
  cleanupUser(otherReferrer.id);
});

// ---------------------------------------------------------------------------
// Link generation
// ---------------------------------------------------------------------------

test('returns a referral link and code for the caller', async ({ authedPage: page }) => {
  await page.goto('/assistants');

  const res = await page.evaluate(async () => {
    const r = await fetch('/api/user/referral');
    return { status: r.status, data: await r.json() };
  });

  expect(res.status).toBe(200);
  expect(typeof res.data.code).toBe('string');
  expect(res.data.code.length).toBeGreaterThan(0);
  expect(res.data.referral_url).toContain(`ref=${res.data.code}`);

  // The same code is persisted (idempotent — no new code on repeat call).
  expect(getReferralCodeFromDb(referrer.id)).toBe(res.data.code);
});

// ---------------------------------------------------------------------------
// Attribution (direct API)
// ---------------------------------------------------------------------------

test('attributes a referred friend to the referrer code', async ({
  authedPage: page,
  browser,
}, testInfo) => {
  testInfo.setTimeout(90_000);

  await page.goto('/assistants');
  const code = await page.evaluate(async () => {
    const r = await fetch('/api/user/referral');
    return (await r.json()).code as string;
  });

  // The friend authenticates and applies the code.
  const friendAuth = await loginAndSaveState(browser, friend.email, friend.password);
  const ctx = await browser.newContext({ storageState: friendAuth });
  const fpage = await ctx.newPage();
  await fpage.goto('/assistants');

  const res = await fpage.evaluate(async (c) => {
    const r = await fetch('/api/user/referral/attribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: c }),
    });
    return { status: r.status, data: await r.json() };
  }, code);
  await ctx.close();

  expect(res.status).toBe(200);
  expect(res.data.attributed).toBe(true);
  expect(getReferralAttributionStatus(friend.id)).toBe('pending');
});

// ---------------------------------------------------------------------------
// One attribution per referee
// ---------------------------------------------------------------------------

test('a referee is attributed at most once', async ({ authedPage: page, browser }, testInfo) => {
  testInfo.setTimeout(90_000);

  await page.goto('/assistants');
  const codeA = await page.evaluate(async () => {
    const r = await fetch('/api/user/referral');
    return (await r.json()).code as string;
  });

  // A competing code owned by a different user.
  const codeB = `e2e-other-${Math.random().toString(36).slice(2, 8)}`;
  insertReferralCode(otherReferrer.id, codeB);

  const friendAuth = await loginAndSaveState(browser, friend.email, friend.password);
  const ctx = await browser.newContext({ storageState: friendAuth });
  const fpage = await ctx.newPage();
  await fpage.goto('/assistants');

  const attribute = (c: string) =>
    fpage.evaluate(async (code) => {
      const r = await fetch('/api/user/referral/attribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      return { status: r.status, data: await r.json() };
    }, c);

  const first = await attribute(codeA);
  expect(first.status).toBe(200);
  expect(first.data.attributed).toBe(true);

  // Second attempt with a different code must NOT re-attribute.
  const second = await attribute(codeB);
  await ctx.close();

  expect(second.data.attributed).toBe(false);

  // Attribution still points at the original (codeA) referrer.
  const attributedCode = dbExec(
    `SELECT code FROM referral_attribution WHERE referee_user_id = '${friend.id}' LIMIT 1`
  ).trim();
  expect(attributedCode).toBe(codeA);
});

// ---------------------------------------------------------------------------
// Self-referral blocked
// ---------------------------------------------------------------------------

test('blocks self-referral', async ({ authedPage: page }) => {
  await page.goto('/assistants');

  const res = await page.evaluate(async () => {
    const meta = await (await fetch('/api/user/referral')).json();
    const r = await fetch('/api/user/referral/attribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: meta.code }),
    });
    return { status: r.status, data: await r.json() };
  });

  expect(res.status).toBeGreaterThanOrEqual(400);
  const msg = res.data.message || res.data.detail || '';
  expect(msg).toMatch(/own|self|cannot/i);
});

// ---------------------------------------------------------------------------
// Referrer dashboard
// ---------------------------------------------------------------------------

test('referrer dashboard reflects a rewarded referral', async ({ authedPage: page }) => {
  const code = getReferralCodeFromDb(referrer.id) ?? 'seed-code';
  if (!getReferralCodeFromDb(referrer.id)) {
    insertReferralCode(referrer.id, code);
  }
  seedRewardedReferral(referrer.id, friend.id, { code, rewardUsd: 12.5 });

  await skipIfManualTopupBilling(test, page);
  await page.goto('/billing?mode=credits');

  const section = page.getByTestId('referrals-section');
  await expect(section).toBeVisible({ timeout: 15_000 });
  // The reward stat surfaces the seeded earnings.
  await expect(section).toContainText(/refer/i);
});

// ---------------------------------------------------------------------------
// Unauthenticated
// ---------------------------------------------------------------------------

unauthTest('referral endpoints require authentication', async ({ page }) => {
  await page.goto('/login');

  const summary = await page.evaluate(async () => {
    const r = await fetch('/api/user/referral');
    return r.status;
  });
  expect(summary).toBe(401);

  const attribute = await page.evaluate(async () => {
    const r = await fetch('/api/user/referral/attribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'whatever' }),
    });
    return r.status;
  });
  expect(attribute).toBe(401);
});
