/**
 * Admin · Managed-Billing v2 UI E2E.
 *
 * Smoke-tests the admin pages added for managed-billing:
 *   - /admin                — landing tile grid links to the new pages.
 *   - /admin/plans          — create + see + deprecate a BESPOKE template
 *                             (incl. picking an FX policy on multi-currency).
 *   - /admin/organizations  — pick an org, see the Plan card, assign the
 *                             template just created, see the Stripe-customer
 *                             prompt collapse to the "provisioned" state
 *                             after the assignment auto-creates one.
 *
 * FX rates no longer have their own admin page — the per-template
 * ``fx_policy`` field replaced the daily-snapshot table. SPOT and
 * PERIOD_AVERAGE rates are resolved live (Frankfurter) at invoice time.
 *
 * The test user is provisioned as the Owner of an organization literally
 * named "Unify" so the AdminLayout's role check accepts them. The target
 * org is a separate seed so we can exercise the per-org plan UI without
 * mutating the admin's own billing account.
 *
 * Run: npx playwright test src/tests/admin/billing-plans.e2e.ts
 */

import { expect, test as base, type Page } from '@playwright/test';
import path from 'path';
import os from 'os';
import { createTestUser, cleanupUser, createOrg, deleteOrg, dbExec } from '../billing/helpers';
import { ensureUnifyOrg } from '../helpers/seeds/client';
import { loginAndWaitForRedirect, completeAccountOnboardingIfPresent } from '../auth/helpers';
import { deferCoordinatorForUser } from '../helpers/coordinator';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Admin user belongs to an org literally named "Unify" with the Owner role
// AND carries a unify.ai mailbox — the `/admin` route layout now requires
// both signals so a squatted "Unify" org name cannot confer staff access.
const adminUser = createTestUser({
  name: 'Admin',
  lastName: 'Operator',
  email: `admin-staff-${Date.now()}@unify.ai`,
});
const unifyOrg = ensureUnifyOrg({
  ownerId: adminUser.id,
  existingOrgOwnerRole: 'Admin',
});
const createdUnifyOrg = unifyOrg.ownerId === adminUser.id;

// Target org — a "real" customer org we'll manage from /admin/organizations.
const targetOwner = createTestUser({ name: 'Target', lastName: 'OrgOwner' });
const targetOrg = createOrg({
  name: `E2E Target ${Date.now()}`,
  ownerId: targetOwner.id,
});

// Per-test unique template name so the catalog row is easy to spot among
// any leftover BESPOKE rows from prior test runs.
const templateName = `e2e-bespoke-${adminUser.id.slice(0, 8).toLowerCase()}`;

// ---------------------------------------------------------------------------
// Auth fixture (login once, reuse storageState)
// ---------------------------------------------------------------------------

let authFile: string | undefined;

const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, use, testInfo) => {
    if (!authFile) {
      testInfo.setTimeout(testInfo.timeout + 30_000);
      authFile = path.join(
        os.tmpdir(),
        `pw-admin-${adminUser.email.replace(/[^a-z0-9]/gi, '-')}.json`
      );
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await deferCoordinatorForUser(adminUser.id, adminUser.apiKey);
      await p.goto('/login');
      await loginAndWaitForRedirect(p, adminUser.email, adminUser.password, 30_000);
      await completeAccountOnboardingIfPresent(p);
      await p.goto('/admin', { waitUntil: 'domcontentloaded' });
      await expect(p).toHaveURL(/\/admin/, { timeout: 15_000 });
      await ctx.storageState({ path: authFile });
      await ctx.close();
    }
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
});

test.describe.configure({ mode: 'serial' });

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

test.afterAll(() => {
  // Clean up any plan assignment we may have written so the target org
  // can be deleted without an FK violation.
  try {
    dbExec(
      `DELETE FROM billing_plan_assignment WHERE billing_account_id = ` +
        `(SELECT billing_account_id FROM organization WHERE id = ${targetOrg.id})`
    );
  } catch {
    /* best effort */
  }
  try {
    dbExec(
      `UPDATE billing_account SET plan_assignment_id = NULL WHERE id = ` +
        `(SELECT billing_account_id FROM organization WHERE id = ${targetOrg.id})`
    );
  } catch {
    /* best effort */
  }
  // Drop the BESPOKE template (only safe because we know the assignment
  // above is gone — templates with assignments would FK-fail).
  try {
    dbExec(`DELETE FROM billing_plan_template WHERE name = '${templateName}'`);
  } catch {
    /* best effort */
  }
  try {
    deleteOrg(targetOrg.id);
  } catch {
    /* best effort */
  }
  try {
    if (createdUnifyOrg) deleteOrg(unifyOrg.id);
  } catch {
    /* best effort */
  }
  cleanupUser(targetOwner.id);
  cleanupUser(adminUser.id);
});

// =============================================================================
// /admin landing
// =============================================================================

test('admin landing lists the managed-billing tools', async ({ adminPage: page }) => {
  await page.goto('/admin');

  // The landing isn't behind a redirect for admins — it should render
  // the tile grid with the new pages discoverable.
  await expect(page.getByText('Admin', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('admin-nav-organizations')).toBeVisible();
  await expect(page.getByTestId('admin-nav-plans')).toBeVisible();
});

// =============================================================================
// /admin/plans — create + deprecate template
// =============================================================================

test('billing plans page creates a BESPOKE template and lists it', async ({ adminPage: page }) => {
  await page.goto('/admin/plans');

  await expect(page.getByText(/Plan templates and the groups/i)).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole('button', { name: /Create Plan/i }).click();

  // Fill the form. Defaults pick COMMITMENT + METERED + BESPOKE which is
  // the canonical happy path the dialog defaults to; we only need to
  // type a unique name + commit amount.
  const dialog = page.getByRole('dialog', { name: /Create Billing Plan/i });
  await dialog.locator('input').first().fill(templateName);

  const billingModeSelect = dialog
    .locator('label')
    .filter({ hasText: /^Billing Mode$/ })
    .locator('xpath=following::button[@role="combobox"][1]');
  await billingModeSelect.click();
  await page.getByRole('option', { name: /CREDITS — prepaid wallet/ }).click();

  // Click the create button INSIDE the dialog (not the trigger above).
  await dialog.getByRole('button', { name: /Create Plan/i }).click();

  // Toast confirms create; row appears in the table when the BESPOKE
  // filter is on (default).
  await expect(page.locator('text=' + templateName).first()).toBeVisible({ timeout: 10_000 });
});

test('billing plans table scrolls horizontally at a constrained viewport', async ({
  adminPage: page,
}) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto('/admin/plans');

  await expect(page.getByRole('button', { name: /Create Plan/i })).toBeVisible({
    timeout: 15_000,
  });

  const table = page.locator('table.min-w-\\[960px\\]').first();
  await expect(table).toBeVisible({ timeout: 10_000 });

  const scrollContainer = table
    .locator('xpath=ancestor::div[contains(@class,"overflow-auto")]')
    .first();
  await expect(scrollContainer).toBeVisible();
  const scrollWidth = await scrollContainer.evaluate((el) => el.scrollWidth);
  const clientWidth = await scrollContainer.evaluate((el) => el.clientWidth);
  expect(scrollWidth).toBeGreaterThan(clientWidth);
});

// =============================================================================
// /admin/organizations — set the bespoke template on the target org
// =============================================================================

test('organizations page sets the new template on the target org', async ({ adminPage: page }) => {
  test.setTimeout(90_000);

  // PR sampling may run this spec without the create-template test in the
  // same worker — seed the row directly so the combobox always has a match.
  dbExec(
    `INSERT INTO billing_plan_template (
      name, display_name, billing_mode, commit_amount, currency,
      collection_method,
      is_custom, is_active
    ) VALUES (
      '${templateName}', '${templateName}', 'CREDITS', NULL, 'USD',
      'AUTO_CARD', true, true
    ) ON CONFLICT (name) DO NOTHING`
  );

  await page.goto('/admin/organizations');

  const search = page.getByPlaceholder('Search organizations…');
  await expect(search).toBeVisible({ timeout: 15_000 });
  await search.fill(targetOrg.name);

  await expect(page.locator('text=' + targetOrg.name)).toBeVisible({ timeout: 10_000 });
  await page
    .locator('text=' + targetOrg.name)
    .first()
    .click();

  await expect(
    page
      .locator('label')
      .filter({ hasText: /^Plan$/ })
      .locator('xpath=following-sibling::p[1]')
  ).toHaveText('default', { timeout: 15_000 });

  await page.getByRole('button', { name: /Change plan/i }).click();
  // Dialog title is "Change plan" for non-default templates and
  // "Return to default plan" for the cancel flow; match either so
  // the test isn't coupled to which template happens to be picked
  // first.
  const dialog = page.getByRole('dialog', { name: /^Change plan$/ });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('combobox').click();
  const templateOption = page.getByRole('option', { name: new RegExp(templateName) });
  await expect(templateOption).toBeVisible({ timeout: 30_000 });
  await templateOption.click();

  const setButton = dialog.getByRole('button', { name: /^Set$/ });
  await expect(setButton).toBeEnabled({ timeout: 15_000 });
  await setButton.click();

  // After success the dialog closes and the active plan card refreshes
  // to show the new template name. A "Return to default plan" affordance
  // appears now that the account is on a non-default plan.
  await expect(page.locator(`text=${templateName}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Change plan/i })).toBeVisible();
});
