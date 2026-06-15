/**
 * Managed-billing — Billing page METERED variant E2E.
 *
 * Verifies that a user on a METERED plan sees the dedicated UI:
 *   - Plan card (template name, plan type, monthly commitment)
 *   - Invoices table (rendered from /v0/billing/invoices)
 *   - NO self-serve credits / subscription card
 *   - NO auto-increment card
 *
 * And that switching back to the implicit default flips the
 * page back to the self-serve CREDITS view.
 *
 * Run: npx playwright test src/tests/billing/metered-billing.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createBillingTest,
  setMeteredPlan,
  clearMeteredPlan,
  insertMeteredInvoice,
  type TestUser,
} from './helpers';

// ---------------------------------------------------------------------------
// Shared user fixture (one billing account → many tests)
// ---------------------------------------------------------------------------

const user = createTestUser({ name: 'Metered', lastName: 'Plan', credits: 0 });
const templateName = `E2E Metered Page ${user.id.slice(0, 8)}`;

// Set up the METERED plan once at module load — every test below runs
// against the same active assignment. ``afterAll`` reverts and cleans
// the user; the bespoke template stays in the DB (harmless audit row).
const { assignmentId } = setMeteredPlan(user.id, {
  templateName,
  commitAmount: 1000,
  commitPeriod: 'MONTHLY',
});

// Seed two invoices so we can assert the table renders rows AND
// orders them newest-first.
insertMeteredInvoice(user.id, {
  amountUsd: 1000,
  invoiceMonth: previousFirstOfMonth(2),
  planAssignmentId: assignmentId,
  status: 'PAID',
  stripeInvoiceId: 'in_test_old',
});
insertMeteredInvoice(user.id, {
  amountUsd: 1450,
  invoiceMonth: previousFirstOfMonth(1),
  planAssignmentId: assignmentId,
  status: 'INVOICE_CREATED',
  stripeInvoiceId: 'in_test_recent',
});

const test = createBillingTest(user);

test.afterAll(() => {
  clearMeteredPlan(user.id);
  cleanupUser(user.id);
});

// ---------------------------------------------------------------------------
// Plan card
// ---------------------------------------------------------------------------

test('shows the METERED plan card with template name and commitment', async ({
  authedPage: page,
}) => {
  await page.goto('/billing');

  const planSection = page.getByTestId('metered-plan-section');
  await expect(planSection).toBeVisible({ timeout: 15_000 });

  await expect(page.getByTestId('plan-name')).toHaveText(templateName);
  await expect(page.getByTestId('plan-type')).toHaveText('Commitment');
  await expect(page.getByTestId('plan-commit')).toContainText('$1,000');
  await expect(page.getByTestId('plan-commit')).toContainText('monthly');
  // Note: there's no usage-cap surface anymore — plan templates dropped
  // `monthly_usage_cap` (the platform never blocks usage based on plan
  // terms; the spending-limit guard layer owns that concern instead).
  await expect(page.getByTestId('plan-billing-mode-badge')).toBeVisible();
});

// ---------------------------------------------------------------------------
// CREDITS UI is suppressed
// ---------------------------------------------------------------------------

test('hides the self-serve credits / subscription UI', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await expect(page.getByTestId('metered-plan-section')).toBeVisible({ timeout: 15_000 });

  // The self-serve CREDITS surface (credits/subscription card, plan
  // picker, auto-increment) must be absent for METERED accounts.
  await expect(page.getByTestId('credits-balance-section')).toHaveCount(0);
  await expect(page.getByTestId('auto-increment-card')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Invoices table
// ---------------------------------------------------------------------------

test('renders the invoices table with rows ordered newest-first', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const invoicesSection = page.getByTestId('metered-invoices-section');
  await expect(invoicesSection).toBeVisible({ timeout: 15_000 });

  // The invoice history now lives behind a "View" button that opens a
  // right-side panel (matching the billing-profile / payment-method
  // layout), so the table only mounts once the panel is open.
  await page.getByTestId('view-invoices').click();

  const table = page.getByTestId('invoices-table');
  await expect(table).toBeVisible({ timeout: 10_000 });

  // The seeded invoices appear, with the recent one above the old
  // one. METERED rows render a second sibling ``<tr>`` carrying the
  // commit/usage/overage breakdown — assert against the data-row
  // testid prefix rather than naked ``tbody tr`` so the count is
  // independent of how many breakdown rows the renderer adds.
  const dataRows = table.locator('tr[data-testid^="invoice-row-"]');
  await expect(dataRows).toHaveCount(2);

  const firstRow = dataRows.nth(0);
  await expect(firstRow).toContainText('$1,450');
  await expect(firstRow).toContainText('Invoice Created');

  const secondRow = dataRows.nth(1);
  await expect(secondRow).toContainText('$1,000');
  await expect(secondRow).toContainText('Paid');

  // Two side-by-side actions per row in the new InvoicesTable —
  // "View" opens the Stripe-hosted invoice (which carries the
  // bank-transfer funding instructions for customer_balance
  // accounts) and "PDF" downloads the receipt. The bare receipt
  // anchor (``invoice-link-…``) was removed when we split the
  // surface; smoke-test the testids exist + are clickable rather
  // than poking at the now-server-resolved short-lived URL.
  await expect(firstRow.getByTestId(/^invoice-view-\d+$/)).toBeVisible();
  await expect(firstRow.getByTestId(/^invoice-download-\d+$/)).toBeVisible();
});

// ---------------------------------------------------------------------------
// Switching back to CREDITS restores the legacy view
// ---------------------------------------------------------------------------

test('switching back to default restores the CREDITS UI', async ({ authedPage: page }) => {
  // Flip the user back to CREDITS mode for this test only, then
  // restore METERED in a finally so the other tests in this file
  // (which run in declaration order under the same fixture) aren't
  // affected. afterAll's clearMeteredPlan still wins as the canonical
  // teardown.
  clearMeteredPlan(user.id);
  try {
    await page.goto('/billing');
    await expect(page.getByTestId('credits-balance-section')).toBeVisible({ timeout: 15_000 });

    // The self-serve plan picker reappears in CREDITS mode.
    await expect(page.getByTestId('tier-select-trigger')).toBeVisible({
      timeout: 10_000,
    });

    // METERED-only sections are gone
    await expect(page.getByTestId('metered-plan-section')).toHaveCount(0);
    await expect(page.getByTestId('metered-invoices-section')).toHaveCount(0);
  } finally {
    setMeteredPlan(user.id, {
      templateName,
      commitAmount: 1000,
      commitPeriod: 'MONTHLY',
    });
  }
});

// ---------------------------------------------------------------------------
// Helpers — local to this test file
// ---------------------------------------------------------------------------

/**
 * Returns 'YYYY-MM-01' for the first day of the month *N* months ago
 * relative to the current UTC date. Used to seed invoices that look
 * like real ``monthly_metered_invoicer`` output (one row per past
 * billing month).
 */
function previousFirstOfMonth(monthsAgo: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}
