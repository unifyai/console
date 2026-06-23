/**
 * Coordinator sidebar E2E verifies the Coordinator row renders as the
 * workspace configuration entry without exposing regular assistant teardown.
 *
 * Run: npx playwright test src/tests/assistants/coordinator-sidebar.e2e.ts
 */

import { test as base, expect, type Browser, type Page } from '@playwright/test';
import os from 'os';
import path from 'path';
import {
  addMember,
  cleanupUser,
  closeHireDialogIfOpen,
  createAssistant,
  createOrg,
  createTestUser,
  dbExec,
  deleteAllAssistantsForUser,
  deleteOrg,
  ensureProjectSync,
  navigateToAssistants,
  openDroidSwitcher,
} from './helpers';
import { loginAndWaitForRedirect } from '../auth/helpers';

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

  if (page.url().includes('/login/onboarding')) {
    const personalButton = page.getByTestId('workspace-personal');
    if (await personalButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await personalButton.click();
      await page.getByTestId('workspace-continue').click();
      await page.waitForURL((url) => !url.pathname.includes('onboarding'), {
        timeout: 15_000,
      });
    } else {
      await page.waitForURL((url) => !url.pathname.includes('onboarding'), {
        timeout: 15_000,
      });
    }
  }

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

async function openAssistantMenu(page: Page, agentId: number) {
  await openDroidSwitcher(page);
  const row = page.getByTestId(`assistant-list-item-${agentId}`);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.hover();
  await page.getByTestId(`assistant-menu-${agentId}`).click();
}

async function expectCoordinatorChatOpen(page: Page, agentId: number) {
  await openDroidSwitcher(page);
  await page.getByTestId(`assistant-list-item-${agentId}`).click();
  await expect(page.getByTestId('coordinator-private')).toHaveCount(0);
  await expect(page.getByTestId('rail-section-chat')).toHaveAttribute('aria-current', 'page');
}

async function expectPinnedBeforeSolo(page: Page) {
  await openDroidSwitcher(page);
  await expect(page.getByTestId('assistant-list-group-pinned')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('assistant-list-section-solo')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId('coordinator-divider')).toBeVisible({
    timeout: 10_000,
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const pinned = document.querySelector('[data-testid="assistant-list-group-pinned"]');
        const divider = document.querySelector('[data-testid="coordinator-divider"]');
        const solo = document.querySelector('[data-testid="assistant-list-section-solo"]');
        if (!pinned || !divider || !solo) return false;
        return Boolean(
          pinned.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING &&
          divider.compareDocumentPosition(solo) & Node.DOCUMENT_POSITION_FOLLOWING
        );
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

const coordinator = createAssistant({
  userId: owner.id,
  orgId: org.id,
  firstName: 'Atlas',
  surname: 'Guide',
  isCoordinator: true,
});
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

test('owner sees the Coordinator pinned with workspace chrome and no contract teardown', async ({
  ownerPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await expectPinnedBeforeSolo(page);

  const coordinatorRow = page.getByTestId(`assistant-list-item-${coordinator.agentId}`);
  await expect(coordinatorRow).toContainText('T-W1N');
  await expect(coordinatorRow.getByLabel('T-W1N')).toBeVisible();

  await openAssistantMenu(page, coordinator.agentId);
  await expect(page.getByTestId('menu-end-contract')).toHaveCount(0);
  await page.getByTestId('menu-edit-profile').click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^End contract$/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close Edit Dialog' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await openAssistantMenu(page, regularAssistant.agentId);
  await expect(page.getByTestId('menu-end-contract')).toBeVisible({
    timeout: 5_000,
  });
  await page.keyboard.press('Escape');

  await expectCoordinatorChatOpen(page, coordinator.agentId);
  await page.getByTestId('assistant-info-button').click();
  await expect(page.getByTestId('assistant-info-tab-onboarding')).toContainText('Onboarding');
  await expect(page.getByTestId('assistant-info-tab-contact')).toContainText('Contact info');
});

test('organization admin cannot access another user coordinator in org workspace', async ({
  adminPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openDroidSwitcher(page);
  await expect(page.getByTestId(`assistant-list-item-${coordinator.agentId}`)).toHaveCount(0);
  await expect(page.getByTestId(`assistant-list-item-${regularAssistant.agentId}`)).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId(`assistant-list-item-${regularAssistant.agentId}`).click();
  await expect(page.getByTestId('coordinator-private')).toHaveCount(0);
});

test('organization member cannot access another user coordinator in org workspace', async ({
  memberPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openDroidSwitcher(page);
  await expect(page.getByTestId(`assistant-list-item-${coordinator.agentId}`)).toHaveCount(0);
  await expect(page.getByTestId(`assistant-list-item-${regularAssistant.agentId}`)).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId(`assistant-list-item-${regularAssistant.agentId}`).click();
  await expect(page.getByTestId('coordinator-private')).toHaveCount(0);
  await openDroidSwitcher(page);
  await page.getByTestId(`assistant-list-item-${regularAssistant.agentId}`).hover();
  const memberMenuTrigger = page.getByTestId(`assistant-menu-${regularAssistant.agentId}`);
  const hasMenuTrigger = (await memberMenuTrigger.count()) > 0;
  if (hasMenuTrigger) {
    await openAssistantMenu(page, regularAssistant.agentId);
    await expect(page.getByTestId('menu-end-contract')).toHaveCount(0);
    await page.keyboard.press('Escape');
  } else {
    await expect(memberMenuTrigger).toHaveCount(0);
  }
});

test('personal workspace shows the personal Coordinator surface', async ({
  personalPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openDroidSwitcher(page);

  await expect(page.getByTestId(`assistant-list-item-${personalCoordinator.agentId}`)).toBeVisible({
    timeout: 15_000,
  });
  await expectCoordinatorChatOpen(page, personalCoordinator.agentId);
  await openAssistantMenu(page, personalCoordinator.agentId);
  await expect(page.getByTestId('menu-end-contract')).toHaveCount(0);
  await page.keyboard.press('Escape');

  const coordinatorCount = dbExec(
    `SELECT count(*) FROM assistants WHERE user_id = '${personalUser.id}' AND organization_id IS NULL AND is_coordinator = TRUE`
  );
  expect(coordinatorCount).toBe('1');
});
