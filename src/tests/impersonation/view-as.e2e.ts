/**
 * Impersonation · "View as user" E2E.
 *
 * Exercises the full staff-impersonation flow:
 *   - A Unify-org member opens the profile menu and picks "View as user".
 *   - They look up a separate customer user by email and confirm.
 *   - The app reloads scoped to the target: the impersonation banner appears
 *     and the target's own assistant (fetched with the target's Orchestra key)
 *     becomes visible — proving the session identity actually swapped.
 *   - "Return to your account" restores the original admin session.
 *
 * The admin is provisioned as a member of an org literally named "Unify" so the
 * membership gate (`requireUnifyMember`) accepts them. The target is a fully
 * separate personal-workspace user with one assistant.
 *
 * Run: npx playwright test src/tests/impersonation/view-as.e2e.ts
 */

import { expect, test as base, type Page } from '@playwright/test';
import path from 'path';
import os from 'os';
import {
  createTestUser,
  cleanupUser,
  createOrg,
  deleteOrg,
  loginAndWaitForRedirect,
} from '../auth/helpers';
import { createAssistant, addMember, dbExec } from '../helpers/seeds/client';

// ---------------------------------------------------------------------------
// Seed (module scope, synchronous)
// ---------------------------------------------------------------------------

// Unify staff member — must belong to an org literally named "Unify" (the
// product convention the membership gate keys off). The org name is globally
// unique, so reuse an existing "Unify" org if one is already present (e.g. a
// live local stack) and otherwise create one.
const adminUser = createTestUser({ name: 'Staff', lastName: 'Member' });

const existingUnifyOrgId = dbExec(`SELECT id FROM organization WHERE name = 'Unify' LIMIT 1;`);
let unifyOrgId: number;
let createdUnifyOrg = false;
if (existingUnifyOrgId) {
  unifyOrgId = parseInt(existingUnifyOrgId, 10);
  // A plain Member is enough — the "View as user" gate only requires
  // membership, not Owner/Admin.
  addMember({ orgId: unifyOrgId, userId: adminUser.id, role: 'Member' });
} else {
  unifyOrgId = createOrg({ name: 'Unify', ownerId: adminUser.id }).id;
  createdUnifyOrg = true;
}

// Target customer — separate user, personal workspace, one assistant.
const targetUser = createTestUser({ name: 'Customer', lastName: 'Persona' });
createAssistant({
  userId: targetUser.id,
  firstName: 'Solo',
  surname: 'Helper',
});

// ---------------------------------------------------------------------------
// Auth fixture (login once as admin, reuse storageState)
// ---------------------------------------------------------------------------

let authFile: string | undefined;

const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, use, testInfo) => {
    if (!authFile) {
      testInfo.setTimeout(testInfo.timeout + 30_000);
      authFile = path.join(
        os.tmpdir(),
        `pw-impersonate-${adminUser.email.replace(/[^a-z0-9]/gi, '-')}.json`
      );
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await p.goto('/login');
      await loginAndWaitForRedirect(p, adminUser.email, adminUser.password, 30_000);
      if (p.url().includes('/login/onboarding')) {
        const personalBtn = p.getByTestId('workspace-personal');
        if (await personalBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await personalBtn.click();
          await p.getByTestId('workspace-continue').click();
          await p.waitForURL((u) => !u.pathname.includes('onboarding'), { timeout: 15_000 });
        }
      }
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

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

test.afterAll(() => {
  if (createdUnifyOrg) deleteOrg(unifyOrgId);
  cleanupUser(targetUser.id);
  cleanupUser(adminUser.id);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Unify member can view as another user and return', async ({ adminPage: page }) => {
  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });

  // Open the rail account menu and start impersonation.
  await page.getByTestId('rail-account-trigger').click();
  await page.getByTestId('view-as-user-menu-item').click();

  const dialog = page.getByTestId('impersonate-dialog');
  await expect(dialog).toBeVisible();

  await page.getByTestId('impersonate-email-input').fill(targetUser.email);
  await page.getByTestId('impersonate-lookup').click();

  // Resolved target preview shows the customer's email before confirming.
  // First hit can be slow while the dev server compiles the server action.
  const targetPreview = page.getByTestId('impersonate-target');
  await expect(targetPreview).toBeVisible({ timeout: 30_000 });
  await expect(targetPreview).toContainText(targetUser.email);

  await page.getByTestId('impersonate-confirm').click();

  // After the reload we are scoped to the target: banner + their assistant.
  const banner = page.getByTestId('impersonation-banner');
  await expect(banner).toBeVisible({ timeout: 30_000 });
  await expect(banner).toContainText('Customer');

  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Solo Helper').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('impersonation-banner')).toBeVisible();

  // Return to the original admin session.
  await page.getByTestId('impersonation-return').click();
  await expect(page.getByTestId('impersonation-banner')).toBeHidden({ timeout: 30_000 });

  // The target's assistant is no longer in view once we are back as the admin.
  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('impersonation-banner')).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText('Solo Helper')).toBeHidden({ timeout: 30_000 });
});
