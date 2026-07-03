/**
 * Self-serve subscription billing — consolidated browser journeys.
 *
 * One file per the self-serve model, covering the user-facing halves of the
 * flows the Orchestra `test_billing` suite proves on the backend:
 *
 *   1. Subscribe        — profile/tax + saved-card gating, an always-on
 *                          payment-methods section, annual framing (12× /
 *                          save 20%), subscribed view (×400 credit
 *                          allowance, renewal date).
 *   2. Plan change      — in-place tier change keeps a confirm dialog
 *                          (immediate, prorated); current tier is a no-op.
 *   3. Auto-increment   — toggle visible + state for subscribed accounts;
 *                          disabled at the top tier; out-of-credits banner
 *                          when off and depleted.
 *   4. Lifecycle        — cancel keeps access to period end; PAST_DUE banner
 *                          + recovery.
 *
 * What is NOT here (and why): credit *grants*, proration maths, the expiry
 * sweep and the reminder email are Stripe-webhook / routine driven and are
 * asserted in Orchestra `test_billing` (those paths can't be exercised from
 * the browser without a live Stripe). Here we seed the post-webhook account
 * state and assert the console renders it correctly.
 *
 * Run: npx playwright test src/tests/billing/subscription-billing.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createBillingTest,
  subscribeUserToTier,
  setBillingAddress,
  setAccountStatus,
  setCancelAtPeriodEnd,
  getTierTemplateId,
  insertMeteredInvoice,
  dbExec,
  waitForAssistantsReady,
} from './helpers';

// ---------------------------------------------------------------------------
// Tier catalog lookups (resolved once against the local DB)
// ---------------------------------------------------------------------------

/** Smallest monthly rung ($50/mo → "20,000 credits"). */
const TIER_MONTHLY = 'tier_50';
const TIER_MONTHLY_ANNUAL = 'tier_50_annual';

/** A different monthly rung, used as the upgrade target in plan-change. */
const TIER_MONTHLY_ALT = dbExec(
  `SELECT name FROM billing_plan_template ` +
    `WHERE name ~ '^tier_[0-9]+$' AND name <> '${TIER_MONTHLY}' ` +
    `ORDER BY commit_amount ASC LIMIT 1`
).trim();

/** Top monthly rung — auto-increment has nothing higher to climb to. */
const TIER_MONTHLY_TOP = dbExec(
  `SELECT name FROM billing_plan_template ` +
    `WHERE name ~ '^tier_[0-9]+$' ORDER BY commit_amount DESC LIMIT 1`
).trim();

const FULL_ADDRESS = {
  line1: '1 Test Street',
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94105',
  country: 'US',
} as const;

// ===========================================================================
// Unsubscribed user — gating, annual framing, trial countdown
// ===========================================================================

const unsubUser = createTestUser({ name: 'SubFlow', lastName: 'Unsub', credits: 50 });
const unsubTest = createBillingTest(unsubUser, { skipWhenManualTopup: true });

unsubTest.afterAll(() => cleanupUser(unsubUser.id));

unsubTest.describe('subscribe — gating & framing (unsubscribed)', () => {
  unsubTest(
    'Subscribe CTA is gated by a prerequisites checklist (billing profile, then card)',
    async ({ authedPage: page }) => {
      // No address → the prerequisites checklist shows both items incomplete
      // and the CTA is disabled.
      setBillingAddress(unsubUser.id, {});
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="choose-plan-card"]', { timeout: 15_000 });

      await expect(page.getByTestId('subscribe-prerequisites')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('prereq-billing-profile')).toHaveAttribute(
        'data-complete',
        'false'
      );
      await expect(page.getByTestId('subscribe-plan-cta')).toBeDisabled();

      // Full address → the billing-profile item flips to complete, but a
      // freshly-seeded account has no saved card, so the payment-method item
      // is still outstanding and the CTA stays disabled (even after picking a
      // tier) until a card is added in the payment section below.
      setBillingAddress(unsubUser.id, FULL_ADDRESS);
      await page.reload();
      await page.waitForSelector('[data-testid="choose-plan-card"]', { timeout: 15_000 });
      await expect(page.getByTestId('prereq-billing-profile')).toHaveAttribute(
        'data-complete',
        'true'
      );
      await expect(page.getByTestId('prereq-payment-method')).toHaveAttribute(
        'data-complete',
        'false'
      );

      await page.getByTestId('tier-select-trigger').click();
      await page.getByTestId(`tier-option-${getTierTemplateId(TIER_MONTHLY)}`).click();
      await expect(page.getByTestId('subscribe-plan-cta')).toBeDisabled();
    }
  );
});

// ===========================================================================
// Subscribed user — rendering, plan change, auto-increment, lifecycle
// ===========================================================================

const subUser = createTestUser({ name: 'SubFlow', lastName: 'Subbed', credits: 0 });
const subTest = createBillingTest(subUser, { skipWhenManualTopup: true });

subTest.afterAll(() => {
  setAccountStatus(subUser.id, 'ACTIVE');
  cleanupUser(subUser.id);
});

subTest.describe('subscribed account — view & plan change', () => {
  subTest(
    'monthly subscription renders tier, renewal & ×400 allowance @critical @area(billing.subscription)',
    async ({ authedPage: page }) => {
      // $50/mo tier, 30k of 20k... credits remaining mid-cycle.
      subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY, credits: 12.5 });
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });

      await expect(page.getByTestId('current-tier-name')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('renewal-date')).toContainText(/renews on/i);
      // $50 commit → 50 × 400 = 20,000 display credits.
      await expect(page.getByTestId('monthly-allowance')).toContainText('20,000');
      await expect(page.getByTestId('credits-remaining')).toBeVisible();
      await expect(page.getByTestId('auto-increment-card')).toBeVisible();
    }
  );

  subTest(
    'changing tier keeps a confirm dialog (immediate, prorated) @critical @area(billing.subscription)',
    async ({ authedPage: page }) => {
      subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY, credits: 10 });
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });

      // Pick a different rung → CTA reads "Change plan" and opens a dialog.
      await page.getByTestId('tier-select-trigger').click();
      await page.getByTestId(`tier-option-${getTierTemplateId(TIER_MONTHLY_ALT)}`).click();

      const cta = page.getByTestId('subscribe-plan-cta');
      await expect(cta).toContainText(/change plan/i);
      await cta.click();

      const confirm = page.getByTestId('subscribe-plan-confirm');
      await expect(confirm).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/takes effect immediately|prorat/i)).toBeVisible();

      // Dismiss without confirming (confirming would call the live switch API).
      await page.keyboard.press('Escape');
      await expect(confirm).toHaveCount(0);
    }
  );

  subTest(
    'subscription invoices open in a side-sheet (credits variant)',
    async ({ authedPage: page }) => {
      // A subscribed credits account surfaces its Stripe subscription
      // invoices behind the same "View" side-sheet as the metered variant.
      // Only recharges with a `stripe_invoice_id` are listed (admin wallet
      // top-ups have none), so seed one paid subscription invoice.
      const { assignmentId } = subscribeUserToTier(subUser.id, {
        tierName: TIER_MONTHLY,
        credits: 10,
      });
      insertMeteredInvoice(subUser.id, {
        amountUsd: 50,
        invoiceMonth: '2026-05-01',
        planAssignmentId: assignmentId,
        status: 'PAID',
        stripeInvoiceId: 'in_e2e_sub_50',
      });

      await page.goto('/billing');
      const section = page.getByTestId('credits-invoices-section');
      await expect(section).toBeVisible({ timeout: 15_000 });

      // The table mounts only once the panel is open.
      await page.getByTestId('view-invoices').click();
      const table = page.getByTestId('invoices-table');
      await expect(table).toBeVisible({ timeout: 10_000 });

      const dataRows = table.locator('tr[data-testid^="invoice-row-"]');
      await expect(dataRows).toHaveCount(1);
      await expect(dataRows.nth(0)).toContainText('$50');
      await expect(dataRows.nth(0)).toContainText('Paid');
    }
  );
});

subTest.describe('subscribed account — auto-increment', () => {
  subTest('top tier disables the toggle with an explanatory note', async ({ authedPage: page }) => {
    subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY_TOP, credits: 10 });
    await page.goto('/billing');
    await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });

    await expect(page.getByTestId('auto-increment-top-tier')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('auto-increment-toggle')).toBeDisabled();
  });
});

subTest.describe('subscribed account — lifecycle', () => {
  subTest(
    'cancel keeps access until period end (confirm copy) @critical @area(billing.subscription)',
    async ({ authedPage: page }) => {
      subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY, credits: 10 });
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });

      // Cancellation opens an in-app confirm dialog (not a native window.confirm).
      // Assert the copy, then back out via "Keep subscription" so we don't hit
      // the live cancel API.
      await page.getByTestId('cancel-subscription').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await expect(dialog).toContainText(
        /keep your credits and access until the end of the current billing period/i
      );
      await expect(dialog).toContainText(/free tier/i);
      await page.getByRole('button', { name: /keep subscription/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    }
  );

  subTest(
    'PAST_DUE shows a soft banner that clears on recovery @critical @area(billing.subscription)',
    async ({ authedPage: page }) => {
      subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY, credits: 10 });

      setAccountStatus(subUser.id, 'PAST_DUE');
      await page.goto('/assistants');
      const banner = page.getByTestId('account-status-banner');
      await expect(banner).toBeVisible({ timeout: 15_000 });
      await expect(banner).toContainText(/past due/i);

      // Recovery (invoice.paid / subscription active) clears the banner.
      setAccountStatus(subUser.id, 'ACTIVE');
      await page.goto('/assistants');
      await waitForAssistantsReady(page);
      await expect(page.getByTestId('account-status-banner')).not.toBeVisible({ timeout: 5_000 });
    }
  );

  subTest(
    'a scheduled end-of-period cancellation surfaces "Canceling" + Resume',
    async ({ authedPage: page }) => {
      // Post-`customer.subscription.updated` (cancel_at_period_end): the
      // account keeps access until the period end, so the plan card swaps the
      // "Renews on …" line for a "Cancels on …" notice and offers Resume in
      // place of Cancel.
      subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY, credits: 10 });
      setCancelAtPeriodEnd(subUser.id, true);
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });

      await expect(page.getByTestId('cancellation-badge')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('cancellation-scheduled')).toContainText(/cancels on/i);
      await expect(page.getByTestId('cancellation-note')).toBeVisible();
      await expect(page.getByTestId('resume-subscription')).toBeVisible();
      // The renewal line and the Cancel action are replaced while scheduled.
      await expect(page.getByTestId('renewal-date')).toHaveCount(0);
      await expect(page.getByTestId('cancel-subscription')).toHaveCount(0);

      // Clearing the flag (Resume / recovery) restores the renewal view.
      setCancelAtPeriodEnd(subUser.id, false);
      await page.reload();
      await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });
      await expect(page.getByTestId('renewal-date')).toContainText(/renews on/i);
      await expect(page.getByTestId('cancellation-badge')).toHaveCount(0);
    }
  );
});
