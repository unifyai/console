/**
 * Coordinator sidebar E2E verifies the Coordinator row renders as the
 * workspace configuration entry without exposing regular assistant teardown.
 *
 * Run: npx playwright test src/tests/assistants/coordinator-sidebar.e2e.ts
 */

import { test as base, expect, type Browser, type Page } from '@playwright/test';
import os from 'os';
import path from 'path';
import { railSection } from '../helpers/shell';
import {
  addMember,
  cleanupUser,
  closeHireDialogIfOpen,
  createAssistant,
  createOrg,
  createTestUser,
  dbExec,
  deferCoordinatorForUser,
  deferCoordinatorOnboarding,
  deleteAllAssistantsForUser,
  deleteOrg,
  ensureProjectSync,
  navigateToAssistants,
  openAssistantInfoPanel,
  openEditDialogFromList,
  openUnitySwitcher,
} from './helpers';
import { loginAndWaitForRedirect, completeAccountOnboardingIfPresent } from '../auth/helpers';

async function authenticate(page: Page, email: string, password: string) {
  const tryDevQuickLogin = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');
      }

      const quickLoginPanel = page.getByTestId('dev-quick-login');
      const quickLoginButton = quickLoginPanel.locator('button', { hasText: email }).first();
      const quickLoginVisible = await quickLoginButton
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      if (!quickLoginVisible) continue;

      await quickLoginButton.click();
      await page.waitForTimeout(500);

      if (new URL(page.url()).pathname === '/login') {
        await page.goto('/assistants');
        await page.waitForLoadState('domcontentloaded');
      }
      if (new URL(page.url()).pathname !== '/login') return true;
    }
    return false;
  };

  await page.goto('/login');
  if (await tryDevQuickLogin()) return;

  try {
    await loginAndWaitForRedirect(page, email, password, 30_000);
    return;
  } catch {
    await page.goto('/login');
    if (await tryDevQuickLogin()) return;
  }

  throw new Error(`Unable to authenticate test user ${email}`);
}

async function loginAndSaveWorkspaceState(
  browser: Browser,
  email: string,
  password: string,
  workspaceId: number | null
): Promise<string> {
  const stateFile = path.join(
    os.tmpdir(),
    `pw-coordinator-${email.replace(/[^a-z0-9]/gi, '-')}.json`
  );
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await authenticate(page, email, password);

  await completeAccountOnboardingIfPresent(page);

  if (workspaceId !== null) {
    const workspaceSwitch = await page.evaluate(async (orgId) => {
      const response = await fetch('/api/session/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: String(orgId) }),
      });
      return { ok: response.ok, status: response.status };
    }, workspaceId);
    if (!workspaceSwitch.ok) {
      throw new Error(`Failed to switch workspace session: ${workspaceSwitch.status}`);
    }
  }

  await ctx.storageState({ path: stateFile });
  await ctx.close();
  return stateFile;
}

async function expectCoordinatorChatOpen(page: Page, agentId: number) {
  await openUnitySwitcher(page);
  await page.getByTestId(`assistant-list-item-${agentId}`).click();
  await expect(page.getByTestId('coordinator-private')).toHaveCount(0);
  await expect(railSection(page, 'chat')).toHaveAttribute('aria-current', 'page');
}

async function expectPinnedBeforeSolo(page: Page) {
  await openUnitySwitcher(page);
  await expect(page.getByTestId('assistant-list-group-pinned')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('assistant-list-section-solo')).toBeVisible({
    timeout: 10_000,
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const pinned = document.querySelector('[data-testid="assistant-list-group-pinned"]');
        const solo = document.querySelector('[data-testid="assistant-list-section-solo"]');
        if (!pinned || !solo) return false;
        return Boolean(pinned.compareDocumentPosition(solo) & Node.DOCUMENT_POSITION_FOLLOWING);
      })
    )
    .toBe(true);
}

const owner = createTestUser({
  name: 'CoordOwner',
  lastName: 'E2E',
  credits: 50_000,
});
const admin = createTestUser({
  name: 'CoordAdmin',
  lastName: 'E2E',
  credits: 50_000,
});
const member = createTestUser({
  name: 'CoordMember',
  lastName: 'E2E',
  credits: 50_000,
});
const personalUser = createTestUser({
  name: 'CoordPersonal',
  lastName: 'E2E',
  credits: 50_000,
});

const org = createOrg({
  name: `CoordSidebar_${Date.now()}`,
  ownerId: owner.id,
});
addMember({ orgId: org.id, userId: admin.id, role: 'Admin' });
addMember({ orgId: org.id, userId: member.id, role: 'Member' });
ensureProjectSync(org.ownerOrgApiKey);
ensureProjectSync(personalUser.apiKey);

// The owner's workspace Coordinator is provisioned with the org, mirroring
// Orchestra's `_create_organization_with_owner_coordinator`.
const coordinator = org.coordinator;
const regularAssistant = createAssistant({
  userId: owner.id,
  orgId: org.id,
  firstName: 'Regular',
  surname: 'Colleague',
});
const existingPersonalCoordinatorId = dbExec(
  `SELECT agent_id FROM assistants WHERE user_id = '${personalUser.id}' AND organization_id IS NULL AND is_coordinator = TRUE ORDER BY agent_id DESC LIMIT 1`
);
const personalCoordinator =
  existingPersonalCoordinatorId && Number.isFinite(parseInt(existingPersonalCoordinatorId, 10))
    ? { agentId: parseInt(existingPersonalCoordinatorId, 10) }
    : createAssistant({
        userId: personalUser.id,
        firstName: 'Personal',
        surname: 'Guide',
        isCoordinator: true,
      });

let ownerAuthFile: string | undefined;
let adminAuthFile: string | undefined;
let memberAuthFile: string | undefined;
let personalAuthFile: string | undefined;

const test = base.extend<{
  ownerPage: Page;
  adminPage: Page;
  memberPage: Page;
  personalPage: Page;
}>({
  ownerPage: async ({ browser }, use, testInfo) => {
    if (!ownerAuthFile) {
      testInfo.setTimeout(testInfo.timeout + 30_000);
      ownerAuthFile = await loginAndSaveWorkspaceState(
        browser,
        owner.email,
        owner.password,
        org.id
      );
    }
    const ctx = await browser.newContext({ storageState: ownerAuthFile });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
  adminPage: async ({ browser }, use, testInfo) => {
    if (!adminAuthFile) {
      testInfo.setTimeout(testInfo.timeout + 30_000);
      adminAuthFile = await loginAndSaveWorkspaceState(
        browser,
        admin.email,
        admin.password,
        org.id
      );
    }
    const ctx = await browser.newContext({ storageState: adminAuthFile });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
  memberPage: async ({ browser }, use, testInfo) => {
    if (!memberAuthFile) {
      testInfo.setTimeout(testInfo.timeout + 30_000);
      memberAuthFile = await loginAndSaveWorkspaceState(
        browser,
        member.email,
        member.password,
        org.id
      );
    }
    const ctx = await browser.newContext({ storageState: memberAuthFile });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
  personalPage: async ({ browser }, use, testInfo) => {
    if (!personalAuthFile) {
      testInfo.setTimeout(testInfo.timeout + 30_000);
      personalAuthFile = await loginAndSaveWorkspaceState(
        browser,
        personalUser.email,
        personalUser.password,
        null
      );
    }
    const ctx = await browser.newContext({ storageState: personalAuthFile });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
});

test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

// A freshly provisioned Coordinator resolves with ``onboarding_active: true``
// and ``intro_watched: false``, which renders the full-screen onboarding overlay
// (``data-testid="coordinator-onboarding"``, ``absolute inset-0 z-50``) that
// intercepts every pointer event. This suite drives the regular two-pane shell
// (rail switcher, list groups), so pause onboarding for the canonical
// coordinators it views up front — exactly as ``createAssistantTest`` does for
// the standard flows.
test.beforeAll(async () => {
  await deferCoordinatorForUser(owner.id, org.ownerOrgApiKey);
  await deferCoordinatorOnboarding(personalUser.apiKey, personalCoordinator.agentId);
});

test.afterAll(() => {
  const cleanupSteps: Array<() => void> = [
    () => deleteAllAssistantsForUser(owner.id),
    () => deleteAllAssistantsForUser(admin.id),
    () => deleteAllAssistantsForUser(member.id),
    () => deleteAllAssistantsForUser(personalUser.id),
    () => deleteOrg(org.id),
    () => cleanupUser(owner.id),
    () => cleanupUser(admin.id),
    () => cleanupUser(member.id),
    () => cleanupUser(personalUser.id),
  ];
  for (const cleanupStep of cleanupSteps) {
    try {
      cleanupStep();
    } catch {
      /* best effort */
    }
  }
});

test('owner sees the Coordinator pinned with workspace chrome and no contract teardown @critical @area(assistants.coordinator)', async ({
  ownerPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await expectPinnedBeforeSolo(page);

  const coordinatorRow = page.getByTestId(`assistant-list-item-${coordinator.agentId}`);
  await expect(coordinatorRow).toContainText('T-W1N');
  await expect(coordinatorRow.getByLabel('T-W1N')).toBeVisible();

  await openEditDialogFromList(page, coordinator.agentId);
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^End contract$/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close Edit Dialog' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await openEditDialogFromList(page, regularAssistant.agentId);
  await expect(page.getByRole('button', { name: /^End contract$/ })).toBeVisible({
    timeout: 5_000,
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expectCoordinatorChatOpen(page, coordinator.agentId);
  await openAssistantInfoPanel(page);
  await expect(page.getByTestId('assistant-info-tab-onboarding')).toContainText('Onboarding');
  await expect(page.getByTestId('assistant-info-tab-profile')).toContainText('Profile');
});

test('organization admin and member cannot access another user coordinator in org workspace @critical @area(assistants.coordinator)', async ({
  adminPage,
  memberPage,
}) => {
  for (const page of [adminPage, memberPage]) {
    await navigateToAssistants(page);
    await closeHireDialogIfOpen(page);
    await openUnitySwitcher(page);
    await expect(page.getByTestId(`assistant-list-item-${coordinator.agentId}`)).toHaveCount(0);
    await expect(page.getByTestId(`assistant-list-item-${regularAssistant.agentId}`)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId(`assistant-list-item-${regularAssistant.agentId}`).click();
    await expect(page.getByTestId('coordinator-private')).toHaveCount(0);
  }
});

test('personal workspace shows the personal Coordinator surface @critical @area(assistants.coordinator)', async ({
  personalPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  await expect(page.getByTestId(`assistant-list-item-${personalCoordinator.agentId}`)).toBeVisible({
    timeout: 15_000,
  });
  await expectCoordinatorChatOpen(page, personalCoordinator.agentId);
  await openEditDialogFromList(page, personalCoordinator.agentId);
  await expect(page.getByRole('button', { name: /^End contract$/ })).toHaveCount(0);
  await page.keyboard.press('Escape');

  const coordinatorCount = dbExec(
    `SELECT count(*) FROM assistants WHERE user_id = '${personalUser.id}' AND organization_id IS NULL AND is_coordinator = TRUE`
  );
  expect(coordinatorCount).toBe('1');
});
