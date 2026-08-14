/**
 * Workspace Context E2E — switching workspace via rail menu, verifying cookie
 * persistence and org-scoped billing data.
 *
 * Run: npx playwright test src/tests/account/workspace-context.e2e.ts
 */

import { expect } from '@playwright/test';
import { openUnitySwitcher } from '../assistants/helpers';
import {
  createTestUser,
  cleanupUser,
  createAccountTest,
  createOrg,
  createAssistant,
  deleteOrg,
  getUserApiKeyFromDb,
  dbExec,
  navigateToAppShellRoute,
  switchWorkspaceViaApi,
} from './helpers';
import {
  deferCoordinatorOnboarding,
  deferCoordinatorAfterAssistantsLoad,
  dismissCoordinatorOnboardingIfOpen,
  getCoordinatorAgentId,
} from '../helpers/coordinator';
import { assistantRail, railAccountTrigger, waitForAssistantsRail } from '../helpers/shell';
import { ensureUnifyOrg } from '../helpers/seeds/client';

// Unify staff member — the workspace org-lock exempts only users with both a
// unify.ai mailbox and Unify org membership, and this spec needs free
// switching between the personal and org workspaces.
const user = createTestUser({
  name: 'WsCtx',
  lastName: 'Test',
  credits: 5_000,
  email: `ws-ctx-staff-${Date.now()}@unify.ai`,
});
ensureUnifyOrg({ memberId: user.id });
const org = createOrg({ name: `WsOrg-${user.id.slice(0, 8)}`, ownerId: user.id, credits: 12_000 });
const lockedOrgAssistant = createAssistant({
  userId: user.id,
  orgId: org.id,
  firstName: 'Locked',
  surname: 'Workspace',
});

const test = createAccountTest(user);
test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

const shellOpts = { userId: user.id, apiKey: user.apiKey };

test.beforeAll(async () => {
  const coordinatorId = getCoordinatorAgentId(user.id);
  if (coordinatorId !== null) {
    await deferCoordinatorOnboarding(user.apiKey, coordinatorId);
  }
});

test.afterAll(() => {
  deleteOrg(org.id);
  cleanupUser(user.id);
});

const personalWorkspaceLabel = `${user.name} ${user.lastName}`;

async function switchWorkspaceViaRail(page: import('@playwright/test').Page, label: string) {
  await navigateToAppShellRoute(page, '/assistants', shellOpts);
  await dismissCoordinatorOnboardingIfOpen(page);
  const accountTrigger = railAccountTrigger(page);
  await expect(accountTrigger).toBeVisible({ timeout: 15_000 });
  await accountTrigger.click({ timeout: 15_000 });
  const menu = page.locator('[data-testid="rail-account-menu"]:visible');
  await expect(menu).toBeVisible({ timeout: 5_000 });
  await menu.getByRole('menuitem', { name: label }).click();
  await expect
    .poll(
      async () => {
        const cookies = await page.context().cookies();
        return cookies.find((c) => c.name === 'unify_workspace_id')?.value ?? '';
      },
      { timeout: 15_000 }
    )
    .not.toBe('');
}

test('personal and org workspaces expose distinct API keys', async () => {
  const personalKey = getUserApiKeyFromDb(user.id);
  const orgKey = getUserApiKeyFromDb(user.id, org.id);

  expect(personalKey).toBeTruthy();
  expect(orgKey).toBeTruthy();
  expect(personalKey).not.toBe(orgKey);
});

test('switching to personal workspace sets a cookie that persists across navigation', async ({
  authedPage: page,
}) => {
  await navigateToAppShellRoute(page, '/assistants', shellOpts);
  await waitForAssistantsRail(page);

  // Establish a non-personal cookie via the API, then verify the rail can switch back.
  await switchWorkspaceViaApi(page, org.id);
  await switchWorkspaceViaRail(page, personalWorkspaceLabel);
  await navigateToAppShellRoute(page, '/account?tab=profile', shellOpts);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible({ timeout: 15_000 });

  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'unify_workspace_id')?.value).toBe('personal');
});

test('switching to org workspace returns org billing balance @push @critical @area(workspace)', async ({
  authedPage: page,
}) => {
  await navigateToAppShellRoute(page, '/assistants', shellOpts);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });

  await switchWorkspaceViaRail(page, org.name);

  const balance = await page.evaluate(async () => {
    const res = await fetch('/api/billing/balance');
    if (!res.ok) return null;
    const data = await res.json();
    return data.balance as string | number;
  });

  const orgCredits = dbExec(
    `SELECT credits FROM billing_account WHERE id = (SELECT billing_account_id FROM organization WHERE id = ${org.id})`
  );
  expect(parseFloat(String(balance))).toBeCloseTo(parseFloat(orgCredits), 0);
});

test('locked org users still see org assistants with a personal workspace cookie', async ({
  authedPage: page,
}) => {
  await navigateToAppShellRoute(page, '/assistants', shellOpts);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });

  await switchWorkspaceViaRail(page, personalWorkspaceLabel);

  await openUnitySwitcher(page, shellOpts);
  await expect(
    page.getByText(`${lockedOrgAssistant.firstName} ${lockedOrgAssistant.surname}`)
  ).toBeVisible({ timeout: 10_000 });
});
