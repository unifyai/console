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
 *                          + recovery; trial-credit countdown / expiry copy.
 *   5. Data integrity   — local DB guards on the seeded tier catalog
 *                          (+ documented prod audits).
 *
 * What is NOT here (and why): credit *grants*, proration maths, the expiry
 * sweep and the reminder email are Stripe-webhook / routine driven and are
 * asserted in Orchestra `test_billing` (those paths can't be exercised from
 * the browser without a live Stripe). Here we seed the post-webhook account
 * state and assert the console renders it correctly.
 *
 * Run: npx playwright test src/tests/billing/subscription-billing.e2e.ts
 */

import { test as dbTest, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createBillingTest,
  subscribeUserToTier,
  grantTrialCredits,
  setBillingAddress,
  setAccountStatus,
  setCancelAtPeriodEnd,
  setUserCredits,
  setAutoIncrement,
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

  unsubTest(
    'an always-on Payment methods section lets cards be added before subscribing',
    async ({ authedPage: page }) => {
      setBillingAddress(unsubUser.id, FULL_ADDRESS);
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="choose-plan-card"]', { timeout: 15_000 });

      // The payment-methods section is always rendered (not hidden behind the
      // Stripe portal), so a card can be added before the first subscribe. It
      // mirrors the billing-profile layout: a summary + a "Manage" button that
      // opens the panel.
      const section = page.getByTestId('payment-methods-section');
      await expect(section).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('manage-payment-methods').click();

      // A freshly-seeded account has no Stripe customer yet → empty state plus
      // an "Add card" affordance (the SetupIntent + Elements flow itself needs
      // live Stripe, so we assert the entry point rather than card entry).
      await expect(page.getByTestId('no-cards')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('add-card')).toBeVisible();

      // Subscribe never opens a hosted-invoice tab anymore — it's a confirm +
      // off-session charge — so the change-path confirm dialog is the only
      // dialog and it isn't present on an unsubscribed account.
      await expect(page.getByTestId('subscribe-plan-confirm')).toHaveCount(0);
    }
  );

  unsubTest('annual checkbox advertises the 20% discount', async ({ authedPage: page }) => {
    setBillingAddress(unsubUser.id, FULL_ADDRESS);
    await page.goto('/billing');
    await page.waitForSelector('[data-testid="choose-plan-card"]', { timeout: 15_000 });

    const annualToggle = page.getByTestId('billing-interval-annual-toggle');
    await expect(annualToggle).toBeVisible({ timeout: 10_000 });
    await expect(annualToggle).toContainText(/save\s*20\s*%/i);

    // Checking the box swaps the picker to annual tiers.
    await page.getByTestId('billing-interval-annual').click();
    await page.getByTestId('tier-select-trigger').click();
    await expect(
      page.getByTestId(`tier-option-${getTierTemplateId(TIER_MONTHLY_ANNUAL)}`)
    ).toBeVisible({ timeout: 10_000 });
  });

  unsubTest(
    'picking a tier shows its credits-per-period in the trigger (not the price)',
    async ({ authedPage: page }) => {
      setBillingAddress(unsubUser.id, FULL_ADDRESS);
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="choose-plan-card"]', { timeout: 15_000 });

      // $50/mo rung → the trigger reads the credit allowance ("20,000
      // credits / mo"), framing the choice in credits rather than dollars.
      await page.getByTestId('tier-select-trigger').click();
      await page.getByTestId(`tier-option-${getTierTemplateId(TIER_MONTHLY)}`).click();
      const trigger = page.getByTestId('tier-select-trigger');
      await expect(trigger).toContainText('20,000 credits / mo');
      await expect(trigger).not.toContainText('$');
    }
  );

  unsubTest(
    'the annual checkbox preserves the chosen rung (monthly <-> annual)',
    async ({ authedPage: page }) => {
      setBillingAddress(unsubUser.id, FULL_ADDRESS);
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="choose-plan-card"]', { timeout: 15_000 });

      // Pick the $50 monthly rung, then tick "annual": the selection must
      // carry over to the equivalent annual rung (240,000 credits / yr =
      // 12 × the monthly grant), not reset to "Choose a plan".
      await page.getByTestId('tier-select-trigger').click();
      await page.getByTestId(`tier-option-${getTierTemplateId(TIER_MONTHLY)}`).click();
      const trigger = page.getByTestId('tier-select-trigger');
      await expect(trigger).toContainText('20,000 credits / mo');

      await page.getByTestId('billing-interval-annual').click();
      await expect(trigger).toContainText('240,000 credits / yr');

      // Unticking returns to the equivalent monthly rung.
      await page.getByTestId('billing-interval-annual').click();
      await expect(trigger).toContainText('20,000 credits / mo');
    }
  );

  unsubTest(
    'incomplete prerequisites are actionable — links open the profile / card panels',
    async ({ authedPage: page }) => {
      // No address + no card → both checklist items are incomplete and each
      // exposes an action link that opens the relevant panel inline (rather
      // than making the user hunt for the section).
      setBillingAddress(unsubUser.id, {});
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="choose-plan-card"]', { timeout: 15_000 });

      // "Add billing address" opens the billing-profile panel (a right-side
      // Sheet titled "Edit Billing Profile").
      await page.getByTestId('prereq-billing-profile-action').click();
      const profilePanel = page.getByRole('dialog');
      await expect(profilePanel).toContainText(/edit billing profile/i, { timeout: 10_000 });
      await page.keyboard.press('Escape');
      await expect(profilePanel).not.toBeVisible({ timeout: 5_000 });

      // With the address satisfied, only the card item remains; its
      // "Add payment method" link opens the payment-methods panel.
      setBillingAddress(unsubUser.id, FULL_ADDRESS);
      await page.reload();
      await page.waitForSelector('[data-testid="choose-plan-card"]', { timeout: 15_000 });
      await page.getByTestId('prereq-payment-method-action').click();
      await expect(page.getByTestId('no-cards')).toBeVisible({ timeout: 10_000 });
    }
  );

  unsubTest(
    'trial credits show a countdown ~3 days before expiry',
    async ({ authedPage: page }) => {
      grantTrialCredits(unsubUser.id, { usd: 25, daysUntilExpiry: 3 });
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="credits-balance-section"]', { timeout: 15_000 });

      const countdown = page.getByTestId('trial-countdown');
      await expect(countdown).toBeVisible({ timeout: 10_000 });
      await expect(countdown).toContainText(/expire in/i);
    }
  );

  unsubTest('expired trial credits surface the "expired" copy', async ({ authedPage: page }) => {
    grantTrialCredits(unsubUser.id, { usd: 25, daysUntilExpiry: -1 });
    await page.goto('/billing');
    await page.waitForSelector('[data-testid="credits-balance-section"]', { timeout: 15_000 });

    await expect(page.getByTestId('trial-countdown')).toContainText(/expired/i, {
      timeout: 10_000,
    });
  });
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
    'monthly subscription renders tier, renewal & ×400 allowance',
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
    'annual subscription shows the annual allowance & renewal',
    async ({ authedPage: page }) => {
      subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY_ANNUAL });
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });

      await expect(page.getByTestId('current-tier-name')).toBeVisible({ timeout: 10_000 });
      // Allowance label flips to "Annual allowance" for an annual tier.
      await expect(page.getByText(/annual allowance/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('renewal-date')).toContainText(/renews on/i);
    }
  );

  subTest(
    'the current-plan header reads credits-per-period for monthly & annual',
    async ({ authedPage: page }) => {
      // Monthly $50 rung → "20,000 credits / mo" (50 × 400), in the same
      // credit units as the balance/allowance rather than the price.
      subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY, credits: 10 });
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });
      await expect(page.getByTestId('current-tier-name')).toContainText('20,000 credits / mo');

      // Annual $50 rung grants the whole year up front → "240,000 credits /
      // yr" (50 × 12 × 400).
      subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY_ANNUAL, credits: 10 });
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });
      await expect(page.getByTestId('current-tier-name')).toContainText('240,000 credits / yr');
    }
  );

  subTest(
    'changing tier keeps a confirm dialog (immediate, prorated)',
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

  subTest('selecting the current tier is a no-op (CTA disabled)', async ({ authedPage: page }) => {
    subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY, credits: 10 });
    await page.goto('/billing');
    await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });

    await page.getByTestId('tier-select-trigger').click();
    await page.getByTestId(`tier-option-${getTierTemplateId(TIER_MONTHLY)}`).click();
    await expect(page.getByTestId('subscribe-plan-cta')).toBeDisabled();
  });

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
  subTest(
    'toggle reflects the disabled (off) state and is operable',
    async ({ authedPage: page }) => {
      subscribeUserToTier(subUser.id, {
        tierName: TIER_MONTHLY,
        credits: 10,
        autoIncrement: false,
      });
      await page.goto('/billing');
      await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });

      const toggle = page.getByTestId('auto-increment-toggle');
      await expect(toggle).toBeVisible({ timeout: 10_000 });
      await expect(toggle).toBeEnabled();
      await expect(toggle).toHaveAttribute('data-state', 'unchecked');
    }
  );

  subTest('toggle reflects the enabled (on) state', async ({ authedPage: page }) => {
    subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY, credits: 10, autoIncrement: true });
    await page.goto('/billing');
    await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });

    await expect(page.getByTestId('auto-increment-toggle')).toHaveAttribute(
      'data-state',
      'checked',
      { timeout: 10_000 }
    );
  });

  subTest('top tier disables the toggle with an explanatory note', async ({ authedPage: page }) => {
    subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY_TOP, credits: 10 });
    await page.goto('/billing');
    await page.waitForSelector('[data-testid="plans-section"]', { timeout: 15_000 });

    await expect(page.getByTestId('auto-increment-top-tier')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('auto-increment-toggle')).toBeDisabled();
  });

  subTest(
    'out-of-credits with auto-increment off shows the blocking banner',
    async ({ authedPage: page }) => {
      subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY, autoIncrement: false });
      setUserCredits(subUser.id, -1);
      setAutoIncrement(subUser.id, false);
      await page.goto('/assistants');

      const banner = page.getByTestId('out-of-credits-banner');
      await expect(banner).toBeVisible({ timeout: 15_000 });
      await expect(banner).toContainText(/billing/i);
    }
  );
});

subTest.describe('subscribed account — lifecycle', () => {
  subTest('cancel keeps access until period end (confirm copy)', async ({ authedPage: page }) => {
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
  });

  subTest('PAST_DUE shows a soft banner that clears on recovery', async ({ authedPage: page }) => {
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
  });

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

  subTest('SUSPENDED shows a hard non-payment banner', async ({ authedPage: page }) => {
    // Dunning exhaustion (subscription `unpaid`) suspends the account; the
    // banner is harder than PAST_DUE and points the holder at Billing.
    subscribeUserToTier(subUser.id, { tierName: TIER_MONTHLY, credits: 10 });
    setAccountStatus(subUser.id, 'SUSPENDED');
    await page.goto('/assistants');

    const banner = page.getByTestId('account-status-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(/suspended/i);
    await expect(banner).toContainText(/billing/i);
  });
});

// ===========================================================================
// Data integrity (local DB) — recovered from data-integrity.e2e.ts
// ===========================================================================
//
// These run SQL against the **local** Orchestra DB (not the browser), as a
// cheap regression guard that the self-serve tier catalog is wired the way
// the console assumes.
//
// ───────────────────────────────────────────────────────────────────────
// PRODUCTION AUDITS (run manually against prod — NOT asserted here)
// ───────────────────────────────────────────────────────────────────────
// The two invariants requested for prod are data audits, not console
// behaviour, and the local seed data intentionally violates the first
// (seeded users don't denormalise `plan_assignment_id`). Run these against
// prod (e.g. via Cloud SQL / a psql session) — both should return 0 rows:
//
//   -- 1. No account is missing its denormalised active plan assignment.
//   SELECT id FROM billing_account WHERE plan_assignment_id IS NULL;
//
//   -- 2. The default plan group (id 1) contains ONLY the free default
//   --    template and the self-serve credit tiers (monthly + annual).
//   SELECT t.id, t.name
//   FROM plan_group_member m
//   JOIN billing_plan_template t ON t.id = m.template_id
//   WHERE m.group_id = 1
//     AND t.name <> 'default'
//     AND t.name !~ '^tier_[0-9]+(_annual)?$';

const DEFAULT_PLAN_GROUP_ID = 1;

dbTest.describe('billing data integrity (local DB)', () => {
  dbTest('default plan group contains the free default + self-serve tier ladder', () => {
    // Positive check: the catalog the console reads (group 1) includes the
    // free default template plus the monthly + annual $50 rungs. The strict
    // "ONLY these" form is a prod audit (see header) because other
    // environments/tests may seed bespoke templates.
    const present = dbExec(
      `SELECT COALESCE(string_agg(t.name, ',' ORDER BY t.name), '') ` +
        `FROM plan_group_member m ` +
        `JOIN billing_plan_template t ON t.id = m.template_id ` +
        `WHERE m.group_id = ${DEFAULT_PLAN_GROUP_ID} ` +
        `AND t.name IN ('default', 'tier_50', 'tier_50_annual')`
    );
    expect(present).toContain('default');
    expect(present).toContain('tier_50');
    expect(present).toContain('tier_50_annual');
  });

  dbTest('every group-1 member points at an active, assignable template', () => {
    // Any member whose template is missing or inactive would surface a dead
    // option (or a crash) in the plan picker.
    const broken = dbExec(
      `SELECT count(*) FROM plan_group_member m ` +
        `LEFT JOIN billing_plan_template t ON t.id = m.template_id ` +
        `WHERE m.group_id = ${DEFAULT_PLAN_GROUP_ID} ` +
        `AND (t.id IS NULL OR t.is_active = false)`
    );
    expect(parseInt(broken, 10)).toBe(0);
  });

  dbTest('self-serve tier rungs are CREDITS / STRIPE_SUBSCRIPTION', () => {
    // The console's `is_subscribed` gate keys off this pairing; a tier
    // seeded with the wrong billing mode / collection method would render
    // as "unsubscribed" even with a live Stripe subscription.
    const misconfigured = dbExec(
      `SELECT count(*) FROM billing_plan_template ` +
        `WHERE name ~ '^tier_[0-9]+(_annual)?$' ` +
        `AND (billing_mode <> 'CREDITS' OR collection_method <> 'STRIPE_SUBSCRIPTION')`
    );
    expect(parseInt(misconfigured, 10)).toBe(0);
  });
});
