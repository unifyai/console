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
  loginAndWaitForRedirect,
  completeAccountOnboardingIfPresent,
} from '../auth/helpers';
import { createAssistant, ensureUnifyOrg, deleteOrg } from '../helpers/seeds/client';
import { openUnitySwitcher } from '../assistants/helpers';
import {
  deferCoordinatorAfterAssistantsLoad,
  deferCoordinatorForUser,
  dismissCoordinatorOnboardingIfOpen,
} from '../helpers/coordinator';
import { assistantRail, railAccountTrigger, railUnitySwitcher } from '../helpers/shell';

// ---------------------------------------------------------------------------
// Seed (module scope, synchronous)
// ---------------------------------------------------------------------------

// Unify staff member — must belong to an org literally named "Unify" AND
// carry a unify.ai mailbox, the two signals the membership gate now keys off.
const adminUser = createTestUser({
  name: 'Staff',
  lastName: 'Member',
  email: `view-as-staff-${Date.now()}@unify.ai`,
});
const unifyOrg = ensureUnifyOrg({ memberId: adminUser.id });
const createdUnifyOrg = unifyOrg.ownerId === adminUser.id;

// Target customer — separate user, personal workspace, one assistant.
const targetUser = createTestUser({ name: 'Customer', lastName: 'Persona' });
const targetAssistant = createAssistant({
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
      await deferCoordinatorForUser(adminUser.id, adminUser.apiKey);
      await p.goto('/login');
      await loginAndWaitForRedirect(p, adminUser.email, adminUser.password, 30_000);
      await completeAccountOnboardingIfPresent(p);
      await p.goto('/assistants', { waitUntil: 'domcontentloaded' });
      await expect(assistantRail(p)).toBeVisible({ timeout: 20_000 });
      await deferCoordinatorAfterAssistantsLoad(p, adminUser.id, adminUser.apiKey);
      await dismissCoordinatorOnboardingIfOpen(p);
      await ctx.storageState({ path: authFile });
      await ctx.close();
    }
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
      } catch {
        /* private mode — ignore */
      }
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
});

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

test.afterAll(() => {
  if (createdUnifyOrg) deleteOrg(unifyOrg.id);
  cleanupUser(targetUser.id);
  cleanupUser(adminUser.id);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Unify member can view as another user and return', async ({ adminPage: page }) => {
  test.setTimeout(120_000);
  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });
  await deferCoordinatorAfterAssistantsLoad(page, adminUser.id, adminUser.apiKey);
  await dismissCoordinatorOnboardingIfOpen(page);

  // Open the rail account menu and start impersonation.
  await expect(railAccountTrigger(page)).toBeVisible({ timeout: 30_000 });
  await railAccountTrigger(page).click({ timeout: 15_000 });
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

  await deferCoordinatorForUser(targetUser.id, targetUser.apiKey);
  await page.goto(`/assistants?profile=${targetAssistant.agentId}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });
  await deferCoordinatorAfterAssistantsLoad(page, targetUser.id, targetUser.apiKey);
  await dismissCoordinatorOnboardingIfOpen(page);
  await openUnitySwitcher(page, { userId: targetUser.id, apiKey: targetUser.apiKey });
  await expect(page.getByTestId(`assistant-list-item-${targetAssistant.agentId}`)).toContainText(
    'Solo',
    {
      timeout: 30_000,
    }
  );
  await expect(page.getByTestId('impersonation-banner')).toBeVisible();

  // Return to the original admin session.
  await page.getByTestId('impersonation-return').click();
  await expect(page.getByTestId('impersonation-banner')).toBeHidden({ timeout: 30_000 });

  // The target's assistant is no longer in view once we are back as the admin.
  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('impersonation-banner')).toBeHidden({ timeout: 30_000 });
  await expect(railUnitySwitcher(page)).not.toContainText('Solo');
});
