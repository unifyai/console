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
  orchestraFetch,
} from './helpers';
import { loginAndWaitForRedirect } from '../auth/helpers';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function authenticate(page: Page, email: string, password: string) {
  async function tryDevQuickLogin(timeout: number): Promise<boolean> {
    const quickLoginPanel = page.getByTestId('dev-quick-login');
    await quickLoginPanel.waitFor({ state: 'visible', timeout });
    const quickLogin = quickLoginPanel.getByRole('button', {
      name: new RegExp(escapeRegex(email)),
    });
    await quickLogin.waitFor({ state: 'visible', timeout: 10_000 });
    await Promise.all([
      page.waitForURL((url) => url.pathname !== '/login', {
        timeout: 15_000,
        waitUntil: 'domcontentloaded',
      }),
      quickLogin.click(),
    ]);
    return true;
  }

  await page.goto('/login');

  try {
    await tryDevQuickLogin(5_000);
    return;
  } catch {
    /* fall back to email auth below */
  }

  try {
    await loginAndWaitForRedirect(page, email, password, 15_000);
  } catch (error) {
    try {
      await tryDevQuickLogin(20_000);
      return;
    } catch {
      throw error;
    }
  }
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
    await page.evaluate(async (orgId) => {
      await fetch('/api/session/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: String(orgId) }),
      });
    }, workspaceId);
  }

  await ctx.storageState({ path: stateFile });
  await ctx.close();
  return stateFile;
}

async function openAssistantMenu(page: Page, agentId: number) {
  const row = page.getByTestId(`assistant-list-item-${agentId}`);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.hover();
  await page.getByTestId(`assistant-menu-${agentId}`).click();
}

async function expectCoordinatorChatOpen(page: Page, agentId: number) {
  await page.getByTestId(`assistant-list-item-${agentId}`).click();
  await expect(page.getByTestId('coordinator-admin-only')).toHaveCount(0);
  await expect(page.getByTestId('right-pane-tab-chat')).toHaveAttribute('data-state', 'active');
}

/* eslint-disable @typescript-eslint/naming-convention */
async function seedCoordinatorWorkspace() {
  const contextRoot = `${owner.id}/${coordinator.agentId}`;
  const rows = [
    {
      context: `${contextRoot}/Coordinator/State`,
      entries: [
        {
          mode: 'active',
          started_at: '2026-05-01T10:00:00Z',
          ready_at: null,
        },
      ],
    },
    {
      context: `${contextRoot}/Coordinator/Checklist`,
      entries: [
        {
          item_id: 1,
          title: 'Invite operators',
          description: 'Add the people who receive assignments.',
          kind: 'team_setup',
          status: 'pending',
          created_at: '2026-05-01T10:00:00Z',
          updated_at: '2026-05-01T10:00:00Z',
        },
        {
          item_id: 2,
          title: 'Validate first run',
          description: null,
          kind: null,
          status: 'done',
          created_at: '2026-05-01T10:01:00Z',
          updated_at: '2026-05-01T10:01:00Z',
        },
      ],
    },
    {
      context: `${contextRoot}/Events/CoordinatorActivity`,
      entries: [
        {
          activity_id: 'activity-1',
          phase: 'progress',
          stage: 'proposal',
          surfaces: ['chat'],
          title: 'Drafting the teammate plan',
          summary: 'Collecting roles and handoff rules.',
          checklist_item_id: 1,
          chat_prompt: 'What roles have you found so far?',
          chat_prompt_label: 'Ask for roles',
          correlation_id: 'corr-1',
          occurred_at: '2026-05-01T10:03:00Z',
          status: 'ok',
          error: null,
        },
      ],
    },
  ];

  await Promise.all(
    rows.map(async (row) => {
      const res = await orchestraFetch(
        '/v0/logs',
        {
          method: 'POST',
          body: JSON.stringify({
            project_name: 'Assistants',
            context: row.context,
            entries: row.entries,
          }),
        },
        org.ownerOrgApiKey
      );
      if (!res.ok) {
        throw new Error(`Failed to seed Coordinator workspace: ${res.status} ${await res.text()}`);
      }
    })
  );
}
/* eslint-enable @typescript-eslint/naming-convention */

/* eslint-disable @typescript-eslint/naming-convention */
async function seedCoordinatorChecklistItem({
  itemId,
  title,
  description,
  kind,
}: {
  itemId: number;
  title: string;
  description: string;
  kind: string;
}) {
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${owner.id}/${coordinator.agentId}/Coordinator/Checklist`,
        entries: [
          {
            item_id: itemId,
            title,
            description,
            kind,
            status: 'pending',
            created_at: '2026-05-01T10:05:00Z',
            updated_at: '2026-05-01T10:05:00Z',
          },
        ],
      }),
    },
    org.ownerOrgApiKey
  );
  if (!res.ok) {
    throw new Error(`Failed to seed Coordinator checklist item: ${res.status} ${await res.text()}`);
  }
}

async function pushCoordinatorActivity(page: Page) {
  await page.evaluate(async (agentId) => {
    const response = await fetch(`/api/assistant/${agentId}/actions/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CoordinatorActivity',
        data: {
          id: 500,
          ts: '2026-05-01T10:05:01Z',
          entries: {
            eventId: 'event-live-integration-setup',
            activityId: 'activity-live-integration-setup',
            phase: 'progress',
            stage: 'integration_setup',
            surfaces: ['credentials'],
            title: 'Connecting Salesforce',
            summary: 'Checking the integration path before asking for access.',
            checklistItemId: 3,
            relatedEntities: [{ type: 'credential', id: 'salesforce', name: 'Salesforce' }],
            chatPrompt: 'Should I continue with Salesforce setup?',
            chatPromptLabel: 'Continue',
            correlationId: 'salesforce-integration-setup',
            occurredAt: '2026-05-01T10:05:00Z',
            status: 'ok',
            error: null,
          },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to push Coordinator activity: ${response.status}`);
    }
  }, coordinator.agentId);
}
/* eslint-enable @typescript-eslint/naming-convention */

async function expectPinnedBeforeSolo(page: Page) {
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
  try {
    deleteAllAssistantsForUser(owner.id);
    deleteAllAssistantsForUser(personalUser.id);
    deleteOrg(org.id);
  } catch {
    /* best effort */
  }
  cleanupUser(owner.id);
  cleanupUser(admin.id);
  cleanupUser(member.id);
  cleanupUser(personalUser.id);
});

test('owner sees the Coordinator pinned with workspace chrome and no contract teardown', async ({
  ownerPage: page,
}) => {
  await seedCoordinatorWorkspace();
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await expectPinnedBeforeSolo(page);

  const coordinatorRow = page.getByTestId(`assistant-list-item-${coordinator.agentId}`);
  await expect(coordinatorRow).toContainText('Coordinator');
  await expect(coordinatorRow.getByLabel('Coordinator')).toBeVisible();

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
  if ((await page.getByTestId('coordinator-workspace-panel').count()) === 0) {
    await page.getByTestId('assistant-info-button').click();
  }
  await expect(page.getByTestId('coordinator-workspace-panel')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('coordinator-workspace-name')).toContainText('Coordinator');
  await expect(page.getByTestId('coordinator-show-activity')).toHaveCount(0);
  const currentWorkCard = page.getByTestId('coordinator-current-work-card');
  await expect(currentWorkCard).toContainText('Drafting the teammate plan', { timeout: 15_000 });
  await expect(currentWorkCard.getByTestId('coordinator-current-work-loader')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Setup plan')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Invite operators')).toBeVisible({ timeout: 15_000 });

  await seedCoordinatorChecklistItem({
    itemId: 3,
    title: 'Connect Salesforce',
    description: 'Finish the integration setup choice.',
    kind: 'integration',
  });
  await pushCoordinatorActivity(page);

  await expect(currentWorkCard).toContainText('Connecting Salesforce', { timeout: 15_000 });
  await expect(currentWorkCard).toContainText('Integration setup', { timeout: 15_000 });
  await expect(page.getByText('Refreshing...')).toHaveCount(0, { timeout: 45_000 });
  await expect(page.getByText('Connect Salesforce')).toBeVisible({ timeout: 15_000 });
});

test('organization admin can open the Coordinator chat', async ({ adminPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await expectPinnedBeforeSolo(page);
  await expectCoordinatorChatOpen(page, coordinator.agentId);
});

test('organization member does not receive the Coordinator sidebar surface', async ({
  memberPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await expect(page.getByTestId(`assistant-list-item-${coordinator.agentId}`)).toHaveCount(0);
  await expect(page.getByTestId('assistant-list-group-pinned')).toHaveCount(0);
  await expect(page.getByTestId('coordinator-divider')).toHaveCount(0);
});

test('personal workspace does not show a Coordinator surface', async ({ personalPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await expect(page.getByTestId('coordinator-divider')).toHaveCount(0);
  const coordinatorCount = dbExec(
    `SELECT count(*) FROM assistants WHERE user_id = '${personalUser.id}' AND is_coordinator = TRUE`
  );
  expect(coordinatorCount).toBe('0');
});
