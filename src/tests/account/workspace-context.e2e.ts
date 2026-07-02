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
} from './helpers';
import { deferCoordinatorOnboarding, getCoordinatorAgentId } from '../helpers/coordinator';
import { ensureUnifyOrg } from '../helpers/seeds/client';

const user = createTestUser({ name: 'WsCtx', lastName: 'Test', credits: 5_000 });
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
  await page.getByTestId('rail-account-trigger').click();
  const menu = page.getByTestId('rail-account-menu');
  await expect(menu).toBeVisible({ timeout: 5_000 });
  await menu.getByRole('menuitem', { name: label }).click();
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.find((c) => c.name === 'unify_workspace_id')?.value ?? '';
    })
    .not.toBe('');
}

test('personal and org workspaces expose distinct API keys', async () => {
  const personalKey = getUserApiKeyFromDb(user.id);
  const orgKey = getUserApiKeyFromDb(user.id, org.id);

  expect(personalKey).toBeTruthy();
  expect(orgKey).toBeTruthy();
  expect(personalKey).not.toBe(orgKey);
});

test('switching to personal workspace via rail sets the workspace cookie', async ({
  authedPage: page,
}) => {
  await navigateToAppShellRoute(page, '/assistants', shellOpts);
  await expect(page.getByTestId('assistant-rail')).toBeVisible({ timeout: 20_000 });

  await switchWorkspaceViaRail(page, personalWorkspaceLabel);

  const cookies = await page.context().cookies();
  const wsCookie = cookies.find((c) => c.name === 'unify_workspace_id');
  expect(wsCookie?.value).toBe('personal');
});

test('workspace cookie persists across navigation', async ({ authedPage: page }) => {
  await navigateToAppShellRoute(page, '/assistants', shellOpts);
  await expect(page.getByTestId('assistant-rail')).toBeVisible({ timeout: 20_000 });

  await switchWorkspaceViaRail(page, personalWorkspaceLabel);
  await navigateToAppShellRoute(page, '/account?tab=profile', shellOpts);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible({ timeout: 15_000 });

  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'unify_workspace_id')?.value).toBe('personal');
});

test('switching to org workspace returns org billing balance', async ({ authedPage: page }) => {
  await navigateToAppShellRoute(page, '/assistants', shellOpts);
  await expect(page.getByTestId('assistant-rail')).toBeVisible({ timeout: 20_000 });

  await switchWorkspaceViaRail(page, org.name);

  const balance = await page.evaluate(async () => {
    const res = await fetch('/api/billing/balance');
    if (!res.ok) return null;
    const data = await res.json();
    return data.balance as number;
  });

  const orgCredits = dbExec(
    `SELECT credits FROM billing_account WHERE id = (SELECT billing_account_id FROM organization WHERE id = ${org.id})`
  );
  expect(balance).toBeCloseTo(parseFloat(orgCredits), 0);
});

test('locked org users still see org assistants with a personal workspace cookie', async ({
  authedPage: page,
}) => {
  await navigateToAppShellRoute(page, '/assistants', shellOpts);
  await expect(page.getByTestId('assistant-rail')).toBeVisible({ timeout: 20_000 });

  await switchWorkspaceViaRail(page, personalWorkspaceLabel);

  await openUnitySwitcher(page, shellOpts);
  await expect(
    page.getByText(`${lockedOrgAssistant.firstName} ${lockedOrgAssistant.surname}`)
  ).toBeVisible({ timeout: 10_000 });
});
